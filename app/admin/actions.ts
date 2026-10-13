"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth";
import { slugify, randomSuffix } from "@/lib/utils";
import {
  JOB_STATUSES,
  UNIQUE_VIOLATION,
  insertJobWithUniqueSlug,
  oneOf,
  parseJobFields,
  str,
} from "@/lib/job-form";
import {
  notifyJobDecision,
  notifyApplicationStatusChanged,
  notifyNewJobSubscribers,
} from "@/lib/notify";
import type { ApplicationStatus, JobStatus } from "@/types/database";

const APPLICATION_STATUSES: ApplicationStatus[] = [
  "pending",
  "under_review",
  "shortlisted",
  "rejected",
  "hired",
];

/**
 * `return_to` arrives in the form body, so it is caller-controlled. Confining it
 * to a same-site absolute path stops it being used as an off-site redirect —
 * `//evil.com` and `https://evil.com` are both rejected, since a bare
 * protocol-relative URL is a valid redirect target.
 */
function safeReturnTo(value: string | null): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/admin";
  return value;
}

/** Publishing touches the public surface, so refresh it too. */
function revalidatePublic(jobId?: string) {
  revalidatePath("/admin");
  revalidatePath("/admin/jobs");
  revalidatePath("/admin/moderation");
  if (jobId) revalidatePath(`/admin/jobs/${jobId}/edit`);
  revalidatePath("/jobs");
  revalidatePath("/");
}

/**
 * Moves a listing through the review queue. This is the only route from
 * pending_review to published, so it is the only way anything reaches /jobs.
 */
export async function setJobStatus(formData: FormData) {
  const { supabase } = await requireProfile("admin");

  const jobId = str(formData, "job_id");
  const status = str(formData, "status");
  const returnTo = safeReturnTo(str(formData, "return_to"));

  if (!jobId || !status || !(JOB_STATUSES as string[]).includes(status)) {
    redirect(`${returnTo}?error=Invalid+request`);
  }

  const { data: job, error } = await supabase
    .from("jobs")
    .update({
      status: status as JobStatus,
      // A published listing carrying an old rejection reason would show the
      // employer "sent back: …" under a live role.
      ...(status === "published" ? { rejection_reason: null } : {}),
    })
    .eq("id", jobId)
    .select("title")
    .single();

  if (error) redirect(`${returnTo}?error=${encodeURIComponent(error.message)}`);

  if (status === "published") {
    const title = (job as { title: string }).title;
    await notifyJobDecision(jobId, title, "published");
    await notifyNewJobSubscribers(title);
  }

  revalidatePublic(jobId);
  redirect(`${returnTo}?updated=${status}`);
}

/**
 * Rejects a listing, with the reason the employer will read.
 *
 * Back to `draft` rather than `closed`: rejection is "fix this and try again",
 * and a draft is the only status the employer can edit and resubmit from. The
 * reason is stored on the row (migration 017) and rendered on their My Jobs page
 * — the brief says it is "sent back to the employer", and until this product
 * sends email, showing it where they work is what that means.
 */
export async function rejectJob(formData: FormData) {
  const { supabase } = await requireProfile("admin");

  const jobId = str(formData, "job_id");
  const reason = str(formData, "rejection_reason");
  const returnTo = safeReturnTo(str(formData, "return_to"));

  if (!jobId) redirect(`${returnTo}?error=Invalid+request`);
  if (!reason) {
    redirect(
      `${returnTo}?error=${encodeURIComponent(
        "A reason is required when rejecting a listing."
      )}`
    );
  }

  const { data: job, error } = await supabase
    .from("jobs")
    .update({ status: "draft", rejection_reason: reason })
    .eq("id", jobId)
    .select("title")
    .single();

  if (error) redirect(`${returnTo}?error=${encodeURIComponent(error.message)}`);

  await notifyJobDecision(jobId, (job as { title: string }).title, "rejected", reason);

  revalidatePublic(jobId);
  redirect(`${returnTo}?updated=rejected`);
}

/**
 * Suspends or reinstates an account (brief §10).
 *
 * A timestamp, not a flag, so "when" is recorded. The database enforces that
 * only an admin can write it (guard_suspension, migration 017), and a suspended
 * company's listings stop being publicly visible through the rewritten
 * jobs_select_published policy — not through anything this action does. So a
 * suspension holds even against a direct API call.
 */
export async function setSuspended(formData: FormData) {
  const { supabase } = await requireProfile("admin");

  const table = str(formData, "table");
  const id = str(formData, "id");
  const suspend = formData.get("suspend") === "true";
  const returnTo = safeReturnTo(str(formData, "return_to"));

  if (!id || (table !== "profiles" && table !== "companies")) {
    redirect(`${returnTo}?error=Invalid+request`);
  }

  const { error } = await supabase
    .from(table as "profiles" | "companies")
    .update({ suspended_at: suspend ? new Date().toISOString() : null })
    .eq("id", id);

  if (error) redirect(`${returnTo}?error=${encodeURIComponent(error.message)}`);

  // A suspended employer's listings leave /jobs, so the public surface changes.
  revalidatePublic();
  revalidatePath("/admin/employers");
  revalidatePath("/admin/seekers");
  redirect(`${returnTo}?updated=${suspend ? "suspended" : "reinstated"}`);
}

/**
 * Verification drives the badge on job cards. A database trigger blocks users
 * from setting it on themselves (migration 001); this is the sanctioned path.
 */
export async function setCompanyVerified(formData: FormData) {
  const { supabase } = await requireProfile("admin");

  const companyId = str(formData, "company_id");
  const verified = formData.get("verified") === "true";
  const returnTo = safeReturnTo(str(formData, "return_to"));

  if (!companyId) redirect(`${returnTo}?error=Invalid+request`);

  const { error } = await supabase
    .from("companies")
    .update({ verified })
    .eq("id", companyId);

  if (error) redirect(`${returnTo}?error=${encodeURIComponent(error.message)}`);

  revalidatePublic();
  redirect(`${returnTo}?updated=verification`);
}

/**
 * Finds or creates the company a listing belongs to.
 *
 * PAC Africa collects most jobs directly from employers who have no account on
 * the site — that was true of the old WordPress install too, where only two
 * real users existed. So an admin can name an employer and get a company record
 * with `owner_id` NULL. If that employer later registers, an admin can attach
 * the account by setting owner_id.
 */
async function resolveCompany(
  supabase: Awaited<ReturnType<typeof requireProfile>>["supabase"],
  formData: FormData
): Promise<{ companyId: string | null } | { error: string }> {
  const existing = str(formData, "company_id");
  if (existing) return { companyId: existing };

  const name = str(formData, "new_company_name");
  if (!name) {
    // Allowed: the listing shows "Confidential employer".
    return { companyId: null };
  }

  const verified = formData.get("new_company_verified") === "on";

  for (let attempt = 0; attempt < 2; attempt++) {
    const slug = attempt === 0 ? slugify(name) : `${slugify(name)}-${randomSuffix()}`;
    const { data, error } = await supabase
      .from("companies")
      .insert({ name, slug, owner_id: null, verified })
      .select("id")
      .single();

    if (!error && data) return { companyId: data.id };
    if (error && error.code !== UNIQUE_VIOLATION) return { error: error.message };
  }
  return { error: "Could not create the employer record." };
}

/**
 * Admin posts a job directly. Unlike the employer form this can publish in one
 * step — an admin entering a job they were sent by phone or email has already
 * done the reviewing, so routing it through their own queue is busywork.
 */
export async function createJobAsAdmin(formData: FormData) {
  const { supabase, userId } = await requireProfile("admin");

  const fields = parseJobFields(formData);
  if (!fields) {
    redirect("/admin/jobs/new?error=Title+and+description+are+required");
  }

  const company = await resolveCompany(supabase, formData);
  if ("error" in company) {
    redirect(`/admin/jobs/new?error=${encodeURIComponent(company.error)}`);
  }

  const status = oneOf(str(formData, "status"), JOB_STATUSES, "published");

  const result = await insertJobWithUniqueSlug(fields.title, (slug) =>
    supabase
      .from("jobs")
      .insert({
        ...fields,
        slug,
        company_id: company.companyId,
        posted_by: userId,
        status,
        is_featured: formData.get("is_featured") === "on",
      })
      .select("id")
      .single()
  );

  if ("error" in result) {
    redirect(`/admin/jobs/new?error=${encodeURIComponent(result.error)}`);
  }

  revalidatePublic(result.id);
  redirect(`/admin/jobs?created=${status}`);
}

/**
 * Deletes a listing permanently.
 *
 * `applications.job_id` and `saved_jobs.job_id` are both `on delete cascade`, so
 * this destroys every application submitted to the job — not just the listing.
 * That is real applicant data, of the same kind we spent this rebuild
 * recovering, so a listing with applicants requires an explicit acknowledgement
 * naming the count. Closing a role is the usual answer; deleting is for spam,
 * duplicates and test posts.
 *
 * Only admins reach this: RLS gives DELETE on jobs to `jobs_admin_all` alone,
 * and requireProfile('admin') redirects anyone else before we get here.
 */
export async function deleteJob(formData: FormData) {
  const { supabase } = await requireProfile("admin");

  const jobId = str(formData, "job_id");
  const acknowledged = formData.get("acknowledge_applications") === "on";
  if (!jobId) redirect("/admin/jobs?error=Invalid+request");

  const [{ data: job }, { count }] = await Promise.all([
    supabase.from("jobs").select("title").eq("id", jobId).single(),
    supabase
      .from("applications")
      .select("id", { count: "exact", head: true })
      .eq("job_id", jobId),
  ]);

  if (!job) redirect("/admin/jobs?error=That+listing+no+longer+exists");

  const applicants = count ?? 0;
  if (applicants > 0 && !acknowledged) {
    redirect(
      `/admin/jobs/${jobId}/edit?error=${encodeURIComponent(
        `This listing has ${applicants} application${applicants === 1 ? "" : "s"}, which would be deleted with it. Tick the confirmation box to proceed, or set the status to Closed instead.`
      )}`
    );
  }

  const { error } = await supabase.from("jobs").delete().eq("id", jobId);
  if (error) {
    redirect(`/admin/jobs/${jobId}/edit?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePublic();
  redirect(
    `/admin/jobs?deleted=${encodeURIComponent(
      (job as { title: string }).title
    )}&lost=${applicants}`
  );
}

/** Admin edits any listing, including its status. */
export async function updateJob(formData: FormData) {
  const { supabase } = await requireProfile("admin");

  const jobId = str(formData, "job_id");
  if (!jobId) redirect("/admin/jobs?error=Invalid+request");

  const fields = parseJobFields(formData);
  if (!fields) {
    redirect(`/admin/jobs/${jobId}/edit?error=Title+and+description+are+required`);
  }

  const status = oneOf(str(formData, "status"), JOB_STATUSES, "pending_review");

  const { error } = await supabase
    .from("jobs")
    .update({
      ...fields,
      status,
      is_featured: formData.get("is_featured") === "on",
    })
    .eq("id", jobId);

  if (error) {
    redirect(`/admin/jobs/${jobId}/edit?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePublic(jobId);
  redirect(`/admin/jobs/${jobId}/edit?saved=1`);
}

/**
 * Admin override of an application's stage. `applications_admin_all` (migration
 * 004) already grants admin unrestricted UPDATE, so this needs no new RLS —
 * it's the same shape as the employer's `setApplicationStatus`, scoped to
 * admin and returning into `/admin/applications` instead.
 */
export async function setApplicationStatusAdmin(formData: FormData) {
  const { supabase } = await requireProfile("admin");

  const applicationId = str(formData, "application_id");
  const status = str(formData, "status");
  const returnTo = safeReturnTo(str(formData, "return_to"));

  if (!applicationId) redirect(`${returnTo}?error=Invalid+request`);

  const note = str(formData, "employer_note");
  const join = returnTo.includes("?") ? "&" : "?";

  const patch: { status?: ApplicationStatus; employer_note?: string | null } = {};
  if (status) patch.status = oneOf(status, APPLICATION_STATUSES, "pending");
  if (formData.has("employer_note")) patch.employer_note = note;

  if (Object.keys(patch).length === 0) redirect(returnTo);

  const { data: updated, error } = await supabase
    .from("applications")
    .update(patch)
    .eq("id", applicationId)
    .select("applicant_email, wp_job_title, job:jobs(title)")
    .single();

  if (error) {
    redirect(`${returnTo}${join}error=${encodeURIComponent(error.message)}`);
  }

  if (patch.status) {
    const row = updated as unknown as {
      applicant_email: string;
      wp_job_title: string | null;
      job: { title: string } | null;
    };
    const title = row.job?.title ?? row.wp_job_title ?? "your application";
    await notifyApplicationStatusChanged(row.applicant_email, title, patch.status);
  }

  revalidatePath("/admin/applications");
  redirect(`${returnTo}${join}updated=${status ? "status" : "note"}`);
}

"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth";
import { slugify, randomSuffix } from "@/lib/utils";
import {
  IMAGE_MAX_BYTES,
  LOGO_BUCKET,
  logoObjectPath,
  looksLikeImage,
} from "@/lib/avatar";
import {
  UNIQUE_VIOLATION,
  insertJobWithUniqueSlug,
  oneOf,
  parseJobFields,
  str,
} from "@/lib/job-form";
import { notifyApplicationStatusChanged, notifyAdminPendingReview } from "@/lib/notify";
import type { ApplicationStatus } from "@/types/database";

const APPLICATION_STATUSES: ApplicationStatus[] = [
  "pending",
  // under_review arrived with migration 014 and belongs in the employer's own
  // workflow — "we have seen it" is the state applicants ask about most.
  "under_review",
  "shortlisted",
  "rejected",
  "hired",
];

export async function upsertCompany(formData: FormData) {
  const { supabase, userId, profile } = await requireProfile("employer");

  const name = str(formData, "name");
  if (!name) {
    redirect("/dashboard/employer/company?error=Company+name+is+required");
  }

  const fields = {
    name,
    website: str(formData, "website"),
    description: str(formData, "description"),
    industry: str(formData, "industry"),
    location: str(formData, "location"),
    size: str(formData, "size"),
  };

  // `verified` is deliberately absent: a database trigger rejects any attempt to
  // change it from a user session (migration 001). Only an admin can grant it.
  if (profile.company_id) {
    const { error } = await supabase
      .from("companies")
      .update(fields)
      .eq("id", profile.company_id);

    if (error) {
      redirect(
        `/dashboard/employer/company?error=${encodeURIComponent(error.message)}`
      );
    }
    revalidatePath("/dashboard/employer/company");
    redirect("/dashboard/employer/company?saved=1");
  }

  // slug is unique, and two employers both called "Nairobi Logistics" is
  // entirely ordinary — so retry once with a suffix.
  let companyId: string | null = null;
  for (let attempt = 0; attempt < 2 && !companyId; attempt++) {
    const slug = attempt === 0 ? slugify(name) : `${slugify(name)}-${randomSuffix()}`;
    const { data, error } = await supabase
      .from("companies")
      .insert({ ...fields, slug, owner_id: userId })
      .select("id")
      .single();

    if (!error && data) {
      companyId = data.id;
      break;
    }
    if (error && error.code !== UNIQUE_VIOLATION) {
      redirect(
        `/dashboard/employer/company?error=${encodeURIComponent(error.message)}`
      );
    }
  }

  if (!companyId) {
    redirect("/dashboard/employer/company?error=Could+not+create+company");
  }

  const { error: linkError } = await supabase
    .from("profiles")
    .update({ company_id: companyId })
    .eq("id", userId);

  if (linkError) {
    redirect(
      `/dashboard/employer/company?error=${encodeURIComponent(linkError.message)}`
    );
  }

  revalidatePath("/dashboard/employer");
  redirect("/dashboard/employer/company?saved=1");
}

/**
 * Company logo. Same shape as the seeker's avatar upload, but into the public
 * `logos` bucket — a corporate mark is branding, not personal data, so there is
 * nothing here to sign or scope.
 */
export async function uploadLogo(formData: FormData) {
  const { supabase, profile } = await requireProfile("employer");
  const base = "/dashboard/employer/company";
  const fail = (message: string) =>
    redirect(`${base}?error=${encodeURIComponent(message)}`);

  if (!profile.company_id) fail("Create your company profile first.");
  const companyId = profile.company_id as string;

  const file = formData.get("logo");
  if (!(file instanceof File) || file.size === 0) fail("Choose an image to upload.");
  const image = file as File;

  if (image.size > IMAGE_MAX_BYTES) fail("That image is larger than 2MB.");
  if (!(await looksLikeImage(image))) {
    fail("That file is not a JPEG, PNG or WebP image.");
  }

  const path = logoObjectPath(companyId, image.name);
  const { error: uploadError } = await supabase.storage
    .from(LOGO_BUCKET)
    .upload(path, image, { contentType: image.type, upsert: false });

  if (uploadError) fail(uploadError.message);

  const previous = (
    await supabase
      .from("companies")
      .select("logo_url")
      .eq("id", companyId)
      .single()
  ).data as { logo_url: string | null } | null;

  const { error } = await supabase
    .from("companies")
    .update({ logo_url: path })
    .eq("id", companyId);

  if (error) fail(error.message);

  if (previous?.logo_url && previous.logo_url !== path) {
    await supabase.storage.from(LOGO_BUCKET).remove([previous.logo_url]);
  }

  revalidatePath(base);
  redirect(`${base}?logo=1`);
}

export async function createJob(formData: FormData) {
  const { supabase, userId, profile } = await requireProfile("employer");

  // A job needs company_id for the employer-visibility policy on applications
  // to resolve (migration 004), so posting without a company is blocked here as
  // well as in the page guard.
  if (!profile.company_id) {
    redirect("/dashboard/employer/company?error=Create+your+company+profile+first");
  }

  const fields = parseJobFields(formData);
  if (!fields) {
    redirect("/dashboard/employer/post?error=Title+and+description+are+required");
  }

  // Two submit buttons post different values here. Anything other than these
  // two is coerced to pending_review by the database anyway (migration 021), so
  // this only has to get the honest cases right.
  const asDraft = str(formData, "intent") === "draft";

  const result = await insertJobWithUniqueSlug(fields.title, (slug) =>
    supabase
      .from("jobs")
      .insert({
        ...fields,
        slug,
        company_id: profile.company_id,
        posted_by: userId,
        // Draft, or the review queue. Publishing is an admin action.
        status: asDraft ? ("draft" as const) : ("pending_review" as const),
      })
      .select("id")
      .single()
  );

  if ("error" in result) {
    redirect(`/dashboard/employer/post?error=${encodeURIComponent(result.error)}`);
  }

  if (!asDraft) await notifyAdminPendingReview(fields.title);

  revalidatePath("/dashboard/employer");
  revalidatePath("/dashboard/employer/jobs");
  if (asDraft) {
    redirect(`/dashboard/employer/jobs/${result.id}/edit?saved=draft`);
  }
  redirect("/dashboard/employer?posted=1");
}

/**
 * Edits a listing the employer owns.
 *
 * Status is deliberately not a field here — it moves through setOwnJobStatus
 * below, and mixing the two would let a form post smuggle a status change into
 * a content edit. Editing published copy clears the approval stamp (migration
 * 019), which the page warns about before you save.
 */
export async function updateOwnJob(formData: FormData) {
  const { supabase } = await requireProfile("employer");

  const jobId = str(formData, "job_id");
  if (!jobId) redirect("/dashboard/employer/jobs?error=Invalid+request");

  const fields = parseJobFields(formData);
  if (!fields) {
    redirect(
      `/dashboard/employer/jobs/${jobId}/edit?error=Title+and+description+are+required`
    );
  }

  // company_id is not accepted from the form: an employer has exactly one, and
  // taking it from the body would let them reassign a listing to someone else.
  const { error } = await supabase.from("jobs").update(fields).eq("id", jobId);

  if (error) {
    redirect(
      `/dashboard/employer/jobs/${jobId}/edit?error=${encodeURIComponent(error.message)}`
    );
  }

  revalidatePath("/dashboard/employer/jobs");
  revalidatePath("/jobs");
  redirect(`/dashboard/employer/jobs/${jobId}/edit?saved=1`);
}

/**
 * Pause, resume, or close a listing the employer owns (brief §9).
 *
 * The interesting transitions are enforced in the database, not here:
 * guard_job_status (migration 019) allows paused → published only while the
 * listing still carries its approval stamp, and blocks every other route to
 * published. So this action can be permissive and still be safe — a rejected
 * transition comes back as an error message rather than as a silent success.
 */
const OWN_STATUSES = [
  "paused",
  "published",
  "closed",
  "draft",
  // Submitting a draft for review. `published` is in this list too, but the
  // database is what decides whether it is allowed — see migration 019.
  "pending_review",
] as const;

export async function setOwnJobStatus(formData: FormData) {
  const { supabase } = await requireProfile("employer");

  const jobId = str(formData, "job_id");
  const status = str(formData, "status");
  if (!jobId || !status || !(OWN_STATUSES as readonly string[]).includes(status)) {
    redirect("/dashboard/employer/jobs?error=Invalid+request");
  }

  const { data: updated, error } = await supabase
    .from("jobs")
    .update({ status: status as (typeof OWN_STATUSES)[number] })
    .eq("id", jobId)
    .select("title")
    .single();

  if (error) {
    redirect(`/dashboard/employer/jobs?error=${encodeURIComponent(error.message)}`);
  }

  if (status === "pending_review") {
    await notifyAdminPendingReview((updated as { title: string }).title);
  }

  revalidatePath("/dashboard/employer/jobs");
  revalidatePath("/jobs");
  redirect(`/dashboard/employer/jobs?updated=${status}`);
}

/**
 * Moves an application through its stages, and saves the note.
 *
 * `return_to` carries the inbox's filters and open drawer so the employer lands
 * back exactly where they were. Confined to a same-site path — it arrives in the
 * form body, so it is caller-controlled.
 */
export async function setApplicationStatus(formData: FormData) {
  const { supabase } = await requireProfile("employer");

  const applicationId = str(formData, "application_id");
  const status = str(formData, "status");
  const raw = str(formData, "return_to");
  const returnTo =
    raw && raw.startsWith("/") && !raw.startsWith("//")
      ? raw
      : "/dashboard/employer/applications";

  if (!applicationId) redirect(`${returnTo}?error=Invalid+request`);

  const note = str(formData, "employer_note");
  const join = returnTo.includes("?") ? "&" : "?";

  // A note-only submit posts no status, so the current one is left alone rather
  // than being reset to pending — and vice versa.
  const patch: { status?: ApplicationStatus; employer_note?: string | null } = {};
  if (status) patch.status = oneOf(status, APPLICATION_STATUSES, "pending");
  if (formData.has("employer_note")) patch.employer_note = note;

  if (Object.keys(patch).length === 0) redirect(returnTo);

  // RLS confines this to applications on jobs this employer owns, so a
  // mismatched id updates nothing rather than erroring. The status change is
  // recorded in application_events by a trigger (migration 017), so the drawer's
  // history is written whether or not this action remembers to.
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

  revalidatePath("/dashboard/employer/applications");
  redirect(`${returnTo}${join}updated=${status ? "status" : "note"}`);
}

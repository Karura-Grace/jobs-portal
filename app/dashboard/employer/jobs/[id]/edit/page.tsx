import Link from "next/link";
import { notFound } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { getJobLookups } from "@/lib/lookups";
import { JobFormFields } from "@/components/job-form-fields";
import { PageHead } from "@/components/dashboard-shell";
import { ToastFromSearchParams } from "@/components/toast-from-search-params";
import { JobStatusBadge } from "@/components/status-badge";
import { dash } from "@/lib/content";
import { setOwnJobStatus, updateOwnJob } from "../../../actions";
import type { Job } from "@/types/database";

export default async function EditOwnJobPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const { supabase } = await requireProfile("employer");
  const { id } = await params;
  const query = await searchParams;

  // RLS limits this to jobs the employer owns, so a foreign id returns nothing
  // and becomes a 404 rather than confirming that the job exists.
  const [{ data: job }, lookups, { count }] = await Promise.all([
    supabase.from("jobs").select("*").eq("id", id).maybeSingle(),
    getJobLookups(),
    supabase
      .from("applications")
      .select("id", { count: "exact", head: true })
      .eq("job_id", id),
  ]);

  if (!job) notFound();
  const row = job as unknown as Job;
  const applicants = count ?? 0;

  return (
    <div>
      <PageHead
        eyebrow={dash.common.edit}
        title={row.title}
        action={<JobStatusBadge status={row.status} />}
      />

      <ToastFromSearchParams
        error={query.error}
        success={
          query.saved === "draft"
            ? "Draft saved. Submit it for review when you are ready."
            : query.saved
              ? "Listing saved."
              : null
        }
      />

      <div className="mb-6 flex flex-wrap items-center gap-3 text-sm">
        <Link
          href={`/dashboard/employer/applications?job=${row.id}`}
          className="btn-secondary"
        >
          {applicants} applicant{applicants === 1 ? "" : "s"}
        </Link>
        {row.status === "published" && (
          <Link href={`/jobs/${row.slug}`} className="btn-ghost border-line">
            View the public listing
          </Link>
        )}
        {row.status === "draft" && (
          <form action={setOwnJobStatus}>
            <input type="hidden" name="job_id" value={row.id} />
            <input type="hidden" name="status" value="pending_review" />
            <button type="submit" className="btn-accent">
              Submit for review
            </button>
          </form>
        )}
      </div>

      {row.status === "draft" && row.rejection_reason && (
        <div
          role="alert"
          className="mb-6 rounded-card border border-red-500/25 bg-red-500/8 px-4 py-3 text-sm text-red-700 dark:text-red-400"
        >
          <span className="font-500">Sent back by PAC Africa:</span>{" "}
          {row.rejection_reason}
        </div>
      )}

      {/* Editing an approved listing costs its approval, per migration 019.
          Better said before the save than discovered after it. */}
      {(row.status === "published" || row.status === "paused") && (
        <p className="mb-6 rounded-card border border-line px-4 py-3 text-sm text-muted">
          This listing has been through review. Changing the role, the copy, the pay or
          the closing date sends it back through the queue before it can be public
          again — status changes and applicant handling are unaffected.
        </p>
      )}

      <form action={updateOwnJob} className="clay max-w-2xl space-y-5 p-6">
        <input type="hidden" name="job_id" value={row.id} />
        <JobFormFields
          categories={lookups.categories}
          locations={lookups.locations}
          job={row}
        />
        <div className="border-t border-line pt-5">
          <button type="submit" className="btn-accent">
            {dash.common.save}
          </button>
        </div>
      </form>
    </div>
  );
}

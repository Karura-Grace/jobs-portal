import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink, Trash2 } from "lucide-react";
import { requireProfile } from "@/lib/auth";
import { getJobLookups } from "@/lib/lookups";
import { JobFormFields } from "@/components/job-form-fields";
import { JobStatusBadge } from "@/components/status-badge";
import { updateJob, deleteJob } from "../../../actions";
import type { Job } from "@/types/database";

export default async function AdminEditJobPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const { supabase } = await requireProfile("admin");
  const { id } = await params;
  const query = await searchParams;

  const [{ data }, lookups, { count: applicantCount }] = await Promise.all([
    supabase
      .from("jobs")
      .select("*, company:companies(name, verified)")
      .eq("id", id)
      .single(),
    getJobLookups(),
    supabase
      .from("applications")
      .select("id", { count: "exact", head: true })
      .eq("job_id", id),
  ]);

  if (!data) notFound();
  const job = data as unknown as Job;
  const applicants = applicantCount ?? 0;

  return (
    <div className="max-w-3xl">
      <Link
        href="/admin/jobs"
        className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-accent-text transition-colors"
      >
        <ArrowLeft className="w-4 h-4" aria-hidden />
        All listings
      </Link>

      <div className="flex flex-wrap items-center gap-3 mt-5 mb-1">
        <h1 className="font-display text-3xl font-700 text-ink">Edit listing</h1>
        <JobStatusBadge status={job.status} />
      </div>
      <p className="text-sm text-muted mb-8">
        {job.company?.name ?? "Confidential employer"}
        {job.status === "published" && (
          <>
            {" "}
            &middot;{" "}
            <Link
              href={`/jobs/${job.slug}`}
              className="inline-flex items-center gap-1 text-accent-text hover:underline"
            >
              view live
              <ExternalLink className="w-3 h-3" aria-hidden />
            </Link>
          </>
        )}
      </p>

      {query.error && (
        <p className="mb-6 text-sm text-red-600 border border-red-200 bg-red-50 rounded-card px-4 py-3">
          {query.error}
        </p>
      )}
      {query.saved && !query.error && (
        <p className="mb-6 text-sm text-green-700 border border-green-200 bg-green-50 rounded-card px-4 py-3">
          Listing saved.
        </p>
      )}

      <form action={updateJob} className="space-y-5">
        <input type="hidden" name="job_id" value={job.id} />

        <fieldset className="clay p-5">
          <legend className="eyebrow float-left mb-3 w-full">The role</legend>
          <div className="clear-both space-y-4">
            <JobFormFields
              categories={lookups.categories}
              locations={lookups.locations}
              job={job}
            />
          </div>
        </fieldset>

        <fieldset className="clay p-5">
          <legend className="eyebrow float-left mb-3 w-full">Visibility</legend>
          <div className="clear-both space-y-4">
            <div>
              <label htmlFor="status" className="eyebrow block mb-2">
                Status
              </label>
              <select
                id="status"
                name="status"
                defaultValue={job.status}
                className="field"
              >
                <option value="published">Published — live on the site</option>
                <option value="pending_review">In review</option>
                <option value="draft">Draft</option>
                <option value="closed">Closed</option>
                <option value="expired">Expired</option>
              </select>
            </div>
            <label className="flex items-center gap-2.5 text-sm text-ink">
              <input
                type="checkbox"
                name="is_featured"
                defaultChecked={job.is_featured}
                className="w-4 h-4 accent-accent"
              />
              Feature this role
            </label>
          </div>
        </fieldset>

        <div className="flex items-center gap-3">
          <button type="submit" className="btn-primary">
            Save changes
          </button>
          <Link href="/admin/jobs" className="btn-ghost">
            Cancel
          </Link>
        </div>
      </form>

      {/* DANGER ZONE ---------------------------------------------------
          Separate form, so a stray Enter in the edit fields above can never
          submit a delete. */}
      <section className="mt-12 rounded-card border border-red-200 bg-red-50/50 p-5">
        <h2 className="font-display text-lg font-600 text-ink mb-1">
          Delete this listing
        </h2>
        <p className="text-sm text-muted mb-4 max-w-xl">
          {applicants > 0 ? (
            <>
              This listing has{" "}
              <strong className="text-ink">
                {applicants} application{applicants === 1 ? "" : "s"}
              </strong>
              . Deleting it deletes {applicants === 1 ? "that" : "those"} too —
              names, contact details and CVs — and cannot be undone. If the role
              is simply no longer open, set the status to{" "}
              <strong className="text-ink">Closed</strong> above instead:
              that hides it from the site and keeps the applicants.
            </>
          ) : (
            <>
              Nobody has applied to this listing, so nothing else is affected.
              This cannot be undone.
            </>
          )}
        </p>

        <form action={deleteJob} className="space-y-3">
          <input type="hidden" name="job_id" value={job.id} />

          {applicants > 0 && (
            <label className="flex items-start gap-2.5 text-sm text-ink">
              <input
                type="checkbox"
                name="acknowledge_applications"
                required
                className="mt-0.5 w-4 h-4 accent-red-600"
              />
              I understand {applicants} application
              {applicants === 1 ? "" : "s"} will be permanently deleted
            </label>
          )}

          <button
            type="submit"
            className="btn press inline-flex items-center gap-2 border border-red-300 bg-transparent text-red-700 transition-[transform,background-color] duration-150 ease-out hover:bg-red-600 hover:text-white hover:border-red-600"
          >
            <Trash2 className="w-4 h-4" aria-hidden />
            Delete permanently
          </button>
        </form>
      </section>
    </div>
  );
}

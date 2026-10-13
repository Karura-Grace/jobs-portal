import Link from "next/link";
import { Bookmark } from "lucide-react";
import { requireCompleteSeekerProfile } from "@/lib/auth";
import { PageHead } from "@/components/dashboard-shell";
import { EmptyState } from "@/components/dashboard-ui";
import { JobCard } from "@/components/job-card";
import { dash } from "@/lib/content";
import type { Job } from "@/types/database";

/**
 * Saved roles (brief §8) — the same clay cards as the public browse page, which
 * is the point: a saved role should look identical to how it looked when it was
 * saved.
 *
 * A saved job whose listing has since closed is filtered out by RLS rather than
 * by this query: `jobs_select_published` only exposes published rows, so the
 * embedded join comes back null and the row is dropped below. The saved_jobs row
 * survives, so if the employer reopens the role it reappears here.
 */
export default async function SavedJobs() {
  const { supabase } = await requireCompleteSeekerProfile("saved");

  const { data } = await supabase
    .from("saved_jobs")
    .select(
      `id, created_at,
       job:jobs(*, category:job_categories!category_id(*), location:job_locations(*))`
    )
    .order("created_at", { ascending: false })
    .limit(100);

  const rows = ((data ?? []) as unknown as { id: string; job: Job | null }[]).filter(
    (row): row is { id: string; job: Job } => Boolean(row.job)
  );

  return (
    <div>
      <PageHead
        eyebrow={dash.common.saved}
        title={dash.seeker.savedTitle}
        sub={dash.seeker.savedSub}
      />

      {rows.length === 0 ? (
        <EmptyState
          icon={Bookmark}
          title={dash.seeker.emptySaved}
          body={dash.seeker.emptySavedBody}
          action={
            <Link href="/jobs" className="btn-primary">
              {dash.seeker.findRoles}
            </Link>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {rows.map((row) => (
            <JobCard
              key={row.id}
              job={row.job}
              saved
              showSave
              returnTo="/dashboard/seeker/saved"
            />
          ))}
        </div>
      )}
    </div>
  );
}

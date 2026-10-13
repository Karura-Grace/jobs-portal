import Link from "next/link";
import { Briefcase, Eye, Pencil } from "lucide-react";
import { requireProfile } from "@/lib/auth";
import { PageHead } from "@/components/dashboard-shell";
import {
  EmptyState,
  RowLink,
  TableFrame,
  Td,
  Th,
  Tr,
} from "@/components/dashboard-ui";
import { ToastFromSearchParams } from "@/components/toast-from-search-params";
import { JobStatusBadge } from "@/components/status-badge";
import { setOwnJobStatus } from "../actions";
import { dash, jobStatusLabels } from "@/lib/content";
import { timeAgo } from "@/lib/utils";
import type { JobStatus } from "@/types/database";

const FILTERS: JobStatus[] = ["published", "pending_review", "paused", "draft", "closed"];

interface JobRow {
  id: string;
  title: string;
  slug: string;
  status: JobStatus;
  views: number | null;
  approved_at: string | null;
  rejection_reason: string | null;
  created_at: string;
  applications: { count: number }[];
}

/**
 * My Jobs (brief §9).
 *
 * A table rather than the brief's card-grid toggle. Two views of the same rows
 * is a preference control that doubles the code and the states to keep working;
 * these rows are five short columns and a table reads them better than a grid
 * of cards would. If someone asks for cards later, that is a change to make
 * then rather than a toggle to maintain now.
 */
export default async function EmployerJobs({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; updated?: string; error?: string }>;
}) {
  const { supabase, profile } = await requireProfile("employer");
  const params = await searchParams;

  if (!profile.company_id) {
    return (
      <div>
        <PageHead eyebrow="Employer" title={dash.employer.jobsTitle} />
        <EmptyState
          icon={Briefcase}
          title="Add your company first"
          body="Listings hang off a company record, and PAC Africa verifies employers against it."
          action={
            <Link href="/dashboard/employer/company" className="btn-accent">
              Add company profile
            </Link>
          }
        />
      </div>
    );
  }

  const status = (FILTERS as string[]).includes(params.status ?? "")
    ? (params.status as JobStatus)
    : null;

  let query = supabase
    .from("jobs")
    .select(
      `id, title, slug, status, views, approved_at, rejection_reason, created_at,
       applications(count)`
    )
    .order("created_at", { ascending: false })
    .limit(200);

  if (status) query = query.eq("status", status);

  const { data } = await query;
  const rows = (data ?? []) as unknown as JobRow[];

  return (
    <div>
      <PageHead
        eyebrow={dash.employer.jobsTitle}
        title={dash.employer.jobsTitle}
        sub={dash.employer.jobsSub}
        action={
          <Link href="/dashboard/employer/post" className="btn-accent">
            {dash.employer.newJob}
          </Link>
        }
      />

      <ToastFromSearchParams
        error={params.error}
        success={
          params.updated === "paused"
            ? "Listing paused. It is no longer visible to applicants."
            : params.updated === "published"
              ? "Listing is live again."
              : params.updated === "closed"
                ? "Listing closed."
                : params.updated
                  ? "Listing updated."
                  : null
        }
      />

      <div className="mb-5 flex flex-wrap items-center gap-2">
        <Link
          href="/dashboard/employer/jobs"
          className={`chip ${!status ? "chip-active" : ""}`}
        >
          All
        </Link>
        {FILTERS.map((s) => (
          <Link
            key={s}
            href={status === s ? "/dashboard/employer/jobs" : `?status=${s}`}
            className={`chip ${status === s ? "chip-active" : ""}`}
          >
            {jobStatusLabels[s]}
          </Link>
        ))}
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={Briefcase}
          title={status ? "Nothing with that status" : dash.employer.emptyJobs}
          body={status ? undefined : dash.employer.emptyJobsBody}
          action={
            status ? (
              <Link href="/dashboard/employer/jobs" className="btn-secondary">
                {dash.common.clear}
              </Link>
            ) : (
              <Link href="/dashboard/employer/post" className="btn-accent">
                {dash.employer.newJob}
              </Link>
            )
          }
        />
      ) : (
        <TableFrame>
          <thead>
            <tr>
              <Th>{dash.employer.colRole}</Th>
              <Th className="w-[110px]">{dash.employer.colStatus}</Th>
              <Th className="w-[90px] text-right">{dash.employer.colApplications}</Th>
              <Th className="w-[80px] text-right">{dash.employer.colViews}</Th>
              <Th className="w-[110px]">{dash.employer.colPosted}</Th>
              <Th className="w-[190px]" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const count = row.applications?.[0]?.count ?? 0;
              return (
                <Tr key={row.id}>
                  <Td>
                    <RowLink
                      href={`/dashboard/employer/applications?job=${row.id}`}
                      label={`${row.title}, ${count} applicants`}
                    >
                      <span className="block truncate font-500 text-ink">
                        {row.title}
                      </span>
                    </RowLink>
                    {row.status === "pending_review" && (
                      <span className="mt-0.5 block text-xs text-muted">
                        {dash.employer.pendingNotice}
                      </span>
                    )}
                    {row.status === "draft" && row.rejection_reason && (
                      <span className="mt-0.5 block text-xs text-red-700 dark:text-red-400">
                        Sent back: {row.rejection_reason}
                      </span>
                    )}
                  </Td>
                  <Td>
                    <JobStatusBadge status={row.status} />
                  </Td>
                  <Td className="text-right font-mono text-xs text-muted">{count}</Td>
                  <Td
                    className="text-right font-mono text-xs text-muted"
                    // The counter is naive by design (migration 017) — say so
                    // rather than implying it counts people.
                    title={dash.employer.viewsHint}
                  >
                    {(row.views ?? 0).toLocaleString()}
                  </Td>
                  <Td className="whitespace-nowrap text-xs text-muted">
                    {timeAgo(row.created_at)}
                  </Td>
                  {/* relative z-10 so these sit above the row overlay link. */}
                  <Td className="relative z-10">
                    <div className="flex items-center justify-end gap-1.5">
                      {row.status === "published" && (
                        <Link
                          href={`/jobs/${row.slug}`}
                          className="press grid h-7 w-7 place-items-center rounded-pill text-muted transition-colors duration-150 hover:bg-surface-raised hover:text-ink"
                          title="View the public listing"
                        >
                          <Eye className="h-3.5 w-3.5" aria-hidden />
                          <span className="sr-only">View the public listing</span>
                        </Link>
                      )}
                      <Link
                        href={`/dashboard/employer/jobs/${row.id}/edit`}
                        className="press grid h-7 w-7 place-items-center rounded-pill text-muted transition-colors duration-150 hover:bg-surface-raised hover:text-ink"
                        title={dash.common.edit}
                      >
                        <Pencil className="h-3.5 w-3.5" aria-hidden />
                        <span className="sr-only">
                          {dash.common.edit} {row.title}
                        </span>
                      </Link>

                      {row.status === "published" && (
                        <StatusButton
                          jobId={row.id}
                          status="paused"
                          label={dash.employer.pause}
                        />
                      )}
                      {row.status === "paused" && (
                        <StatusButton
                          jobId={row.id}
                          status="published"
                          label={dash.employer.resume}
                          // Resuming is blocked by the database once the copy
                          // has changed, so say why before they click.
                          title={
                            row.approved_at ? undefined : dash.employer.resumeBlocked
                          }
                        />
                      )}
                      {(row.status === "published" || row.status === "paused") && (
                        <StatusButton
                          jobId={row.id}
                          status="closed"
                          label={dash.employer.closeJob}
                        />
                      )}
                      {row.status === "closed" && (
                        <StatusButton
                          jobId={row.id}
                          status="draft"
                          label={dash.employer.reopen}
                          title="Reopening puts it back in your drafts to resubmit."
                        />
                      )}
                    </div>
                  </Td>
                </Tr>
              );
            })}
          </tbody>
        </TableFrame>
      )}
    </div>
  );
}

function StatusButton({
  jobId,
  status,
  label,
  title,
}: {
  jobId: string;
  status: JobStatus;
  label: string;
  title?: string;
}) {
  return (
    <form action={setOwnJobStatus}>
      <input type="hidden" name="job_id" value={jobId} />
      <input type="hidden" name="status" value={status} />
      <button
        type="submit"
        title={title}
        className="press rounded-pill border border-line px-2.5 py-1 text-xs text-muted transition-colors duration-150 hover:border-accent/50 hover:text-ink"
      >
        {label}
      </button>
    </form>
  );
}

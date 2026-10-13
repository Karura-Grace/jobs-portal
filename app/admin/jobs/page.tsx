import Link from "next/link";
import { ExternalLink, Plus, Search } from "lucide-react";
import { requireProfile } from "@/lib/auth";
import { getJobLookups } from "@/lib/lookups";
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
import { ConfirmAction } from "@/components/confirm-action";
import { dash, jobStatusLabels } from "@/lib/content";
import { timeAgo } from "@/lib/utils";
import { deleteJob, setJobStatus } from "../actions";
import type { JobStatus } from "@/types/database";

const BASE = "/admin/jobs";
const PER_PAGE = 50;

/** Every status, unlike the public browse page. This is the admin-only filter. */
const STATUSES: JobStatus[] = [
  "published",
  "pending_review",
  "draft",
  "paused",
  "closed",
  "expired",
];

type Params = {
  q?: string;
  status?: string;
  category?: string;
  location?: string;
  page?: string;
  created?: string;
  updated?: string;
  deleted?: string;
  lost?: string;
  error?: string;
};

function href(current: Params, changes: Partial<Record<keyof Params, string | null>>) {
  const next = new URLSearchParams();
  const merged = { ...current, ...changes } as Record<string, string | null | undefined>;
  for (const key of ["created", "updated", "deleted", "lost", "error"]) {
    delete merged[key];
  }
  for (const [key, value] of Object.entries(merged)) if (value) next.set(key, value);
  const qs = next.toString();
  return qs ? `${BASE}?${qs}` : BASE;
}

interface Row {
  id: string;
  title: string;
  slug: string;
  status: JobStatus;
  created_at: string;
  is_featured: boolean;
  views: number | null;
  company: { name: string; verified: boolean } | null;
  applications: { count: number }[];
}

/**
 * All jobs (brief §10): the browse page's filters plus a status filter, and the
 * force-close and delete controls an admin needs and nobody else has.
 *
 * Delete is behind a confirmation naming the applications it would take with it,
 * because `applications.job_id` cascades — that is real applicant data, of the
 * same kind this rebuild spent weeks recovering. Closing is almost always the
 * right answer; deleting is for spam, duplicates and test posts.
 */
export default async function AdminJobsPage({
  searchParams,
}: {
  searchParams: Promise<Params>;
}) {
  const { supabase } = await requireProfile("admin");
  const params = await searchParams;

  const page = Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1);
  const from = (page - 1) * PER_PAGE;
  const status = (STATUSES as string[]).includes(params.status ?? "")
    ? (params.status as JobStatus)
    : null;

  let query = supabase
    .from("jobs")
    .select(
      `id, title, slug, status, created_at, is_featured, views,
       company:companies(name, verified), applications(count)`,
      { count: "exact" }
    )
    .order("created_at", { ascending: false });

  if (status) query = query.eq("status", status);
  if (params.category) query = query.eq("category_id", params.category);
  if (params.location) query = query.eq("location_id", params.location);
  if (params.q) {
    const term = params.q.replace(/[%,()]/g, " ").trim();
    if (term) query = query.ilike("title", `%${term}%`);
  }

  const [{ data, count }, lookups] = await Promise.all([
    query.range(from, from + PER_PAGE - 1),
    getJobLookups(),
  ]);

  const rows = (data ?? []) as unknown as Row[];
  const total = count ?? 0;
  const lastPage = Math.max(1, Math.ceil(total / PER_PAGE));
  const filtered = Boolean(params.q || status || params.category || params.location);

  return (
    <div>
      <PageHead
        eyebrow="PAC Africa · Internal"
        title={dash.admin.jobsTitle}
        sub={`${total.toLocaleString()} listing${total === 1 ? "" : "s"} on the platform.`}
        action={
          <Link href="/admin/jobs/new" className="btn-accent">
            <Plus className="h-4 w-4" aria-hidden />
            Post a job
          </Link>
        }
      />

      <ToastFromSearchParams
        error={params.error}
        success={
          params.error
            ? null
            : params.created
              ? params.created === "published"
                ? "Listing is live on the site."
                : `Listing saved as ${params.created.replace("_", " ")}.`
              : params.updated
                ? params.updated === "rejected"
                  ? "Sent back to the employer."
                  : `Listing moved to ${params.updated.replace("_", " ")}.`
                : params.deleted
                  ? `Deleted “${params.deleted}”${
                      Number(params.lost) > 0
                        ? ` and ${params.lost} application${
                            Number(params.lost) === 1 ? "" : "s"
                          } attached to it`
                        : ""
                    }.`
                  : null
        }
      />

      {/* FILTERS — the browse page's, plus status. */}
      <form action={BASE} className="mb-4 flex flex-wrap items-end gap-2.5">
        <div className="relative min-w-[200px] flex-1">
          <label htmlFor="q" className="eyebrow mb-1.5 block">
            Title
          </label>
          <Search
            className="absolute left-3.5 top-[calc(50%+9px)] h-4 w-4 -translate-y-1/2 text-faint"
            aria-hidden
          />
          <input
            id="q"
            name="q"
            defaultValue={params.q ?? ""}
            placeholder="Search job titles"
            className="field pl-10"
          />
        </div>
        <div>
          <label htmlFor="category" className="eyebrow mb-1.5 block">
            Category
          </label>
          <select
            id="category"
            name="category"
            defaultValue={params.category ?? ""}
            className="field w-[190px]"
          >
            <option value="">All categories</option>
            {lookups.categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="location" className="eyebrow mb-1.5 block">
            Location
          </label>
          <select
            id="location"
            name="location"
            defaultValue={params.location ?? ""}
            className="field w-[170px]"
          >
            <option value="">Anywhere</option>
            {lookups.locations.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </div>
        {status && <input type="hidden" name="status" value={status} />}
        <button type="submit" className="btn-primary shrink-0">
          {dash.common.apply}
        </button>
      </form>

      <div className="mb-5 flex flex-wrap items-center gap-2">
        <Link
          href={href(params, { status: null, page: null })}
          className={`chip ${!status ? "chip-active" : ""}`}
        >
          All
        </Link>
        {STATUSES.map((s) => (
          <Link
            key={s}
            href={href(params, { status: status === s ? null : s, page: null })}
            className={`chip ${status === s ? "chip-active" : ""}`}
          >
            {jobStatusLabels[s]}
          </Link>
        ))}
        {filtered && (
          <Link href={BASE} className="btn-ghost ml-auto text-xs">
            {dash.common.clear}
          </Link>
        )}
      </div>

      {rows.length === 0 ? (
        <EmptyState
          title={filtered ? "Nothing matches" : "No listings yet"}
          body={
            filtered
              ? "Try a shorter title, or clear the filters."
              : "Post the first role. An admin posting goes live immediately."
          }
          action={
            filtered ? (
              <Link href={BASE} className="btn-secondary">
                {dash.common.clear}
              </Link>
            ) : (
              <Link href="/admin/jobs/new" className="btn-accent">
                Post a job
              </Link>
            )
          }
        />
      ) : (
        <>
          <TableFrame>
            <thead>
              <tr>
                <Th>{dash.employer.colRole}</Th>
                <Th className="w-[110px]">{dash.employer.colStatus}</Th>
                <Th className="w-[80px] text-right">{dash.employer.colApplications}</Th>
                <Th className="w-[70px] text-right">{dash.employer.colViews}</Th>
                <Th className="w-[230px]" />
              </tr>
            </thead>
            <tbody>
              {rows.map((job) => {
                const applicants = job.applications?.[0]?.count ?? 0;
                return (
                  <Tr key={job.id}>
                    <Td>
                      <RowLink
                        href={`/admin/jobs/${job.id}/edit`}
                        label={`${dash.common.edit} ${job.title}`}
                      >
                        <span className="flex items-center gap-2">
                          <span className="truncate font-500 text-ink">{job.title}</span>
                          {job.is_featured && <span className="eyebrow">featured</span>}
                        </span>
                        <span className="mt-0.5 block truncate text-xs text-muted">
                          {job.company?.name ?? "Confidential employer"}
                          {job.company?.verified && " · verified"} ·{" "}
                          {timeAgo(job.created_at)}
                        </span>
                      </RowLink>
                    </Td>
                    <Td>
                      <JobStatusBadge status={job.status} />
                    </Td>
                    <Td className="text-right font-mono text-xs text-muted">
                      {applicants}
                    </Td>
                    <Td className="text-right font-mono text-xs text-muted">
                      {(job.views ?? 0).toLocaleString()}
                    </Td>
                    <Td className="relative z-10">
                      <div className="flex flex-wrap items-center justify-end gap-1.5">
                        {job.status === "published" ? (
                          <>
                            <Link
                              href={`/jobs/${job.slug}`}
                              className="press grid h-7 w-7 place-items-center rounded-pill text-muted transition-colors duration-150 hover:bg-surface-raised hover:text-ink"
                              title="View live"
                            >
                              <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                              <span className="sr-only">View live</span>
                            </Link>
                            <StatusButton
                              jobId={job.id}
                              status="paused"
                              label="Hide"
                              title="Takes it off the public site without closing it."
                            />
                            <StatusButton
                              jobId={job.id}
                              status="closed"
                              label="Close"
                            />
                          </>
                        ) : (
                          <StatusButton
                            jobId={job.id}
                            status="published"
                            label="Publish"
                          />
                        )}

                        {/* Nothing to lose, so delete straight from the list.
                            With applicants it needs the confirmation, because
                            deleting cascades to their applications. */}
                        {applicants === 0 ? (
                          <form action={deleteJob}>
                            <input type="hidden" name="job_id" value={job.id} />
                            <button
                              type="submit"
                              className="press rounded-pill border border-line px-2.5 py-1 text-xs text-muted transition-colors duration-150 hover:border-red-500/40 hover:text-red-700 dark:hover:text-red-400"
                            >
                              Delete
                            </button>
                          </form>
                        ) : (
                          <ConfirmAction
                            action={deleteJob}
                            fields={{
                              job_id: job.id,
                              acknowledge_applications: "on",
                            }}
                            trigger="Delete"
                            triggerClassName="press rounded-pill border border-line px-2.5 py-1 text-xs text-muted transition-colors duration-150 hover:border-red-500/40 hover:text-red-700 dark:hover:text-red-400"
                            title="Delete this listing and its applications?"
                            body={`${applicants} application${
                              applicants === 1 ? "" : "s"
                            } would be deleted with it, including the CVs attached to them. This cannot be undone — closing the listing keeps the records.`}
                            confirmLabel="Delete permanently"
                            tone="danger"
                          />
                        )}
                      </div>
                    </Td>
                  </Tr>
                );
              })}
            </tbody>
          </TableFrame>

          <div className="mt-4 flex items-center justify-between gap-4">
            <p className="text-xs text-muted">
              {dash.common.showing(from + 1, from + rows.length, total)}
            </p>
            {lastPage > 1 && (
              <div className="flex gap-2">
                {page > 1 && (
                  <Link
                    href={href(params, { page: page === 2 ? null : String(page - 1) })}
                    className="btn-secondary px-3 py-1.5 text-xs"
                  >
                    {dash.common.prev}
                  </Link>
                )}
                {page < lastPage && (
                  <Link
                    href={href(params, { page: String(page + 1) })}
                    className="btn-secondary px-3 py-1.5 text-xs"
                  >
                    {dash.common.next}
                  </Link>
                )}
              </div>
            )}
          </div>
        </>
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
    <form action={setJobStatus}>
      <input type="hidden" name="job_id" value={jobId} />
      <input type="hidden" name="status" value={status} />
      <input type="hidden" name="return_to" value={BASE} />
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

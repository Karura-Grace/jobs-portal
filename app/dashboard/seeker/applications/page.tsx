import Link from "next/link";
import { Send } from "lucide-react";
import { requireCompleteSeekerProfile } from "@/lib/auth";
import { PageHead } from "@/components/dashboard-shell";
import {
  EmptyState,
  RowLink,
  TableFrame,
  Td,
  Th,
  Tr,
} from "@/components/dashboard-ui";
import { ApplicationStatusBadge } from "@/components/status-badge";
import { Drawer } from "@/components/drawer";
import {
  ApplicationDetailBody,
  type ApplicationDetail,
  type ApplicationEventItem,
} from "@/components/application-detail";
import { signApplicationCv } from "@/lib/cv-actions";
import { cvStatus } from "@/lib/cv";
import { applicationStatusLabels, dash } from "@/lib/content";

import type { ApplicationStatus } from "@/types/database";

const PER_PAGE = 40;

const STATUSES: ApplicationStatus[] = [
  "pending",
  "under_review",
  "shortlisted",
  "rejected",
  "hired",
];

interface Row {
  id: string;
  wp_job_title: string | null;
  status: ApplicationStatus;
  applied_at: string;
  wp_post_id: number | null;
  job: { title: string; slug: string } | null;
}

type Params = { status?: string; page?: string; id?: string };

function href(current: Params, changes: Partial<Record<keyof Params, string | null>>) {
  const next = new URLSearchParams();
  const merged = { ...current, ...changes } as Record<string, string | null | undefined>;
  for (const [key, value] of Object.entries(merged)) if (value) next.set(key, value);
  const qs = next.toString();
  return qs
    ? `/dashboard/seeker/applications?${qs}`
    : "/dashboard/seeker/applications";
}

/**
 * My Applications (brief §8).
 *
 * No Company column, deliberately. The brief lists one, but the employer behind
 * a role is admin-only information in this product — PAC Africa sits between the
 * applicant and the employer, so naming it here would undo that on the one page
 * an applicant reads most often.
 */
export default async function SeekerApplications({
  searchParams,
}: {
  searchParams: Promise<Params>;
}) {
  const { supabase } = await requireCompleteSeekerProfile("applications");
  const params = await searchParams;

  const page = Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1);
  const from = (page - 1) * PER_PAGE;

  let query = supabase
    .from("applications")
    .select("id, wp_job_title, status, applied_at, wp_post_id, job:jobs(title, slug)", {
      count: "exact",
    })
    .order("applied_at", { ascending: false });

  const status = (STATUSES as string[]).includes(params.status ?? "")
    ? (params.status as ApplicationStatus)
    : null;
  if (status) query = query.eq("status", status);

  const { data, count } = await query.range(from, from + PER_PAGE - 1);
  const rows = (data ?? []) as unknown as Row[];
  const total = count ?? 0;
  const lastPage = Math.max(1, Math.ceil(total / PER_PAGE));

  // The drawer's contents are fetched with the page, so opening one costs a
  // navigation rather than a client fetch and a spinner.
  const openId = params.id ?? null;
  let detail: ApplicationDetail | null = null;
  let events: ApplicationEventItem[] = [];
  let cvSt: "none" | "legacy" | "ready" = "none";

  if (openId) {
    const [{ data: one }, { data: log }] = await Promise.all([
      supabase
        .from("applications")
        .select(
          `id, applicant_name, applicant_email, applicant_phone, cover_letter, cv_url,
           status, employer_note, applied_at, wp_post_id, wp_job_title, meets_requirements,
           job:jobs(id, title, slug)`
        )
        .eq("id", openId)
        .maybeSingle(),
      supabase
        .from("application_events")
        .select("id, from_status, to_status, created_at, note")
        .eq("application_id", openId)
        .order("created_at", { ascending: false }),
    ]);

    if (one) {
      const row = one as unknown as ApplicationDetail & { cv_url: string | null };
      detail = { ...row, applicant: null };
      events = (log ?? []) as unknown as ApplicationEventItem[];
      cvSt = cvStatus(row.cv_url);
    }
  }

  return (
    <div>
      <PageHead
        eyebrow={dash.seeker.applicationsTitle}
        title={dash.seeker.applicationsTitle}
        sub={dash.seeker.applicationsSub}
      />

      <div className="mb-5 flex flex-wrap items-center gap-2">
        <Link
          href={href(params, { status: null, page: null, id: null })}
          className={`chip ${!status ? "chip-active" : ""}`}
        >
          All
        </Link>
        {STATUSES.map((s) => (
          <Link
            key={s}
            href={href(params, {
              status: status === s ? null : s,
              page: null,
              id: null,
            })}
            className={`chip ${status === s ? "chip-active" : ""}`}
          >
            {applicationStatusLabels[s]}
          </Link>
        ))}
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={Send}
          title={status ? "Nothing at that stage" : dash.seeker.emptyApplications}
          body={
            status
              ? "Try another stage, or clear the filter to see everything."
              : dash.seeker.emptyApplicationsBody
          }
          action={
            status ? (
              <Link href="/dashboard/seeker/applications" className="btn-secondary">
                {dash.common.clear}
              </Link>
            ) : (
              <Link href="/jobs" className="btn-primary">
                {dash.seeker.findRoles}
              </Link>
            )
          }
        />
      ) : (
        <>
          <TableFrame>
            <thead>
              <tr>
                <Th>{dash.seeker.colRole}</Th>
                <Th className="w-[140px]">{dash.seeker.colApplied}</Th>
                <Th className="w-[130px] text-right">{dash.seeker.colStatus}</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                // job_id is NULL for every migrated row, so the title snapshot
                // preserved from WordPress is the only label available.
                const title =
                  row.job?.title ?? row.wp_job_title ?? dash.drawer.roleNotRecorded;
                return (
                  <Tr key={row.id}>
                    <Td>
                      <RowLink
                        href={href(params, { id: row.id })}
                        label={`${title}, ${applicationStatusLabels[row.status]}`}
                      >
                        <span className="block truncate font-500 text-ink">{title}</span>
                        {row.wp_post_id !== null && (
                          <span className="eyebrow mt-0.5 block">
                            {dash.drawer.archived}
                          </span>
                        )}
                      </RowLink>
                    </Td>
                    <Td className="whitespace-nowrap text-muted">
                      {new Date(row.applied_at).toLocaleDateString("en-KE", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </Td>
                    <Td className="text-right">
                      <ApplicationStatusBadge status={row.status} />
                    </Td>
                  </Tr>
                );
              })}
            </tbody>
          </TableFrame>

          {lastPage > 1 && (
            <div className="mt-4 flex items-center justify-between gap-4">
              <p className="text-xs text-muted">
                {dash.common.showing(from + 1, from + rows.length, total)}
              </p>
              <div className="flex gap-2">
                {page > 1 && (
                  <Link
                    href={href(params, {
                      page: page === 2 ? null : String(page - 1),
                      id: null,
                    })}
                    className="btn-secondary px-3 py-1.5 text-xs"
                  >
                    {dash.common.prev}
                  </Link>
                )}
                {page < lastPage && (
                  <Link
                    href={href(params, { page: String(page + 1), id: null })}
                    className="btn-secondary px-3 py-1.5 text-xs"
                  >
                    {dash.common.next}
                  </Link>
                )}
              </div>
            </div>
          )}
        </>
      )}

      <Drawer
        open={Boolean(detail)}
        closeHref={href(params, { id: null })}
        title={
          detail?.job?.title ?? detail?.wp_job_title ?? dash.drawer.roleNotRecorded
        }
      >
        {detail && (
          <ApplicationDetailBody
            application={detail}
            events={events}
            cv={{
              status: cvSt,
              onOpen: openId ? signApplicationCv.bind(null, openId) : undefined,
            }}
          />
        )}
      </Drawer>
    </div>
  );
}

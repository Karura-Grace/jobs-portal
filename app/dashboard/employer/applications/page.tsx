import Link from "next/link";
import { Inbox, Search } from "lucide-react";
import { requireProfile } from "@/lib/auth";
import { PageHead } from "@/components/dashboard-shell";
import { Avatar, EmptyState, TableFrame, Td, Th, Tr, RowLink } from "@/components/dashboard-ui";
import { ApplicationStatusBadge, ReviewStatusBadge } from "@/components/status-badge";
import { Drawer } from "@/components/drawer";
import { ToastFromSearchParams } from "@/components/toast-from-search-params";
import {
  ApplicationDetailBody,
  type ApplicantProfileDetail,
  type ApplicationDetail,
  type ApplicationEventItem,
} from "@/components/application-detail";
import { ReviewPanel } from "@/components/review-panel";
import { NoteForm, StatusSelect } from "@/components/application-status-form";
import { applicantCards } from "@/lib/applicant-cards";
import { reviewSummaries, reviewSummaryFor } from "@/lib/application-reviews";
import { signApplicationCv } from "@/lib/cv-actions";
import { cvStatus } from "@/lib/cv";
import { applicationStatusLabels, dash } from "@/lib/content";
import { displayApplicant, timeAgo } from "@/lib/utils";
import { setApplicationStatus } from "../actions";
import type { ApplicationStatus } from "@/types/database";

const PER_PAGE = 40;

const STATUSES: ApplicationStatus[] = [
  "pending",
  "under_review",
  "shortlisted",
  "rejected",
  "hired",
];

const SORTS = [
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "name", label: "Name A–Z" },
] as const;

type Params = {
  q?: string;
  job?: string;
  status?: string;
  sort?: string;
  /** Review filter (migration 029): unreviewed | seen | final. */
  review?: string;
  page?: string;
  id?: string;
  updated?: string;
  reviewed?: string;
  error?: string;
};

const BASE = "/dashboard/employer/applications";

function href(current: Params, changes: Partial<Record<keyof Params, string | null>>) {
  const next = new URLSearchParams();
  const merged = { ...current, ...changes } as Record<string, string | null | undefined>;
  // Never carried across a navigation: they describe what just happened, not
  // where you are.
  delete merged.updated;
  delete merged.reviewed;
  delete merged.error;
  for (const [key, value] of Object.entries(merged)) if (value) next.set(key, value);
  const qs = next.toString();
  return qs ? `${BASE}?${qs}` : BASE;
}

interface Row {
  id: string;
  applicant_name: string | null;
  applicant_email: string;
  status: ApplicationStatus;
  applied_at: string;
  job: { id: string; title: string } | null;
}

/**
 * The unified applications inbox — the core of the employer dashboard (brief §9).
 *
 * The list is a server-rendered table and the drawer is driven by `?id=`, so
 * every state here is a URL: a filtered inbox with a candidate open is a link
 * you can send to a colleague, and the back button closes the drawer.
 *
 * RLS does the scoping. `applications` is readable to an employer only for jobs
 * they posted or that belong to their company (migration 004), so none of these
 * queries carry an owner filter — there is nothing to forget.
 */
export default async function EmployerInbox({
  searchParams,
}: {
  searchParams: Promise<Params>;
}) {
  const { supabase, profile, userId } = await requireProfile("employer");
  const params = await searchParams;

  if (!profile.company_id) {
    return (
      <div>
        <PageHead eyebrow="Employer" title={dash.employer.inboxTitle} />
        <EmptyState
          icon={Inbox}
          title="Add your company first"
          body="Applications are attached to your listings, and listings need a company record."
          action={
            <Link href="/dashboard/employer/company" className="btn-accent">
              Add company profile
            </Link>
          }
        />
      </div>
    );
  }

  const page = Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1);
  const from = (page - 1) * PER_PAGE;
  const sort = SORTS.find((s) => s.value === params.sort)?.value ?? "newest";
  const status = (STATUSES as string[]).includes(params.status ?? "")
    ? (params.status as ApplicationStatus)
    : null;

  let query = supabase
    .from("applications")
    .select(
      "id, applicant_name, applicant_email, status, applied_at, job:jobs(id, title)",
      { count: "exact" }
    );

  if (sort === "name") {
    // Rows with no name sort last rather than forming a block at the top —
    // historical applications often have only an email address.
    query = query.order("applicant_name", { ascending: true, nullsFirst: false });
  } else {
    query = query.order("applied_at", { ascending: sort === "oldest" });
  }

  if (status) query = query.eq("status", status);
  if (params.job) query = query.eq("job_id", params.job);

  if (params.review === "unreviewed" || params.review === "seen" || params.review === "final") {
    const { data: reviewRows } = await supabase
      .from("application_reviews")
      .select("application_id, mode");
    const rows = (reviewRows ?? []) as { application_id: string; mode: string }[];
    const anyIds = [...new Set(rows.map((r) => r.application_id))];
    const finalIds = [...new Set(rows.filter((r) => r.mode === "final").map((r) => r.application_id))];
    const NONE = "00000000-0000-0000-0000-000000000000";
    if (params.review === "unreviewed") {
      query = anyIds.length ? query.not("id", "in", `(${anyIds.join(",")})`) : query;
    } else if (params.review === "seen") {
      query = query.in("id", anyIds.length ? anyIds : [NONE]);
    } else {
      query = query.in("id", finalIds.length ? finalIds : [NONE]);
    }
  }

  if (params.q) {
    // The two things an employer knows about a candidate. Wildcards and the
    // comma that separates PostgREST's `or` arguments are stripped, so a search
    // term cannot alter the filter's shape.
    const term = params.q.replace(/[%,()]/g, " ").trim();
    if (term) {
      query = query.or(
        `applicant_name.ilike.%${term}%,applicant_email.ilike.%${term}%`
      );
    }
  }

  const [{ data, count }, { data: jobRows }] = await Promise.all([
    query.range(from, from + PER_PAGE - 1),
    supabase
      .from("jobs")
      .select("id, title")
      .order("created_at", { ascending: false })
      .limit(200),
  ]);

  const rows = (data ?? []) as unknown as Row[];
  const total = count ?? 0;
  const lastPage = Math.max(1, Math.ceil(total / PER_PAGE));
  const jobs = (jobRows as { id: string; title: string }[] | null) ?? [];

  // Two batched calls for the whole page, not one per row.
  const cards = await applicantCards(
    supabase,
    rows.map((row) => row.id)
  );
  const reviews = await reviewSummaries(
    supabase,
    rows.map((row) => row.id)
  );

  // DRAWER --------------------------------------------------------------
  const openId = params.id ?? null;
  let detail: ApplicationDetail | null = null;
  let events: ApplicationEventItem[] = [];
  let cvSt: "none" | "legacy" | "ready" = "none";
  let detailCard: { headline: string | null; avatarSrc: string | null } | undefined;
  let profileDetail: ApplicantProfileDetail | null = null;

  if (openId) {
    const [{ data: one }, { data: log }, { data: profile }] = await Promise.all([
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
      supabase.rpc("applicant_profile_detail", { p_application_id: openId }),
    ]);

    if (one) {
      const row = one as unknown as ApplicationDetail & { cv_url: string | null };
      detailCard = cards.get(openId) ?? (await applicantCards(supabase, [openId])).get(openId);
      detail = {
        ...row,
        applicant: detailCard ? { headline: detailCard.headline, avatar_url: null } : null,
      };
      profileDetail = profile?.[0] ?? null;
      events = (log ?? []) as unknown as ApplicationEventItem[];
      cvSt = cvStatus(row.cv_url);
    }
  }

  const closeHref = href(params, { id: null });
  // Where the status form should land: back on this exact view, drawer open.
  const returnTo = href(params, { id: openId });

  return (
    <div>
      <PageHead
        eyebrow={dash.employer.inboxTitle}
        title={dash.employer.inboxTitle}
        sub={dash.employer.inboxSub}
      />

      {/* FILTERS ------------------------------------------------------- */}
      <form action={BASE} className="mb-4 flex flex-wrap items-end gap-2.5">
        <div className="relative min-w-[220px] flex-1">
          <label htmlFor="q" className="eyebrow mb-1.5 block">
            {dash.employer.searchApplicants}
          </label>
          <Search
            className="absolute left-3.5 top-[calc(50%+9px)] h-4 w-4 -translate-y-1/2 text-faint"
            aria-hidden
          />
          <input
            id="q"
            name="q"
            defaultValue={params.q ?? ""}
            placeholder="Name or email address"
            className="field pl-10"
          />
        </div>

        <div>
          <label htmlFor="job" className="eyebrow mb-1.5 block">
            {dash.employer.filterJob}
          </label>
          <select
            id="job"
            name="job"
            defaultValue={params.job ?? ""}
            className="field w-[200px]"
          >
            <option value="">{dash.employer.filterAnyJob}</option>
            {jobs.map((j) => (
              <option key={j.id} value={j.id}>
                {j.title}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="sort" className="eyebrow mb-1.5 block">
            {dash.employer.sort}
          </label>
          <select id="sort" name="sort" defaultValue={sort} className="field w-[150px]">
            {SORTS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>

        {/* Chip state lives in the URL, so it must survive this submit. */}
        {status && <input type="hidden" name="status" value={status} />}
        <button type="submit" className="btn-primary shrink-0">
          {dash.common.apply}
        </button>
      </form>

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
            href={href(params, { status: status === s ? null : s, page: null, id: null })}
            className={`chip ${status === s ? "chip-active" : ""}`}
          >
            {applicationStatusLabels[s]}
          </Link>
        ))}
        <span className="w-px h-5 bg-line mx-1" aria-hidden />
        <Link
          href={href(params, { review: params.review === "unreviewed" ? null : "unreviewed", page: null, id: null })}
          className={`chip ${params.review === "unreviewed" ? "chip-active" : ""}`}
        >
          Not reviewed
        </Link>
        <Link
          href={href(params, { review: params.review === "seen" ? null : "seen", page: null, id: null })}
          className={`chip ${params.review === "seen" ? "chip-active" : ""}`}
        >
          Seen
        </Link>
        <Link
          href={href(params, { review: params.review === "final" ? null : "final", page: null, id: null })}
          className={`chip ${params.review === "final" ? "chip-active" : ""}`}
        >
          Final reviewed
        </Link>
        {(params.q || params.job || status || params.sort || params.review) && (
          <Link href={BASE} className="btn-ghost ml-auto text-xs">
            {dash.common.clear}
          </Link>
        )}
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title={
            params.q || params.job || status ? "Nothing matches" : dash.employer.emptyInbox
          }
          body={
            params.q || params.job || status
              ? "Try a shorter search term, or clear the filters."
              : dash.employer.emptyInboxBody
          }
          action={
            params.q || params.job || status ? (
              <Link href={BASE} className="btn-secondary">
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
        <>
          <TableFrame>
            <thead>
              <tr>
                <Th>Applicant</Th>
                <Th className="w-[190px]">{dash.employer.colRole}</Th>
                <Th className="w-[110px]">{dash.seeker.colApplied}</Th>
                <Th className="w-[120px]">Review</Th>
                <Th className="w-[130px] text-right">{dash.seeker.colStatus}</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const name = displayApplicant(row.applicant_name, row.applicant_email);
                const card = cards.get(row.id);
                return (
                  <Tr key={row.id}>
                    <Td>
                      <RowLink
                        href={href(params, { id: row.id })}
                        label={`${name}, ${applicationStatusLabels[row.status]}`}
                      >
                        <span className="flex items-center gap-2.5">
                          <Avatar
                            name={row.applicant_name}
                            email={row.applicant_email}
                            src={card?.avatarSrc}
                            size={30}
                          />
                          <span className="min-w-0">
                            <span className="block truncate font-500 text-ink">
                              {name}
                            </span>
                            <span className="block truncate text-xs text-muted">
                              {card?.headline ?? row.applicant_email}
                            </span>
                          </span>
                        </span>
                      </RowLink>
                    </Td>
                    <Td className="text-muted">
                      <span className="block truncate">
                        {row.job?.title ?? dash.drawer.roleNotRecorded}
                      </span>
                    </Td>
                    <Td className="whitespace-nowrap text-xs text-muted">
                      {timeAgo(row.applied_at)}
                    </Td>
                    <Td>
                      {(() => {
                        const rs = reviewSummaryFor(reviews, row.id);
                        return (
                          <ReviewStatusBadge
                            finalBy={rs.final?.reviewerName ?? null}
                            overviewCount={rs.overviews.length}
                          />
                        );
                      })()}
                    </Td>
                    <Td className="text-right">
                      <ApplicationStatusBadge status={row.status} />
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
            )}
          </div>
        </>
      )}

      <Drawer
        open={Boolean(detail)}
        closeHref={closeHref}
        title={
          detail
            ? displayApplicant(detail.applicant_name, detail.applicant_email)
            : dash.employer.inboxTitle
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
            avatarSrc={detailCard?.avatarSrc}
            showContact
            showNote
            profileDetail={profileDetail}
            statusControl={
              <StatusSelect
                applicationId={detail.id}
                current={detail.status}
                returnTo={returnTo}
                action={setApplicationStatus}
              />
            }
            noteControl={
              <NoteForm
                applicationId={detail.id}
                current={detail.employer_note}
                returnTo={returnTo}
                action={setApplicationStatus}
              />
            }
            reviewPanel={
              <ReviewPanel
                applicationId={detail.id}
                returnTo={returnTo}
                currentUserId={userId}
                summary={reviewSummaryFor(reviews, detail.id)}
              />
            }
          />
        )}
      </Drawer>

      <ToastFromSearchParams
        error={params.error}
        success={
          params.updated === "status"
            ? dash.drawer.statusUpdated
            : params.updated === "note"
              ? "Note saved."
              : params.reviewed === "final"
                ? "Final review recorded."
                : params.reviewed === "overview"
                  ? "Marked as seen."
                  : null
        }
      />
    </div>
  );
}

import Link from "next/link";
import { Briefcase, CheckCircle2, Inbox, Trophy } from "lucide-react";
import { requireProfile } from "@/lib/auth";
import { PageHead } from "@/components/dashboard-shell";
import { Avatar, EmptyState, StatCard } from "@/components/dashboard-ui";
import { ToastFromSearchParams } from "@/components/toast-from-search-params";
import { ApplicationStatusBadge } from "@/components/status-badge";
import { applicantCards } from "@/lib/applicant-cards";
import { timeAgo, displayApplicant } from "@/lib/utils";
import { dash } from "@/lib/content";
import type { ApplicationStatus } from "@/types/database";

const FEED_SIZE = 5;

interface AppRow {
  id: string;
  applicant_name: string | null;
  applicant_email: string;
  status: ApplicationStatus;
  applied_at: string;
  job: { id: string; title: string } | null;
}

/** First of the calendar month, for the "this month" counters. */
function monthStart(): string {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
}

export default async function EmployerOverview({
  searchParams,
}: {
  searchParams: Promise<{ posted?: string; error?: string; updated?: string }>;
}) {
  const { supabase, profile } = await requireProfile("employer");
  const params = await searchParams;

  // No company yet — nothing else on this page can work, so ask for that first
  // rather than showing an empty dashboard of zeros.
  if (!profile.company_id) {
    return (
      <div>
        <PageHead eyebrow="Employer" title="Set up your company" />
        <EmptyState
          icon={Briefcase}
          title="One step before you can post"
          body="Your listings hang off a company record, and PAC Africa verifies employers against it before anything goes live. Add it once and you are set."
          action={
            <Link href="/dashboard/employer/company" className="btn-accent">
              Add company profile
            </Link>
          }
        />
      </div>
    );
  }

  const since = monthStart();

  const [live, thisMonth, shortlisted, hired, { data: recent }, { data: company }] =
    await Promise.all([
      supabase
        .from("jobs")
        .select("id", { count: "exact", head: true })
        .eq("status", "published"),
      supabase
        .from("applications")
        .select("id", { count: "exact", head: true })
        .gte("applied_at", since),
      supabase
        .from("applications")
        .select("id", { count: "exact", head: true })
        .eq("status", "shortlisted"),
      supabase
        .from("applications")
        .select("id", { count: "exact", head: true })
        .eq("status", "hired"),
      supabase
        .from("applications")
        .select(
          "id, applicant_name, applicant_email, status, applied_at, job:jobs(id, title)"
        )
        .order("applied_at", { ascending: false })
        .limit(FEED_SIZE),
      supabase
        .from("companies")
        .select("name, verified, suspended_at")
        .eq("id", profile.company_id)
        .single(),
    ]);

  const feed = (recent ?? []) as unknown as AppRow[];
  // Headline and avatar come through the migration-020 accessor: the profiles
  // policy is own-row-or-admin, so an embedded join returns null here.
  const cards = await applicantCards(
    supabase,
    feed.map((row) => row.id)
  );

  const suspended = Boolean(
    (company as { suspended_at: string | null } | null)?.suspended_at
  );

  return (
    <div>
      <PageHead
        eyebrow={company?.verified ? "Verified employer" : "Awaiting verification"}
        title={company?.name ?? dash.employer.title}
        action={
          <Link href="/dashboard/employer/post" className="btn-accent">
            {dash.employer.newJob}
          </Link>
        }
      />

      <ToastFromSearchParams
        error={params.error}
        success={
          params.posted
            ? "Listing submitted. It goes live once PAC Africa approves it."
            : null
        }
      />

      {suspended && (
        <div
          role="alert"
          className="mb-6 rounded-card border border-red-500/25 bg-red-500/8 px-4 py-3 text-sm text-red-700 dark:text-red-400"
        >
          This account is suspended, so your listings are not visible on the site. Contact
          PAC Africa to sort it out.
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label={dash.employer.statActive}
          value={live.count ?? 0}
          hint={dash.employer.statActiveHint}
          icon={Briefcase}
          href="/dashboard/employer/jobs?status=published"
        />
        <StatCard
          label={dash.employer.statApplications}
          value={thisMonth.count ?? 0}
          icon={Inbox}
          href="/dashboard/employer/applications"
        />
        <StatCard
          label={dash.employer.statShortlisted}
          value={shortlisted.count ?? 0}
          icon={CheckCircle2}
          href="/dashboard/employer/applications?status=shortlisted"
        />
        <StatCard
          label={dash.employer.statHired}
          value={hired.count ?? 0}
          icon={Trophy}
          href="/dashboard/employer/applications?status=hired"
        />
      </div>

      <div className="mb-4 mt-10 flex items-baseline justify-between gap-4">
        <h2 className="font-display text-lg font-600 text-ink">
          {dash.employer.recentApplications}
        </h2>
        <Link
          href="/dashboard/employer/applications"
          className="text-sm text-accent-text transition-opacity duration-150 hover:opacity-70"
        >
          {dash.common.viewAll}
        </Link>
      </div>

      {feed.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title={dash.employer.emptyInbox}
          body={dash.employer.emptyInboxBody}
          action={
            <Link href="/dashboard/employer/jobs" className="btn-secondary">
              {dash.employer.jobsTitle}
            </Link>
          }
        />
      ) : (
        <ul className="clay divide-y divide-line">
          {feed.map((row) => (
            <li key={row.id}>
              <Link
                href={`/dashboard/employer/applications?id=${row.id}`}
                scroll={false}
                className="flex items-center gap-3 p-4 transition-colors duration-150 hover:bg-surface-raised/60"
              >
                <Avatar
                  name={row.applicant_name}
                  email={row.applicant_email}
                  src={cards.get(row.id)?.avatarSrc}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-500 text-ink">
                    {displayApplicant(row.applicant_name, row.applicant_email)}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-muted">
                    {row.job?.title ?? dash.drawer.roleNotRecorded} ·{" "}
                    {timeAgo(row.applied_at)}
                  </p>
                </div>
                <ApplicationStatusBadge status={row.status} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

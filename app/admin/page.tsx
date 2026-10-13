import Link from "next/link";
import { Briefcase, Building2, Inbox, ShieldAlert, Users } from "lucide-react";
import { requireProfile } from "@/lib/auth";
import { PageHead } from "@/components/dashboard-shell";
import { Avatar, EmptyState, StatCard } from "@/components/dashboard-ui";
import { ToastFromSearchParams } from "@/components/toast-from-search-params";
import { ApplicationStatusBadge } from "@/components/status-badge";
import { applicantCards } from "@/lib/applicant-cards";
import { displayApplicant, timeAgo } from "@/lib/utils";
import { dash } from "@/lib/content";
import type { ApplicationStatus } from "@/types/database";

const FEED_SIZE = 8;

interface RecentApp {
  id: string;
  applicant_name: string | null;
  applicant_email: string;
  wp_job_title: string | null;
  status: ApplicationStatus;
  applied_at: string;
  job: { title: string } | null;
}

function monthStart(): string {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
}

export default async function AdminOverview({
  searchParams,
}: {
  searchParams: Promise<{ updated?: string; error?: string }>;
}) {
  const { supabase } = await requireProfile("admin");
  const params = await searchParams;
  const since = monthStart();

  const [live, pending, seekers, employers, thisMonth, { data: recent }] =
    await Promise.all([
      supabase
        .from("jobs")
        .select("id", { count: "exact", head: true })
        .eq("status", "published"),
      supabase
        .from("jobs")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending_review"),
      supabase
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("role", "seeker"),
      supabase.from("companies").select("id", { count: "exact", head: true }),
      supabase
        .from("applications")
        .select("id", { count: "exact", head: true })
        .gte("applied_at", since),
      supabase
        .from("applications")
        .select(
          "id, applicant_name, applicant_email, wp_job_title, status, applied_at, job:jobs(title)"
        )
        .order("applied_at", { ascending: false })
        .limit(FEED_SIZE),
    ]);

  const feed = (recent ?? []) as unknown as RecentApp[];
  const cards = await applicantCards(
    supabase,
    feed.map((row) => row.id)
  );
  const queue = pending.count ?? 0;

  return (
    <div>
      <PageHead
        eyebrow="PAC Africa · Internal"
        title={dash.admin.title}
        action={
          <Link href="/admin/jobs/new" className="btn-accent">
            Post a job
          </Link>
        }
      />

      <ToastFromSearchParams
        error={params.error}
        success={
          params.updated === "suspended"
            ? "Account suspended."
            : params.updated === "reinstated"
              ? "Account reinstated."
              : params.updated
                ? "Updated."
                : null
        }
      />

      {/* The queue is the one number that means somebody has to do something,
          so it leads and it is the only card that changes colour. */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard
          label={dash.admin.statPending}
          value={queue}
          hint={dash.admin.statPendingHint}
          icon={ShieldAlert}
          href="/admin/moderation"
          tone="alert"
        />
        <StatCard
          label={dash.admin.statLive}
          value={live.count ?? 0}
          icon={Briefcase}
          href="/admin/jobs?status=published"
        />
        <StatCard
          label={dash.admin.statApplicationsMonth}
          value={thisMonth.count ?? 0}
          icon={Inbox}
          href="/admin/applications"
        />
        <StatCard
          label={dash.admin.statSeekers}
          value={seekers.count ?? 0}
          icon={Users}
          href="/admin/seekers"
        />
        <StatCard
          label={dash.admin.statEmployers}
          value={employers.count ?? 0}
          icon={Building2}
          href="/admin/employers"
        />
      </div>

      <div className="mb-4 mt-10 flex items-baseline justify-between gap-4">
        <h2 className="font-display text-lg font-600 text-ink">
          {dash.employer.recentApplications}
        </h2>
        <Link
          href="/admin/applications"
          className="text-sm text-accent-text transition-opacity duration-150 hover:opacity-70"
        >
          {dash.common.viewAll}
        </Link>
      </div>

      {feed.length === 0 ? (
        <EmptyState icon={Inbox} title="No applications yet" />
      ) : (
        <ul className="clay divide-y divide-line">
          {feed.map((row) => (
            <li key={row.id}>
              <Link
                href={`/admin/applications?id=${row.id}`}
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
                    {row.job?.title ?? row.wp_job_title ?? dash.drawer.roleNotRecorded} ·{" "}
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

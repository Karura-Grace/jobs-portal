import { Bell } from "lucide-react";
import { requireCompleteSeekerProfile } from "@/lib/auth";
import { PageHead } from "@/components/dashboard-shell";
import { EmptyState } from "@/components/dashboard-ui";
import { ToastFromSearchParams } from "@/components/toast-from-search-params";
import { dash, jobTypeLabels } from "@/lib/content";
import { createJobAlert, deleteJobAlert, toggleJobAlert } from "./actions";
import type { JobAlert, JobCategory, JobLocation, JobType } from "@/types/database";

const JOB_TYPES: JobType[] = ["full_time", "part_time", "freelance", "contract", "internship"];

export default async function JobAlerts({
  searchParams,
}: {
  searchParams: Promise<{ created?: string; deleted?: string; error?: string }>;
}) {
  const { supabase, userId } = await requireCompleteSeekerProfile("alerts");
  const params = await searchParams;

  const [{ data: alerts }, { data: categories }, { data: locations }] = await Promise.all([
    supabase
      .from("job_alerts")
      .select("*, category:job_categories(name), location:job_locations(name)")
      .eq("profile_id", userId)
      .order("created_at", { ascending: false }),
    supabase.from("job_categories").select("id, name").order("name").limit(300),
    supabase.from("job_locations").select("id, name").order("name").limit(300),
  ]);

  const rows = (alerts ?? []) as unknown as (JobAlert & {
    category: Pick<JobCategory, "name"> | null;
    location: Pick<JobLocation, "name"> | null;
  })[];

  return (
    <div>
      <PageHead
        eyebrow={dash.common.settings}
        title={dash.seeker.alertsTitle}
        sub={dash.seeker.alertsSub}
      />

      <ToastFromSearchParams
        error={params.error}
        success={
          params.created ? "Alert created." : params.deleted ? "Alert deleted." : null
        }
      />

      {rows.length === 0 ? (
        <EmptyState icon={Bell} title={dash.seeker.emptyAlerts} body={dash.seeker.emptyAlertsBody} />
      ) : (
        <ul className="clay mb-8 divide-y divide-line">
          {rows.map((alert) => (
            <li key={alert.id} className="flex items-center justify-between gap-4 p-4">
              <div className="min-w-0">
                <p className="truncate text-sm text-ink">
                  {[
                    alert.keyword,
                    alert.category?.name,
                    alert.location?.name,
                    alert.job_type ? jobTypeLabels[alert.job_type] : null,
                  ]
                    .filter(Boolean)
                    .join(" · ") || "Any new role"}
                </p>
                <p className="mt-0.5 text-xs text-muted">
                  {alert.frequency === "weekly"
                    ? dash.seeker.alertFrequencyWeekly
                    : dash.seeker.alertFrequencyDaily}
                  {!alert.is_active && ` · ${dash.seeker.alertPaused}`}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <form action={toggleJobAlert}>
                  <input type="hidden" name="id" value={alert.id} />
                  <input type="hidden" name="is_active" value={String(alert.is_active)} />
                  <button type="submit" className="btn-secondary text-xs">
                    {alert.is_active ? dash.seeker.alertPause : dash.seeker.alertResume}
                  </button>
                </form>
                <form action={deleteJobAlert}>
                  <input type="hidden" name="id" value={alert.id} />
                  <button type="submit" className="btn-ghost text-xs text-red-600 dark:text-red-400">
                    {dash.seeker.alertDelete}
                  </button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="clay p-6">
        <p className="mb-4 font-display text-base font-600 text-ink">{dash.seeker.alertCreate}</p>
        <form action={createJobAlert} className="grid gap-3 sm:grid-cols-2">
          <input
            name="keyword"
            placeholder={dash.seeker.alertKeywordPlaceholder}
            className="field sm:col-span-2"
          />
          <select name="category_id" defaultValue="" className="field">
            <option value="">{dash.seeker.alertAnyCategory}</option>
            {(categories ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <select name="location_id" defaultValue="" className="field">
            <option value="">{dash.seeker.alertAnyLocation}</option>
            {(locations ?? []).map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
          <select name="job_type" defaultValue="" className="field">
            <option value="">{dash.seeker.alertAnyType}</option>
            {JOB_TYPES.map((t) => (
              <option key={t} value={t}>
                {jobTypeLabels[t]}
              </option>
            ))}
          </select>
          <select name="frequency" defaultValue="daily" className="field">
            <option value="daily">{dash.seeker.alertFrequencyDaily}</option>
            <option value="weekly">{dash.seeker.alertFrequencyWeekly}</option>
          </select>
          <button type="submit" className="btn-accent sm:col-span-2">
            {dash.seeker.alertCreate}
          </button>
        </form>
      </div>
    </div>
  );
}

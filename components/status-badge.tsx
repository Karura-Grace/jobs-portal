import { applicationStatusLabels, jobStatusLabels } from "@/lib/content";
import type { ApplicationStatus, JobStatus } from "@/types/database";

/**
 * Status pills. Labels come from lib/content.ts (brief §12) so the database
 * vocabulary and the displayed vocabulary can differ — `pending` reads as
 * "Applied", `published` as "Active".
 *
 * Each status gets a distinct colour (brief §8). Every pair is specified for
 * both modes rather than relying on one tint to work on charcoal and on bone:
 * the -700 text needed in light mode is unreadable on a dark surface, so the
 * dark variants step up to -400.
 */
const APPLICATION_STYLES: Record<ApplicationStatus, string> = {
  pending: "bg-surface-raised text-muted",
  under_review: "bg-amber-500/12 text-amber-700 dark:text-amber-400",
  shortlisted: "bg-emerald-500/12 text-emerald-700 dark:text-emerald-400",
  rejected: "bg-red-500/12 text-red-700 dark:text-red-400",
  hired: "bg-accent/15 text-accent-text",
};

const JOB_STYLES: Record<JobStatus, string> = {
  draft: "bg-surface-raised text-muted",
  pending_review: "bg-amber-500/12 text-amber-700 dark:text-amber-400",
  published: "bg-emerald-500/12 text-emerald-700 dark:text-emerald-400",
  paused: "bg-sky-500/12 text-sky-700 dark:text-sky-400",
  expired: "bg-surface-raised text-faint",
  closed: "bg-red-500/12 text-red-700 dark:text-red-400",
};

function Badge({ label, className }: { label: string; className: string }) {
  return (
    <span
      className={`shrink-0 rounded-pill px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-wider ${className}`}
    >
      {label}
    </span>
  );
}

export function ApplicationStatusBadge({ status }: { status: ApplicationStatus }) {
  return (
    <Badge
      label={applicationStatusLabels[status] ?? status}
      className={APPLICATION_STYLES[status] ?? "bg-surface-raised text-muted"}
    />
  );
}

export function JobStatusBadge({ status }: { status: JobStatus }) {
  return (
    <Badge
      label={jobStatusLabels[status] ?? status}
      className={JOB_STYLES[status] ?? "bg-surface-raised text-muted"}
    />
  );
}

/** Whether HR has looked at this one yet (migration 029). */
export function ReviewStatusBadge({
  finalBy,
  overviewCount,
}: {
  finalBy: string | null;
  overviewCount: number;
}) {
  if (finalBy) {
    return <Badge label={`Final · ${finalBy}`} className="bg-emerald-500/12 text-emerald-700 dark:text-emerald-400" />;
  }
  if (overviewCount > 0) {
    return (
      <Badge
        label={`Seen · ${overviewCount}`}
        className="bg-amber-500/12 text-amber-700 dark:text-amber-400"
      />
    );
  }
  return <Badge label="Not reviewed" className="bg-surface-raised text-faint" />;
}

/**
 * Flags (never hides or auto-rejects) an application against its job's
 * optional requirement fields (migration 033). `null` means the job set no
 * requirements — nothing to judge, so nothing renders.
 */
export function RequirementsBadge({ meets }: { meets: boolean | null }) {
  if (meets === null) return null;
  return meets ? (
    <Badge label="Meets requirements" className="bg-emerald-500/12 text-emerald-700 dark:text-emerald-400" />
  ) : (
    <Badge label="Below requirements" className="bg-amber-500/12 text-amber-700 dark:text-amber-400" />
  );
}

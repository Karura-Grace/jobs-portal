import Link from "next/link";
import { MapPin, Bookmark } from "lucide-react";
import { formatSalary, timeAgo } from "@/lib/utils";
import { job as jobCopy, jobTypeLabels, employmentLevelLabels } from "@/lib/content";
import { toggleSavedJob } from "@/app/actions/saved-jobs";
import type { Job } from "@/types/database";

/**
 * The clay job card. One component for the homepage feed, browse results and
 * saved jobs (brief §4).
 *
 * NO EMPLOYER, NO SALARY. The company behind a role is admin-only information —
 * PAC sits between applicant and employer — so this renders no company name, no
 * logo and no verified badge. Salaries were removed from the product. The
 * seniority tag takes the space the company line used to hold, so the card still
 * has three lines of substance rather than looking half-filled.
 *
 * Hover is CSS, not Framer Motion: it fires on every card on every page and runs
 * as a compositor-only transform off the main thread. Framer is reserved for the
 * drawer, modals and scroll reveals where interruptibility earns its keep.
 *
 * The save button mutates, so it is a form — and a form cannot live inside the
 * card's <Link>. The link is an absolutely positioned overlay instead, with the
 * save button stacked above it.
 */
export function JobCard({
  job,
  saved = false,
  returnTo = "/jobs",
  showSave = true,
  matchPercent = null,
}: {
  job: Job;
  saved?: boolean;
  returnTo?: string;
  showSave?: boolean;
  /**
   * Skill-overlap match for the signed-in seeker viewing this card
   * (lib/match.ts). Null means either the viewer has no skills on file, or
   * the job has no required_skills to grade against — never shown as 0%.
   */
  matchPercent?: number | null;
}) {
  const location = job.is_remote
    ? "Remote"
    : (job.location?.name ?? job.location_text ?? "Kenya");

  return (
    <article
      className="group clay relative isolate h-full overflow-hidden p-5
                 transition-[transform,box-shadow] duration-200 ease-out
                 hover:-translate-y-1 hover:shadow-clay-lifted
                 focus-within:-translate-y-1 focus-within:shadow-clay-lifted"
    >
      {/* The vetting stamp, carried over from the previous design — the one mark
          in here that is ours. Fades in on hover. */}
      <span
        aria-hidden
        className="absolute inset-y-0 left-0 w-[3px] bg-accent opacity-0
                   transition-opacity duration-200 ease-out
                   group-hover:opacity-100 group-focus-within:opacity-100"
      />

      {/* prefetch off: this link scrolls into view on every listing page for
          every visitor, and the RSC prefetch fetch is a real edge request —
          with a dozen cards per page that adds up fast for a link people
          mostly never click. */}
      <Link
        href={`/jobs/${job.slug}`}
        className="absolute inset-0 z-0"
        aria-label={job.title}
        prefetch={false}
      >
        <span className="sr-only">{job.title}</span>
      </Link>

      <div className="pointer-events-none relative z-[1] pr-9">
        <span className="eyebrow block truncate">
          {job.category?.name ?? "General"}
        </span>

        <div className="mt-1.5 flex items-center gap-2">
          <h3
            className="truncate font-display text-lg font-600 tracking-tight text-ink
                       transition-colors duration-200 ease-out group-hover:text-accent-text"
          >
            {job.title}
          </h3>
          {matchPercent !== null && (
            <span className="clay-raised shrink-0 rounded-pill px-2 py-0.5 font-mono text-[10px] font-500 text-accent-text">
              {matchPercent}% match
            </span>
          )}
        </div>

        <p className="mt-2 flex items-center gap-1.5 text-sm text-muted">
          <MapPin className="h-3.5 w-3.5 shrink-0" strokeWidth={2} aria-hidden />
          <span className="truncate">{location}</span>
        </p>

        {/* Salary is optional — when it is unset the card says nothing about
            pay rather than showing a "not disclosed" placeholder, which reads
            as a gap. Seniority holds the line either way. */}
        {job.salary_min || job.salary_max ? (
          <p className="mt-1.5 text-sm font-medium text-ink">
            {formatSalary(job.salary_min, job.salary_max, job.salary_currency)}
          </p>
        ) : (
          <p className="mt-1 text-sm text-muted">
            {employmentLevelLabels[job.employment_level] ?? job.employment_level} level
          </p>
        )}

        <div className="mt-4 flex items-center justify-between gap-3">
          <span className="clay-raised rounded-pill px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-muted">
            {jobTypeLabels[job.job_type] ?? job.job_type}
          </span>
          {/* text-muted, not text-faint — faint is for non-text use only
              (an icon, a decorative dot), never body text. Lighthouse
              caught this as an AA contrast failure: 3.41:1 where text
              needs 4.5:1. */}
          <span className="font-mono text-[11px] text-muted">
            {timeAgo(job.original_date ?? job.created_at)}
          </span>
        </div>
      </div>

      {showSave && (
        <form action={toggleSavedJob} className="absolute right-3 top-3 z-[2]">
          <input type="hidden" name="job_id" value={job.id} />
          <input type="hidden" name="return_to" value={returnTo} />
          <button
            type="submit"
            aria-label={saved ? jobCopy.unsave : jobCopy.save}
            title={saved ? jobCopy.unsave : jobCopy.save}
            className={`press grid h-8 w-8 place-items-center rounded-pill
                        transition-[opacity,color,background-color] duration-200 ease-out
                        hover:bg-surface-raised
                        ${
                          saved
                            ? "text-accent-text opacity-100"
                            : "text-faint opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100"
                        }`}
          >
            <Bookmark
              className="h-4 w-4"
              strokeWidth={2}
              fill={saved ? "currentColor" : "none"}
              aria-hidden
            />
          </button>
        </form>
      )}
    </article>
  );
}

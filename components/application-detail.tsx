import Link from "next/link";
import { Mail, Phone } from "lucide-react";
import { Avatar } from "@/components/dashboard-ui";
import { ApplicationStatusBadge, RequirementsBadge } from "@/components/status-badge";
import { CvLink } from "@/components/cv-link";
import { applicationStatusLabels, dash, educationLevelLabels, noticePeriodLabels } from "@/lib/content";
import { displayApplicant } from "@/lib/utils";
import type { CvLink as CvLinkValue } from "@/lib/cv";
import type { ApplicationStatus, EducationLevel, NoticePeriod } from "@/types/database";

type CvProp = { status: "none" | "legacy" | "ready"; onOpen?: () => Promise<CvLinkValue> };

/**
 * The body of an application drawer. One component, three audiences:
 *
 *  - the seeker looking at their own application (no contact block, no notes)
 *  - the employer working through their inbox (everything, editable)
 *  - the admin, who sees everything but changes nothing — moving an application
 *    through its stages is the employer's decision, per the brief.
 *
 * Which of those it is comes from the props rather than from a role check
 * inside, so the page that renders it decides, and the page is where the auth
 * check already happened.
 */

export type ApplicationDetail = {
  id: string;
  applicant_name: string | null;
  applicant_email: string;
  applicant_phone: string | null;
  cover_letter: string | null;
  status: ApplicationStatus;
  employer_note: string | null;
  applied_at: string;
  wp_post_id: number | null;
  wp_job_title: string | null;
  applicant: { headline: string | null; avatar_url: string | null } | null;
  job: { id: string; title: string; slug: string } | null;
  /** null = job had no requirements set (migration 033). */
  meets_requirements: boolean | null;
};

/** From the applicant_profile_detail() RPC (migration 033) — fetched once
 * per opened drawer by the page, not eagerly on every list row. */
export type ApplicantProfileDetail = {
  years_experience: number | null;
  education_level: EducationLevel | null;
  industry_name: string | null;
  expected_salary: number | null;
  current_salary: number | null;
  notice_period: NoticePeriod | null;
  education: {
    school_name: string;
    field_of_study: string | null;
    level: EducationLevel | null;
    start_year: number | null;
    end_year: number | null;
  }[];
  work_experience: {
    company_name: string;
    job_title: string;
    start_date: string | null;
    end_date: string | null;
    description: string | null;
  }[];
};

export type ApplicationEventItem = {
  id: string;
  from_status: ApplicationStatus | null;
  to_status: ApplicationStatus;
  created_at: string;
  note: string | null;
};

const dateTime = (iso: string) =>
  new Date(iso).toLocaleString("en-KE", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

export function ApplicationDetailBody({
  application,
  events,
  cv,
  avatarSrc,
  showContact = false,
  showNote = false,
  statusControl,
  noteControl,
  reviewPanel,
  profileDetail,
}: {
  application: ApplicationDetail;
  events: ApplicationEventItem[];
  cv: CvProp;
  avatarSrc?: string | null;
  /** Email and phone. Withheld from the applicant's own view — they know it. */
  showContact?: boolean;
  /** The internal note. Never shown to the applicant. */
  showNote?: boolean;
  /** Employer-only: the status selector form. */
  statusControl?: React.ReactNode;
  /** Employer-only: the note form. */
  noteControl?: React.ReactNode;
  /** Employer/admin-only: the HR review log and prompt (migration 029). */
  reviewPanel?: React.ReactNode;
  /** Employer/admin-only, fetched by the page via applicant_profile_detail(). */
  profileDetail?: ApplicantProfileDetail | null;
}) {
  const role = application.job?.title ?? application.wp_job_title;

  return (
    <div className="space-y-6">
      {/* WHO ---------------------------------------------------------- */}
      <div className="flex items-start gap-3">
        <Avatar
          name={application.applicant_name}
          email={application.applicant_email}
          src={avatarSrc}
          size={44}
        />
        <div className="min-w-0">
          <p className="font-display text-base font-600 leading-tight text-ink">
            {displayApplicant(application.applicant_name, application.applicant_email)}
          </p>
          {application.applicant?.headline && (
            <p className="mt-0.5 text-sm text-muted">{application.applicant.headline}</p>
          )}
          {application.wp_post_id !== null && (
            <p className="eyebrow mt-1">{dash.drawer.archived}</p>
          )}
        </div>
      </div>

      {showContact && (
        <div className="clay-inset space-y-1.5 p-3.5">
          <p className="eyebrow">{dash.drawer.contact}</p>
          <a
            href={`mailto:${application.applicant_email}`}
            className="flex items-center gap-2 text-sm text-ink transition-colors duration-150 hover:text-accent-text"
          >
            <Mail className="h-3.5 w-3.5 shrink-0 text-faint" aria-hidden />
            <span className="truncate">{application.applicant_email}</span>
          </a>
          {application.applicant_phone && (
            <a
              href={`tel:${application.applicant_phone.replace(/\s+/g, "")}`}
              className="flex items-center gap-2 text-sm text-ink transition-colors duration-150 hover:text-accent-text"
            >
              <Phone className="h-3.5 w-3.5 shrink-0 text-faint" aria-hidden />
              {application.applicant_phone}
            </a>
          )}
        </div>
      )}

      {/* WHAT FOR ----------------------------------------------------- */}
      <dl className="space-y-3 text-sm">
        <div>
          <dt className="eyebrow">{dash.drawer.appliedTo}</dt>
          <dd className="mt-1 text-ink">
            {application.job ? (
              <Link
                href={`/jobs/${application.job.slug}`}
                className="text-accent-text transition-opacity duration-150 hover:opacity-70"
              >
                {application.job.title}
              </Link>
            ) : (
              (role ?? <span className="text-faint">{dash.drawer.roleNotRecorded}</span>)
            )}
          </dd>
        </div>
        <div>
          <dt className="eyebrow">{dash.drawer.appliedOn}</dt>
          <dd className="mt-1 text-ink">{dateTime(application.applied_at)}</dd>
        </div>
        <div>
          <dt className="eyebrow">{dash.drawer.statusLabel}</dt>
          <dd className="mt-1.5 flex flex-wrap items-center gap-2">
            {statusControl ?? <ApplicationStatusBadge status={application.status} />}
            <RequirementsBadge meets={application.meets_requirements} />
          </dd>
        </div>
      </dl>

      {/* HIRING PROFILE (migration 033) — employer/admin only; fetched by the
          page via applicant_profile_detail(), scoped to who may see it. */}
      {profileDetail && (
        <div className="border-t border-line pt-5">
          <p className="eyebrow mb-2">{dash.drawer.hiringProfile}</p>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            {profileDetail.years_experience !== null && (
              <div>
                <dt className="text-xs text-muted">{dash.seeker.yearsExperience}</dt>
                <dd className="text-ink">{profileDetail.years_experience}</dd>
              </div>
            )}
            {profileDetail.education_level && (
              <div>
                <dt className="text-xs text-muted">{dash.seeker.educationLevel}</dt>
                <dd className="text-ink">{educationLevelLabels[profileDetail.education_level]}</dd>
              </div>
            )}
            {profileDetail.industry_name && (
              <div>
                <dt className="text-xs text-muted">{dash.seeker.industry}</dt>
                <dd className="text-ink">{profileDetail.industry_name}</dd>
              </div>
            )}
            {profileDetail.notice_period && (
              <div>
                <dt className="text-xs text-muted">{dash.seeker.noticePeriod}</dt>
                <dd className="text-ink">{noticePeriodLabels[profileDetail.notice_period]}</dd>
              </div>
            )}
            {profileDetail.expected_salary !== null && (
              <div>
                <dt className="text-xs text-muted">{dash.seeker.expectedSalary}</dt>
                <dd className="text-ink">{profileDetail.expected_salary.toLocaleString()}</dd>
              </div>
            )}
            {profileDetail.current_salary !== null && (
              <div>
                <dt className="text-xs text-muted">{dash.seeker.currentSalary}</dt>
                <dd className="text-ink">{profileDetail.current_salary.toLocaleString()}</dd>
              </div>
            )}
          </dl>

          {profileDetail.work_experience.length > 0 && (
            <div className="mt-4">
              <p className="text-xs text-muted">{dash.seeker.experienceTitle}</p>
              <ul className="mt-1.5 space-y-2">
                {profileDetail.work_experience.map((w, i) => (
                  <li key={i} className="text-sm text-ink">
                    <span className="font-500">{w.job_title}</span> · {w.company_name}
                    <span className="ml-1.5 text-xs text-muted">
                      ({[w.start_date, w.end_date ?? "Present"].filter(Boolean).join(" – ")})
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {profileDetail.education.length > 0 && (
            <div className="mt-4">
              <p className="text-xs text-muted">{dash.seeker.educationTitle}</p>
              <ul className="mt-1.5 space-y-2">
                {profileDetail.education.map((e, i) => (
                  <li key={i} className="text-sm text-ink">
                    <span className="font-500">{e.school_name}</span>
                    {e.field_of_study ? ` · ${e.field_of_study}` : ""}
                    {e.level && (
                      <span className="ml-1.5 text-xs text-muted">
                        ({educationLevelLabels[e.level]})
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* CV ----------------------------------------------------------- */}
      <div className="border-t border-line pt-5">
        <CvLink status={cv.status} onOpen={cv.onOpen} />
      </div>

      {/* COVER LETTER ------------------------------------------------- */}
      <div className="border-t border-line pt-5">
        <p className="eyebrow mb-2">{dash.drawer.coverLetter}</p>
        {application.cover_letter ? (
          <p className="whitespace-pre-line text-sm leading-relaxed text-ink/90">
            {application.cover_letter}
          </p>
        ) : (
          <p className="text-sm text-faint">{dash.drawer.noCoverLetter}</p>
        )}
      </div>

      {/* NOTES -------------------------------------------------------- */}
      {showNote && (
        <div className="border-t border-line pt-5">
          <p className="eyebrow">{dash.drawer.notesLabel}</p>
          <p className="mb-2.5 mt-1 text-xs text-muted">{dash.drawer.notesHint}</p>
          {noteControl ??
            (application.employer_note ? (
              <p className="whitespace-pre-line border-l-2 border-accent/40 pl-3 text-sm text-ink/90">
                {application.employer_note}
              </p>
            ) : (
              <p className="text-sm text-faint">No notes.</p>
            ))}
        </div>
      )}

      {reviewPanel}

      {/* HISTORY ------------------------------------------------------ */}
      <div className="border-t border-line pt-5">
        <p className="eyebrow mb-3">{dash.drawer.activityLabel}</p>
        {events.length === 0 ? (
          <p className="text-sm text-faint">{dash.common.noActivity}</p>
        ) : (
          <ol className="space-y-3">
            {events.map((event) => (
              <li key={event.id} className="relative pl-4">
                <span
                  aria-hidden
                  className="absolute left-0 top-[7px] h-1.5 w-1.5 rounded-pill bg-accent/70"
                />
                <p className="text-sm text-ink">
                  {event.from_status
                    ? `${applicationStatusLabels[event.from_status]} → ${
                        applicationStatusLabels[event.to_status]
                      }`
                    : applicationStatusLabels[event.to_status]}
                </p>
                <p className="mt-0.5 text-xs text-muted">{dateTime(event.created_at)}</p>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}

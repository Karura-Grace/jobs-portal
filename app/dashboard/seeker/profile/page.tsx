import { Check } from "lucide-react";
import { requireProfile } from "@/lib/auth";
import { signMyProfileCv } from "@/lib/cv-actions";
import { CV_ACCEPT, CV_MAX_BYTES, cvStatus } from "@/lib/cv";
import { avatarUrl, IMAGE_ACCEPT } from "@/lib/avatar";
import { CvLink } from "@/components/cv-link";
import { PageHead } from "@/components/dashboard-shell";
import { Avatar } from "@/components/dashboard-ui";
import { ToastFromSearchParams } from "@/components/toast-from-search-params";
import { completeness, profileChecklist } from "@/lib/profile";
import { cv as cvCopy, dash, educationLevelLabels, noticePeriodLabels } from "@/lib/content";
import { updateProfile, uploadAvatar, uploadCv } from "../actions";
import {
  addEducation,
  addWorkExperience,
  deleteEducation,
  deleteWorkExperience,
} from "../hiring-profile-actions";
import type { EducationLevel, NoticePeriod } from "@/types/database";

const EDUCATION_LEVELS: EducationLevel[] = [
  "high_school",
  "certificate",
  "diploma",
  "bachelors",
  "masters",
  "doctorate",
];
const NOTICE_PERIODS: NoticePeriod[] = [
  "immediate",
  "two_weeks",
  "one_month",
  "two_months",
  "three_plus_months",
];

export default async function SeekerProfilePage({
  searchParams,
}: {
  searchParams: Promise<{
    saved?: string;
    cv?: string;
    avatar?: string;
    error?: string;
    locked?: string;
  }>;
}) {
  const { supabase, profile } = await requireProfile("seeker");
  const params = await searchParams;

  const avatarSrc = await avatarUrl(supabase, profile.avatar_url);
  const cvSt = cvStatus(profile.cv_url);
  const hasUsableCv = cvSt === "ready";

  const [{ data: categories }, { data: educationRows }, { data: experienceRows }] =
    await Promise.all([
      supabase.from("job_categories").select("id, name").order("name").limit(300),
      supabase
        .from("profile_education")
        .select("*")
        .eq("profile_id", profile.id)
        .order("end_year", { ascending: false, nullsFirst: true }),
      supabase
        .from("profile_work_experience")
        .select("*")
        .eq("profile_id", profile.id)
        .order("end_date", { ascending: false, nullsFirst: true }),
    ]);

  const hasEducation = (educationRows?.length ?? 0) > 0;
  const hasWorkExperience = (experienceRows?.length ?? 0) > 0;
  const checks = profileChecklist(profile, hasUsableCv, hasEducation, hasWorkExperience);
  const progress = completeness(checks);
  const outstanding = checks.filter((c) => !c.done);

  return (
    <div>
      <PageHead
        eyebrow="Your details"
        title={dash.seeker.profileTitle}
        sub={dash.seeker.profileSub}
      />

      <ToastFromSearchParams
        error={params.error}
        success={
          params.error
            ? null
            : params.cv
              ? "CV uploaded."
              : params.avatar
                ? "Photo updated."
                : params.saved
                  ? "Profile saved."
                  : null
        }
      />

      {params.locked && dash.seeker.lockedFeatureNames[params.locked] && (
        <div className="clay relative mb-8 overflow-hidden p-6">
          <div aria-hidden className="absolute inset-y-0 left-0 w-[3px] bg-accent" />
          <p className="eyebrow">Locked</p>
          <p className="mt-1 font-display text-lg font-600 text-ink">
            {dash.seeker.lockedFeatureNames[params.locked]} isn&apos;t unlocked yet
          </p>
          <p className="mt-1 max-w-lg text-sm leading-relaxed text-muted">
            {dash.seeker.lockedBanner(dash.seeker.lockedFeatureNames[params.locked])}
          </p>
        </div>
      )}

      {/* COMPLETENESS -------------------------------------------------
          Named against what an employer sees, not against database columns,
          and only listing fields a seeker can actually finish. */}
      <section className="clay mb-8 p-6">
        <div className="mb-3 flex items-baseline justify-between gap-4">
          <h2 className="font-display text-lg font-600 text-ink">
            {progress.percent === 100 ? "Your profile is complete" : "Finish your profile"}
          </h2>
          <span className="font-mono text-xs text-muted">
            {progress.done}/{progress.total}
          </span>
        </div>

        <div
          className="clay-inset h-1.5 overflow-hidden rounded-pill"
          role="progressbar"
          aria-valuenow={progress.percent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Profile completeness"
        >
          <div
            className="h-full rounded-pill bg-accent transition-[width] duration-500 ease-out"
            style={{ width: `${progress.percent}%` }}
          />
        </div>

        {outstanding.length > 0 ? (
          <ul className="mt-4 space-y-2">
            {outstanding.map((check) => (
              <li key={check.label} className="text-sm">
                <span className="font-500 text-ink">{check.label}</span>
                <span className="text-muted"> — {check.why}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 text-sm text-muted">
            Nothing outstanding. Applications will carry all of this across.
          </p>
        )}
      </section>

      {/* PHOTO ------------------------------------------------------- */}
      <section className="clay mb-8 p-6">
        <h2 className="font-display text-lg font-600 text-ink">Photo</h2>
        <p className="mb-4 mt-1 max-w-lg text-sm text-muted">
          Optional. Shown to employers you have applied to, alongside your name — nowhere
          public, and never on a listing.
        </p>
        <form action={uploadAvatar} className="flex flex-wrap items-center gap-4">
          <Avatar
            name={profile.full_name}
            email={profile.email}
            src={avatarSrc}
            size={56}
          />
          <label htmlFor="avatar" className="sr-only">
            Choose a photo
          </label>
          <input
            id="avatar"
            type="file"
            name="avatar"
            accept={IMAGE_ACCEPT}
            required
            className="min-w-0 flex-1 text-sm text-ink file:mr-3 file:cursor-pointer file:rounded-card file:border file:border-line file:bg-surface-raised file:px-3 file:py-2 file:text-sm file:font-medium file:text-ink hover:file:border-accent"
          />
          <button type="submit" className="btn-secondary shrink-0">
            {profile.avatar_url ? "Replace photo" : "Upload photo"}
          </button>
        </form>
        <p className="mt-2 text-xs text-muted">JPEG, PNG or WebP, up to 2MB.</p>
      </section>

      {/* CV ---------------------------------------------------------- */}
      <section className="clay mb-8 p-6">
        <h2 className="font-display text-lg font-600 text-ink">Curriculum vitae</h2>
        <p className="mb-4 mt-1 text-sm text-muted">{cvCopy.constraint}</p>

        {cvSt === "legacy" && (
          <p className="mb-4 rounded-card border border-line px-4 py-3 text-sm text-muted">
            We hold a CV for you from the previous version of this site, but it is not
            readable yet while we move those files across. Uploading it again here is the
            quickest way to have it attached to your account.
          </p>
        )}

        {hasUsableCv && (
          <p className="mb-4 flex flex-wrap items-center gap-2 text-sm">
            <Check className="h-4 w-4 shrink-0 text-accent-text" aria-hidden />
            <span className="text-ink">{cvCopy.onFile}</span>
            <CvLink status={cvSt} onOpen={signMyProfileCv} compact />
          </p>
        )}

        <form action={uploadCv} className="flex flex-col gap-3 sm:flex-row">
          <label htmlFor="cv" className="sr-only">
            Choose a CV to upload
          </label>
          <input
            id="cv"
            type="file"
            name="cv"
            accept={CV_ACCEPT}
            required
            className="min-w-0 flex-1 text-sm text-ink file:mr-3 file:cursor-pointer file:rounded-card file:border file:border-line file:bg-surface-raised file:px-3 file:py-2 file:text-sm file:font-medium file:text-ink hover:file:border-accent"
          />
          <button type="submit" className="btn-secondary shrink-0">
            {hasUsableCv ? cvCopy.replace : cvCopy.upload}
          </button>
        </form>
        <p className="mt-2 text-xs text-muted">
          Maximum {Math.round(CV_MAX_BYTES / (1024 * 1024))}MB. Only you, PAC Africa, and
          employers you apply to can open it.
        </p>
      </section>

      {/* DETAILS ----------------------------------------------------- */}
      <form action={updateProfile} className="clay max-w-2xl space-y-5 p-6">
        <Field
          label="Full name"
          name="full_name"
          defaultValue={profile.full_name}
          hint="Employers see this instead of your email address."
        />
        <Field
          label="Headline"
          name="headline"
          defaultValue={profile.headline}
          placeholder="e.g. Finance graduate seeking entry-level roles"
        />

        <div>
          <label htmlFor="bio" className="eyebrow mb-2 block">
            About you
          </label>
          <textarea
            id="bio"
            name="bio"
            rows={5}
            defaultValue={profile.bio ?? ""}
            className="field resize-y"
          />
        </div>

        <div>
          <label htmlFor="skills" className="eyebrow mb-2 block">
            Skills
          </label>
          <input
            id="skills"
            name="skills"
            defaultValue={profile.skills?.join(", ") ?? ""}
            placeholder="Comma separated — e.g. Excel, QuickBooks, IFRS"
            className="field"
          />
          {/* Echoing them back is how someone can tell the commas split the way
              they expected, without saving first. */}
          {profile.skills && profile.skills.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {profile.skills.map((skill) => (
                <span
                  key={skill}
                  className="rounded-pill bg-surface-raised px-2.5 py-1 text-xs text-ink"
                >
                  {skill}
                </span>
              ))}
            </div>
          )}
        </div>

        <Field label="Phone" name="phone" defaultValue={profile.phone} />
        <Field
          label="Location"
          name="address"
          defaultValue={profile.address}
          placeholder="e.g. Nairobi"
        />
        <Field
          label="LinkedIn"
          name="linkedin_url"
          defaultValue={profile.linkedin_url}
          placeholder="linkedin.com/in/your-name"
          hint="A full link or just your handle — both work."
        />

        {/* HIRING DETAILS (migration 033) — informational, not gating; the
            profile-completion gate (lib/auth.ts requireCompleteSeekerProfile)
            only checks name/phone/CV, none of these. */}
        <div className="grid gap-5 sm:grid-cols-2">
          <Field
            label={dash.seeker.yearsExperience}
            name="years_experience"
            type="number"
            defaultValue={profile.years_experience?.toString() ?? null}
          />
          <div>
            <label htmlFor="education_level" className="eyebrow mb-2 block">
              {dash.seeker.educationLevel}
            </label>
            <select
              id="education_level"
              name="education_level"
              defaultValue={profile.education_level ?? ""}
              className="field"
            >
              <option value="">{dash.seeker.selectPlaceholder}</option>
              {EDUCATION_LEVELS.map((level) => (
                <option key={level} value={level}>
                  {educationLevelLabels[level]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="industry_category_id" className="eyebrow mb-2 block">
              {dash.seeker.industry}
            </label>
            <select
              id="industry_category_id"
              name="industry_category_id"
              defaultValue={profile.industry_category_id ?? ""}
              className="field"
            >
              <option value="">{dash.seeker.selectPlaceholder}</option>
              {(categories ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="notice_period" className="eyebrow mb-2 block">
              {dash.seeker.noticePeriod}
            </label>
            <select
              id="notice_period"
              name="notice_period"
              defaultValue={profile.notice_period ?? ""}
              className="field"
            >
              <option value="">{dash.seeker.selectPlaceholder}</option>
              {NOTICE_PERIODS.map((period) => (
                <option key={period} value={period}>
                  {noticePeriodLabels[period]}
                </option>
              ))}
            </select>
          </div>
          <Field
            label={dash.seeker.expectedSalary}
            name="expected_salary"
            type="number"
            defaultValue={profile.expected_salary?.toString() ?? null}
          />
          <Field
            label={dash.seeker.currentSalary}
            name="current_salary"
            type="number"
            defaultValue={profile.current_salary?.toString() ?? null}
          />
        </div>

        <div className="flex flex-wrap items-center gap-4 pt-1">
          <button type="submit" className="btn-primary">
            {dash.common.save}
          </button>
          <span className="text-xs text-muted">Signed in as {profile.email}</span>
        </div>
      </form>

      {/* EDUCATION ----------------------------------------------------- */}
      <section className="clay mt-8 max-w-2xl p-6">
        <h2 className="font-display text-lg font-600 text-ink">{dash.seeker.educationTitle}</h2>
        {(educationRows ?? []).length === 0 ? (
          <p className="mt-2 text-sm text-muted">{dash.seeker.educationEmpty}</p>
        ) : (
          <ul className="mt-4 divide-y divide-line">
            {(educationRows ?? []).map((entry) => (
              <li key={entry.id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-500 text-ink">{entry.school_name}</p>
                  <p className="truncate text-xs text-muted">
                    {[
                      entry.field_of_study,
                      entry.level ? educationLevelLabels[entry.level as EducationLevel] : null,
                      entry.start_year || entry.end_year
                        ? `${entry.start_year ?? "?"}–${entry.end_year ?? "present"}`
                        : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
                <form action={deleteEducation}>
                  <input type="hidden" name="id" value={entry.id} />
                  <button type="submit" className="btn-ghost shrink-0 text-xs">
                    {dash.seeker.entryRemove}
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}

        <form action={addEducation} className="mt-5 grid gap-3 sm:grid-cols-2">
          <input
            name="school_name"
            required
            placeholder={dash.seeker.educationSchool}
            className="field sm:col-span-2"
          />
          <input
            name="field_of_study"
            placeholder={dash.seeker.educationField}
            className="field"
          />
          <select name="level" defaultValue="" className="field">
            <option value="">{dash.seeker.selectPlaceholder}</option>
            {EDUCATION_LEVELS.map((level) => (
              <option key={level} value={level}>
                {educationLevelLabels[level]}
              </option>
            ))}
          </select>
          <input
            name="start_year"
            type="number"
            placeholder={dash.seeker.educationStartYear}
            className="field"
          />
          <input
            name="end_year"
            type="number"
            placeholder={dash.seeker.educationEndYear}
            className="field"
          />
          <button type="submit" className="btn-secondary sm:col-span-2">
            {dash.seeker.educationAdd}
          </button>
        </form>
      </section>

      {/* WORK EXPERIENCE ------------------------------------------------ */}
      <section className="clay mt-8 max-w-2xl p-6">
        <h2 className="font-display text-lg font-600 text-ink">{dash.seeker.experienceTitle}</h2>
        {(experienceRows ?? []).length === 0 ? (
          <p className="mt-2 text-sm text-muted">{dash.seeker.experienceEmpty}</p>
        ) : (
          <ul className="mt-4 divide-y divide-line">
            {(experienceRows ?? []).map((entry) => (
              <li key={entry.id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-500 text-ink">
                    {entry.job_title} · {entry.company_name}
                  </p>
                  <p className="truncate text-xs text-muted">
                    {[entry.start_date, entry.end_date ?? "Present"].filter(Boolean).join(" – ")}
                  </p>
                </div>
                <form action={deleteWorkExperience}>
                  <input type="hidden" name="id" value={entry.id} />
                  <button type="submit" className="btn-ghost shrink-0 text-xs">
                    {dash.seeker.entryRemove}
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}

        <form action={addWorkExperience} className="mt-5 grid gap-3 sm:grid-cols-2">
          <input
            name="company_name"
            required
            placeholder={dash.seeker.experienceCompany}
            className="field"
          />
          <input
            name="job_title"
            required
            placeholder={dash.seeker.experienceJobTitle}
            className="field"
          />
          <input
            name="start_date"
            type="date"
            aria-label={dash.seeker.experienceStartDate}
            className="field"
          />
          <input
            name="end_date"
            type="date"
            aria-label={dash.seeker.experienceEndDate}
            className="field"
          />
          <textarea
            name="description"
            rows={3}
            placeholder={dash.seeker.experienceDescription}
            className="field resize-y sm:col-span-2"
          />
          <button type="submit" className="btn-secondary sm:col-span-2">
            {dash.seeker.experienceAdd}
          </button>
        </form>
      </section>
    </div>
  );
}

function Field({
  label,
  name,
  defaultValue,
  placeholder,
  hint,
  type = "text",
}: {
  label: string;
  name: string;
  defaultValue: string | null;
  placeholder?: string;
  hint?: string;
  type?: "text" | "number";
}) {
  return (
    <div>
      <label htmlFor={name} className="eyebrow mb-2 block">
        {label}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        min={type === "number" ? 0 : undefined}
        defaultValue={defaultValue ?? ""}
        placeholder={placeholder}
        aria-describedby={hint ? `${name}-hint` : undefined}
        className="field"
      />
      {hint && (
        <p id={`${name}-hint`} className="mt-1.5 text-xs text-muted">
          {hint}
        </p>
      )}
    </div>
  );
}

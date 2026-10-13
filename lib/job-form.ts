import { slugify, randomSuffix } from "@/lib/utils";
import { sanitizeJobHtml } from "@/lib/sanitize";
import { isBlankHtml, toRichHtml } from "@/lib/rich-text";
import type { EducationLevel, EmploymentLevel, JobStatus, JobType } from "@/types/database";

const EDUCATION_LEVELS: EducationLevel[] = [
  "high_school",
  "certificate",
  "diploma",
  "bachelors",
  "masters",
  "doctorate",
];

export const UNIQUE_VIOLATION = "23505";

const JOB_TYPES: JobType[] = [
  "full_time",
  "part_time",
  "freelance",
  "contract",
  "internship",
];
const LEVELS: EmploymentLevel[] = ["entry", "mid", "senior", "executive"];
export const JOB_STATUSES: JobStatus[] = [
  "draft",
  "pending_review",
  "published",
  "expired",
  "closed",
];

/**
 * `max` is optional and defaults to no cap, so every existing call site
 * (ids, statuses, enum-ish values with their own bound) is unaffected — only
 * genuinely free-text fields need to pass one. Truncated rather than
 * rejected, matching the same choice `text()` in app/jobs/actions.ts makes
 * for cover letters: a long paste is not a mistake worth throwing the whole
 * submission away over.
 */
export function str(formData: FormData, key: string, max?: number): string | null {
  const value = formData.get(key);
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (trimmed === "") return null;
  return max ? trimmed.slice(0, max) : trimmed;
}

export function int(formData: FormData, key: string): number | null {
  const raw = str(formData, key);
  if (raw === null) return null;
  const n = Number.parseInt(raw.replace(/[^0-9]/g, ""), 10);
  return Number.isFinite(n) ? n : null;
}

export function oneOf<T extends string>(value: string | null, allowed: T[], fallback: T): T {
  return (allowed as string[]).includes(value ?? "") ? (value as T) : fallback;
}

/**
 * One of the rich-text body fields.
 *
 * Structure is inferred first (so a value typed into the old textareas, or
 * pasted as plain text, still becomes real markup), then run through the
 * allowlist. `isBlankHtml` catches the `<p><br></p>` a cleared contenteditable
 * leaves behind — stored as-is that renders a stray blank line on the listing
 * and makes an empty field look filled in.
 */
function richField(formData: FormData, key: string): string | null {
  const raw = str(formData, key);
  if (!raw) return null;
  const clean = sanitizeJobHtml(toRichHtml(raw));
  return isBlankHtml(clean) ? null : clean;
}

export type JobFields = {
  title: string;
  description: string;
  requirements: string | null;
  /** Replaced `benefits` in migration 015 — same slot, better prompt. */
  qualifications: string | null;
  /** Migration 031. Same comma-split shape as profiles.skills. */
  required_skills: string[] | null;
  // Requirement fields the compute_meets_requirements() trigger flags
  // against (migration 033). All optional.
  required_years_experience: number | null;
  required_education_level: EducationLevel | null;
  required_industry_category_id: string | null;
  /** Optional. Null on both means the listing says nothing about pay. */
  salary_min: number | null;
  salary_max: number | null;
  category_id: string | null;
  location_id: string | null;
  location_text: string | null;
  job_type: JobType;
  employment_level: EmploymentLevel;
  is_remote: boolean;
  application_deadline: string | null;
};

/**
 * Reads the shared job fields. Returns null when the two required fields are
 * missing so the caller can redirect with its own error target.
 */
export function parseJobFields(formData: FormData): JobFields | null {
  // No length cap existed on either field before — a title or location string
  // of unbounded length would have gone straight to a `text` column with
  // nothing stopping it. Caps chosen generously against real job titles
  // ("Senior Backend Engineer — Payments Platform" is ~45 chars) and
  // freeform location strings, not against a spec.
  const title = str(formData, "title", 200);
  // The three body fields now arrive as HTML from the rich-text editor, so they
  // are sanitised on the way in as well as on the way out. Render-time
  // sanitising is still the guarantee — it also covers the migrated WordPress
  // copy and anything written straight through PostgREST — but storing markup
  // that has already been through the allowlist means the database does not
  // hold a payload waiting for a future template that forgets to sanitise.
  const description = richField(formData, "description");
  if (!title || !description) return null;

  // Salary is optional — both fields may be blank, and a listing with no pay
  // information shows nothing about pay rather than a placeholder.
  const salaryMin = int(formData, "salary_min");
  const salaryMax = int(formData, "salary_max");
  // Swapped rather than rejected: someone typing 120000 then 80000 meant a
  // range, and storing it backwards would break the salary sort silently.
  const flip = salaryMin !== null && salaryMax !== null && salaryMin > salaryMax;

  // Same comma-split-trim-filter shape updateProfile (app/dashboard/seeker/actions.ts)
  // already uses for profiles.skills.
  const rawSkills = formData.get("required_skills");
  const requiredSkills =
    typeof rawSkills === "string" && rawSkills.trim() !== ""
      ? rawSkills
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
          .slice(0, 40)
      : null;

  const educationLevelRaw = str(formData, "required_education_level");
  const requiredEducationLevel =
    educationLevelRaw && (EDUCATION_LEVELS as string[]).includes(educationLevelRaw)
      ? (educationLevelRaw as EducationLevel)
      : null;

  return {
    title,
    description,
    requirements: richField(formData, "requirements"),
    qualifications: richField(formData, "qualifications"),
    required_skills: requiredSkills,
    required_years_experience: int(formData, "required_years_experience"),
    required_education_level: requiredEducationLevel,
    required_industry_category_id: str(formData, "required_industry_category_id"),
    salary_min: flip ? salaryMax : salaryMin,
    salary_max: flip ? salaryMin : salaryMax,
    category_id: str(formData, "category_id"),
    location_id: str(formData, "location_id"),
    location_text: str(formData, "location_text", 120),
    job_type: oneOf(str(formData, "job_type"), JOB_TYPES, "full_time"),
    employment_level: oneOf(str(formData, "employment_level"), LEVELS, "mid"),
    is_remote: formData.get("is_remote") === "on",
    application_deadline: str(formData, "application_deadline"),
  };
}

/**
 * Inserts a job, retrying once with a random suffix on a slug collision.
 * jobs.slug is `unique not null`, and two employers both posting "Sales
 * Representative" is entirely ordinary.
 */
/**
 * The caller supplies the insert, so the Supabase generics stay exact at the
 * call site instead of being flattened into a structural stand-in here.
 * PromiseLike rather than Promise because Supabase's query builder is thenable
 * but not an actual Promise.
 */
export async function insertJobWithUniqueSlug(
  title: string,
  insert: (slug: string) => PromiseLike<{
    data: { id: string } | null;
    error: { code?: string; message: string } | null;
  }>
): Promise<{ id: string } | { error: string }> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const slug =
      attempt === 0 ? slugify(title) : `${slugify(title)}-${randomSuffix()}`;

    const { data, error } = await insert(slug);

    if (!error && data) return { id: data.id };
    if (error && error.code !== UNIQUE_VIOLATION) return { error: error.message };
  }
  return { error: "Could not create the listing — please try again." };
}

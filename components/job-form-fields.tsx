import { JOB_TYPE_LABELS } from "@/lib/utils";
import { job as jobCopy, educationLevelLabels } from "@/lib/content";
import { RichTextEditor } from "@/components/rich-text-editor";
import type { EducationLevel, Job, JobCategory, JobLocation } from "@/types/database";

const EDUCATION_LEVELS: EducationLevel[] = [
  "high_school",
  "certificate",
  "diploma",
  "bachelors",
  "masters",
  "doctorate",
];

const LEVELS = [
  { value: "entry", label: "Entry level" },
  { value: "mid", label: "Mid level" },
  { value: "senior", label: "Senior" },
  { value: "executive", label: "Executive" },
];

/**
 * Every field of a job listing, shared by the employer post form and the admin
 * post/edit forms. One definition so the three can never drift apart — the
 * admin form is the one PAC staff use to collect jobs on employers' behalf, so
 * it has to accept exactly what an employer could have submitted.
 *
 * Pass `job` to prefill for editing.
 */
export function JobFormFields({
  categories,
  locations,
  job,
}: {
  categories: Pick<JobCategory, "id" | "name">[];
  locations: Pick<JobLocation, "id" | "name">[];
  job?: Job;
}) {
  return (
    <>
      <div>
        <label htmlFor="title" className="eyebrow block mb-2">
          Job title *
        </label>
        <input
          id="title"
          name="title"
          required
          defaultValue={job?.title ?? ""}
          placeholder="e.g. Accounts Assistant"
          className="field"
        />
      </div>

      {/* The three body fields are rich text. Each editing surface carries the
          same `.prose-job` styles as the published listing, so the layout an
          author builds here is the layout an applicant reads. */}
      <div>
        <span id="description-label" className="eyebrow mb-2 block">
          About the role *
        </span>
        <RichTextEditor
          name="description"
          labelledBy="description-label"
          defaultValue={job?.description}
          placeholder="What the role is, who it reports to, and why it exists."
          required
          minHeight={190}
        />
        <p className="mt-1.5 text-xs text-muted">
          Use the toolbar for bold, italic and lists. Pasted text keeps its lines
          and bullets but drops the source&apos;s fonts and colours.
        </p>
      </div>

      <div>
        {/* Label text from the content module, so the form and the public
            listing cannot disagree about what this field is called. */}
        <span id="requirements-label" className="eyebrow mb-2 block">
          {jobCopy.requirements}
        </span>
        <RichTextEditor
          name="requirements"
          labelledBy="requirements-label"
          defaultValue={job?.requirements}
          placeholder="One bullet per task — what the person will actually be doing, day to day."
          // Starts as a bullet list: this field is a list in practice, so the
          // author should not have to reach for the button first.
          startAsList
          minHeight={150}
        />
      </div>

      <div>
        <span id="qualifications-label" className="eyebrow mb-2 block">
          {jobCopy.qualifications}
        </span>
        <RichTextEditor
          name="qualifications"
          labelledBy="qualifications-label"
          defaultValue={job?.qualifications}
          placeholder="Certifications, education, licences — one per bullet."
          startAsList
          minHeight={130}
        />
      </div>

      <div>
        <label htmlFor="required_skills" className="eyebrow mb-2 block">
          Required skills
        </label>
        <input
          id="required_skills"
          name="required_skills"
          defaultValue={job?.required_skills?.join(", ") ?? ""}
          placeholder="Comma separated — e.g. Excel, QuickBooks, IFRS"
          className="field"
        />
        <p className="mt-1.5 text-xs text-muted">
          Optional. Powers the match% shown to seekers and the admin candidate search — leave
          blank if this role has no specific skill requirements to match against.
        </p>
      </div>

      <div className="grid sm:grid-cols-3 gap-4">
        <div>
          <label htmlFor="required_years_experience" className="eyebrow block mb-2">
            Min. years experience
          </label>
          <input
            id="required_years_experience"
            name="required_years_experience"
            type="number"
            min={0}
            defaultValue={job?.required_years_experience ?? ""}
            placeholder="Any"
            className="field"
          />
        </div>
        <div>
          <label htmlFor="required_education_level" className="eyebrow block mb-2">
            Min. education level
          </label>
          <select
            id="required_education_level"
            name="required_education_level"
            defaultValue={job?.required_education_level ?? ""}
            className="field"
          >
            <option value="">Any</option>
            {EDUCATION_LEVELS.map((level) => (
              <option key={level} value={level}>
                {educationLevelLabels[level]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="required_industry_category_id" className="eyebrow block mb-2">
            Required industry
          </label>
          <select
            id="required_industry_category_id"
            name="required_industry_category_id"
            defaultValue={job?.required_industry_category_id ?? ""}
            className="field"
          >
            <option value="">Any</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>
      <p className="-mt-2 text-xs text-muted">
        All three optional. Set any of them to have matching applications flagged for you in the
        admin queue — nothing is ever auto-rejected.
      </p>

      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="category_id" className="eyebrow block mb-2">
            Category
          </label>
          <select
            id="category_id"
            name="category_id"
            defaultValue={job?.category_id ?? ""}
            className="field"
          >
            <option value="">Not specified</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="location_id" className="eyebrow block mb-2">
            Location
          </label>
          <select
            id="location_id"
            name="location_id"
            defaultValue={job?.location_id ?? ""}
            className="field"
          >
            <option value="">Not specified</option>
            {locations.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label htmlFor="location_text" className="eyebrow block mb-2">
          Location detail
        </label>
        <input
          id="location_text"
          name="location_text"
          defaultValue={job?.location_text ?? ""}
          placeholder="e.g. Westlands, Nairobi"
          className="field"
        />
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="job_type" className="eyebrow block mb-2">
            Job type
          </label>
          <select
            id="job_type"
            name="job_type"
            defaultValue={job?.job_type ?? "full_time"}
            className="field"
          >
            {Object.entries(JOB_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="employment_level" className="eyebrow block mb-2">
            Seniority
          </label>
          <select
            id="employment_level"
            name="employment_level"
            defaultValue={job?.employment_level ?? "mid"}
            className="field"
          >
            {LEVELS.map((l) => (
              <option key={l.value} value={l.value}>
                {l.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Salary is optional. Left blank, nothing about pay appears on the
          listing at all — no "salary not disclosed" placeholder, which reads as
          a gap rather than a choice. */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label htmlFor="salary_min" className="eyebrow block mb-2">
            Salary from (KES)
          </label>
          <input
            id="salary_min"
            name="salary_min"
            inputMode="numeric"
            placeholder="Optional"
            defaultValue={job?.salary_min ?? ""}
            className="field"
          />
        </div>
        <div>
          <label htmlFor="salary_max" className="eyebrow block mb-2">
            Salary to (KES)
          </label>
          <input
            id="salary_max"
            name="salary_max"
            inputMode="numeric"
            placeholder="Optional"
            defaultValue={job?.salary_max ?? ""}
            className="field"
          />
        </div>
        <div>
          <label htmlFor="application_deadline" className="eyebrow block mb-2">
            Closing date
          </label>
          <input
            id="application_deadline"
            name="application_deadline"
            type="date"
            defaultValue={job?.application_deadline ?? ""}
            className="field"
          />
        </div>
      </div>

      <label className="flex items-center gap-2.5 text-sm text-pac-ink">
        <input
          type="checkbox"
          name="is_remote"
          defaultChecked={job?.is_remote ?? false}
          className="w-4 h-4 accent-pac-orange"
        />
        This role can be done remotely
      </label>
    </>
  );
}

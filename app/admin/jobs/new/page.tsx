import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireProfile } from "@/lib/auth";
import { getJobLookups } from "@/lib/lookups";
import { JobFormFields } from "@/components/job-form-fields";
import { createJobAsAdmin } from "../../actions";
import type { Company } from "@/types/database";

export default async function AdminNewJobPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { supabase } = await requireProfile("admin");
  const params = await searchParams;

  const [lookups, { data: companies }] = await Promise.all([
    getJobLookups(),
    supabase.from("companies").select("id, name, verified").order("name").limit(500),
  ]);

  const employers = (companies ?? []) as Pick<Company, "id" | "name" | "verified">[];

  return (
    <div className="max-w-3xl">
      <Link
        href="/admin/jobs"
        className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-accent-text transition-colors"
      >
        <ArrowLeft className="w-4 h-4" aria-hidden />
        All listings
      </Link>

      <span className="eyebrow block mt-5">PAC Africa &middot; Internal</span>
      <h1 className="font-display text-3xl font-700 text-ink mt-2 mb-2">
        Post a job
      </h1>
      <p className="text-sm text-muted mb-8 max-w-xl">
        For roles PAC Africa collects directly from employers. Publishing here
        skips the review queue, because entering it is the review.
      </p>

      {params.error && (
        <p className="mb-6 text-sm text-red-600 border border-red-200 bg-red-50 rounded-card px-4 py-3">
          {params.error}
        </p>
      )}

      <form action={createJobAsAdmin} className="space-y-5">
        {/* EMPLOYER ---------------------------------------------------- */}
        <fieldset className="clay p-5">
          <legend className="eyebrow float-left mb-3 w-full">Employer</legend>
          <div className="clear-both space-y-4">

            <div>
              <label htmlFor="company_id" className="eyebrow block mb-2">
                Existing employer
              </label>
              <select id="company_id" name="company_id" defaultValue="" className="field">
                <option value="">— none / add a new one below —</option>
                {employers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                    {c.verified ? " (verified)" : ""}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="new_company_name" className="eyebrow block mb-2">
                Or add a new employer
              </label>
              <input
                id="new_company_name"
                name="new_company_name"
                placeholder="Company name"
                className="field"
              />
              <p className="text-xs text-muted mt-1.5">
                Creates an employer record with no linked account. If they register
                later, an admin can attach it. Leave both blank and the listing
                shows as &ldquo;Confidential employer&rdquo;.
              </p>
            </div>

            <label className="flex items-center gap-2.5 text-sm text-ink">
              <input
                type="checkbox"
                name="new_company_verified"
                className="w-4 h-4 accent-accent"
              />
              Mark this new employer as vetted
            </label>
          </div>
        </fieldset>

        {/* THE ROLE ---------------------------------------------------- */}
        <fieldset className="clay p-5">
          <legend className="eyebrow float-left mb-3 w-full">The role</legend>
          <div className="clear-both space-y-4">
            <JobFormFields categories={lookups.categories} locations={lookups.locations} />
          </div>
        </fieldset>

        {/* VISIBILITY -------------------------------------------------- */}
        <fieldset className="clay p-5">
          <legend className="eyebrow float-left mb-3 w-full">Visibility</legend>
          <div className="clear-both space-y-4">

            <div>
              <label htmlFor="status" className="eyebrow block mb-2">
                Status
              </label>
              <select id="status" name="status" defaultValue="published" className="field">
                <option value="published">Publish now — live on the site</option>
                <option value="pending_review">Hold in the review queue</option>
                <option value="draft">Save as draft</option>
              </select>
            </div>

            <label className="flex items-center gap-2.5 text-sm text-ink">
              <input
                type="checkbox"
                name="is_featured"
                className="w-4 h-4 accent-accent"
              />
              Feature this role
            </label>
          </div>
        </fieldset>

        <div className="flex items-center gap-3">
          <button type="submit" className="btn-primary">
            Save listing
          </button>
          <Link href="/admin/jobs" className="btn-ghost">
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}

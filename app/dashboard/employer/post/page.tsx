import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { getJobLookups } from "@/lib/lookups";
import { JobFormFields } from "@/components/job-form-fields";
import { PageHead } from "@/components/dashboard-shell";
import { ToastFromSearchParams } from "@/components/toast-from-search-params";
import { dash } from "@/lib/content";
import { createJob } from "../actions";

export default async function PostJobPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { profile } = await requireProfile("employer");
  const params = await searchParams;

  // A listing needs company_id for the employer-visibility policy on
  // applications to resolve (migration 004). Without it an employer would post
  // a job and never see who applied.
  if (!profile.company_id) {
    redirect("/dashboard/employer/company?error=Create+your+company+profile+first");
  }

  const lookups = await getJobLookups();

  return (
    <div>
      <PageHead
        eyebrow="Employer"
        title={dash.employer.newJob}
        sub="PAC Africa reads every listing before it goes live. Save a draft if you are not finished."
      />

      <ToastFromSearchParams error={params.error} />

      <form action={createJob} className="clay max-w-2xl space-y-5 p-6">
        <JobFormFields categories={lookups.categories} locations={lookups.locations} />

        <div className="flex flex-wrap items-center gap-3 border-t border-line pt-5">
          <button type="submit" name="intent" value="review" className="btn-accent">
            Submit for review
          </button>
          {/* Same form, different intent — a draft is not a different kind of
              listing, just one that has not been sent yet. */}
          <button type="submit" name="intent" value="draft" className="btn-secondary">
            Save as draft
          </button>
        </div>
      </form>
    </div>
  );
}

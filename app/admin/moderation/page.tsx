import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { requireProfile } from "@/lib/auth";
import { PageHead } from "@/components/dashboard-shell";
import { EmptyState } from "@/components/dashboard-ui";
import { ToastFromSearchParams } from "@/components/toast-from-search-params";
import { ConfirmAction } from "@/components/confirm-action";
import { dash } from "@/lib/content";
import { plainSnippet, timeAgo } from "@/lib/utils";
import { rejectJob, setCompanyVerified, setJobStatus } from "../actions";

const RETURN_TO = "/admin/moderation";

interface PendingJob {
  id: string;
  title: string;
  slug: string;
  description: string;
  created_at: string;
  location_text: string | null;
  company: { id: string; name: string; verified: boolean } | null;
  location: { name: string } | null;
}

/**
 * The moderation queue — the first thing built of the admin dashboard, because
 * it is the control that makes everything else safe. Nothing an employer writes
 * reaches the public site except through this page.
 *
 * Each card shows enough to decide without opening the listing: the title, who
 * submitted it, where it is, and the first lines of the copy. The full listing
 * is one click away for the cases where that is not enough.
 */
export default async function ModerationQueue({
  searchParams,
}: {
  searchParams: Promise<{ updated?: string; error?: string }>;
}) {
  const { supabase } = await requireProfile("admin");
  const params = await searchParams;

  const { data } = await supabase
    .from("jobs")
    .select(
      `id, title, slug, description, created_at, location_text,
       company:companies(id, name, verified), location:job_locations(name)`
    )
    .eq("status", "pending_review")
    .order("created_at", { ascending: true })
    .limit(100);

  const queue = (data ?? []) as unknown as PendingJob[];

  return (
    <div>
      <PageHead
        eyebrow={`${queue.length} waiting`}
        title={dash.admin.moderationTitle}
        sub={dash.admin.moderationSub}
      />

      <ToastFromSearchParams
        error={params.error}
        success={
          params.updated === "published"
            ? "Published. It is live on the site now."
            : params.updated === "rejected"
              ? "Sent back to the employer with your reason."
              : params.updated === "verification"
                ? "Employer verification updated."
                : null
        }
      />

      {queue.length === 0 ? (
        <EmptyState
          icon={ShieldCheck}
          title={dash.admin.emptyModeration}
          body={dash.admin.emptyModerationBody}
          action={
            <Link href="/admin/jobs" className="btn-secondary">
              {dash.admin.jobsTitle}
            </Link>
          }
        />
      ) : (
        // Oldest first, deliberately: a queue that shows newest first quietly
        // starves whatever has been waiting longest.
        <ul className="space-y-4">
          {queue.map((job) => (
            <li key={job.id} className="clay p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="font-display text-base font-600 text-ink">
                    {job.title}
                  </h2>
                  <p className="mt-1 text-xs text-muted">
                    {job.company?.name ?? "Confidential employer"}
                    {job.company && !job.company.verified && (
                      <span className="ml-1.5 text-accent-text">unverified</span>
                    )}
                    {" · "}
                    {job.location?.name ?? job.location_text ?? "Kenya"}
                    {" · submitted "}
                    {timeAgo(job.created_at)}
                  </p>
                </div>
                <Link
                  href={`/admin/jobs/${job.id}/edit`}
                  className="btn-ghost shrink-0 border-line text-xs"
                >
                  Open in full
                </Link>
              </div>

              <p className="mt-3 border-l-2 border-line pl-3 text-sm leading-relaxed text-muted">
                {plainSnippet(job.description, 260)}
              </p>

              <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line pt-4">
                <ConfirmAction
                  action={setJobStatus}
                  fields={{
                    job_id: job.id,
                    status: "published",
                    return_to: RETURN_TO,
                  }}
                  trigger={dash.admin.approve}
                  triggerClassName="btn-accent px-4 py-2 text-sm"
                  title={dash.admin.confirmApproveTitle}
                  body={dash.admin.confirmApproveBody}
                  confirmLabel="Publish it"
                />

                <ConfirmAction
                  action={rejectJob}
                  fields={{ job_id: job.id, return_to: RETURN_TO }}
                  trigger={dash.admin.reject}
                  title={dash.admin.confirmRejectTitle}
                  body={dash.admin.confirmRejectBody}
                  confirmLabel="Send it back"
                  tone="danger"
                  reason={{
                    name: "rejection_reason",
                    label: dash.admin.rejectReasonLabel,
                    hint: dash.admin.rejectReasonHint,
                    placeholder:
                      "The salary range looks like a typo — please confirm the figures and resubmit.",
                  }}
                />

                {job.company && !job.company.verified && (
                  <form action={setCompanyVerified} className="ml-auto">
                    <input type="hidden" name="company_id" value={job.company.id} />
                    <input type="hidden" name="verified" value="true" />
                    <input type="hidden" name="return_to" value={RETURN_TO} />
                    <button
                      type="submit"
                      className="press rounded-pill border border-line px-3 py-1.5 text-xs text-muted transition-colors duration-150 hover:border-accent/50 hover:text-ink"
                    >
                      Verify employer
                    </button>
                  </form>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

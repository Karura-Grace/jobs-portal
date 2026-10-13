"use client";

import { useState } from "react";
import type { ReviewEntry, ReviewSummary } from "@/lib/application-reviews";
import { addApplicationReview } from "@/lib/review-actions";

const dateTime = (iso: string) =>
  new Date(iso).toLocaleString("en-KE", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });

/**
 * The HR review log (migration 029) — shown in the application drawer for
 * employers and admins. Two things live here: the prompt for whoever opened
 * this application and hasn't logged a pass yet, and the history everyone
 * else already left, so the team can see at a glance whether this one is
 * settled or just glanced at.
 */
export function ReviewPanel({
  applicationId,
  returnTo,
  currentUserId,
  summary,
}: {
  applicationId: string;
  returnTo: string;
  currentUserId: string;
  summary: ReviewSummary;
}) {
  const [showFinalForm, setShowFinalForm] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const history: ReviewEntry[] = [
    ...(summary.final ? [summary.final] : []),
    ...summary.overviews,
  ].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

  const alreadyReviewedByMe = history.some((entry) => entry.reviewerId === currentUserId);
  const showPrompt = !summary.final && !alreadyReviewedByMe && !dismissed;

  return (
    <div className="border-t border-line pt-5">
      <p className="eyebrow mb-3">Review</p>

      {showPrompt && (
        <div className="clay-inset mb-4 space-y-3 p-3.5">
          {!showFinalForm ? (
            <>
              <p className="text-xs text-muted">
                Have you looked at this one? Overview is a quick look — final review
                is your call on the candidate, and closes it out for the team.
              </p>
              <div className="flex gap-2">
                <form action={addApplicationReview}>
                  <input type="hidden" name="application_id" value={applicationId} />
                  <input type="hidden" name="mode" value="overview" />
                  <input type="hidden" name="return_to" value={returnTo} />
                  <button type="submit" className="btn-secondary text-xs">
                    Quick overview
                  </button>
                </form>
                <button
                  type="button"
                  onClick={() => setShowFinalForm(true)}
                  className="btn-accent text-xs"
                >
                  Final review
                </button>
                <button
                  type="button"
                  onClick={() => setDismissed(true)}
                  className="btn-ghost ml-auto text-xs"
                >
                  Not now
                </button>
              </div>
            </>
          ) : (
            <form action={addApplicationReview} className="space-y-2.5">
              <input type="hidden" name="application_id" value={applicationId} />
              <input type="hidden" name="mode" value="final" />
              <input type="hidden" name="return_to" value={returnTo} />
              <label htmlFor="opinion" className="eyebrow block">
                Your call on this candidate
              </label>
              <textarea
                id="opinion"
                name="opinion"
                rows={3}
                placeholder="Optional — what should the next person know?"
                className="field"
              />
              <div className="flex gap-2">
                <button type="submit" className="btn-accent text-xs">
                  Record final review
                </button>
                <button
                  type="button"
                  onClick={() => setShowFinalForm(false)}
                  className="btn-ghost text-xs"
                >
                  Back
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {alreadyReviewedByMe && !summary.final && (
        <button
          type="button"
          onClick={() => setDismissed(false)}
          className="mb-3 text-xs text-accent-text hover:underline"
        >
          Log another pass
        </button>
      )}

      {history.length === 0 ? (
        <p className="text-sm text-faint">No one has reviewed this yet.</p>
      ) : (
        <ol className="space-y-3">
          {history.map((entry) => (
            <li key={entry.id} className="relative pl-4">
              <span
                aria-hidden
                className={`absolute left-0 top-[7px] h-1.5 w-1.5 rounded-pill ${
                  entry.mode === "final" ? "bg-emerald-500" : "bg-amber-500"
                }`}
              />
              <p className="text-sm text-ink">
                {entry.mode === "final" ? "Final review" : "Overview"} · {entry.reviewerName}
              </p>
              {entry.opinion && (
                <p className="mt-1 whitespace-pre-line border-l-2 border-accent/40 pl-3 text-sm text-ink/90">
                  {entry.opinion}
                </p>
              )}
              <p className="mt-0.5 text-xs text-muted">{dateTime(entry.createdAt)}</p>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

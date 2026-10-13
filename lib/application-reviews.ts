import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, ApplicationReviewMode } from "@/types/database";

export type ReviewEntry = {
  id: string;
  reviewerId: string;
  reviewerName: string;
  mode: ApplicationReviewMode;
  opinion: string | null;
  createdAt: string;
};

export type ReviewSummary = {
  /** Most recent 'final' review, if any — the one that closes the loop. */
  final: ReviewEntry | null;
  /** 'overview' entries, most recent first. */
  overviews: ReviewEntry[];
};

const EMPTY: ReviewSummary = { final: null, overviews: [] };

type Row = {
  id: string;
  application_id: string;
  reviewer_id: string;
  mode: ApplicationReviewMode;
  opinion: string | null;
  created_at: string;
  reviewer: { full_name: string | null; email: string } | null;
};

function toEntry(row: Row): ReviewEntry {
  return {
    id: row.id,
    reviewerId: row.reviewer_id,
    reviewerName: row.reviewer?.full_name?.trim() || row.reviewer?.email || "Someone",
    mode: row.mode,
    opinion: row.opinion,
    createdAt: row.created_at,
  };
}

/**
 * Review history for a batch of applications, keyed by application id.
 *
 * RLS on application_reviews (migration 029) already confines this to
 * applications the caller can see, so there is nothing to scope here beyond
 * the id list itself.
 */
export async function reviewSummaries(
  supabase: SupabaseClient<Database>,
  applicationIds: string[]
): Promise<Map<string, ReviewSummary>> {
  const summaries = new Map<string, ReviewSummary>();
  const ids = [...new Set(applicationIds)];
  if (ids.length === 0) return summaries;

  const { data } = await supabase
    .from("application_reviews")
    .select("id, application_id, reviewer_id, mode, opinion, created_at, reviewer:profiles(full_name, email)")
    .in("application_id", ids)
    .order("created_at", { ascending: false });

  for (const raw of (data ?? []) as unknown as Row[]) {
    const entry = summaries.get(raw.application_id) ?? { final: null, overviews: [] };
    if (raw.mode === "final") {
      if (!entry.final) entry.final = toEntry(raw);
    } else {
      entry.overviews.push(toEntry(raw));
    }
    summaries.set(raw.application_id, entry);
  }
  return summaries;
}

export function reviewSummaryFor(
  summaries: Map<string, ReviewSummary>,
  applicationId: string
): ReviewSummary {
  return summaries.get(applicationId) ?? EMPTY;
}

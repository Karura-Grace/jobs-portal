import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { avatarUrls } from "@/lib/avatar";

export type ApplicantCard = {
  headline: string | null;
  /** Already signed and ready for an <img src>, or null. */
  avatarSrc: string | null;
};

/**
 * Headline and avatar for a batch of applications, keyed by application id.
 *
 * Two round trips: the RPC from migration 020 (which does the ownership check
 * the profiles policy cannot express), then one batch signing call for the
 * avatar objects. Both are batched, so a 40-row inbox costs two queries rather
 * than eighty.
 *
 * Returns an empty map rather than throwing. A missing headline shows nothing
 * and a missing avatar falls back to initials — neither is worth failing a page
 * over, and this data is decoration around the application itself.
 */
export async function applicantCards(
  supabase: SupabaseClient<Database>,
  applicationIds: string[]
): Promise<Map<string, ApplicantCard>> {
  const cards = new Map<string, ApplicantCard>();
  const ids = [...new Set(applicationIds)];
  if (ids.length === 0) return cards;

  const { data } = await supabase.rpc("applicant_cards", { app_ids: ids });
  const rows = data ?? [];
  if (rows.length === 0) return cards;

  const signed = await avatarUrls(
    supabase,
    rows.map((row) => row.avatar_url)
  );

  for (const row of rows) {
    cards.set(row.application_id, {
      headline: row.headline,
      avatarSrc: row.avatar_url ? (signed.get(row.avatar_url) ?? null) : null,
    });
  }
  return cards;
}

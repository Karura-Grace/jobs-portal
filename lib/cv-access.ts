import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  CV_BUCKET,
  isLegacyCvUrl,
  isR2Key,
  r2KeyOf,
  type CvLink,
} from "@/lib/cv";
import { presignR2Many } from "@/lib/r2";

/**
 * Resolves stored cv_url values to openable links, across all three shapes
 * described in lib/cv.ts. Server-only, because R2 signing needs the secret.
 *
 * Legacy URLs are returned as kind "legacy" rather than as a usable href: they
 * 403 since the domain moved, and offering a link that cannot work reads as a
 * broken product. The file itself is recoverable from the archive.
 */

type StorageOnly = Pick<SupabaseClient, "storage">;

export async function cvLink(
  supabase: StorageOnly,
  cvUrl: string | null | undefined,
  expiresInSeconds = 1500
): Promise<CvLink> {
  const links = await cvLinksBatch(supabase, [cvUrl], expiresInSeconds);
  return cvUrl ? (links.get(cvUrl) ?? { kind: "none" }) : { kind: "none" };
}

/**
 * Resolves many at once, keyed by the stored value.
 *
 * A list page would otherwise sign one URL per row. Both backends are
 * deduplicated first — object paths are content-hashed, so several applications
 * can legitimately share one file.
 */
export async function cvLinksBatch(
  supabase: StorageOnly,
  cvUrls: (string | null | undefined)[],
  expiresInSeconds = 1500
): Promise<Map<string, CvLink>> {
  const links = new Map<string, CvLink>();
  const supabasePaths = new Set<string>();
  const r2Keys = new Set<string>();

  for (const url of cvUrls) {
    if (!url || links.has(url)) continue;
    if (isLegacyCvUrl(url)) links.set(url, { kind: "legacy", href: url });
    else if (isR2Key(url)) r2Keys.add(url);
    else supabasePaths.add(url);
  }

  await Promise.all([
    (async () => {
      if (supabasePaths.size === 0) return;
      const { data } = await supabase.storage
        .from(CV_BUCKET)
        .createSignedUrls([...supabasePaths], expiresInSeconds);

      for (const item of data ?? []) {
        if (item.signedUrl && item.path) {
          links.set(item.path, { kind: "supabase", href: item.signedUrl });
        }
      }
    })(),
    (async () => {
      if (r2Keys.size === 0) return;
      const signed = await presignR2Many(
        [...r2Keys].map(r2KeyOf),
        expiresInSeconds
      );
      for (const stored of r2Keys) {
        const href = signed.get(r2KeyOf(stored));
        // No href means R2 is unconfigured or the key is missing. Fall back to
        // "legacy" so the UI says "pending migration" rather than "no CV" —
        // the file exists, it just is not reachable from here yet.
        links.set(stored, href ? { kind: "r2", href } : { kind: "legacy", href: stored });
      }
    })(),
  ]);

  return links;
}

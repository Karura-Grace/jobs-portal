import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Avatars live in a private bucket (migration 018), because a photograph of a
 * person is personal data and the rest of this product treats it that way. So
 * every avatar shown is a signed URL, minted per render.
 *
 * The public bucket alternative would have been one line of code and no signing,
 * but it would also mean a permanent, shareable link to a face.
 */

export const AVATAR_BUCKET = "avatars";
export const LOGO_BUCKET = "logos";
export const IMAGE_MAX_BYTES = 2 * 1024 * 1024;
export const IMAGE_ACCEPT = "image/jpeg,image/png,image/webp";

type StorageOnly = Pick<SupabaseClient, "storage">;

/** `<uid>/<random>.<ext>` — the folder is the owner, which is what the RLS policies key on. */
export function avatarObjectPath(userId: string, filename: string): string {
  const ext = (filename.split(".").pop() ?? "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
  return `${userId}/${crypto.randomUUID()}.${ext || "jpg"}`;
}

export function logoObjectPath(companyId: string, filename: string): string {
  const ext = (filename.split(".").pop() ?? "png").toLowerCase().replace(/[^a-z0-9]/g, "");
  return `${companyId}/${crypto.randomUUID()}.${ext || "png"}`;
}

/**
 * Magic-byte check. The bucket restricts MIME types and the form restricts the
 * accept attribute, but both of those trust a label the client chose; this reads
 * the file. JPEG, PNG and WebP only — the three the bucket accepts.
 */
export async function looksLikeImage(file: File): Promise<boolean> {
  const head = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  if (head.length < 12) return false;

  // JPEG: FF D8 FF
  if (head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) return true;
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (png.every((byte, i) => head[i] === byte)) return true;
  // WebP: "RIFF" .... "WEBP"
  const riff = String.fromCharCode(...head.slice(0, 4));
  const webp = String.fromCharCode(...head.slice(8, 12));
  return riff === "RIFF" && webp === "WEBP";
}

/**
 * Signs many avatar paths at once, keyed by stored path. Returns an empty map
 * rather than throwing when the bucket is unreachable — a missing avatar falls
 * back to initials, which is not worth failing a page over.
 */
export async function avatarUrls(
  supabase: StorageOnly,
  paths: (string | null | undefined)[],
  expiresInSeconds = 300
): Promise<Map<string, string>> {
  const wanted = [...new Set(paths.filter((p): p is string => Boolean(p)))];
  const urls = new Map<string, string>();
  if (wanted.length === 0) return urls;

  const { data } = await supabase.storage
    .from(AVATAR_BUCKET)
    .createSignedUrls(wanted, expiresInSeconds);

  for (const item of data ?? []) {
    if (item.signedUrl && item.path) urls.set(item.path, item.signedUrl);
  }
  return urls;
}

export async function avatarUrl(
  supabase: StorageOnly,
  path: string | null | undefined
): Promise<string | null> {
  if (!path) return null;
  const urls = await avatarUrls(supabase, [path]);
  return urls.get(path) ?? null;
}

/** Logos are in a public bucket, so no signing — just resolve the path. */
export function logoUrl(
  supabase: StorageOnly,
  path: string | null | undefined
): string | null {
  if (!path) return null;
  if (path.startsWith("http")) return path;
  return supabase.storage.from(LOGO_BUCKET).getPublicUrl(path).data.publicUrl;
}

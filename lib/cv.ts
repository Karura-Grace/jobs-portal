/**
 * Pure CV helpers — safe to import from client components.
 *
 * Signing lives in lib/cv-access.ts and lib/r2.ts, which are server-only: the
 * R2 secret must never reach the browser bundle, and this file is imported by
 * components/apply-form.tsx.
 *
 * THREE SHAPES OF applications.cv_url
 *
 *   https://jobs.pac.africa/wp-content/uploads/jobmonster/…
 *       Legacy. Dead since the domain moved to Vercel — those paths now hit the
 *       Next.js app and return 403. Recoverable from the local archive.
 *
 *   r2:<key>
 *       The recovered archive, in Cloudflare R2. Roughly 1.2 GB, which is why it
 *       is not in Supabase Storage: the free tier is 1 GB and would have been
 *       83% full before a single new applicant arrived.
 *
 *   <hash>/<filename>
 *       A new upload, in the Supabase `cvs` bucket. New CVs stay here because
 *       the browser-side upload path already works in production and averages
 *       ~250 KB, so 1 GB is years of intake.
 */

export const CV_BUCKET = "cvs";
export const CV_MAX_BYTES = 5 * 1024 * 1024;
export const CV_ACCEPT = "application/pdf";

/** Marks a cv_url as an R2 object key. */
export const R2_PREFIX = "r2:";

export type CvLink =
  | { kind: "supabase"; href: string }
  | { kind: "r2"; href: string }
  | { kind: "legacy"; href: string }
  | { kind: "none" };

export function isLegacyCvUrl(cvUrl: string | null | undefined): boolean {
  return !!cvUrl && /^https?:\/\//i.test(cvUrl);
}

export function isR2Key(cvUrl: string | null | undefined): boolean {
  return !!cvUrl && cvUrl.startsWith(R2_PREFIX);
}

export function r2KeyOf(cvUrl: string): string {
  return cvUrl.slice(R2_PREFIX.length);
}

/**
 * Which of the three shapes a stored cv_url is, without signing anything.
 * Lets the UI show "No CV" / "pending migration" up front and defer the
 * actual signed-URL request to the moment someone clicks Open CV.
 */
export function cvStatus(
  cvUrl: string | null | undefined
): "none" | "legacy" | "ready" {
  if (!cvUrl) return "none";
  if (isLegacyCvUrl(cvUrl)) return "legacy";
  return "ready";
}

/**
 * Checks the file really is a PDF by looking at its first bytes, not its
 * declared type.
 *
 * `allowed_mime_types` on the bucket validates the content type the *uploader
 * declares*, not the bytes — so a caller can send anything and label it
 * application/pdf. This reads the actual magic number.
 *
 * Honest about the limit: the browser-side apply form can only check before it
 * uploads, and a determined caller talking to the Storage API directly skips it.
 * It is still worth having — it catches the common case of somebody attaching a
 * .doc renamed to .pdf, and the residual risk is bounded because the file is
 * only ever served back from a private bucket as application/pdf, so it is a
 * malformed download rather than anything executable. The seeker profile upload
 * goes through a server action and is checked there, where it cannot be skipped.
 */
export async function looksLikePdf(file: Blob): Promise<boolean> {
  const head = new Uint8Array(await file.slice(0, 5).arrayBuffer());
  // "%PDF-"
  return (
    head[0] === 0x25 &&
    head[1] === 0x50 &&
    head[2] === 0x44 &&
    head[3] === 0x46 &&
    head[4] === 0x2d
  );
}

/**
 * Object path for a new upload: <uuid>/<safe-filename>.pdf
 *
 * A random prefix rather than a user id, because guests upload too and there is
 * no id to key on. It needs to be unguessable rather than meaningful.
 */
export function cvObjectPath(originalName: string): string {
  const safe =
    originalName
      .toLowerCase()
      .replace(/[^a-z0-9.]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(-80) || "cv.pdf";
  return `${crypto.randomUUID()}/${safe}`;
}

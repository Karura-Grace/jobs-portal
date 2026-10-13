import "server-only";
import { headers } from "next/headers";
import { createHmac } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Rate limiting for the apply server action — see migrations/026_apply_rate_limit.sql
 * for the counter itself. This is the only call site; it is not a general
 * framework, so adding a second one should mean asking whether the same
 * bucket/window shape actually fits before reusing this.
 *
 * The IP is HMAC'd with a server-only secret before it ever reaches the
 * database — this product already treats tracking an anonymous applicant's
 * address as something to avoid where possible. A plain, unsalted hash would
 * only be pseudonymous in name: IPv4 is a ~4 billion-value space, cheap to
 * hash in full ahead of time, so `sha256(ip)` is a lookup table away from
 * being reversed. Keying it with a secret only this server knows is what
 * actually makes it one-way.
 *
 * Fails OPEN: if the check itself errors (missing service role key, database
 * hiccup, or migration 026 not yet applied so the function does not exist
 * yet), a real applicant is not blocked over infrastructure trouble — the
 * guest path is still constrained server-side by `submit_guest_application()`
 * regardless of whether this check ran.
 *
 * Failing open silently would mean the limiter can be permanently inert —
 * e.g. if 026 was never run against the live project — with nothing to show
 * for it in the UI, since an allowed request looks identical to a correctly
 * rate-limited one. Logged here so that state is at least visible in
 * function logs rather than indistinguishable from "nobody hit the limit".
 */
export async function checkRateLimit(
  bucket: string,
  max: number,
  windowSeconds: number
): Promise<boolean> {
  const hdrs = await headers();
  const forwardedFor = hdrs.get("x-forwarded-for");
  const ip = forwardedFor?.split(",")[0]?.trim() || hdrs.get("x-real-ip") || "unknown";

  try {
    const secret = process.env.RATE_LIMIT_HASH_SECRET;
    if (!secret) {
      throw new Error("RATE_LIMIT_HASH_SECRET is not set");
    }
    const hash = createHmac("sha256", secret).update(ip).digest("hex").slice(0, 32);
    const key = `${bucket}:${hash}`;

    const admin = createAdminClient();
    const { data, error } = await admin.rpc("rate_limit_hit", {
      p_key: key,
      p_max: max,
      p_window_seconds: windowSeconds,
    });
    if (error) {
      console.error("checkRateLimit: rate_limit_hit failed, failing open", error);
      return true;
    }
    return data === true;
  } catch (err) {
    console.error("checkRateLimit: unexpected error, failing open", err);
    return true;
  }
}

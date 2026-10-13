import { NextRequest, NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { getRedis } from "@/lib/redis";
import type { Database } from "@/types/database";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A counter nobody flushes (e.g. a job id that doesn't exist) expires on its own. */
const COUNTER_TTL_SECONDS = 7 * 24 * 60 * 60;

/**
 * Counts a view.
 *
 * With Redis configured, the view is an INCR on `job:views:<id>` and nothing
 * touches Postgres: `app/api/cron/flush-views` adds the totals to `jobs.views`
 * in one batched call (migration 035). That turns an UPDATE on a hot jobs row
 * per page view into one write per job per flush.
 *
 * Without Redis, or if Redis errors, it falls back to the original path — the
 * SECURITY DEFINER RPC, which an anonymous visitor may call because they have
 * no UPDATE on jobs and are not going to be given one.
 *
 * Called client-side, once, from `components/apply-panel.tsx` on mount —
 * moved out of the page's server render so `/jobs/[slug]` never touches
 * `headers()` and can be served from the ISR cache. A side effect of firing
 * from the browser rather than matching a server-side user-agent regex: a
 * crawler that never executes JavaScript never calls this at all, which
 * undercounts real crawler traffic more completely than the old regex did.
 *
 * Errors are swallowed on purpose. This is a vanity number on an employer's
 * dashboard; nothing about the page depends on it.
 */
export async function POST(request: NextRequest) {
  const { jobId } = (await request.json().catch(() => ({}))) as { jobId?: string };
  if (!jobId) return NextResponse.json({ ok: false }, { status: 400 });

  // Only well-formed ids get a Redis key, so a caller can't invent arbitrary key
  // names or put something in the flush batch that the database would reject.
  const redis = getRedis();
  if (redis && UUID.test(jobId)) {
    try {
      const key = `job:views:${jobId.toLowerCase()}`;
      await redis.multi().incr(key).expire(key, COUNTER_TTL_SECONDS, "NX").exec();
      return NextResponse.json({ ok: true });
    } catch {
      // Fall through to the database path below.
    }
  }

  try {
    const supabase = createSupabaseClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    await supabase.rpc("increment_job_view", { job: jobId });
  } catch {
    // Intentionally ignored.
  }

  return NextResponse.json({ ok: true });
}

import { NextRequest, NextResponse } from "next/server";
import { getRedis } from "@/lib/redis";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Moves the view counters that `app/api/jobs/view` keeps in Redis into
 * `jobs.views`, in one batched call (migration 035).
 *
 * Auth is the same as `app/api/cron/job-alerts`: `Authorization: Bearer
 * $CRON_SECRET`. Vercel sends that automatically for the cron in vercel.json
 * (once a day). For a tighter schedule on any plan, migration 035 has an
 * optional pg_cron snippet that calls this route every couple of minutes.
 *
 * Each counter is read and deleted in one atomic step (GETDEL), so a view that
 * lands mid-flush starts a fresh counter instead of being lost. If the database
 * call fails, the counts are put back so the next run picks them up.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const redis = getRedis();
  if (!redis) return NextResponse.json({ ok: true, skipped: "redis not configured" });

  const counts: Record<string, number> = {};
  let cursor = "0";
  do {
    const [next, keys] = await redis.scan(cursor, "MATCH", "job:views:*", "COUNT", 500);
    cursor = next;
    for (const key of keys) {
      const n = Number(await redis.getdel(key));
      if (Number.isFinite(n) && n > 0) counts[key.slice("job:views:".length)] = n;
    }
  } while (cursor !== "0");

  const ids = Object.keys(counts);
  if (ids.length === 0) return NextResponse.json({ ok: true, flushed: 0 });

  // increment_job_views is declared in migration 035, not yet in types/database.ts.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (createAdminClient() as any).rpc("increment_job_views", {
    p_counts: counts,
  });

  if (error) {
    console.error("flush-views: increment_job_views failed, restoring counters", error);
    await Promise.all(ids.map((id) => redis.incrby(`job:views:${id}`, counts[id])));
    return NextResponse.json({ ok: false }, { status: 500 });
  }

  return NextResponse.json({ ok: true, flushed: ids.length });
}

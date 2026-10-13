import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { deleteByPattern, JOBS_LIST_PREFIX } from "@/lib/redis-cache";

export const dynamic = "force-dynamic";

function sameSecret(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/**
 * Drops the cached /jobs listings. Called by the trigger in migration 036 when
 * a job is inserted, changed or deleted. Optional: with no trigger, cached
 * listings just expire on their own TTL.
 *
 * Guarded by `x-cache-secret` — without CACHE_INVALIDATE_SECRET set this
 * endpoint refuses everything, so it is never an open "flush the cache" URL.
 */
export async function POST(request: NextRequest) {
  const secret = process.env.CACHE_INVALIDATE_SECRET;
  const given = request.headers.get("x-cache-secret") ?? "";
  if (!secret || !sameSecret(given, secret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const removed = await deleteByPattern(`${JOBS_LIST_PREFIX}:*`);
    return NextResponse.json({ ok: true, removed });
  } catch (err) {
    console.error("cache invalidate failed", err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

import "server-only";
import { createHash } from "crypto";
import { getRedis } from "@/lib/redis";

/**
 * Cache-aside helpers on top of lib/redis.ts.
 *
 * Only ever put PUBLIC data through here — the same rows an anonymous visitor
 * can read. A cached value is served to everyone who asks for the same key, so
 * nothing viewer-specific (saved jobs, applications, profile data) belongs in
 * it. The jobs listing qualifies because it is read through the anon-key
 * client (`createPublicClient`) and RLS only lets published jobs through.
 */

/** Hard ceiling on any single Redis round-trip, on top of ioredis' own timeout. */
const REDIS_TIMEOUT_MS = 400;

function withTimeout<T>(promise: Promise<T>, ms = REDIS_TIMEOUT_MS): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("redis timeout")), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

interface CachedJsonOptions<T> {
  /** Only store the result when this returns true (e.g. not an error result). */
  cacheIf?: (value: T) => boolean;
  /** Skip Redis entirely for this call (e.g. a request not worth caching). */
  bypass?: boolean;
}

/**
 * Returns the cached value for `key`, or runs `load`, stores the result for
 * `ttlSeconds` and returns it. Fails open: if Redis is missing, slow or down,
 * `load` simply runs, so the page behaves as it did without a cache.
 */
export async function cachedJson<T>(
  key: string,
  ttlSeconds: number,
  // PromiseLike, not Promise: a Supabase query builder is awaitable but is not a Promise.
  load: () => PromiseLike<T>,
  options: CachedJsonOptions<T> = {}
): Promise<T> {
  const redis = options.bypass ? null : getRedis();
  if (!redis) return await load();

  let redisReachable = true;
  try {
    const hit = await withTimeout(redis.get(key));
    if (hit !== null) return JSON.parse(hit) as T;
  } catch {
    // Treated as a miss; falls through to the database. The read failed, so
    // don't make the request wait on a second Redis call just to write.
    redisReachable = false;
  }

  const value = await load();

  if (redisReachable && (!options.cacheIf || options.cacheIf(value))) {
    try {
      // A few seconds of jitter so keys written together don't all expire together.
      const ttl = ttlSeconds + Math.floor(Math.random() * 10);
      await withTimeout(redis.set(key, JSON.stringify(value), "EX", ttl));
    } catch {
      // Not caching is fine; the value is still returned.
    }
  }
  return value;
}

/**
 * Stable key for a set of request parameters: empty values dropped, keys
 * sorted, then hashed. The hash keeps keys short and means raw user input
 * (search text) never ends up in a Redis key name.
 */
export function hashedKey(prefix: string, params: Record<string, string | number | undefined | null>) {
  const normalised = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== "")
    .sort(([a], [b]) => a.localeCompare(b));
  const digest = createHash("sha1").update(JSON.stringify(normalised)).digest("hex").slice(0, 24);
  return `${prefix}:${digest}`;
}

/**
 * Deletes every key matching `pattern`. Used to drop cached listings when jobs
 * change. SCAN rather than KEYS so it never blocks Redis, and UNLINK so the
 * memory is freed in the background. Returns how many keys were removed.
 */
export async function deleteByPattern(pattern: string): Promise<number> {
  const redis = getRedis();
  if (!redis) return 0;

  let cursor = "0";
  let removed = 0;
  do {
    const [next, keys] = await redis.scan(cursor, "MATCH", pattern, "COUNT", 200);
    cursor = next;
    if (keys.length) removed += await redis.unlink(...keys);
  } while (cursor !== "0");
  return removed;
}

/** Cached `/jobs` result pages live under this prefix. */
export const JOBS_LIST_PREFIX = "jobs:list";

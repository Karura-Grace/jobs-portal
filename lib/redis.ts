import "server-only";
import { Redis } from "ioredis";

/**
 * Optional Redis connection, used only as a cache (see lib/redis-cache.ts).
 * Postgres stays the source of truth: nothing stored here is needed to serve a
 * correct page, so every caller has to cope with `null` and with failures.
 *
 * Returns null when no URL is configured, which makes Redis fully opt-in. A
 * deploy without REDIS_URL behaves exactly like the app did before.
 *
 * Tuned for serverless (Vercel):
 *  - the client is kept on globalThis, so a warm instance and `next dev` hot
 *    reloads reuse one connection instead of opening a new one per request;
 *  - short connect/command timeouts, so a slow Redis costs a request at most a
 *    fraction of a second before it falls back to Postgres;
 *  - offline queue ON, so the first command on a cold instance waits for the
 *    connection instead of failing straight away.
 *
 * Vercel's Upstash integration provides a `rediss://` URL (TLS), which ioredis
 * enables automatically from the scheme.
 */
const globalForRedis = globalThis as unknown as { __pacRedis?: Redis | null };

export function getRedis(): Redis | null {
  if (globalForRedis.__pacRedis !== undefined) return globalForRedis.__pacRedis;

  const url = process.env.REDIS_URL || process.env.KV_URL;
  if (!url) {
    globalForRedis.__pacRedis = null;
    return null;
  }

  const client = new Redis(url, {
    connectTimeout: 2000,
    commandTimeout: 1000,
    maxRetriesPerRequest: 1,
    enableOfflineQueue: true,
    // Keep retrying in the background with a capped backoff, so a long-lived
    // `next start` process recovers by itself after a Redis restart.
    retryStrategy: (times) => Math.min(times * 200, 2000),
  });
  client.on("error", (err) => {
    // Logged, never thrown: a Redis outage must not take pages down.
    console.error("[redis]", err.message);
  });

  globalForRedis.__pacRedis = client;
  return client;
}

npm run# Redis cache

Redis is an optional cache in front of Postgres. Postgres stays the source of
truth; nothing in Redis is needed to serve a correct page. With `REDIS_URL`
unset, or Redis down or slow, the app behaves exactly as it did before.

## What it does

| Where | What | Key | TTL |
|---|---|---|---|
| `app/jobs/page.tsx` | the `/jobs` result page for each search/filter/page combination | `jobs:list:<hash>` | 60 s |
| `app/api/jobs/view/route.ts` | view counter: `INCR` instead of an `UPDATE` on `jobs` per page view | `job:views:<job id>` | 7 days (safety) |
| `app/api/cron/flush-views` | adds the counters to `jobs.views` in one batched call, then clears them | | |
| `app/api/cache/invalidate` | optional: clears cached listings when a job changes | | |

Deliberately **not** moved to Redis, because they are already cached by
`unstable_cache` / ISR and Vercel's shared data cache: the homepage feed,
categories and locations, and `/jobs/[slug]`. Also untouched: the apply
rate limiter (`lib/rate-limit.ts`, migration 026), and everything per-user
(applications, profiles, saved jobs, dashboards), which must never be cached
in a shared store.

Only public data goes through `lib/redis-cache.ts`. The `/jobs` query runs on
the anon-key client, so what is cached is exactly what an anonymous visitor
can already see.

## Setup

1. **Redis.** In the Vercel project: Storage → Marketplace → *Upstash for Redis*.
   It adds the connection URL (a `rediss://` URL) to the project. Make sure it
   is available to the app as `REDIS_URL`. Locally, `redis-server` plus
   `REDIS_URL=redis://localhost:6379` works.
2. **Dependency.** `ioredis` is already in `package.json` / `package-lock.json`.
3. **Migration 035** (`migrations/035_batched_job_views.sql`) in the Supabase SQL
   editor. Needed for the batched view counter. Until it is applied the daily
   flush cannot write the counts, so apply it before or together with deploying.
4. **Deploy.** `vercel.json` now has a second cron, `/api/cron/flush-views`,
   daily at 07:30 and protected by the same `CRON_SECRET` as the alerts cron.
5. **Optional: flush more often.** Migration 035 ends with a commented
   `pg_cron` snippet that calls the flush route every 2 minutes. Use it if your
   Vercel plan only allows daily crons and you want fresher view counts.
6. **Optional: instant invalidation.** Migration 036 plus `CACHE_INVALIDATE_SECRET`
   makes a changed job clear the cached listings immediately instead of after
   up to a minute. Needs `pg_net`. Edit the domain and secret in the SQL
   editor; do not commit the real secret.

## Behaviour to know about

- A cached `/jobs` page can be up to about a minute out of date (TTL 60 s plus a
  few seconds of jitter) unless migration 036 is applied.
- View counts reach `jobs.views` on the next flush (daily by default). The
  counter in Redis is not visible to the dashboard until then.
- Errors are never cached. A failed Redis call is treated as a cache miss.
- Searches over 100 characters, pages past 20 and non-uuid category/location
  values skip the cache, so probing traffic can't fill it with junk keys.
- If Redis is unreachable, a `/jobs` request waits up to about 0.4 s for the
  failed read before going to Postgres.

## Checking it works

Load `/jobs?category=<id>` twice. With Redis CLI connected to the same instance,
`SCAN 0 MATCH "jobs:list:*"` shows the cached page, and `TTL` on it counts down
from ~60. Open a job page and `GET job:views:<job id>` shows the counter.

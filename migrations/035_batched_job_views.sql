-- 035 — batched view counter, for the Redis cache layer
--
-- app/api/jobs/view now counts views in Redis and app/api/cron/flush-views adds
-- the totals to jobs.views in one call. This is that call. increment_job_view()
-- (migration 017) is untouched and stays as the fallback when Redis is not
-- configured or is down.
--
-- Same rules as 017: only published jobs are counted, and it is a vanity number.
-- Unlike 017 this one is NOT callable by anon/authenticated — it takes a whole
-- batch, so it is granted to service_role only and reached from the cron route
-- through the admin client.
--
-- Idempotent — safe to re-run.

create or replace function public.increment_job_views(p_counts jsonb)
returns integer
language sql
security definer
set search_path = ''
as $$
  with batch as (
    select key::uuid as id,
           -- clamp a bad value rather than letting one entry skew a count
           least(greatest(value::integer, 0), 1000000) as n
      from jsonb_each_text(p_counts)
  ),
  updated as (
    update public.jobs j
       set views = coalesce(j.views, 0) + b.n
      from batch b
     where j.id = b.id
       and j.status = 'published'::public.job_status
    returning 1
  )
  select count(*)::integer from updated;
$$;

revoke execute on function public.increment_job_views(jsonb) from public, anon, authenticated;
grant execute on function public.increment_job_views(jsonb) to service_role;

-- ── Optional: flush every 2 minutes instead of once a day ─────────────────────
-- vercel.json runs /api/cron/flush-views once a day, which is all some Vercel
-- plans allow. To flush more often, schedule it from Supabase instead (needs the
-- pg_cron and pg_net extensions, both available under Database → Extensions).
-- Replace the host and secret, run it once in the SQL editor, and do NOT commit
-- the real secret:
--
--   select cron.schedule(
--     'flush-job-views',
--     '*/2 * * * *',
--     $job$
--       select net.http_get(
--         url     := 'https://YOUR-DOMAIN/api/cron/flush-views',
--         headers := jsonb_build_object('Authorization', 'Bearer YOUR_CRON_SECRET')
--       );
--     $job$
--   );
--
-- To remove it:  select cron.unschedule('flush-job-views');

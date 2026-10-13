-- 036 — OPTIONAL: clear the Redis job-listing cache as soon as a job changes
--
-- You do not need this. Without it, a cached /jobs page expires on its own
-- after about a minute (see the TTL in app/jobs/page.tsx), which is the same
-- order of staleness as the ISR pages around it. Apply it only if you want an
-- approved, rejected, paused or deleted job to disappear from /jobs listings
-- immediately.
--
-- How it works: a trigger on public.jobs calls POST /api/cache/invalidate on
-- the site (through pg_net, asynchronously), which deletes the cached listing
-- keys. It never blocks or fails a job write: any error inside the trigger is
-- swallowed. Writes that only change `views` or `updated_at` are ignored, so the
-- view-counter flush does not clear the cache, and a bulk update fires one
-- request per transaction, not one per row.
--
-- Before running:
--   1. Database → Extensions → enable pg_net.
--   2. Set CACHE_INVALIDATE_SECRET in Vercel (any long random string).
--   3. Replace YOUR-DOMAIN and YOUR_CACHE_INVALIDATE_SECRET below, in the SQL
--      editor. Do NOT commit the real secret to git.
--
-- Idempotent — safe to re-run.

create or replace function public.notify_jobs_changed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- once per transaction is enough
  if current_setting('app.jobs_cache_notified', true) = '1' then
    return null;
  end if;
  perform set_config('app.jobs_cache_notified', '1', true);

  begin
    perform net.http_post(
      url     := 'https://YOUR-DOMAIN/api/cache/invalidate',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-cache-secret', 'YOUR_CACHE_INVALIDATE_SECRET'
      ),
      body    := '{}'::jsonb
    );
  exception when others then
    -- pg_net missing or the call failed: never let that break a job write
    null;
  end;

  return null;
end;
$$;

revoke execute on function public.notify_jobs_changed() from public, anon, authenticated;

drop trigger if exists jobs_cache_invalidate_ins_del on public.jobs;
create trigger jobs_cache_invalidate_ins_del
  after insert or delete on public.jobs
  for each row execute function public.notify_jobs_changed();

drop trigger if exists jobs_cache_invalidate_upd on public.jobs;
create trigger jobs_cache_invalidate_upd
  after update on public.jobs
  for each row
  when (
    (to_jsonb(old) - 'views' - 'updated_at')
      is distinct from (to_jsonb(new) - 'views' - 'updated_at')
  )
  execute function public.notify_jobs_changed();

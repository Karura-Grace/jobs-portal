-- ============================================================
-- 026 — Rate limit the guest/seeker apply path
-- ============================================================
-- launch-checks.md S11/S17: there is no rate limiting anywhere. Sign-in
-- traffic goes straight to Supabase Auth (its own rate limits apply there),
-- but the apply flow is a server action on our own origin since migration
-- 024 — so it is the one write path this project can throttle itself,
-- without depending on whether Vercel's WAF custom rules are available on
-- the current plan.
--
-- This is deliberately a narrow, single-purpose counter, not a general rate
-- limiting framework: one function, one table, called from exactly one
-- place (app/jobs/actions.ts submitApplication, via lib/rate-limit.ts).
--
-- Keyed on a HASHED ip, never the raw address — this product already treats
-- IP-level tracking of an anonymous applicant as something to avoid where
-- possible (see 013's note on why per-IP throttling was not done at the
-- Postgres/PostgREST layer). Hashing means the stored key cannot be reversed
-- back to an address, while still being stable enough to rate-limit against.
--
-- Fixed window, not sliding — a fixed window can allow a short burst right at
-- the boundary, but it needs no extra bookkeeping and is precise enough for
-- "stop a script", which is the actual threat here. The limit itself
-- (8 requests / 15 minutes, see lib/rate-limit.ts) is deliberately generous:
-- Kenyan mobile traffic sits behind carrier NAT, so one IP can be hundreds of
-- people, and this only needs to catch a scripted flood, not a busy family
-- Wi-Fi router.
-- ============================================================

create table if not exists public.rate_limits (
  key text not null,
  window_start timestamptz not null,
  hits integer not null default 1,
  primary key (key, window_start)
);

create index if not exists rate_limits_window_start_idx
  on public.rate_limits (window_start);

-- RLS on with no policies at all: nobody reaches this table directly, only
-- through rate_limit_hit() below, which runs as the function owner and
-- bypasses it. Belt and braces, matching the pattern used everywhere else in
-- this schema for tables that should have no direct API surface.
alter table public.rate_limits enable row level security;

create or replace function public.rate_limit_hit(
  p_key text,
  p_max integer,
  p_window_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  bucket timestamptz;
  current_hits integer;
begin
  bucket := to_timestamp(
    floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds
  );

  insert into public.rate_limits (key, window_start, hits)
  values (p_key, bucket, 1)
  on conflict (key, window_start)
  do update set hits = public.rate_limits.hits + 1
  returning hits into current_hits;

  -- Cheap, probabilistic cleanup rather than a cron job: on roughly 1 in 100
  -- calls, drop buckets old enough that no window could still reference them.
  -- This table only ever holds recent windows for keys that are actually
  -- being hit, so it stays small without needing pg_cron wired up for it.
  if random() < 0.01 then
    delete from public.rate_limits
    where window_start < now() - interval '1 day';
  end if;

  return current_hits <= p_max;
end;
$$;

-- service_role only. This is called from lib/rate-limit.ts via the admin
-- client, the same sanctioned pattern lib/supabase/admin.ts already
-- documents for scoped, security-definer-only elevated access — never
-- exposed to anon or authenticated directly.
revoke execute on function public.rate_limit_hit(text, integer, integer)
  from public, anon, authenticated;
grant execute on function public.rate_limit_hit(text, integer, integer)
  to service_role;

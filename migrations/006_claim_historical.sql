-- ============================================================
-- 006 — Let a returning applicant claim their own history
-- ============================================================
-- All 4,355 migrated applications have applicant_id = NULL, because Jobmonster
-- stored applicants as `noo_application` posts rather than WordPress users --
-- there was no account to map to. Migration 004's seeker policy is
-- `applicant_id = auth.uid()`, so those rows are invisible to everyone except
-- admins and the owning employer.
--
-- Consequence without this migration: someone who applied through PAC Africa in
-- 2016 signs up on the new site and sees an empty dashboard, even though their
-- application is sitting in the table. Claiming is what makes a decade of
-- recovered history worth anything to the person it belongs to.
--
-- SECURITY -- this is the sharp edge of the whole rebuild.
-- Matching on email means that whoever controls an email address can reach the
-- name, phone number and cover letters filed under it. Two controls:
--
--   1. The address is read from auth.users by auth.uid(). It is NEVER a
--      parameter. A caller cannot ask to claim someone else's address.
--   2. email_confirmed_at must be non-null. Without this, anyone could register
--      as victim@example.com and harvest their history before the real owner
--      ever saw a confirmation mail. This is why email confirmation stays on.
--
-- Matching is case-insensitive because the WordPress meta was not normalised.
-- ============================================================

-- ── HOW MANY COULD I CLAIM? ──────────────────────────────────
create or replace function public.count_claimable_applications()
returns integer
language plpgsql
security definer
stable
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  addr text;
  n integer;
begin
  if uid is null then
    return 0;
  end if;

  select u.email into addr
  from auth.users u
  where u.id = uid
    and u.email_confirmed_at is not null;

  if addr is null then
    return 0;
  end if;

  select count(*) into n
  from public.applications
  where applicant_id is null
    and lower(applicant_email) = lower(addr);

  return coalesce(n, 0);
end;
$$;

comment on function public.count_claimable_applications() is
  'Number of unclaimed historical applications matching the caller''s confirmed '
  'email address. Returns 0 for unconfirmed or anonymous callers.';

-- ── CLAIM THEM ───────────────────────────────────────────────
-- Deliberately NOT `stable` -- it writes.
create or replace function public.claim_historical_applications()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  addr text;
  claimed integer;
begin
  if uid is null then
    return 0;
  end if;

  select u.email into addr
  from auth.users u
  where u.id = uid
    and u.email_confirmed_at is not null;

  if addr is null then
    return 0;
  end if;

  update public.applications
     set applicant_id = uid
   where applicant_id is null
     and lower(applicant_email) = lower(addr);

  get diagnostics claimed = row_count;
  return coalesce(claimed, 0);
end;
$$;

comment on function public.claim_historical_applications() is
  'Attaches unclaimed historical applications matching the caller''s CONFIRMED '
  'email to their profile. Address is taken from auth.users via auth.uid(), '
  'never from a parameter (see migration 006).';

-- Anon has nothing to claim and must not be able to probe which addresses
-- exist in the historical data.
revoke execute on function public.count_claimable_applications() from public;
revoke execute on function public.claim_historical_applications() from public;
grant execute on function public.count_claimable_applications() to authenticated;
grant execute on function public.claim_historical_applications() to authenticated;

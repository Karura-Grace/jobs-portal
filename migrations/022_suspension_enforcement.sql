-- ============================================================
-- 022 — Make a suspension actually stop something
-- ============================================================
-- Migration 017 added `suspended_at` and made a suspended *employer's* listings
-- disappear from the public site, through jobs_select_published. It did nothing
-- about a suspended *seeker*: the column was set and the account carried on
-- applying, which makes the admin action a label rather than a control.
--
-- Two layers, because either alone is incomplete:
--
--   The app redirects a suspended user out of every dashboard (lib/auth.ts), so
--   they are told what happened rather than watching things silently fail.
--
--   This trigger refuses the write, so the API cannot be used to get round the
--   app. It is the layer that matters.
--
-- A guest application (applicant_id null) is deliberately unaffected: there is
-- no account to suspend, and the apply form is open to the public by design.
-- ============================================================

create or replace function public.guard_suspended_applicant()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.applicant_id is not null
     and exists (
       select 1 from public.profiles p
       where p.id = new.applicant_id and p.suspended_at is not null
     ) then
    raise exception 'this account is suspended and cannot submit applications';
  end if;
  return new;
end;
$$;

revoke execute on function public.guard_suspended_applicant() from public, anon, authenticated;

drop trigger if exists trg_applications_suspended on public.applications;
create trigger trg_applications_suspended
  before insert on public.applications
  for each row execute function public.guard_suspended_applicant();

-- Same for posting: a suspended employer should not be able to add listings,
-- even though the ones they have are already hidden.
create or replace function public.guard_suspended_poster()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null or public.is_admin() then
    return new;
  end if;

  if exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.suspended_at is not null
  ) or exists (
    select 1 from public.companies c
    where c.id = new.company_id and c.suspended_at is not null
  ) then
    raise exception 'this account is suspended and cannot post listings';
  end if;
  return new;
end;
$$;

revoke execute on function public.guard_suspended_poster() from public, anon, authenticated;

drop trigger if exists trg_jobs_suspended on public.jobs;
create trigger trg_jobs_suspended
  before insert or update on public.jobs
  for each row execute function public.guard_suspended_poster();

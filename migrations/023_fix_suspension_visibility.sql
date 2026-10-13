-- ============================================================
-- 023 — Fix: suspending an employer did not hide their listings
-- ============================================================
-- Migration 017 rewrote jobs_select_published to exclude listings whose company
-- is suspended:
--
--   and not exists (
--     select 1 from public.companies c
--     where c.id = jobs.company_id and c.suspended_at is not null
--   )
--
-- That subquery runs under the *caller's* privileges, and migration 016 removed
-- public read on `companies`. So for an anonymous visitor the subquery returns
-- zero rows whatever the truth is, `not exists` is always true, and a suspended
-- employer's roles stayed on the public site — exactly the case the check
-- existed for. Confirmed by probe: as `anon`, `select count(*) from companies`
-- returns 0 while the company plainly exists.
--
-- A policy predicate must not depend on RLS the caller does not have. The check
-- moves into a SECURITY DEFINER function, which reads `companies` regardless of
-- who is asking and returns one boolean — no rows, no columns, nothing else
-- leaked. `stable` so the planner can call it once per company id rather than
-- once per row.
-- ============================================================

create or replace function public.company_suspended(company uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select company is not null
     and exists (
       select 1 from public.companies c
       where c.id = company and c.suspended_at is not null
     );
$$;

-- anon needs it: the policy below is evaluated for anonymous visitors, and a
-- policy calling a function the role cannot execute fails the whole query.
revoke execute on function public.company_suspended(uuid) from public;
grant execute on function public.company_suspended(uuid) to anon, authenticated;

drop policy if exists "jobs_select_published" on public.jobs;
create policy "jobs_select_published" on public.jobs
  for select to anon, authenticated
  using (
    status = 'published'::public.job_status
    and not public.company_suspended(company_id)
  );

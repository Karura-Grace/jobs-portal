-- ============================================================
-- 001 — Fix infinite RLS recursion (42P17)
-- ============================================================
-- PROBLEM (measured against this project as the `anon` role):
--
--   applications   -> 42P17 infinite recursion detected in policy for relation "profiles"
--   jobs           -> 42P17
--   companies      -> 42P17
--   profiles       -> 42P17
--
-- Cause: "admins full access profiles" is a policy ON profiles whose USING
-- clause runs `exists (select 1 from profiles ...)`. Reading profiles
-- re-evaluates that same policy, so Postgres aborts with 42P17 instead of
-- recursing. The identical subquery was copy-pasted into the admin policies on
-- jobs, applications and companies, so those tables inherit the fault the
-- moment their admin policy is evaluated -- which is every query, because
-- policies are OR-ed and all of them get planned.
--
-- Fix: move the admin test into a SECURITY DEFINER function. The definer
-- context does not apply RLS to the function's own read of profiles, which
-- breaks the cycle. This is the standard Supabase remedy.
--
-- Also applied throughout this migration set:
--   * `(select auth.uid())` rather than bare `auth.uid()` -- lets the planner
--     hoist it to an InitPlan evaluated once per query instead of once per row.
--     With 4,355 rows in `applications` that is the difference between one call
--     and 4,355.
--   * explicit `to anon` / `to authenticated` instead of the default PUBLIC, so
--     a policy is never even considered for a role it does not concern.
--   * `set search_path = ''` on every function, with fully-qualified names, so
--     the function cannot be hijacked by a caller-controlled search_path.
-- ============================================================

-- ── ADMIN PREDICATE ──────────────────────────────────────────
create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid())
      and role = 'admin'::public.user_role
  );
$$;

comment on function public.is_admin() is
  'True when the caller is an admin. SECURITY DEFINER so that reading profiles '
  'here does not re-enter profiles RLS (see migration 001).';

-- Anon has no admin question to ask. service_role keeps execute so a future
-- server-side import script (see context-sessions/06-access-and-credentials.md)
-- is not locked out of its own helper.
revoke execute on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated, service_role;

-- ── PROFILES ─────────────────────────────────────────────────
drop policy if exists "admins full access profiles" on public.profiles;
drop policy if exists "users view own profile"      on public.profiles;
drop policy if exists "users update own profile"    on public.profiles;

create policy "profiles_select" on public.profiles
  for select to authenticated
  using ((select auth.uid()) = id or public.is_admin());

create policy "profiles_update" on public.profiles
  for update to authenticated
  using ((select auth.uid()) = id or public.is_admin())
  with check ((select auth.uid()) = id or public.is_admin());

-- Deliberately no DELETE policy: profiles are removed by the
-- `on delete cascade` from auth.users, not by clients.

-- ── JOBS ─────────────────────────────────────────────────────
drop policy if exists "admins full access jobs"    on public.jobs;
drop policy if exists "employers manage own jobs"  on public.jobs;
drop policy if exists "public view published jobs" on public.jobs;

-- Published jobs are the public product surface.
create policy "jobs_select_published" on public.jobs
  for select to anon, authenticated
  using (status = 'published'::public.job_status);

-- An employer sees and edits their own jobs at any status. Matched on
-- posted_by OR company ownership so a job stays reachable if one of the two
-- was left unset (see migration 004 for why that mattered).
create policy "jobs_select_own" on public.jobs
  for select to authenticated
  using (
    posted_by = (select auth.uid())
    or company_id in (
      select c.id from public.companies c where c.owner_id = (select auth.uid())
    )
  );

create policy "jobs_insert_own" on public.jobs
  for insert to authenticated
  with check (posted_by = (select auth.uid()));

create policy "jobs_update_own" on public.jobs
  for update to authenticated
  using (
    posted_by = (select auth.uid())
    or company_id in (
      select c.id from public.companies c where c.owner_id = (select auth.uid())
    )
  )
  with check (
    posted_by = (select auth.uid())
    or company_id in (
      select c.id from public.companies c where c.owner_id = (select auth.uid())
    )
  );

create policy "jobs_admin_all" on public.jobs
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ── COMPANIES ────────────────────────────────────────────────
drop policy if exists "admins full access companies" on public.companies;
drop policy if exists "owners manage company"        on public.companies;
drop policy if exists "public view companies"        on public.companies;

create policy "companies_select_public" on public.companies
  for select to anon, authenticated
  using (true);

create policy "companies_insert_own" on public.companies
  for insert to authenticated
  with check (owner_id = (select auth.uid()));

-- `verified` drives the badge on job cards, so it must not be self-settable.
-- Enforced by trigger below rather than in the policy, because a WITH CHECK
-- cannot see the previous row value on UPDATE.
create policy "companies_update_own" on public.companies
  for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

create policy "companies_admin_all" on public.companies
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create or replace function public.guard_company_verified()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  -- Only end users carrying a JWT are policed here. A direct database session
  -- (SQL Editor, service_role key, migration script) has no auth.uid() and is
  -- already privileged enough to bypass RLS, so guarding it would only make
  -- legitimate admin work harder without adding protection.
  if new.verified is distinct from old.verified
     and (select auth.uid()) is not null
     and not public.is_admin() then
    raise exception 'verified may only be changed by an admin';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_companies_verified_guard on public.companies;
create trigger trg_companies_verified_guard
  before update on public.companies
  for each row execute function public.guard_company_verified();

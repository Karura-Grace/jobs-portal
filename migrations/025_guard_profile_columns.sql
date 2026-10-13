-- ============================================================
-- 025 — Stop a user promoting themselves to admin
-- ============================================================
-- CRITICAL, and live since migration 001. `profiles_update` allowed
--
--   using       (auth.uid() = id or is_admin())
--   with check  (auth.uid() = id or is_admin())
--
-- which constrains the ROW but not the COLUMNS. RLS has no column granularity,
-- and nothing else stood in the way: `handle_new_user` (003) whitelists the role
-- supplied at signup, but that only covers the insert. Nothing guarded a later
-- UPDATE.
--
-- So any registered user could send
--
--   PATCH /rest/v1/profiles?id=eq.<own-uid>   {"role":"admin"}
--
-- with the public anon key and their own token, and `is_admin()` would then
-- return true — unlocking `applications_admin_all`, `cvs_select_admin`, the
-- admin jobs/companies policies, the publish bypass in `guard_job_status`, and
-- every /admin page. Verified against the live database before writing this:
-- a seeker promoted itself and read 4,355 of 4,356 application rows.
--
-- Two other columns matter for the same reason:
--
--   email      — app/jobs/actions.ts takes a signed-in applicant's address from
--                here, so a rewritable value meant an application could be filed
--                under someone else's address. (That call site now reads
--                auth.users instead, but the column should not have been
--                rewritable either way.)
--   company_id — self-assigning another employer's company is an integrity
--                problem even where it grants nothing, because every employer
--                policy keys on companies.owner_id rather than on this column.
--
-- WHY A TRIGGER AND NOT A COLUMN GRANT. `revoke update (role) on profiles from
-- authenticated` looks like the tighter fix and is the wrong one here: Supabase
-- admins ARE the `authenticated` role, so a column revoke would also stop an
-- admin changing a role or suspending an account. Column privileges cannot see
-- who is asking; a trigger calling is_admin() can.
-- ============================================================

create or replace function public.guard_profile_columns()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  -- A direct database session (SQL editor, service_role, migration) has no
  -- auth.uid() and is already privileged.
  if (select auth.uid()) is null or public.is_admin() then
    return new;
  end if;

  if new.role is distinct from old.role then
    raise exception 'only an administrator can change an account role';
  end if;

  if new.email is distinct from old.email then
    raise exception 'email cannot be changed here';
  end if;

  -- Allowed to change, but only to a company you actually own — which is what
  -- the employer onboarding flow does after creating one.
  if new.company_id is distinct from old.company_id
     and new.company_id is not null
     and not exists (
       select 1 from public.companies c
       where c.id = new.company_id and c.owner_id = (select auth.uid())
     ) then
    raise exception 'you can only attach your profile to a company you own';
  end if;

  return new;
end;
$$;

revoke execute on function public.guard_profile_columns() from public, anon, authenticated;

drop trigger if exists trg_profiles_columns_guard on public.profiles;
create trigger trg_profiles_columns_guard
  before update on public.profiles
  for each row execute function public.guard_profile_columns();

-- ── Audit ────────────────────────────────────────────────────
-- Surfaces any admin that was not created deliberately. Run and read the output
-- rather than assuming; the escalation above was reachable for the whole life of
-- the rebuild.
do $$
declare
  admins text;
begin
  select string_agg(email || ' (' || created_at::date || ')', ', ' order by created_at)
    into admins
    from public.profiles where role = 'admin';
  raise notice 'ADMIN ACCOUNTS: %', coalesce(admins, 'none');
end $$;

-- ============================================================
-- Tighten the application insert policy
-- ============================================================
-- Migration 024's `applications_insert_own` checked applicant_id, job_id and
-- that the job is published. It did not constrain `status`, so any authenticated
-- caller could POST an application already marked `hired`, and it had no role
-- gate at all — despite the comment in app/jobs/actions.ts claiming the policy
-- provided one.
--
-- `cv_url` is constrained away from the `r2:` prefix as well. Migration 012
-- dropped `cvs_select_applicant` precisely because an unconstrained cv_url lets
-- a caller pin read access to an object path they happen to know; the archive
-- keys are content hashes reached through lib/r2.ts, which signs any key it is
-- given, so they have no business arriving from a client insert.
drop policy if exists "applications_insert_own" on public.applications;
create policy "applications_insert_own" on public.applications
  for insert to authenticated
  with check (
    applicant_id = (select auth.uid())
    and job_id is not null
    -- A new application starts at the beginning, whoever is writing it.
    and status = 'pending'::public.application_status
    -- Only a job seeker applies. Employers and admins get the read-only view.
    and exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid())
        and p.role = 'seeker'::public.user_role
        and p.suspended_at is null
    )
    and (cv_url is null or cv_url not like 'r2:%')
    and exists (
      select 1 from public.jobs j
      where j.id = job_id
        and j.status = 'published'::public.job_status
    )
  );

-- ============================================================
-- Stop the employer CV policy trusting a caller-writable column
-- ============================================================
-- `cvs_select_employer` (007) matches on `a.cv_url = storage.objects.name`. An
-- employer who owns a published job could therefore insert an application for
-- themselves against their own job, set cv_url to a path they had seen
-- elsewhere, and gain indefinite read on that object — the same shape migration
-- 012 closed for applicants and left open here.
--
-- Excluding rows the caller filed themselves removes it. An employer reading a
-- CV on their own application is already covered by `cvs_select_owner`.
drop policy if exists "cvs_select_employer" on storage.objects;
create policy "cvs_select_employer" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'cvs'
    and exists (
      select 1
      from public.applications a
      join public.jobs j on j.id = a.job_id
      where a.cv_url = storage.objects.name
        -- Not a row you wrote about yourself.
        and a.applicant_id is distinct from (select auth.uid())
        and (
          j.posted_by = (select auth.uid())
          or j.company_id in (
            select c.id from public.companies c where c.owner_id = (select auth.uid())
          )
        )
    )
  );

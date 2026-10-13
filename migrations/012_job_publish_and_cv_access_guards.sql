-- ============================================================
-- 012 — Close two authorization holes found in review
-- ============================================================
-- Both are reachable because PostgREST is directly callable with the public
-- anon key. The app code does the right thing in every case; RLS did not
-- enforce it, and the app is not the only client.
--
-- ── FINDING 1: employers could publish their own listings, and post as
--    somebody else's company ────────────────────────────────────────────
--
-- `jobs_insert_own` checked only `posted_by = auth.uid()`. Nothing constrained
-- `status` or `company_id`. So any registered employer could:
--
--   POST /rest/v1/jobs
--   { "posted_by": "<their uid>",
--     "status": "published",                 <-- straight past the review queue
--     "company_id": "<a verified company>",  <-- posting as someone else
--     "title": "...", "slug": "...", "description": "..." }
--
-- and land a live listing on /jobs carrying another employer's name and the
-- "Verified employer" badge from components/job-card.tsx. On a job board that
-- is the high-value attack: a scam role under a trusted brand, harvesting
-- applicant names, phone numbers and CVs. `jobs_update_own` allowed the same
-- status flip on an existing row.
--
-- Fixed two ways, because they are two different shapes of problem:
--   * `company_id` is a static property of the new row, so a WITH CHECK can
--     require the caller to own it.
--   * `status` is a transition, and WITH CHECK cannot see the old value — so a
--     trigger, matching the existing guard_company_verified pattern from 001.
--
-- ── FINDING 2: cvs_select_applicant granted read on any object path the
--    caller could name ─────────────────────────────────────────────────
--
-- The policy was:
--     exists (select 1 from applications a
--              where a.cv_url = storage.objects.name
--                and a.applicant_id = auth.uid())
--
-- `applications_insert_public` puts no constraint on `cv_url`. So a signed-in
-- seeker could apply to any published job with `cv_url` set to a path they had
-- seen — for example lifted out of an expired presigned URL, which contains the
-- object path in plain sight — and thereby hold indefinite read access to
-- someone else's CV. It turns a 5-minute link into a permanent one.
--
-- The policy existed only for archive files, which have `owner` NULL because
-- service_role uploaded them, so `cvs_select_owner` could not match. The archive
-- is going to R2 instead (migration 009 and scripts/migrate-cvs.mjs), where
-- storage.objects policies do not apply at all. So it now protects nothing and
-- is simply dropped rather than narrowed.
-- ============================================================

-- ── 1a. company_id must belong to the caller ─────────────────
drop policy if exists "jobs_insert_own" on public.jobs;
create policy "jobs_insert_own" on public.jobs
  for insert to authenticated
  with check (
    posted_by = (select auth.uid())
    and (
      company_id is null
      or company_id in (
        select c.id from public.companies c where c.owner_id = (select auth.uid())
      )
    )
  );

drop policy if exists "jobs_update_own" on public.jobs;
create policy "jobs_update_own" on public.jobs
  for update to authenticated
  using (
    posted_by = (select auth.uid())
    or company_id in (
      select c.id from public.companies c where c.owner_id = (select auth.uid())
    )
  )
  with check (
    (
      posted_by = (select auth.uid())
      or company_id in (
        select c.id from public.companies c where c.owner_id = (select auth.uid())
      )
    )
    and (
      company_id is null
      or company_id in (
        select c.id from public.companies c where c.owner_id = (select auth.uid())
      )
    )
  );

-- ── 1b. only an admin may publish ────────────────────────────
create or replace function public.guard_job_status()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  -- A direct database session (SQL Editor, service_role, migration) has no
  -- auth.uid() and is already privileged; admins are the sanctioned path.
  if (select auth.uid()) is null or public.is_admin() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    -- Coerced rather than rejected: an employer submitting a listing has done
    -- nothing wrong, they just do not get to choose where it lands.
    if new.status is distinct from 'pending_review'::public.job_status then
      new.status := 'pending_review'::public.job_status;
    end if;
  elsif new.status is distinct from old.status
        and new.status in ('published'::public.job_status,
                           'expired'::public.job_status) then
    raise exception 'only an administrator can publish a listing';
  end if;

  return new;
end;
$$;

revoke execute on function public.guard_job_status() from public, anon, authenticated;

drop trigger if exists trg_jobs_status_guard on public.jobs;
create trigger trg_jobs_status_guard
  before insert or update on public.jobs
  for each row execute function public.guard_job_status();

-- ── 2. drop the over-broad CV read path ──────────────────────
drop policy if exists "cvs_select_applicant" on storage.objects;

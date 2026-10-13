-- ============================================================
-- 004 — Applications: who may read, insert and update
-- ============================================================
-- `applications` is the most sensitive table in this database: 4,355 real
-- names, email addresses and phone numbers, some over a decade old, recovered
-- from the compromised WordPress install. Anon must never read a row from it.
--
-- TWO DEFECTS FIXED HERE
--
-- 1. Guest applications were impossible. "seekers insert applications" had
--    `with check (applicant_id = auth.uid())`. For a visitor who is not signed
--    in, both sides are NULL, and `NULL = NULL` is NULL -- not true -- so the
--    insert was denied. The public apply form on /jobs/[slug] could therefore
--    never succeed for the exact audience it exists to serve. (Migrated
--    history shows _candidate_user_id was 0 for nearly all 4,355 rows, i.e.
--    the old site was overwhelmingly guest applications too.)
--
-- 2. Employers could not see their own applicants. "employers manage own jobs"
--    keys on `posted_by = auth.uid()`, but "employers view applications on
--    their jobs" joined through `companies.owner_id`. A job whose company_id
--    was unset was therefore permanently invisible in the applications view,
--    with no error to explain why. Both predicates are now accepted.
--
-- Anon is granted INSERT but never SELECT, so a visitor can submit an
-- application and cannot read anyone's -- including the row they just wrote.
-- ============================================================

drop policy if exists "seekers insert applications"              on public.applications;
drop policy if exists "seekers view own applications"            on public.applications;
drop policy if exists "employers view applications on their jobs" on public.applications;
drop policy if exists "employers update application status"       on public.applications;
drop policy if exists "admins full access applications"           on public.applications;

-- ── INSERT: the public apply form ────────────────────────────
-- A signed-in user may only file under their own id; a guest files with NULL.
-- The job must exist and be published, so this cannot be used to attach rows
-- to drafts, or to probe for the existence of unpublished listings.
create policy "applications_insert_public" on public.applications
  for insert to anon, authenticated
  with check (
    (applicant_id is null or applicant_id = (select auth.uid()))
    and job_id is not null
    and exists (
      select 1 from public.jobs j
      where j.id = job_id
        and j.status = 'published'::public.job_status
    )
  );

-- ── SELECT ───────────────────────────────────────────────────
-- Seekers see rows they own. Migrated rows have applicant_id NULL and are
-- therefore invisible here until claimed -- see migration 006.
create policy "applications_select_own" on public.applications
  for select to authenticated
  using (applicant_id = (select auth.uid()));

-- Employers see applications against jobs they own, by either ownership route.
create policy "applications_select_employer" on public.applications
  for select to authenticated
  using (
    exists (
      select 1 from public.jobs j
      where j.id = applications.job_id
        and (
          j.posted_by = (select auth.uid())
          or j.company_id in (
            select c.id from public.companies c where c.owner_id = (select auth.uid())
          )
        )
    )
  );

-- ── UPDATE ───────────────────────────────────────────────────
-- Employers move status and leave an internal note. The WITH CHECK repeats the
-- USING predicate so an employer cannot reassign a row to another job.
create policy "applications_update_employer" on public.applications
  for update to authenticated
  using (
    exists (
      select 1 from public.jobs j
      where j.id = applications.job_id
        and (
          j.posted_by = (select auth.uid())
          or j.company_id in (
            select c.id from public.companies c where c.owner_id = (select auth.uid())
          )
        )
    )
  )
  with check (
    exists (
      select 1 from public.jobs j
      where j.id = applications.job_id
        and (
          j.posted_by = (select auth.uid())
          or j.company_id in (
            select c.id from public.companies c where c.owner_id = (select auth.uid())
          )
        )
    )
  );

-- Note: seekers get no UPDATE and no DELETE. An application is a record of
-- something that happened; withdrawing it is a status change an employer or
-- admin makes, not a row the applicant can rewrite or erase.

-- ── ADMIN ────────────────────────────────────────────────────
create policy "applications_admin_all" on public.applications
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

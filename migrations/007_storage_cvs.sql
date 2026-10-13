-- ============================================================
-- 007 — CV storage bucket
-- ============================================================
-- NOT YET APPLIED — run this one yourself.
--
-- No storage bucket exists on this project. Two consequences:
--   * components/apply-form.tsx has no file input at all, so the public apply
--     form collects name/email/phone/cover letter and no CV.
--   * applications.cv_url for all 4,355 migrated rows holds an absolute URL on
--     the dead WordPress host (https://jobs.pac.africa/wp-content/uploads/
--     jobmonster/...). Those files were never re-hosted and will 404.
--
-- PATH CONVENTION (the app depends on this):
--   New uploads go to bucket `cvs`, object name `<uuid>/<filename>.pdf`.
--   applications.cv_url and profiles.cv_url store that OBJECT NAME, not a URL.
--   A cv_url beginning with 'http' is therefore a dead legacy link, and the UI
--   renders it disabled. Anything else is a storage path resolved through
--   createSignedUrl. See lib/supabase/storage.ts.
--
-- WHY ANON MAY INSERT: guests apply. That is the primary audience, and the old
-- site's data shows _candidate_user_id was 0 for nearly every one of the 4,355
-- historical applications. Abuse is bounded at the bucket level rather than by
-- policy: PDF-only and 5 MB are enforced by storage itself, so a malicious
-- uploader cannot use this as general-purpose file hosting.
--
-- Anon gets INSERT and nothing else -- no select, no list, no update, no delete.
-- ============================================================

-- ── BUCKET ───────────────────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('cvs', 'cvs', false, 5242880, array['application/pdf'])
on conflict (id) do update
  set public             = false,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- ── UPLOAD ───────────────────────────────────────────────────
drop policy if exists "cvs_insert" on storage.objects;
create policy "cvs_insert" on storage.objects
  for insert to anon, authenticated
  with check (bucket_id = 'cvs');

-- ── READ ─────────────────────────────────────────────────────
-- The uploader. Supabase Storage stamps `owner` from the JWT, so this covers a
-- seeker re-reading the CV on their own profile. Guest uploads have owner NULL
-- and are unreachable by this branch, which is intended.
drop policy if exists "cvs_select_owner" on storage.objects;
create policy "cvs_select_owner" on storage.objects
  for select to authenticated
  using (bucket_id = 'cvs' and owner = (select auth.uid()));

-- The employer, for CVs attached to applications on jobs they own -- matched on
-- the object name recorded in applications.cv_url. This is what lets an
-- employer open a guest applicant's CV without the bucket being public.
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
        and (
          j.posted_by = (select auth.uid())
          or j.company_id in (
            select c.id from public.companies c where c.owner_id = (select auth.uid())
          )
        )
    )
  );

-- The applicant, for a CV attached to an application they own. Needed because
-- the recovered WordPress CVs are bulk-uploaded by service_role, which leaves
-- storage.objects.owner NULL — so cvs_select_owner above cannot match them.
-- Without this, someone who claims their history (migration 006) could see the
-- application but not open their own CV.
drop policy if exists "cvs_select_applicant" on storage.objects;
create policy "cvs_select_applicant" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'cvs'
    and exists (
      select 1 from public.applications a
      where a.cv_url = storage.objects.name
        and a.applicant_id = (select auth.uid())
    )
  );

drop policy if exists "cvs_select_admin" on storage.objects;
create policy "cvs_select_admin" on storage.objects
  for select to authenticated
  using (bucket_id = 'cvs' and public.is_admin());

-- ── REPLACE / REMOVE ─────────────────────────────────────────
-- Only the uploader may overwrite or delete their own file. Employers get read
-- access to an applicant's CV, never write.
drop policy if exists "cvs_update_owner" on storage.objects;
create policy "cvs_update_owner" on storage.objects
  for update to authenticated
  using (bucket_id = 'cvs' and owner = (select auth.uid()))
  with check (bucket_id = 'cvs' and owner = (select auth.uid()));

drop policy if exists "cvs_delete_owner" on storage.objects;
create policy "cvs_delete_owner" on storage.objects
  for delete to authenticated
  using (bucket_id = 'cvs' and owner = (select auth.uid()));

drop policy if exists "cvs_delete_admin" on storage.objects;
create policy "cvs_delete_admin" on storage.objects
  for delete to authenticated
  using (bucket_id = 'cvs' and public.is_admin());

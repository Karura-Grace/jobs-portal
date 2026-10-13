-- ============================================================
-- 018 — Avatar and logo storage
-- ============================================================
-- The brief asks for an avatar on the seeker profile (§8) and a logo on the
-- company profile (§9). Two buckets rather than one, because they are not the
-- same kind of data and should not share an access rule:
--
--   avatars — a photograph of a person. Private, read-scoped exactly like a CV.
--   logos   — corporate branding. Public; there is nothing to protect.
--
-- Path convention for both: `<owner-uuid>/<random>.<ext>`. Policies key on the
-- first path segment rather than on `storage.objects.owner`, because owner is
-- NULL for anything written with the service role — the trap that migration 007
-- had to work around for the recovered CV archive.
-- ============================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('avatars', 'avatars', false, 2097152,
   array['image/jpeg', 'image/png', 'image/webp']),
  ('logos', 'logos', true, 2097152,
   array['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- ── avatars ──────────────────────────────────────────────────
-- Write: only into your own folder.
drop policy if exists "avatars_insert_own" on storage.objects;
create policy "avatars_insert_own" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "avatars_update_own" on storage.objects;
create policy "avatars_update_own" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "avatars_delete_own" on storage.objects;
create policy "avatars_delete_own" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- Read: yourself, an admin, or an employer you have actually applied to. Same
-- reach as the CV policies, so an avatar never travels further than the
-- application it is attached to.
drop policy if exists "avatars_select_own" on storage.objects;
create policy "avatars_select_own" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "avatars_select_admin" on storage.objects;
create policy "avatars_select_admin" on storage.objects
  for select to authenticated
  using (bucket_id = 'avatars' and public.is_admin());

drop policy if exists "avatars_select_employer" on storage.objects;
create policy "avatars_select_employer" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'avatars'
    and exists (
      select 1
      from public.applications a
      join public.jobs j on j.id = a.job_id
      where a.applicant_id::text = (storage.foldername(storage.objects.name))[1]
        and (
          j.posted_by = (select auth.uid())
          or j.company_id in (
            select c.id from public.companies c where c.owner_id = (select auth.uid())
          )
        )
    )
  );

-- ── logos ────────────────────────────────────────────────────
-- Public read comes from the bucket flag. Writes are confined to the owner of
-- the company the folder is named after, plus admins, who create company
-- records on behalf of employers with no account (see admin/actions.ts).
drop policy if exists "logos_write_owner" on storage.objects;
create policy "logos_write_owner" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'logos'
    and (
      public.is_admin()
      or exists (
        select 1 from public.companies c
        where c.id::text = (storage.foldername(name))[1]
          and c.owner_id = (select auth.uid())
      )
    )
  );

drop policy if exists "logos_update_owner" on storage.objects;
create policy "logos_update_owner" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'logos'
    and (
      public.is_admin()
      or exists (
        select 1 from public.companies c
        where c.id::text = (storage.foldername(name))[1]
          and c.owner_id = (select auth.uid())
      )
    )
  )
  with check (bucket_id = 'logos');

drop policy if exists "logos_delete_owner" on storage.objects;
create policy "logos_delete_owner" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'logos'
    and (
      public.is_admin()
      or exists (
        select 1 from public.companies c
        where c.id::text = (storage.foldername(name))[1]
          and c.owner_id = (select auth.uid())
      )
    )
  );

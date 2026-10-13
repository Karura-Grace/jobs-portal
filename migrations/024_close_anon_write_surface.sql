-- ============================================================
-- 024 — Close the anonymous write surface
-- ============================================================
-- `applications_insert_public` (migration 004) granted INSERT to `anon`, because
-- guests apply and the apply form ran in the browser. The anon key is public by
-- design, so that made `POST /rest/v1/applications` an open, unauthenticated
-- write endpoint on the most sensitive table in the database. Nothing at the
-- edge can protect it either: the request never reaches Vercel, so a WAF rule on
-- /jobs/* throttles page views and not this.
--
-- The same was true of storage: `cvs_insert` allowed `anon` to upload, so the
-- bucket was an open 5 MB-a-time write endpoint.
--
-- The fix is to stop accepting anonymous writes at all, and move the guest path
-- server-side:
--
--   signed in  →  the request-scoped client, under the policy below, so RLS
--                 still enforces that you can only file your own application.
--   guest      →  a server action, which validates and then writes with the
--                 service role. There is no session to check against, so the
--                 check has to live in code — but it is now code we control,
--                 behind a rate limit, rather than an open endpoint.
--
-- What this deliberately does NOT do: route signed-in applications through the
-- service role as well. Keeping them on the caller's own session means the
-- ownership rule stays a database guarantee for every user who has one, instead
-- of becoming something the application promises.
-- ============================================================

-- ── applications ─────────────────────────────────────────────
drop policy if exists "applications_insert_public" on public.applications;

-- Authenticated applicants insert their own row, on a published job, as before.
-- `applicant_id is null` is gone: a signed-in user filing an anonymous-looking
-- row was never wanted, and it is what allowed a logged-in account to submit
-- rows it would then be unable to see.
create policy "applications_insert_own" on public.applications
  for insert to authenticated
  with check (
    applicant_id = (select auth.uid())
    and job_id is not null
    and exists (
      select 1 from public.jobs j
      where j.id = job_id
        and j.status = 'published'::public.job_status
    )
  );

-- Belt and braces: revoke the table grant too, so `anon` cannot insert even if
-- a future migration adds a permissive policy by accident. Supabase's default
-- privileges hand `anon` INSERT on every table in `public`, which is why the
-- policy was the only thing standing there.
revoke insert on public.applications from anon;

-- ── storage: cvs ─────────────────────────────────────────────
-- Authenticated uploads stay (the profile CV upload is a server action running
-- as the user). The anonymous half moves to the server.
drop policy if exists "cvs_insert" on storage.objects;

create policy "cvs_insert_authenticated" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'cvs');

-- ── The guest path's validation, in the database ──────────────
-- Called by the apply server action with the service role. The service role
-- bypasses RLS, so without this the action would be the only thing deciding
-- what may be written. This constrains it: a fixed column list, `pending`
-- status, `applicant_id` always null, and the job must actually be published.
-- A bug in the action cannot turn into an arbitrary insert.
create or replace function public.submit_guest_application(
  p_job_id uuid,
  p_name text,
  p_email text,
  p_phone text,
  p_cover_letter text,
  p_cv_url text,
  p_job_title text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_id uuid;
begin
  if p_email is null or p_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'a valid email address is required';
  end if;

  if not exists (
    select 1 from public.jobs j
    where j.id = p_job_id
      and j.status = 'published'::public.job_status
  ) then
    raise exception 'that role is not open for applications';
  end if;

  insert into public.applications (
    job_id, applicant_id, applicant_name, applicant_email, applicant_phone,
    cover_letter, cv_url, wp_job_title, status
  ) values (
    p_job_id,
    -- Never a user. A signed-in application does not come through here.
    null,
    nullif(btrim(p_name), ''),
    lower(btrim(p_email)),
    nullif(btrim(p_phone), ''),
    nullif(btrim(p_cover_letter), ''),
    nullif(btrim(p_cv_url), ''),
    nullif(btrim(p_job_title), ''),
    'pending'::public.application_status
  )
  returning id into new_id;

  return new_id;
end;
$$;

-- service_role only. Granting this to `anon` would recreate exactly the hole it
-- exists to close.
revoke execute on function public.submit_guest_application(
  uuid, text, text, text, text, text, text
) from public, anon, authenticated;
grant execute on function public.submit_guest_application(
  uuid, text, text, text, text, text, text
) to service_role;

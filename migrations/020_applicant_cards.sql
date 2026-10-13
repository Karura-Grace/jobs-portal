-- ============================================================
-- 020 — Applicant headline and avatar, for people who applied to you
-- ============================================================
-- The brief's employer inbox shows "applicant name and avatar" and the drawer
-- shows their headline (§9). Both live on `profiles`, and the policy there is
-- own-row-or-admin — so embedding profiles in the applications query returns
-- null for an employer, silently. Correct, but it makes the feature impossible.
--
-- Widening the profiles policy is the wrong fix: it is row-level, so "let the
-- employer see the applicant's profile" would hand over phone, address, bio,
-- LinkedIn and cv_url as well. This function exposes exactly two columns, and
-- only for applications on jobs the caller actually owns.
--
-- Note what is NOT here: no `applicant_id` in, no way to ask about a person.
-- You pass application ids you can already read, and get back the two display
-- fields for those. An id you do not own returns no row rather than an error.
-- ============================================================

create or replace function public.applicant_cards(app_ids uuid[])
returns table (application_id uuid, headline text, avatar_url text)
language sql
security definer
stable
set search_path = ''
as $$
  select a.id, p.headline, p.avatar_url
    from public.applications a
    join public.profiles p on p.id = a.applicant_id
    left join public.jobs j on j.id = a.job_id
   where a.id = any(app_ids)
     and (
       public.is_admin()
       -- The applicant themselves, so the same call works on the seeker side.
       or a.applicant_id = (select auth.uid())
       or j.posted_by = (select auth.uid())
       or j.company_id in (
         select c.id from public.companies c where c.owner_id = (select auth.uid())
       )
     );
$$;

revoke execute on function public.applicant_cards(uuid[]) from public, anon;
grant execute on function public.applicant_cards(uuid[]) to authenticated;

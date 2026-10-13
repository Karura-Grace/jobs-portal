-- ============================================================
-- 031 — Employer work-email requirement, and jobs.required_skills
-- ============================================================
-- Two unrelated changes bundled in one migration because both are small and
-- both landed in the same session; see the migration comments below for each.

-- ── Work-email-only employer signup ─────────────────────────────────────
-- Client-side check (lib/employer-email.ts) catches the normal case with no
-- round trip. This is the backstop: `role` already arrives from the browser
-- in signUp({ options: { data }}) and is attacker-controlled (see migration
-- 003's comment on the same trigger) — so is the email a client chooses to
-- submit with. Re-validating server-side closes the gap where someone calls
-- the Supabase Auth API directly with the anon key, bypassing the form.
--
-- Blocklist, not allowlist, for the same reason lib/employer-email.ts uses
-- one: we cannot enumerate every real company domain, but we can enumerate
-- the handful of large free-mail providers that are never a work address.
-- Keep this list in sync with lib/employer-email.ts by hand if it changes.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  requested text := new.raw_user_meta_data ->> 'role';
  resolved  public.user_role;
  email_domain text := lower(split_part(new.email, '@', 2));
  blocked_domains text[] := array[
    'gmail.com', 'googlemail.com', 'yahoo.com', 'yahoo.co.uk', 'ymail.com',
    'aol.com', 'icloud.com', 'me.com', 'mac.com', 'protonmail.com',
    'proton.me', 'gmx.com', 'mail.com', 'yandex.com'
  ];
begin
  resolved := case requested
                when 'employer' then 'employer'::public.user_role
                when 'seeker'   then 'seeker'::public.user_role
                else 'seeker'::public.user_role
              end;

  if resolved = 'employer' and email_domain = any(blocked_domains) then
    raise exception 'work_email_required: employers must sign up with a work email address';
  end if;

  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    nullif(trim(coalesce(new.raw_user_meta_data ->> 'full_name', '')), ''),
    resolved
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

comment on function public.handle_new_user() is
  'Creates public.profiles row on signup. Role is whitelisted to seeker/employer '
  '(migration 003); employer signups from a blocklisted free-mail domain are '
  'rejected outright (migration 031).';

-- ── jobs.required_skills ─────────────────────────────────────────────────
-- Same shape as profiles.skills, so a job's requirements and a seeker's
-- profile can be compared with a plain array intersection (lib/match.ts,
-- and the candidate_matches() RPC in migration 032) rather than trying to
-- extract skill-like terms out of the free-text requirements/qualifications
-- rich-text fields.
alter table public.jobs
  add column if not exists required_skills text[];

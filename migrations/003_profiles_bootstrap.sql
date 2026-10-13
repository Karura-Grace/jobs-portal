-- ============================================================
-- 003 — Create a profile for every new auth user
-- ============================================================
-- PROBLEM: `profiles` had no INSERT policy at all -- schema.sql granted
-- select-own, update-own and a (recursive) admin ALL, and nothing else. So the
-- client-side insert at app/auth/register/page.tsx was denied by RLS, and its
-- error was never checked. Every signup produced an auth.users row with no
-- profile, which is consistent with `profiles` sitting at 0 rows while the
-- product has supposedly been live.
--
-- Fix: stop asking the browser to create the profile. A SECURITY DEFINER
-- trigger on auth.users does it atomically with the signup, so a profile can
-- never be missing and the client cannot choose not to create one.
--
-- SECURITY: `role` arrives from the browser in signUp({ options: { data }}).
-- It is attacker-controlled. Casting it straight to user_role would let anyone
-- self-register as an admin, which -- given is_admin() gates the entire admin
-- surface -- would be a full compromise. The whitelist below is the control.
-- Admin is granted only by a deliberate UPDATE (see README).
-- ============================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  requested text := new.raw_user_meta_data ->> 'role';
  resolved  public.user_role;
begin
  -- Whitelist, never cast. Anything other than these two -- including 'admin',
  -- a typo, or NULL -- becomes 'seeker'.
  resolved := case requested
                when 'employer' then 'employer'::public.user_role
                when 'seeker'   then 'seeker'::public.user_role
                else 'seeker'::public.user_role
              end;

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
  'because raw_user_meta_data is client-supplied (see migration 003).';

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backstop policy. The trigger is the real mechanism, but if a profile ever
-- needs creating from the client this keeps it own-row-only rather than open.
create policy "profiles_insert_own" on public.profiles
  for insert to authenticated
  with check ((select auth.uid()) = id);

-- Backfill: any auth user that predates this trigger gets a profile now.
insert into public.profiles (id, email, full_name, role)
select u.id,
       u.email,
       nullif(trim(coalesce(u.raw_user_meta_data ->> 'full_name', '')), ''),
       case u.raw_user_meta_data ->> 'role'
         when 'employer' then 'employer'::public.user_role
         else 'seeker'::public.user_role
       end
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null
  and u.email is not null
on conflict (id) do nothing;

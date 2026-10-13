-- ============================================================
-- 008 — Close out the remaining advisor findings
-- ============================================================
-- NOT YET APPLIED — run this one yourself.
--
-- Two items left from the Supabase security advisor.
-- ============================================================

-- ── 1. update_updated_at had a mutable search_path ───────────
-- WARN function_search_path_mutable. This trigger function runs on every update
-- to profiles, jobs, applications and companies. Without a pinned search_path,
-- a caller who can influence search_path can decide which `now()` it resolves
-- to. Body is unchanged; only the setting is added.
create or replace function public.update_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Triggers already reference this function by name and need no change:
--   trg_profiles_updated, trg_jobs_updated,
--   trg_applications_updated, trg_companies_updated

-- ── 2. rls_auto_enable was executable by anon ────────────────
-- WARN anon_security_definer_function_executable /
--      authenticated_security_definer_function_executable
--
-- Investigated before changing anything. This function is NOT a problem and is
-- NOT ours to delete:
--
--   * It `returns event_trigger` and is wired to the `ensure_rls` event trigger
--     on ddl_command_end. Postgres refuses to execute an event-trigger function
--     outside trigger context, so the advertised REST route
--     /rest/v1/rpc/rls_auto_enable cannot actually invoke it. The finding is a
--     false positive on exploitability.
--   * It already carries `SET search_path TO 'pg_catalog'`.
--   * It is a safety net: it auto-enables RLS on any new table created in
--     `public`. It is the reason job_categories and job_locations had RLS on
--     despite schema.sql never enabling it -- a lockout that migration 002
--     fixed, but the underlying behaviour is protective and should stay. Any
--     future table added to this schema starts closed rather than open.
--
-- So: keep the function and the event trigger, and simply remove the EXECUTE
-- grant that triggers the lint. Defence in depth, and it quiets the advisor.
-- Must revoke from PUBLIC, not from anon/authenticated individually. Postgres
-- grants EXECUTE on new functions to PUBLIC by default, and every role inherits
-- that grant — so revoking the named roles leaves the privilege in place, which
-- is exactly what happened on the first attempt here.
revoke execute on function public.rls_auto_enable() from public;
revoke execute on function public.rls_auto_enable() from anon, authenticated;

-- ── Not SQL: do these in the dashboard ───────────────────────
-- 1. Auth -> Providers -> Email: keep "Confirm email" ENABLED. Migration 006's
--    claim flow treats a confirmed address as proof of ownership over a
--    decade of someone's contact details. Turning confirmation off converts
--    that into "anyone who knows the address".
--
-- 2. Auth -> Policies: enable leaked-password protection (HaveIBeenPwned).
--    Currently disabled -- advisor finding auth_leaked_password_protection.
--    app/auth/register/page.tsx enforces minLength 8; consider raising it.

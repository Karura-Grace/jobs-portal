-- ============================================================
-- 030 — Dashboard personalization preferences
-- ============================================================
-- Two cosmetic preferences, added to `profiles` for the same reason 028's
-- notification toggles were: every read of these already has the profile row
-- in hand (auth gate, settings page), so a join buys nothing.
--
-- `dashboard_landing` stores a full href (e.g. "/dashboard/seeker/applications")
-- or null for "default". It is NOT constrained here to a whitelist of valid
-- per-role paths — that would mean hardcoding every role's nav here and
-- keeping it in step with lib/dashboard-nav.ts by hand. Instead the app
-- validates it at write time (app/dashboard/settings-actions.ts, against
-- navFor(role)) before it ever reaches this column, the same trust boundary
-- safeNextPath already applies to a "next" query param. A stray value written
-- some other way just fails that validation on next save; it can never redirect
-- anywhere unexpected because app/dashboard/page.tsx only ever reads it as a
-- same-origin path, never constructs a URL from it.
--
-- Not guarded by guard_profile_columns (migration 025) for the same reason
-- 028's columns are not: neither changes what the account can access, only how
-- its own dashboard looks and where it lands after login.

alter table profiles
  add column if not exists dashboard_landing text,
  add column if not exists dashboard_density text not null default 'comfortable';

alter table profiles
  drop constraint if exists profiles_dashboard_density_check;

alter table profiles
  add constraint profiles_dashboard_density_check
    check (dashboard_density in ('comfortable', 'compact'));

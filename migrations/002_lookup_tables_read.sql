-- ============================================================
-- 002 — Unlock the reference tables
-- ============================================================
-- PROBLEM: job_categories (165 rows) and job_locations (65 rows) have RLS
-- enabled and ZERO policies, so they are readable by nobody. Measured as anon:
-- "OK -- 0 rows" on both. Flagged by the Supabase advisor as
-- `rls_enabled_no_policy`.
--
-- schema.sql never enabled RLS on these two -- the `ensure_rls` event trigger
-- did it automatically at CREATE TABLE time (see migration 008). RLS-on with no
-- policy is a silent lockout, not a warning.
--
-- Visible effects today:
--   * the /jobs sidebar filters render empty (getFilters(), app/jobs/page.tsx)
--   * every job card falls back to "General" (components/job-card.tsx)
--   * the employer post-a-job form would have no category/location options
--
-- These are non-sensitive reference data -- 165 job categories and 65 Kenyan
-- and international place names. World-readable is correct; writes are admin
-- only, since the migrated slugs are referenced by seeded rows.
-- ============================================================

-- ── JOB CATEGORIES ───────────────────────────────────────────
create policy "job_categories_select_public" on public.job_categories
  for select to anon, authenticated
  using (true);

create policy "job_categories_admin_write" on public.job_categories
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ── JOB LOCATIONS ────────────────────────────────────────────
create policy "job_locations_select_public" on public.job_locations
  for select to anon, authenticated
  using (true);

create policy "job_locations_admin_write" on public.job_locations
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ── SAVED JOBS / JOB ALERTS ──────────────────────────────────
-- These two already had own-row-only policies that do NOT reference profiles,
-- so they were never caught by the recursion. Re-stated here only to scope them
-- to `authenticated` and to use the InitPlan form of auth.uid(); behaviour is
-- otherwise unchanged.
drop policy if exists "own saved jobs" on public.saved_jobs;
create policy "saved_jobs_own" on public.saved_jobs
  for all to authenticated
  using (profile_id = (select auth.uid()))
  with check (profile_id = (select auth.uid()));

drop policy if exists "own job alerts" on public.job_alerts;
create policy "job_alerts_own" on public.job_alerts
  for all to authenticated
  using (profile_id = (select auth.uid()))
  with check (profile_id = (select auth.uid()));

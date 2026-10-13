-- ============================================================
-- 010 — Take EXECUTE away from anon where anon has no business
-- ============================================================
-- WHAT I GOT WRONG IN 001/003/005/006
--
-- Those migrations did `revoke execute ... from public` then granted to the
-- roles that needed it. That looked right and was not, because Supabase ships
-- ALTER DEFAULT PRIVILEGES granting EXECUTE on every new function in `public`
-- to anon, authenticated and service_role. So each function was created with an
-- *explicit* anon grant already attached; revoking PUBLIC never touched it.
--
-- Inspecting proacl showed the truth:
--   is_admin                      anon=X  authenticated=X  service_role=X
--   count_claimable_applications  anon=X  authenticated=X  service_role=X
--   claim_historical_applications anon=X  authenticated=X  service_role=X
--
-- IMPACT: none in practice. Every one of these returns early when auth.uid()
-- is null, which is why an anonymous caller got `false` or `0` rather than data
-- — that guard was deliberate, and it held. The trigger functions cannot be
-- invoked over RPC at all: Postgres refuses to execute a function returning
-- `trigger` or `event_trigger` outside trigger context.
--
-- Still worth closing. A reachable definer function is one refactor away from
-- being a real hole, and the guard should not be the only thing standing there.
--
-- SAFE FOR TRIGGERS: Postgres checks EXECUTE on a trigger function when the
-- trigger is CREATED, not each time it fires. Revoking now does not stop
-- trg_profiles_updated, trg_jobs_updated, trg_applications_updated,
-- trg_companies_updated, trg_companies_verified_guard or on_auth_user_created.
-- ============================================================

-- ── Callable by signed-in users only ─────────────────────────
revoke execute on function public.is_admin()                      from anon;
revoke execute on function public.count_claimable_applications()  from anon;
revoke execute on function public.claim_historical_applications()  from anon;

-- ── Trigger-only: nobody should reach these over the API ─────
revoke execute on function public.handle_new_user()        from public, anon, authenticated;
revoke execute on function public.update_updated_at()      from public, anon, authenticated;
revoke execute on function public.guard_company_verified() from public, anon, authenticated;

-- ── Deliberately left open to anon ───────────────────────────
-- public.stats() stays callable by anon. It is what lets the homepage show
-- "4,355 applications on file" without any policy exposing an application row
-- (migration 005). It takes no arguments, applies no filter, and returns three
-- integers, so it cannot be narrowed toward an individual.

-- Verify:
--   select p.proname,
--          has_function_privilege('anon', p.oid, 'EXECUTE') as anon,
--          has_function_privilege('authenticated', p.oid, 'EXECUTE') as authed
--     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--    where n.nspname = 'public'
--    order by 1;
-- Expect anon=true for stats only.

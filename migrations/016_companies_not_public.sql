-- ============================================================
-- 016 — Stop anonymous visitors enumerating employers
-- ============================================================
-- FINDING (security review, verified as the `anon` role): every employer record
-- was world-readable. `companies_select_public` was `using (true)`, so an
-- unauthenticated caller with the public anon key could list
--
--   id, owner_id, name, slug, logo_url, website, description,
--   industry, location, size, verified, created_at, updated_at
--
-- for every employer on the platform — including owner_id, which is the
-- employer's profile UUID.
--
-- That directly undercuts the decision recorded in migration 015: applicants
-- must not be able to see which employer a role belongs to. 015 removed the
-- company from every public surface and noted that the company row itself was
-- still readable, calling it out as unadvertised rather than protected. This
-- closes it properly.
--
-- SAFE TO REMOVE — checked every reader first:
--   * app/page.tsx, app/jobs/page.tsx, app/jobs/[slug]/page.tsx no longer join
--     companies at all (migration 015 work).
--   * Admin surfaces read companies under `companies_admin_all`.
--   * The employer dashboard reads its own company — which needs a policy that
--     did not previously exist, because the only SELECT path was the public one.
--     `companies_select_own` is added below.
--
-- The policy subqueries in `jobs_insert_own`, `jobs_update_own`,
-- `applications_select_employer` and storage's `cvs_select_employer` all read
-- companies as `owner_id = auth.uid()`, which `companies_select_own` satisfies.
-- Losing the public policy does not break them.
-- ============================================================

drop policy if exists "companies_select_public" on public.companies;

create policy "companies_select_own" on public.companies
  for select to authenticated
  using (owner_id = (select auth.uid()));

-- Admin SELECT continues to come from companies_admin_all (FOR ALL).

-- Verify: expect 0 as anon, 1 as the owning employer, all as admin.
--   set role anon;  select count(*) from public.companies;

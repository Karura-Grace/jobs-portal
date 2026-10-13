-- ============================================================
-- 029 — Application reviews (who on the HR side has looked at what)
-- ============================================================
-- HR is not one person. Without this, two teammates open the same CV, or
-- worse, nobody does because each assumed the other had. This is an
-- append-only log, not a status field on `applications`: it needs to answer
-- "who has looked at this and how carefully", which a single column cannot
-- hold once more than one person can look.
--
-- Two modes, both written by the reviewer themselves:
--   'overview' — a quick look. Does not close the loop.
--   'final'    — "I've checked this and this is my call." Closes it.
--
-- RLS mirrors migration 004's applications policies exactly: whoever can see
-- an application can see and add reviews on it, and can only ever write a
-- review under their own id.

create table if not exists public.application_reviews (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications(id) on delete cascade,
  reviewer_id uuid not null references public.profiles(id) on delete cascade,
  mode text not null check (mode in ('overview', 'final')),
  opinion text,
  created_at timestamptz not null default now()
);

create index if not exists application_reviews_application_id_idx
  on public.application_reviews (application_id);

alter table public.application_reviews enable row level security;

drop policy if exists "application_reviews_select" on public.application_reviews;
drop policy if exists "application_reviews_insert" on public.application_reviews;
drop policy if exists "application_reviews_admin_all" on public.application_reviews;
drop policy if exists "application_reviews_admin_select" on public.application_reviews;
drop policy if exists "application_reviews_admin_insert" on public.application_reviews;

-- ── SELECT: same reach as the parent application ────────────
create policy "application_reviews_select" on public.application_reviews
  for select to authenticated
  using (
    exists (
      select 1 from public.applications a
      join public.jobs j on j.id = a.job_id
      where a.id = application_reviews.application_id
        and (
          j.posted_by = (select auth.uid())
          or j.company_id in (
            select c.id from public.companies c where c.owner_id = (select auth.uid())
          )
        )
    )
  );

-- ── INSERT: same reach, and only ever under your own id ─────
create policy "application_reviews_insert" on public.application_reviews
  for insert to authenticated
  with check (
    reviewer_id = (select auth.uid())
    and exists (
      select 1 from public.applications a
      join public.jobs j on j.id = a.job_id
      where a.id = application_reviews.application_id
        and (
          j.posted_by = (select auth.uid())
          or j.company_id in (
            select c.id from public.companies c where c.owner_id = (select auth.uid())
          )
        )
    )
  );

-- No UPDATE, no DELETE for anyone, admins included: a review is a record of
-- something that happened. A wrong opinion gets superseded by another row,
-- not rewritten history.

-- ── ADMIN ────────────────────────────────────────────────────
create policy "application_reviews_admin_select" on public.application_reviews
  for select to authenticated
  using (public.is_admin());

create policy "application_reviews_admin_insert" on public.application_reviews
  for insert to authenticated
  with check (public.is_admin() and reviewer_id = (select auth.uid()));

comment on table public.application_reviews is
  'Append-only log of who looked at an application and how: overview (quick look, does not close it) or final (recorded opinion, closes it).';

-- ============================================================
-- 017 — What the brief's dashboards need and the schema lacked
-- ============================================================
-- Four additions, each demanded by a specific screen in the frontend brief.
--
-- 1. application_events — the drawer's activity log (§9)
-- 2. jobs.rejection_reason — moderation reject requires a reason (§10)
-- 3. suspended_at on profiles and companies — admin suspend (§10)
-- 4. increment_job_view() — My Jobs shows a Views count (§9)
-- ============================================================

-- ── 1. Activity log ──────────────────────────────────────────
-- "Activity log: timestamped history of every status change on this
-- application". Written by a trigger rather than by the app, so the history is
-- complete even when a status changes through the API or a SQL console — an
-- audit trail the application can forget to write is not one.
create table if not exists public.application_events (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications(id) on delete cascade,
  from_status public.application_status,
  to_status public.application_status not null,
  -- Null when the change came from a direct database session rather than a user.
  actor_id uuid references public.profiles(id) on delete set null,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists idx_application_events_application
  on public.application_events(application_id, created_at desc);

alter table public.application_events enable row level security;

-- Visibility mirrors the application itself: whoever may read the application
-- may read its history. Expressed by delegating to `applications`, so the two
-- can never drift apart.
create policy "application_events_select" on public.application_events
  for select to authenticated
  using (
    exists (select 1 from public.applications a where a.id = application_id)
  );

-- Nobody writes these directly. The trigger below is the only author, and it is
-- SECURITY DEFINER so it can insert regardless of the caller's grants.
create policy "application_events_admin" on public.application_events
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create or replace function public.log_application_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.application_events (application_id, from_status, to_status, actor_id)
    values (new.id, null, new.status, new.applicant_id);
  elsif new.status is distinct from old.status then
    insert into public.application_events (application_id, from_status, to_status, actor_id, note)
    values (new.id, old.status, new.status, (select auth.uid()), new.employer_note);
  end if;
  return new;
end;
$$;

revoke execute on function public.log_application_status() from public, anon, authenticated;

drop trigger if exists trg_application_status_log on public.applications;
create trigger trg_application_status_log
  after insert or update on public.applications
  for each row execute function public.log_application_status();

-- ── 2. Reject reason ─────────────────────────────────────────
-- "Reject (with a required reason field sent back to the employer)". Stored
-- here; sending it is an email feature that does not exist yet, so the employer
-- sees it in their own dashboard rather than being told it was emailed.
alter table public.jobs add column if not exists rejection_reason text;

-- ── 3. Suspension ────────────────────────────────────────────
-- Nullable timestamp rather than a boolean: "when were they suspended" is
-- strictly more information than "are they", at the same storage cost.
alter table public.profiles  add column if not exists suspended_at timestamptz;
alter table public.companies add column if not exists suspended_at timestamptz;

-- A suspended employer's listings must stop being public. Enforced here rather
-- than in the app, so it holds against the API too.
drop policy if exists "jobs_select_published" on public.jobs;
create policy "jobs_select_published" on public.jobs
  for select to anon, authenticated
  using (
    status = 'published'::public.job_status
    and not exists (
      select 1 from public.companies c
      where c.id = jobs.company_id and c.suspended_at is not null
    )
  );

-- Only an admin may set or clear suspension, the same shape as the `verified`
-- guard in migration 001.
create or replace function public.guard_suspension()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.suspended_at is distinct from old.suspended_at
     and (select auth.uid()) is not null
     and not public.is_admin() then
    raise exception 'only an administrator can suspend or reinstate an account';
  end if;
  return new;
end;
$$;

revoke execute on function public.guard_suspension() from public, anon, authenticated;

drop trigger if exists trg_profiles_suspension on public.profiles;
create trigger trg_profiles_suspension
  before update on public.profiles
  for each row execute function public.guard_suspension();

drop trigger if exists trg_companies_suspension on public.companies;
create trigger trg_companies_suspension
  before update on public.companies
  for each row execute function public.guard_suspension();

-- ── 4. View counter ──────────────────────────────────────────
-- `jobs.views` existed from the original schema and nothing ever incremented
-- it. SECURITY DEFINER because an anonymous visitor has no UPDATE on jobs and
-- should not be given one.
--
-- Naive on purpose: it counts every call, so a reload or a crawler inflates it.
-- It is a vanity number shown to the employer who posted the role, not a metric
-- anything depends on, and deduplicating it properly would mean storing a
-- visitor identifier — which is personal data this product does not want.
create or replace function public.increment_job_view(job uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.jobs
     set views = coalesce(views, 0) + 1
   where id = job
     and status = 'published'::public.job_status;
$$;

revoke execute on function public.increment_job_view(uuid) from public;
grant execute on function public.increment_job_view(uuid) to anon, authenticated;

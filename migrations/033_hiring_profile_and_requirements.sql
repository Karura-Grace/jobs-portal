-- ============================================================
-- 033 — Expanded seeker profiles, job requirements, application
--        snapshot fields, auto-flag (not auto-reject), and apply-time
--        data consent
-- ============================================================
-- See context-sessions/ for the brainstorming record. Summary of the
-- decisions this migration encodes:
--   - Education/work experience are multi-entry (new tables), not flat
--     single fields — matches how a real work history actually looks.
--   - "Industry" reuses job_categories rather than a new lookup table —
--     every job already has one, exact-match filtering for free.
--   - meets_requirements is a FLAG, never an automatic status change. An
--     admin still makes every call; this is a sort/filter signal only.
--   - years_experience/expected_salary/current_salary are captured again on
--     applications as a point-in-time snapshot (same reason
--     applicant_name/applicant_email/wp_job_title already are) — required
--     for a NEW submission, but the columns stay nullable so 4,356+ existing
--     rows that predate this feature don't need fabricated backfill values.
--   - consented_at/consent_version record apply-time data consent the same
--     way — required going forward, nullable for historical rows.

-- ── Enums ────────────────────────────────────────────────────────────────
do $$ begin
  create type public.education_level as enum (
    'high_school', 'certificate', 'diploma', 'bachelors', 'masters', 'doctorate'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.notice_period as enum (
    'immediate', 'two_weeks', 'one_month', 'two_months', 'three_plus_months'
  );
exception when duplicate_object then null;
end $$;

-- ── profiles: flat hiring-relevant fields ──────────────────────────────
-- All nullable — same "optional, no permanently-broken empty state" rule
-- every other profile field follows (lib/profile.ts's checklist already
-- treats a missing field as incomplete, never as broken).
alter table public.profiles
  add column if not exists years_experience int,
  add column if not exists education_level public.education_level,
  add column if not exists industry_category_id uuid references public.job_categories(id),
  add column if not exists expected_salary integer,
  add column if not exists current_salary integer,
  add column if not exists notice_period public.notice_period;

-- ── profile_education / profile_work_experience ────────────────────────
-- Same RLS shape as profiles' own policy: own-row-or-admin. Delete-and-
-- re-add rather than edit, for a first pass — matches job_alerts' own
-- create/pause/resume/delete-only surface.
create table if not exists public.profile_education (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.profiles(id) on delete cascade,
  school_name text not null,
  field_of_study text,
  level public.education_level,
  start_year int,
  end_year int, -- null = ongoing
  created_at timestamptz default now()
);

create table if not exists public.profile_work_experience (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.profiles(id) on delete cascade,
  company_name text not null,
  job_title text not null,
  start_date date,
  end_date date, -- null = current role
  description text,
  created_at timestamptz default now()
);

alter table public.profile_education enable row level security;
alter table public.profile_work_experience enable row level security;

drop policy if exists "profile_education_own" on public.profile_education;
create policy "profile_education_own" on public.profile_education
  for all to authenticated
  using (profile_id = (select auth.uid()) or public.is_admin())
  with check (profile_id = (select auth.uid()));

drop policy if exists "profile_work_experience_own" on public.profile_work_experience;
create policy "profile_work_experience_own" on public.profile_work_experience
  for all to authenticated
  using (profile_id = (select auth.uid()) or public.is_admin())
  with check (profile_id = (select auth.uid()));

-- ── jobs: requirement fields ────────────────────────────────────────────
-- All nullable — a job with no requirements set flags nothing against it,
-- same "no badge/no flag for something never asked for" rule required_skills
-- (migration 031) already follows.
alter table public.jobs
  add column if not exists required_years_experience int,
  add column if not exists required_education_level public.education_level,
  add column if not exists required_industry_category_id uuid references public.job_categories(id);

-- ── applications: snapshot fields, consent, and the computed flag ──────
-- Nullable at the schema level — see the file header. "Required for a new
-- submission" is enforced in app/jobs/actions.ts and
-- submit_guest_application() below, not by a NOT NULL constraint that would
-- otherwise force fabricating values for every historical row.
alter table public.applications
  add column if not exists years_experience int,
  add column if not exists expected_salary integer,
  add column if not exists current_salary integer,
  add column if not exists consented_at timestamptz,
  add column if not exists consent_version text,
  add column if not exists meets_requirements boolean;

-- ── meets_requirements trigger ──────────────────────────────────────────
-- Computed once at submission time, not recomputed later if the seeker
-- edits their profile or the employer edits the job's requirements — an
-- application reflects the facts as they stood when filed, same snapshot
-- philosophy as the columns above. Fires regardless of which insert path
-- wrote the row (signed-in .insert() or submit_guest_application()), since
-- it's a plain trigger on the table itself.
create or replace function public.compute_meets_requirements()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  req_years int;
  req_education public.education_level;
  req_industry uuid;
  applicant_education public.education_level;
  applicant_industry uuid;
  ok boolean := true;
  has_requirement boolean := false;
begin
  select j.required_years_experience, j.required_education_level, j.required_industry_category_id
    into req_years, req_education, req_industry
    from public.jobs j
   where j.id = new.job_id;

  if req_years is null and req_education is null and req_industry is null then
    new.meets_requirements := null;
    return new;
  end if;

  if new.applicant_id is not null then
    select p.education_level, p.industry_category_id
      into applicant_education, applicant_industry
      from public.profiles p
     where p.id = new.applicant_id;
  end if;

  if req_years is not null then
    has_requirement := true;
    if new.years_experience is null or new.years_experience < req_years then
      ok := false;
    end if;
  end if;

  if req_education is not null then
    has_requirement := true;
    -- Ordinal comparison via the enum's declared order (high_school < ... <
    -- doctorate, as declared above) — "at least this level", not "exactly".
    if applicant_education is null or applicant_education < req_education then
      ok := false;
    end if;
  end if;

  if req_industry is not null then
    has_requirement := true;
    if applicant_industry is null or applicant_industry != req_industry then
      ok := false;
    end if;
  end if;

  new.meets_requirements := case when has_requirement then ok else null end;
  return new;
end;
$$;

drop trigger if exists compute_meets_requirements_trigger on public.applications;
create trigger compute_meets_requirements_trigger
  before insert on public.applications
  for each row execute function public.compute_meets_requirements();

comment on function public.compute_meets_requirements() is
  'Flags (never auto-rejects) an application against its job''s optional '
  'requirement fields (migration 033). null = job set no requirements.';

-- ── submit_guest_application(): five new params ─────────────────────────
-- Defaulted to null so the signature change is non-breaking, but the body
-- still raises if the five required-for-a-new-submission fields are
-- missing — the default exists for signature compatibility, not to make
-- null an accepted value for a real call. See app/jobs/actions.ts, which is
-- updated in this same change to always pass all five.
create or replace function public.submit_guest_application(
  p_job_id uuid,
  p_name text,
  p_email text,
  p_phone text,
  p_cover_letter text,
  p_cv_url text,
  p_job_title text,
  p_years_experience int default null,
  p_expected_salary integer default null,
  p_current_salary integer default null,
  p_consented_at timestamptz default null,
  p_consent_version text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_id uuid;
begin
  if p_email is null or p_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'a valid email address is required';
  end if;

  if p_years_experience is null or p_expected_salary is null or p_current_salary is null then
    raise exception 'years of experience and salary fields are required';
  end if;

  if p_consented_at is null or p_consent_version is null then
    raise exception 'data consent is required';
  end if;

  if not exists (
    select 1 from public.jobs j
    where j.id = p_job_id
      and j.status = 'published'::public.job_status
  ) then
    raise exception 'that role is not open for applications';
  end if;

  insert into public.applications (
    job_id, applicant_id, applicant_name, applicant_email, applicant_phone,
    cover_letter, cv_url, wp_job_title, status,
    years_experience, expected_salary, current_salary,
    consented_at, consent_version
  )
  values (
    p_job_id, null, p_name, p_email, p_phone,
    p_cover_letter, p_cv_url, p_job_title, 'pending'::public.application_status,
    p_years_experience, p_expected_salary, p_current_salary,
    p_consented_at, p_consent_version
  )
  returning id into new_id;

  return new_id;
end;
$$;

revoke execute on function public.submit_guest_application(
  uuid, text, text, text, text, text, text, int, integer, integer, timestamptz, text
) from public, anon, authenticated;
grant execute on function public.submit_guest_application(
  uuid, text, text, text, text, text, text, int, integer, integer, timestamptz, text
) to service_role;

-- ── applicant_profile_detail(): scoped read of the new profile depth ───
-- Same scoping as applicant_cards() (migration 020) — the applicant
-- themselves, an employer who owns the job the given application is on, or
-- an admin. Called once per opened application drawer, not batched/eager
-- like applicant_cards() (headline+avatar are cheap on every row; full
-- education/experience history is heavier and only worth fetching on demand).
create or replace function public.applicant_profile_detail(p_application_id uuid)
returns table (
  years_experience int,
  education_level public.education_level,
  industry_name text,
  expected_salary integer,
  current_salary integer,
  notice_period public.notice_period,
  education jsonb,
  work_experience jsonb
)
language plpgsql
security definer
stable
set search_path = ''
as $$
declare
  target_applicant uuid;
  allowed boolean;
begin
  select a.applicant_id into target_applicant
    from public.applications a
    left join public.jobs j on j.id = a.job_id
   where a.id = p_application_id
     and (
       public.is_admin()
       or a.applicant_id = (select auth.uid())
       or j.posted_by = (select auth.uid())
       or j.company_id in (
         select c.id from public.companies c where c.owner_id = (select auth.uid())
       )
     );

  if target_applicant is null then
    return;
  end if;

  return query
    select
      p.years_experience,
      p.education_level,
      jc.name,
      p.expected_salary,
      p.current_salary,
      p.notice_period,
      coalesce(
        (select jsonb_agg(jsonb_build_object(
            'school_name', e.school_name, 'field_of_study', e.field_of_study,
            'level', e.level, 'start_year', e.start_year, 'end_year', e.end_year
          ) order by e.end_year desc nulls first)
         from public.profile_education e where e.profile_id = p.id),
        '[]'::jsonb
      ),
      coalesce(
        (select jsonb_agg(jsonb_build_object(
            'company_name', w.company_name, 'job_title', w.job_title,
            'start_date', w.start_date, 'end_date', w.end_date, 'description', w.description
          ) order by w.end_date desc nulls first)
         from public.profile_work_experience w where w.profile_id = p.id),
        '[]'::jsonb
      )
    from public.profiles p
    left join public.job_categories jc on jc.id = p.industry_category_id
    where p.id = target_applicant;
end;
$$;

comment on function public.applicant_profile_detail(uuid) is
  'Scoped read of a seeker''s full hiring profile (education/work history, '
  'salary, notice period) for one application — admin, the applicant, or '
  'the employer who owns the job. Migration 033.';

revoke all on function public.applicant_profile_detail(uuid) from public;
grant execute on function public.applicant_profile_detail(uuid) to authenticated;

-- ============================================================
-- jobs.pac.africa — Supabase Schema
-- Stack: Next.js 15 + Supabase + shadcn/ui
-- Migrated from: Noo JobMonster WordPress (SDzBUb_ prefix)
-- ============================================================

-- ENUMS
create type user_role as enum ('seeker', 'employer', 'admin');
create type application_status as enum ('pending', 'shortlisted', 'rejected', 'hired');
create type job_status as enum ('draft', 'pending_review', 'published', 'expired', 'closed');
create type job_type as enum ('full_time', 'part_time', 'freelance', 'contract', 'internship');
create type employment_level as enum ('entry', 'mid', 'senior', 'executive');

-- ── PROFILES ─────────────────────────────────────────────────
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role user_role not null default 'seeker',
  full_name text,
  email text unique not null,
  phone text,
  avatar_url text,
  -- seeker fields
  headline text,
  bio text,
  skills text[],
  address text,
  linkedin_url text,
  cv_url text,
  -- employer fields (populated if role = employer)
  company_id uuid,
  -- meta
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ── COMPANIES ────────────────────────────────────────────────
create table companies (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references profiles(id) on delete set null,
  name text not null,
  slug text unique not null,
  logo_url text,
  website text,
  description text,
  industry text,
  location text,
  size text, -- e.g. "1-10", "11-50", "51-200"
  verified boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- add FK back to companies
alter table profiles add constraint profiles_company_fk
  foreign key (company_id) references companies(id) on delete set null;

-- ── JOB CATEGORIES ───────────────────────────────────────────
create table job_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  parent_id uuid references job_categories(id),
  created_at timestamptz default now()
);

-- ── JOB LOCATIONS ────────────────────────────────────────────
create table job_locations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  country text,
  created_at timestamptz default now()
);

-- ── JOBS ─────────────────────────────────────────────────────
create table jobs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references companies(id) on delete cascade,
  posted_by uuid references profiles(id) on delete set null,
  title text not null,
  slug text unique not null,
  description text not null,
  requirements text,
  benefits text,
  category_id uuid references job_categories(id),
  location_id uuid references job_locations(id),
  location_text text, -- free-form fallback
  job_type job_type default 'full_time',
  employment_level employment_level default 'mid',
  salary_min integer,
  salary_max integer,
  salary_currency text default 'KES',
  is_remote boolean default false,
  status job_status default 'pending_review',
  is_featured boolean default false,
  application_deadline date,
  views integer default 0,
  -- migration fields
  wp_post_id integer unique, -- original WP post ID
  original_date timestamptz, -- preserve original post date
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ── APPLICATIONS ─────────────────────────────────────────────
create table applications (
  id uuid primary key default gen_random_uuid(),
  job_id uuid references jobs(id) on delete cascade,
  applicant_id uuid references profiles(id) on delete set null,
  -- denormalized for historical records (migrated applicants without accounts)
  applicant_name text,
  applicant_email text not null,
  applicant_phone text,
  cover_letter text,
  cv_url text,
  status application_status default 'pending',
  employer_note text, -- internal note from employer
  -- migration fields
  wp_post_id integer unique,
  wp_job_title text, -- original job title from _job_applied_for
  applied_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ── SAVED JOBS (bookmarks) ───────────────────────────────────
create table saved_jobs (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references profiles(id) on delete cascade,
  job_id uuid references jobs(id) on delete cascade,
  created_at timestamptz default now(),
  unique(profile_id, job_id)
);

-- ── JOB ALERTS ───────────────────────────────────────────────
create table job_alerts (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references profiles(id) on delete cascade,
  email text not null,
  keyword text,
  category_id uuid references job_categories(id),
  location_id uuid references job_locations(id),
  job_type job_type,
  frequency text default 'daily', -- daily | weekly
  is_active boolean default true,
  last_sent_at timestamptz,
  created_at timestamptz default now()
);

-- ── INDEXES ──────────────────────────────────────────────────
create index idx_jobs_status on jobs(status);
create index idx_jobs_category on jobs(category_id);
create index idx_jobs_location on jobs(location_id);
create index idx_jobs_company on jobs(company_id);
create index idx_jobs_created on jobs(created_at desc);
create index idx_jobs_wp_id on jobs(wp_post_id);
create index idx_applications_job on applications(job_id);
create index idx_applications_applicant on applications(applicant_id);
create index idx_applications_email on applications(applicant_email);
create index idx_applications_wp_id on applications(wp_post_id);
create index idx_applications_status on applications(status);

-- ── FULL TEXT SEARCH ─────────────────────────────────────────
alter table jobs add column fts tsvector
  generated always as (
    to_tsvector('english', coalesce(title,'') || ' ' || coalesce(description,'') || ' ' || coalesce(requirements,''))
  ) stored;
create index idx_jobs_fts on jobs using gin(fts);

-- ── UPDATED_AT TRIGGER ───────────────────────────────────────
create or replace function update_updated_at()
returns trigger as $$
begin new.updated_at = now(); return new; end;
$$ language plpgsql;

create trigger trg_profiles_updated before update on profiles
  for each row execute function update_updated_at();
create trigger trg_jobs_updated before update on jobs
  for each row execute function update_updated_at();
create trigger trg_applications_updated before update on applications
  for each row execute function update_updated_at();
create trigger trg_companies_updated before update on companies
  for each row execute function update_updated_at();

-- ── ROW LEVEL SECURITY ───────────────────────────────────────
alter table profiles enable row level security;
alter table companies enable row level security;
alter table jobs enable row level security;
alter table applications enable row level security;
alter table saved_jobs enable row level security;
alter table job_alerts enable row level security;

-- Profiles: users see their own; admins see all
create policy "users view own profile" on profiles
  for select using (auth.uid() = id);
create policy "users update own profile" on profiles
  for update using (auth.uid() = id);
create policy "admins full access profiles" on profiles
  for all using (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

-- Jobs: published jobs are public; employers manage their own; admins see all
create policy "public view published jobs" on jobs
  for select using (status = 'published');
create policy "employers manage own jobs" on jobs
  for all using (posted_by = auth.uid());
create policy "admins full access jobs" on jobs
  for all using (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

-- Applications: seekers see own; employers see apps on their jobs; admins see all
create policy "seekers view own applications" on applications
  for select using (applicant_id = auth.uid());
create policy "seekers insert applications" on applications
  for insert with check (applicant_id = auth.uid());
create policy "employers view applications on their jobs" on applications
  for select using (
    exists (
      select 1 from jobs j
      join companies c on c.id = j.company_id
      where j.id = applications.job_id
      and c.owner_id = auth.uid()
    )
  );
create policy "employers update application status" on applications
  for update using (
    exists (
      select 1 from jobs j
      join companies c on c.id = j.company_id
      where j.id = applications.job_id
      and c.owner_id = auth.uid()
    )
  );
create policy "admins full access applications" on applications
  for all using (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

-- Saved jobs: own only
create policy "own saved jobs" on saved_jobs
  for all using (profile_id = auth.uid());

-- Job alerts: own only
create policy "own job alerts" on job_alerts
  for all using (profile_id = auth.uid());

-- Companies: public read; owner manages; admins full
create policy "public view companies" on companies for select using (true);
create policy "owners manage company" on companies
  for all using (owner_id = auth.uid());
create policy "admins full access companies" on companies
  for all using (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );


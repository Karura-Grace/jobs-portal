-- ============================================================
-- 028 — Notification preferences
-- ============================================================
-- Three real, working toggles, added to `profiles` rather than a new table:
-- every one of them is read by a single query already fetching the profile
-- row for something else (recipient lookup in lib/notify.ts), so a join buys
-- nothing here.
--
-- Not guarded by guard_profile_columns (migration 025) — that trigger exists
-- to stop a user rewriting role/email/company_id, columns that change what
-- they can access. These three change nothing but whether they get an email,
-- so the ordinary "users update own profile" policy is exactly right for them.

alter table profiles
  add column if not exists notify_email boolean not null default true,
  add column if not exists notify_new_jobs boolean not null default false,
  add column if not exists notify_pending_review boolean not null default true;

comment on column profiles.notify_email is
  'Master switch for transactional email: application received, status changed, listing decision. Seeker and employer.';
comment on column profiles.notify_new_jobs is
  'Seeker opt-in: email when any new job is published. Off by default — this is a volume choice, not a safety one.';
comment on column profiles.notify_pending_review is
  'Admin opt-in: email when a job enters the review queue. On by default so a new admin does not have to discover it.';

-- ============================================================
-- 019 — Let an employer resume a listing they paused
-- ============================================================
-- Migration 012 closed the employer publish-bypass by making any transition into
-- `published` admin-only. Correct, but it turned the brief's Pause action (§9)
-- into a one-way door: pause a live role and you need an admin to get it back.
-- An employer who learns that will simply never pause anything, which defeats
-- the feature.
--
-- The fix keeps the property that matters — no listing reaches the public
-- without having been reviewed — while allowing the specific case where the
-- content was already reviewed and has not changed since:
--
--   `approved_at` is stamped when an admin publishes, and cleared whenever a
--   non-admin edits any field that a reviewer would have read. An employer may
--   move paused → published only while approved_at is set. Edit the copy and it
--   goes back through the queue, which is the whole point of the queue.
-- ============================================================

alter table public.jobs add column if not exists approved_at timestamptz;

-- Backfill: anything already live was approved by an admin to get there.
update public.jobs
   set approved_at = coalesce(approved_at, updated_at, created_at)
 where status = 'published'::public.job_status
   and approved_at is null;

create or replace function public.guard_job_status()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  reviewed_changed boolean;
begin
  -- A direct database session (SQL Editor, service_role, migration) has no
  -- auth.uid() and is already privileged; admins are the sanctioned path.
  if (select auth.uid()) is null or public.is_admin() then
    if tg_op = 'UPDATE'
       and new.status = 'published'::public.job_status
       and old.status is distinct from new.status then
      new.approved_at := now();
    elsif tg_op = 'INSERT' and new.status = 'published'::public.job_status then
      new.approved_at := now();
    end if;
    return new;
  end if;

  if tg_op = 'INSERT' then
    -- Coerced rather than rejected: an employer submitting a listing has done
    -- nothing wrong, they just do not get to choose where it lands.
    if new.status is distinct from 'pending_review'::public.job_status then
      new.status := 'pending_review'::public.job_status;
    end if;
    new.approved_at := null;
    return new;
  end if;

  -- Did this edit touch anything a reviewer would have read? Salary, deadline
  -- and the remote flag count: they are part of the offer, not presentation.
  reviewed_changed :=
       new.title             is distinct from old.title
    or new.description       is distinct from old.description
    or new.requirements      is distinct from old.requirements
    or new.qualifications    is distinct from old.qualifications
    or new.company_id        is distinct from old.company_id
    or new.category_id       is distinct from old.category_id
    or new.location_id       is distinct from old.location_id
    or new.location_text     is distinct from old.location_text
    or new.job_type          is distinct from old.job_type
    or new.employment_level  is distinct from old.employment_level
    or new.salary_min        is distinct from old.salary_min
    or new.salary_max        is distinct from old.salary_max
    or new.is_remote         is distinct from old.is_remote
    or new.application_deadline is distinct from old.application_deadline;

  if reviewed_changed then
    new.approved_at := null;
  else
    -- An employer cannot grant themselves prior approval.
    new.approved_at := old.approved_at;
  end if;

  if new.status is distinct from old.status then
    if new.status = 'expired'::public.job_status then
      raise exception 'only an administrator can expire a listing';
    end if;

    if new.status = 'published'::public.job_status then
      if old.status <> 'paused'::public.job_status then
        raise exception 'only an administrator can publish a listing';
      end if;
      if new.approved_at is null then
        raise exception
          'this listing has been edited since it was approved and must be reviewed again';
      end if;
    end if;
  end if;

  return new;
end;
$$;

revoke execute on function public.guard_job_status() from public, anon, authenticated;

drop trigger if exists trg_jobs_status_guard on public.jobs;
create trigger trg_jobs_status_guard
  before insert or update on public.jobs
  for each row execute function public.guard_job_status();

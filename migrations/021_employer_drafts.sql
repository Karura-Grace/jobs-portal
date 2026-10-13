-- ============================================================
-- 021 — Let an employer save a draft
-- ============================================================
-- The brief's post form offers "Draft save at any point" (§9), but
-- guard_job_status coerced every employer INSERT to `pending_review`, so the
-- first save always entered the moderation queue — there was no way to write
-- half a listing and come back to it.
--
-- `draft` is not publicly visible (jobs_select_published exposes `published`
-- only), so permitting it on insert gives away nothing. Everything else is
-- still coerced into the queue, and `published` remains unreachable except
-- through an admin or the resume path from migration 019.
-- ============================================================

create or replace function public.guard_job_status()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  reviewed_changed boolean;
begin
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
    -- Draft or the queue. Anything else is coerced rather than rejected: an
    -- employer submitting a listing has done nothing wrong, they just do not get
    -- to choose whether it is public.
    if new.status not in ('draft'::public.job_status,
                          'pending_review'::public.job_status) then
      new.status := 'pending_review'::public.job_status;
    end if;
    new.approved_at := null;
    return new;
  end if;

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

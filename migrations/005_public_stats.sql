-- ============================================================
-- 005 — Public homepage statistics
-- ============================================================
-- PROBLEM: app/page.tsx counts `applications` as an anonymous visitor. With
-- migration 004 in place that correctly returns 0, so the homepage would
-- advertise "0 Applications on file" directly beneath copy reading "Since 2014
-- we've connected thousands of applicants" -- while 4,355 rows sit in the table.
--
-- The wrong fix is an anon SELECT policy on `applications`. That would expose
-- every applicant's name, email and phone number to the internet in order to
-- render one number.
--
-- The right fix is to expose the aggregate and nothing else. This function
-- returns three integers and cannot be coerced into returning a row: there are
-- no parameters, no filters, and no way to narrow the count toward a single
-- individual.
-- ============================================================

create or replace function public.stats()
returns table (live_jobs bigint, applications bigint, employers bigint)
language sql
security definer
stable
set search_path = ''
as $$
  select
    (select count(*) from public.jobs
      where status = 'published'::public.job_status)          as live_jobs,
    (select count(*) from public.applications)               as applications,
    (select count(*) from public.companies)                  as employers;
$$;

comment on function public.stats() is
  'Aggregate counts for the public homepage. SECURITY DEFINER so anon can read '
  'a count of applications without any policy exposing application rows.';

revoke execute on function public.stats() from public;
grant execute on function public.stats() to anon, authenticated;

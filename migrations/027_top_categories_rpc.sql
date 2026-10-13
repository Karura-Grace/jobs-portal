-- 027_top_categories_rpc
--
-- Replaces the homepage pattern of fetching 200 job rows and counting
-- categories in JavaScript. This function does the GROUP BY in the database
-- and returns only the top N rows, cutting the data transferred on every
-- homepage ISR revalidation from ~200 rows to 6.
--
-- Granted to anon so the homepage can call it without a session.

create or replace function top_job_categories(limit_n integer default 6)
returns table (id uuid, name text)
language sql
stable
security definer
set search_path = public
as $$
  select
    jc.id,
    jc.name
  from jobs j
  join job_categories jc on jc.id = j.category_id
  where j.status = 'published'
    and j.category_id is not null
  group by jc.id, jc.name
  order by count(*) desc
  limit limit_n;
$$;

grant execute on function top_job_categories(integer) to anon, authenticated;

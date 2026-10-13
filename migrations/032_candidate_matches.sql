-- ============================================================
-- 032 — candidate_matches(): rank every seeker against a job's required_skills
-- ============================================================
-- Admin candidate-sourcing search: "pick a job, see every seeker ranked by
-- match%, not just applicants". Gated inside the function itself with
-- is_admin() — same pattern as every other admin-only RPC (e.g. stats() was
-- until 011, applicant_cards() checks ownership per-row) — not just by what
-- the client happens to call. Admin already has row-level read on every
-- profile (RLS: own-row-or-admin), so this doesn't expose anything a manual
-- table browse couldn't already show; it just does the ranking arithmetic in
-- the database instead of pulling every seeker to the app layer to sort.

create or replace function public.candidate_matches(
  p_job_id uuid,
  p_industry_category_id uuid default null
)
returns table (
  seeker_id uuid,
  full_name text,
  headline text,
  avatar_url text,
  match_percent int
)
language plpgsql
security definer
stable
set search_path = ''
as $$
declare
  required text[];
begin
  if not public.is_admin() then
    return;
  end if;

  select j.required_skills into required
    from public.jobs j
   where j.id = p_job_id;

  -- Nothing to grade against — same "no badge, not a fake 0%" rule
  -- lib/match.ts follows on the app side.
  if required is null or array_length(required, 1) is null then
    return;
  end if;

  return query
    select
      p.id,
      p.full_name,
      p.headline,
      p.avatar_url,
      round(
        100.0 * cardinality(array(select unnest(p.skills) intersect select unnest(required)))
        / cardinality(required)
      )::int as match_percent
    from public.profiles p
   where p.role = 'seeker'
     and p.skills is not null
     and array_length(p.skills, 1) is not null
     and (p_industry_category_id is null or p.industry_category_id = p_industry_category_id)
   order by match_percent desc;
end;
$$;

comment on function public.candidate_matches(uuid, uuid) is
  'Admin-only. Ranks every seeker with skills on file against one job''s '
  'required_skills by overlap percentage (migration 031''s new column), '
  'optionally filtered by industry (migration 033). '
  'Gated by is_admin() inside the function, not only by grant.';

revoke all on function public.candidate_matches(uuid, uuid) from public;
grant execute on function public.candidate_matches(uuid, uuid) to authenticated;

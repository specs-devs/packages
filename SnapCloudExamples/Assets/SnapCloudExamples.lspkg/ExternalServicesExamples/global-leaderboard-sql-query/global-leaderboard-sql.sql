/*
  Global Leaderboard (Minimal Clean Version)

  - One row per user (best score only)
  - Stores: displayname + score
  - Uses SECURITY DEFINER RPC for writes
  - Public read via RPC
  - RLS enabled
  - No direct table access

  Objects created:
    table: public.game_leaderboard_scores
    function: public.submit_score(p_score, p_displayname, p_sort_mode)
    function: public.get_top_scores(p_limit, p_sort_mode)
    function: public.leaderboard_healthcheck()
*/

begin;

-- =========================
-- 1) Table
-- =========================
create table if not exists public.game_leaderboard_scores (
  user_id uuid primary key references auth.users(id) on delete cascade,
  displayname text not null,
  score double precision not null,
  updated_at timestamptz not null default now()
);

create index if not exists game_leaderboard_scores_score_idx
  on public.game_leaderboard_scores (score);

create index if not exists game_leaderboard_scores_updated_at_idx
  on public.game_leaderboard_scores (updated_at desc);

-- updated_at trigger
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_game_leaderboard_scores_updated_at on public.game_leaderboard_scores;

create trigger trg_game_leaderboard_scores_updated_at
before update on public.game_leaderboard_scores
for each row execute function public.set_updated_at();

alter table public.game_leaderboard_scores enable row level security;

-- =========================
-- 2) RPC: submit_score
-- =========================
create or replace function public.submit_score(
  p_score double precision,
  p_displayname text,
  p_sort_mode text default 'desc'  -- 'desc' = higher better, 'asc' = lower better
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_existing_score double precision;
  v_should_update boolean := false;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  if p_displayname is null or length(trim(p_displayname)) = 0 then
    raise exception 'displayname is required';
  end if;

  if p_score is null then
    raise exception 'score is required';
  end if;

  if p_sort_mode not in ('asc', 'desc') then
    raise exception 'Invalid sort mode. Use asc or desc.';
  end if;

  select score
    into v_existing_score
  from public.game_leaderboard_scores
  where user_id = v_uid;

  if not found then
    insert into public.game_leaderboard_scores (user_id, displayname, score)
    values (v_uid, p_displayname, p_score);
    return;
  end if;

  if p_sort_mode = 'desc' then
    v_should_update := p_score > v_existing_score;
  else
    v_should_update := p_score < v_existing_score;
  end if;

  update public.game_leaderboard_scores
  set
    displayname = p_displayname,
    score = case when v_should_update then p_score else score end
  where user_id = v_uid;

end;
$$;

-- =========================
-- 3) RPC: get_top_scores
-- =========================
create or replace function public.get_top_scores(
  p_limit integer,
  p_sort_mode text default 'desc'
)
returns table (
  displayname text,
  score double precision
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_limit is null or p_limit < 1 or p_limit > 100 then
    raise exception 'p_limit must be between 1 and 100';
  end if;

  if p_sort_mode not in ('asc', 'desc') then
    raise exception 'Invalid sort mode. Use asc or desc.';
  end if;

  if p_sort_mode = 'desc' then
    return query
      select s.displayname, s.score
      from public.game_leaderboard_scores s
      order by s.score desc, s.updated_at desc
      limit p_limit;
  else
    return query
      select s.displayname, s.score
      from public.game_leaderboard_scores s
      order by s.score asc, s.updated_at desc
      limit p_limit;
  end if;
end;
$$;

-- =========================
-- 4) Optional: healthcheck
-- =========================
create or replace function public.leaderboard_healthcheck()
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_table_exists boolean;
  v_submit_exists boolean;
  v_get_exists boolean;
begin
  select exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'game_leaderboard_scores'
  ) into v_table_exists;

  select exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'submit_score'
  ) into v_submit_exists;

  select exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'get_top_scores'
  ) into v_get_exists;

  return json_build_object(
    'ok', (v_table_exists and v_submit_exists and v_get_exists),
    'version', '2.0.0',
    'table', v_table_exists,
    'rpc_submit_score', v_submit_exists,
    'rpc_get_top_scores', v_get_exists
  );
end;
$$;

-- =========================
-- 5) Lockdown
-- =========================

revoke all on table public.game_leaderboard_scores from anon, authenticated;

revoke all on function public.submit_score(double precision, text, text) from public;
grant execute on function public.submit_score(double precision, text, text) to authenticated;

revoke all on function public.get_top_scores(integer, text) from public;
grant execute on function public.get_top_scores(integer, text) to anon, authenticated;

revoke all on function public.leaderboard_healthcheck() from public;
grant execute on function public.leaderboard_healthcheck() to anon, authenticated;

commit;
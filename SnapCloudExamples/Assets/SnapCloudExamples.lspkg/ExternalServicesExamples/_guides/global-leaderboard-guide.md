# Global Leaderboard (Snap Cloud)

This folder contains a reusable **Global Leaderboard** system for Snapchat Spectacles applications.

It uses **Snap Cloud** as the backend to store and retrieve leaderboard data.

---

# Overview

The Global Leaderboard system provides:

- One global leaderboard per Supabase project  
- One row per user (best score only)  
- Secure score submission (authenticated users only)  
- Public leaderboard retrieval (no login required to view)  
- Support for ascending or descending score sorting  
- Simple UI integration using row prefabs  

---

# What Gets Stored

The database stores:

- `user_id` (Supabase Auth UID)
- `displayname` (from Snapchat user context)
- `score`
- `updated_at` (automatic timestamp)

---

# Files in This Asset

- **GlobalLeaderboard.ts**  
  Main controller. Handles submit + refresh.

- **SupabaseLeaderboardService.ts**  
  Handles Supabase client, authentication, and RPC calls.

- **LeaderboardRowInstantiator.ts**  
  Instantiates leaderboard row prefabs as children of its scene object, sets their local position (startPosition + step × index), and binds entry data via each row’s `bind(entry)`. Item count comes from **GlobalLeaderboard** when assigned, otherwise from **itemsCount**. Assign the row prefab to **itemPrefab**.

- **LeaderboardRowItem.ts**  
  Row component that binds rank, display name, and score (implements `bind(entry)`).

- **Prefabs/ScrollViewListItem.prefab**  
  Row prefab with LeaderboardRowItem script and three Text children (Placement, Display Name, Score). Assign as **itemPrefab** on **LeaderboardRowInstantiator**.

---

# Scroll layout (ScrollWindow)

The list is designed to sit inside Spectacles UI Kit’s **ScrollWindow**:

- **Hierarchy:** ScrollWindow → **Content** (or “UI”) → **rowInstantiator** (scene object with LeaderboardRowInstantiator script). Row instances are created as children of the rowInstantiator object (which is the scrollable content).
- **GlobalLeaderboard** assigns **rowInstantiator** (LeaderboardRowInstantiator) and calls `rowInstantiator.render(entries)` when data is refreshed.
- Configure **startPosition** and **step** on LeaderboardRowInstantiator to match your ScrollWindow’s local space (e.g. first row at (-10, 0, 0), step (-4, 0, 0) for the next).

---

# Setup Instructions

## 1️. Create Supabase Project

1. Go to Snap Cloud / Supabase.
2. Create a **new project** (recommended: one project per game/project).
3. Open the SQL editor.
4. Copy and paste the SQL from the section below.
5. Run the query.

---

## 2️. SQL Setup (Copy & Paste)

```sql
begin;

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
for each row
when (old.score is distinct from new.score)
execute function public.set_updated_at();

alter table public.game_leaderboard_scores enable row level security;

create or replace function public.submit_score(
  p_score double precision,
  p_displayname text,
  p_sort_mode text default 'desc'
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

  insert into public.game_leaderboard_scores (user_id, displayname, score)
  values (v_uid, p_displayname, p_score)
  on conflict (user_id) do update
  set
    displayname = excluded.displayname,
    score = case
      when p_sort_mode = 'desc' and excluded.score > game_leaderboard_scores.score then excluded.score
      when p_sort_mode = 'asc' and excluded.score < game_leaderboard_scores.score then excluded.score
      else game_leaderboard_scores.score
    end;

end;
$$;

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

revoke all on table public.game_leaderboard_scores from anon, authenticated;

revoke all on function public.submit_score(double precision, text, text) from public;
grant execute on function public.submit_score(double precision, text, text) to authenticated;

revoke all on function public.get_top_scores(integer, text) from public;
grant execute on function public.get_top_scores(integer, text) to anon, authenticated;

commit;
```

---

# Usage Example

```ts
globalLeaderboard.submitScore(score, displayName);
globalLeaderboard.refresh();
```

---

# Notes

- `submit_score` requires authentication.
- `get_top_scores` is public.
- Only one score per user is stored.
- Score updates only if the new score is better (based on sort mode).
- One Supabase project per game is recommended.
# Example 7 – Global Counter

One action per user, one shared total for everyone: the pattern behind pledge, vote or "I was here"
Lenses. Each signed-in Snapchat user can add themselves once; everyone sees the same total. All counting
happens in the database, so the Lens can't double count and holds no counting logic.

## Files

| File | Role |
|---|---|
| `Example7-GlobalCounter/GlobalCounter.ts` | Signs in, checks whether you already joined, joins once, refreshes the total; builds its own small panel. |

## Database setup

Run this once in the SQL editor of your Snap Cloud (Supabase) project:

```sql
-- One row per user who joined.
create table if not exists public.counter_actions (
  user_id    uuid primary key default auth.uid() references auth.users on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.counter_actions enable row level security;
create policy "read own row" on public.counter_actions for select using (auth.uid() = user_id);

-- Has the signed-in user already joined?
create or replace function public.counter_has_joined() returns boolean
language sql security definer set search_path = public as $$
  select exists (select 1 from public.counter_actions where user_id = auth.uid());
$$;

-- Join once (a second call changes nothing) and return the new total.
create or replace function public.counter_join_once() returns bigint
language plpgsql security definer set search_path = public as $$
begin
  insert into public.counter_actions (user_id) values (auth.uid()) on conflict do nothing;
  return (select count(*) from public.counter_actions);
end;
$$;

-- The shared total.
create or replace function public.counter_total() returns bigint
language sql security definer set search_path = public as $$
  select count(*) from public.counter_actions;
$$;

grant execute on function public.counter_has_joined(), public.counter_join_once(), public.counter_total() to authenticated;
```

## Use it

1. Import your project with the Supabase plug-in and assign it to `SnapCloudRequirements`.
2. On the `GlobalCounter` component set `title` and `actionLabel` (for example "World Kindness Day" and
   "I pledge to be kind").
3. Call `join()` from your own flow (after a speech pledge, a pinch, a game result…) or use the built-in button.
4. `refreshInterval` polls the total; for instant updates subscribe to `counter_actions` with Realtime
   (see Example 2).

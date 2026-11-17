-- Checkpoints + visits for the productionized Friend Finder.
--
-- checkpoints:       named places a user marks from the phone ("Main Stage").
-- checkpoint_visits: an actor entered a checkpoint's geofence radius at
--                    entered_at. Client-side geofence detection inserts these;
--                    the other side polls them (PostgREST, NOT Realtime — this
--                    project's Realtime WS doesn't reach SUBSCRIBED on device,
--                    see rtc_signals) to raise an in-app "was here N min ago"
--                    notification.

create table if not exists public.checkpoints (
    id          bigint generated always as identity primary key,
    session     text not null,               -- FriendFinder session code (wrp-…)
    user_id     uuid,                         -- who marked it (null for anon)
    device_name text,                         -- marker's display/device name
    name        text not null,               -- checkpoint label
    lat         double precision not null,
    lon         double precision not null,
    created_at  timestamptz not null default now()
);
create index if not exists checkpoints_session_idx
    on public.checkpoints (session, id);

create table if not exists public.checkpoint_visits (
    id              bigint generated always as identity primary key,
    session         text not null,
    checkpoint_id   bigint references public.checkpoints(id),
    checkpoint_name text not null,            -- denormalized for the notification text
    role            text not null,            -- 'self' | 'friend' (relative to writer)
    device_name     text not null,            -- who was there ('Phone A' / friend name)
    lat             double precision,
    lon             double precision,
    entered_at      timestamptz not null default now()
);
-- Poll pattern: WHERE session = ? AND role = 'friend' AND id > <cursor> ORDER BY id.
create index if not exists checkpoint_visits_session_idx
    on public.checkpoint_visits (session, id);

alter table public.checkpoints        enable row level security;
alter table public.checkpoint_visits  enable row level security;

-- PROTOTYPE POLICY (mirrors rtc_signals): the Glasses authenticates (snapchat
-- id-token → authenticated) and the phone uses the public anon key (anon). Both
-- must read/write across the pairing, so allow both roles. Tighten (scope by
-- session ownership) before any non-prototype use.
create policy "cp_open_insert" on public.checkpoints
    for insert to anon, authenticated with check (true);
create policy "cp_open_select" on public.checkpoints
    for select to anon, authenticated using (true);
create policy "cp_open_delete" on public.checkpoints
    for delete to anon, authenticated using (true);

create policy "cv_open_insert" on public.checkpoint_visits
    for insert to anon, authenticated with check (true);
create policy "cv_open_select" on public.checkpoint_visits
    for select to anon, authenticated using (true);
create policy "cv_open_delete" on public.checkpoint_visits
    for delete to anon, authenticated using (true);

-- ARKit Spectator 2.0.0 — rooms, read-only spectators and one host-published scene state per room.
--
-- Security model
--  * Every client signs in (Snapchat sign-in on the Lens, anonymous sign-in on the iPhone).
--  * Tables are read-only for clients: no insert/update/delete grants. All writes go through
--    SECURITY DEFINER functions that derive authority from auth.uid().
--  * Only the room host may publish state. Spectators can only read rooms they joined.
--  * Limits: 5 active rooms per host, 24 h room lifetime, 64 entities and 128 KB per state,
--    20 join attempts per user per minute (failed guesses are counted, not rolled back).
--  * Camera frames, world anchors and device poses never leave the device: only the poses of the
--    objects the Lens creator chose to stream, relative to the Lens-side stage origin.
begin;

create table if not exists public.spectator_rooms (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  host_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '24 hours'
);

create table if not exists public.spectator_members (
  room_id uuid not null references public.spectator_rooms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('host', 'spectator')),
  joined_at timestamptz not null default now(),
  primary key (room_id, user_id)
);

create table if not exists public.spectator_states (
  room_id uuid primary key references public.spectator_rooms(id) on delete cascade,
  revision bigint not null default 0,
  state jsonb not null default '{"entities":[]}',
  updated_at timestamptz not null default now()
);

create table if not exists public.spectator_join_limits (
  user_id uuid primary key references auth.users(id) on delete cascade,
  window_start timestamptz not null default now(),
  attempts integer not null default 0
);

alter table public.spectator_rooms enable row level security;
alter table public.spectator_members enable row level security;
alter table public.spectator_states enable row level security;
alter table public.spectator_join_limits enable row level security;

create or replace function public.spectator_is_member(p_room uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(
    select 1 from public.spectator_members m join public.spectator_rooms r on r.id = m.room_id
    where m.room_id = p_room and m.user_id = auth.uid() and r.expires_at > now())
$$;

drop policy if exists spectator_rooms_read on public.spectator_rooms;
drop policy if exists spectator_members_read on public.spectator_members;
drop policy if exists spectator_states_read on public.spectator_states;
create policy spectator_rooms_read on public.spectator_rooms for select to authenticated using (public.spectator_is_member(id));
create policy spectator_members_read on public.spectator_members for select to authenticated using (public.spectator_is_member(room_id));
create policy spectator_states_read on public.spectator_states for select to authenticated using (public.spectator_is_member(room_id));

revoke all on public.spectator_rooms, public.spectator_members, public.spectator_states, public.spectator_join_limits from public, anon, authenticated;
grant select on public.spectator_rooms, public.spectator_members, public.spectator_states to authenticated;

-- Numeric array of exactly n finite values within ±limit.
create or replace function public.spectator_valid_vector(p jsonb, n integer, lim numeric) returns boolean
language sql immutable set search_path = '' as $$
  select jsonb_typeof(p) = 'array' and jsonb_array_length(p) = n
     and not exists(select 1 from jsonb_array_elements(p) v
                    where jsonb_typeof(v) <> 'number' or abs(v::text::numeric) > lim)
$$;

-- Wire format (also documented in the package README):
-- { "entities": [ { "id", "name"?, "p":[x,y,z] cm, "r":[x,y,z,w], "s":[x,y,z], "asset"? https URL,
--   "primitive"? box|sphere|cylinder|plane|none, "color"? #RRGGBB(AA), "visible"? bool,
--   "clip"? {"name", "loop"?, "id"?}, "data"? any JSON <= 2 KB } ], "data"? any JSON <= 8 KB }
create or replace function public.spectator_validate_state(p_state jsonb) returns void
language plpgsql immutable set search_path = '' as $$
declare e jsonb;
begin
  if p_state is null or jsonb_typeof(p_state) <> 'object' or octet_length(p_state::text) > 131072
     or jsonb_typeof(p_state->'entities') is distinct from 'array' then raise exception 'Invalid state'; end if;
  if exists(select 1 from jsonb_object_keys(p_state) k where k not in ('entities', 'data')) then raise exception 'Unknown state field'; end if;
  if p_state ? 'data' and octet_length((p_state->'data')::text) > 8192 then raise exception 'Room data too large'; end if;
  if jsonb_array_length(p_state->'entities') > 64 then raise exception 'Too many entities'; end if;
  if exists(select 1 from jsonb_array_elements(p_state->'entities') i(x) group by i.x->>'id' having count(*) > 1) then raise exception 'Duplicate entity id'; end if;
  for e in select value from jsonb_array_elements(p_state->'entities') loop
    if jsonb_typeof(e) <> 'object' then raise exception 'Invalid entity'; end if;
    if exists(select 1 from jsonb_object_keys(e) k where k not in ('id','name','p','r','s','asset','primitive','color','visible','clip','data')) then raise exception 'Unknown entity field'; end if;
    if jsonb_typeof(e->'id') is distinct from 'string' or length(e->>'id') not between 1 and 80
       or (e ? 'name' and (jsonb_typeof(e->'name') is distinct from 'string' or length(e->>'name') > 80))
       or not public.spectator_valid_vector(e->'p', 3, 100000)
       or not public.spectator_valid_vector(e->'r', 4, 1.01)
       or not public.spectator_valid_vector(e->'s', 3, 1000)
       or (e ? 'asset' and (jsonb_typeof(e->'asset') is distinct from 'string' or length(e->>'asset') > 512 or e->>'asset' !~ '^https://'))
       or (e ? 'primitive' and (jsonb_typeof(e->'primitive') is distinct from 'string' or e->>'primitive' not in ('box','sphere','cylinder','plane','none')))
       or (e ? 'color' and (jsonb_typeof(e->'color') is distinct from 'string' or e->>'color' !~ '^#[0-9A-Fa-f]{6}([0-9A-Fa-f]{2})?$'))
       or (e ? 'visible' and jsonb_typeof(e->'visible') is distinct from 'boolean')
       or (e ? 'data' and octet_length((e->'data')::text) > 2048)
    then raise exception 'Invalid entity %', left(coalesce(e->>'id', '?'), 80); end if;
    if e ? 'clip' and (jsonb_typeof(e->'clip') is distinct from 'object'
       or exists(select 1 from jsonb_object_keys(e->'clip') k where k not in ('name','loop','id'))
       or jsonb_typeof(e->'clip'->'name') is distinct from 'string' or length(e->'clip'->>'name') not between 1 and 80
       or (e->'clip' ? 'loop' and jsonb_typeof(e->'clip'->'loop') is distinct from 'boolean')
       or (e->'clip' ? 'id' and (jsonb_typeof(e->'clip'->'id') is distinct from 'string' or length(e->'clip'->>'id') > 64)))
    then raise exception 'Invalid clip on entity %', left(e->>'id', 80); end if;
  end loop;
end $$;

-- Host: allocate a 4-digit code (unique among active rooms; expired codes are released).
create or replace function public.spectator_create_room() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare r public.spectator_rooms; candidate text; start_code integer; i integer;
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  perform pg_advisory_xact_lock(hashtext('spectator-room-code-allocation'));
  if (select count(*) from public.spectator_rooms where host_id = auth.uid() and expires_at > now()) >= 5 then
    raise exception 'Room limit reached (5 active rooms). Close a room or wait for it to expire.'; end if;
  start_code = floor(random() * 10000)::integer;
  for i in 0..9999 loop
    candidate = lpad(((start_code + i) % 10000)::text, 4, '0');
    update public.spectator_rooms set code = 'expired:' || id::text where code = candidate and expires_at <= now();
    insert into public.spectator_rooms(code, host_id) values (candidate, auth.uid()) on conflict (code) do nothing returning * into r;
    if found then
      insert into public.spectator_members(room_id, user_id, role) values (r.id, auth.uid(), 'host');
      insert into public.spectator_states(room_id) values (r.id);
      return jsonb_build_object('id', r.id, 'code', r.code, 'role', 'host', 'expires_at', r.expires_at);
    end if;
  end loop;
  raise exception 'All room codes are in use. Try again later.';
end $$;

-- Spectator: join by code. Errors are returned (not raised) so failed guesses keep their rate count.
create or replace function public.spectator_join_room(p_code text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare r public.spectator_rooms; existing text; attempt_count integer;
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  p_code = btrim(p_code);
  if p_code is null or p_code !~ '^[0-9]{4}$' then return jsonb_build_object('error', 'Enter the 4-digit room code'); end if;
  insert into public.spectator_join_limits(user_id, window_start, attempts) values (auth.uid(), now(), 1)
  on conflict (user_id) do update set
    attempts = case when spectator_join_limits.window_start < now() - interval '1 minute' then 1 else spectator_join_limits.attempts + 1 end,
    window_start = case when spectator_join_limits.window_start < now() - interval '1 minute' then now() else spectator_join_limits.window_start end
  returning attempts into attempt_count;
  if attempt_count > 20 then return jsonb_build_object('error', 'Too many attempts. Wait a minute and try again.'); end if;
  select * into r from public.spectator_rooms where code = p_code and expires_at > now();
  if not found then return jsonb_build_object('error', 'Room not found or expired'); end if;
  select role into existing from public.spectator_members where room_id = r.id and user_id = auth.uid();
  if existing is null then
    insert into public.spectator_members(room_id, user_id, role) values (r.id, auth.uid(), 'spectator');
    existing = 'spectator';
  end if;
  return jsonb_build_object('id', r.id, 'code', r.code, 'role', existing, 'expires_at', r.expires_at);
end $$;

-- Host only: replace the room state. p_revision must equal the stored revision (stale writes fail).
create or replace function public.spectator_publish(p_room uuid, p_revision bigint, p_state jsonb) returns bigint
language plpgsql security definer set search_path = '' as $$
declare next_revision bigint;
begin
  if not exists(select 1 from public.spectator_rooms where id = p_room and host_id = auth.uid() and expires_at > now()) then
    raise exception 'Only the room host may publish'; end if;
  perform public.spectator_validate_state(p_state);
  update public.spectator_states set state = p_state, revision = revision + 1, updated_at = now()
  where room_id = p_room and revision = p_revision returning revision into next_revision;
  if not found then raise exception 'Revision conflict'; end if;
  return next_revision;
end $$;

-- Leave a room. When the host leaves, the room closes: its state is cleared and its code released.
create or replace function public.spectator_leave_room(p_room uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if exists(select 1 from public.spectator_rooms where id = p_room and host_id = auth.uid()) then
    update public.spectator_states set state = '{"entities":[]}', revision = revision + 1, updated_at = now() where room_id = p_room;
    update public.spectator_rooms set expires_at = now(), code = 'expired:' || id::text where id = p_room;
  end if;
  delete from public.spectator_members where room_id = p_room and user_id = auth.uid();
end $$;

revoke all on function public.spectator_is_member(uuid), public.spectator_valid_vector(jsonb, integer, numeric),
  public.spectator_validate_state(jsonb), public.spectator_create_room(), public.spectator_join_room(text),
  public.spectator_publish(uuid, bigint, jsonb), public.spectator_leave_room(uuid) from public, anon;
grant execute on function public.spectator_is_member(uuid), public.spectator_create_room(), public.spectator_join_room(text),
  public.spectator_publish(uuid, bigint, jsonb), public.spectator_leave_room(uuid) to authenticated;

-- Spectators receive state changes over Realtime Postgres Changes (RLS applies to the stream).
do $$ begin
  if not exists(select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'spectator_states') then
    alter publication supabase_realtime add table public.spectator_states;
  end if;
end $$;

notify pgrst, 'reload schema';
commit;

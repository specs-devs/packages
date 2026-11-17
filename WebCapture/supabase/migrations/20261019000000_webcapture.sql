-- Web Capture 4.0.0 migration (supabase db push). Same SQL as setup.sql.
-- (safe to re-run). Identical to supabase/migrations/20261019000000_webcapture.sql; use either.
--
-- What it stores
--  * webcapture_sessions: one row per running Lens (Snap Cloud mode) with its latest scene snapshot.
--  * webcapture_recordings: recordings saved by that Lens, plus the portal's edits.
--
-- Security model
--  * The Lens signs in (Snapchat sign-in, or anonymous). Only the signed-in owner of a session can
--    publish its scene or save recordings into it.
--  * The portal uses the project's PUBLIC key and a 6-character session code. Anyone who knows the
--    code can read that session's scene and recordings and save portal edits (trim, look, titles),
--    never the recorded tracks. Treat the code like a share link.
--  * Tables are closed to clients (no grants); every access goes through the SECURITY DEFINER
--    functions below, which check ownership or the code.
--  * Limits: 10 open sessions per owner, sessions expire after 7 days, scene ≤ 512 KB,
--    recording ≤ 6 MB, edits ≤ 512 KB, 50 recordings per session.
--  * Only what the Lens creator chose to capture is sent: object poses relative to the capture
--    origin, shapes, colours, text and the camera pose. No camera images, no audio.
begin;

create table if not exists public.webcapture_sessions (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  owner_id uuid not null references auth.users(id) on delete cascade,
  lens text not null default '',
  status text not null default 'live' check (status in ('live', 'ended')),
  revision bigint not null default 0,
  scene jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '7 days'
);

create table if not exists public.webcapture_recordings (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.webcapture_sessions(id) on delete cascade,
  name text not null default '',
  duration real not null default 0,
  objects integer not null default 0,
  bytes integer not null default 0,
  data jsonb not null,
  edits jsonb,
  created_at timestamptz not null default now(),
  edited_at timestamptz
);

create index if not exists webcapture_recordings_session on public.webcapture_recordings(session_id, created_at desc);
create index if not exists webcapture_sessions_owner on public.webcapture_sessions(owner_id, status);

alter table public.webcapture_sessions enable row level security;
alter table public.webcapture_recordings enable row level security;
revoke all on public.webcapture_sessions, public.webcapture_recordings from public, anon, authenticated;

-- 6 characters from an alphabet without look-alikes (no 0/O, 1/I/L): 31^6 ≈ 887 million codes.
create or replace function public.webcapture_new_code() returns text
language plpgsql volatile set search_path = '' as $$
declare
  alphabet constant text := '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
  candidate text;
begin
  loop
    candidate := '';
    for i in 1..6 loop
      candidate := candidate || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    exit when not exists(select 1 from public.webcapture_sessions where code = candidate);
  end loop;
  return candidate;
end $$;

-- Lens: open a session. Returns {id, code}.
create or replace function public.webcapture_create_session(p_lens text default '') returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  row_id uuid;
  new_code text;
begin
  if uid is null then raise exception 'Sign in first (Snapchat or anonymous)'; end if;
  update public.webcapture_sessions set status = 'ended' where owner_id = uid and status = 'live' and expires_at <= now();
  if (select count(*) from public.webcapture_sessions where owner_id = uid and status = 'live') >= 10 then
    -- Close the oldest open sessions instead of failing: a Lens restarted many times in a row.
    update public.webcapture_sessions set status = 'ended'
    where id in (select id from public.webcapture_sessions where owner_id = uid and status = 'live' order by created_at asc limit 1);
  end if;
  new_code := public.webcapture_new_code();
  insert into public.webcapture_sessions(code, owner_id, lens) values (new_code, uid, left(coalesce(p_lens, ''), 80))
  returning id into row_id;
  return jsonb_build_object('id', row_id, 'code', new_code);
end $$;

-- Lens: publish the latest scene snapshot. Returns the new revision.
create or replace function public.webcapture_publish_scene(p_session uuid, p_revision bigint, p_scene jsonb) returns bigint
language plpgsql security definer set search_path = '' as $$
declare
  next_rev bigint;
begin
  if octet_length(p_scene::text) > 512 * 1024 then raise exception 'Scene larger than 512 KB'; end if;
  if coalesce(p_scene->>'format', '') <> 'webcapture-scene/1' then raise exception 'Not a webcapture-scene/1 snapshot'; end if;
  update public.webcapture_sessions
     set scene = p_scene, revision = greatest(revision, p_revision) + 1, updated_at = now()
   where id = p_session and owner_id = auth.uid() and status = 'live' and expires_at > now()
  returning revision into next_rev;
  if next_rev is null then raise exception 'Session not found, ended or not yours'; end if;
  return next_rev;
end $$;

-- Lens: save a recording into its session. Returns the recording id.
create or replace function public.webcapture_save_recording(p_session uuid, p_recording jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  rec_id uuid;
  size integer := octet_length(p_recording::text);
begin
  if size > 6 * 1024 * 1024 then raise exception 'Recording larger than 6 MB'; end if;
  if coalesce(p_recording->>'format', '') <> 'webcapture/1' then raise exception 'Not a webcapture/1 recording'; end if;
  if not exists(select 1 from public.webcapture_sessions where id = p_session and owner_id = auth.uid() and expires_at > now()) then
    raise exception 'Session not found or not yours';
  end if;
  if (select count(*) from public.webcapture_recordings where session_id = p_session) >= 50 then
    raise exception 'This session already has 50 recordings: restart the Lens to open a new session';
  end if;
  insert into public.webcapture_recordings(session_id, name, duration, objects, bytes, data)
  values (p_session, left(coalesce(p_recording#>>'{meta,name}', ''), 140),
          coalesce((p_recording#>>'{meta,duration}')::real, 0),
          coalesce(jsonb_array_length(p_recording->'objects'), 0), size, p_recording - 'edits')
  returning id into rec_id;
  return rec_id;
end $$;

-- Lens: end the session (the portal shows it as ended; recordings stay until the session expires).
create or replace function public.webcapture_end_session(p_session uuid) returns void
language sql security definer set search_path = '' as $$
  update public.webcapture_sessions set status = 'ended', updated_at = now() where id = p_session and owner_id = auth.uid()
$$;

-- Portal: the session's latest scene, by code.
create or replace function public.webcapture_get_session(p_code text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('code', code, 'lens', lens, 'status', status, 'revision', revision, 'scene', scene, 'updated_at', updated_at)
    from public.webcapture_sessions
   where code = upper(trim(p_code)) and expires_at > now()
$$;

-- Portal: the session's recordings (newest first) as one JSON array, without the data.
drop function if exists public.webcapture_list_recordings(text);
create or replace function public.webcapture_list_recordings(p_code text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', r.id, 'name', r.name, 'duration', r.duration, 'objects', r.objects, 'bytes', r.bytes,
                                               'created_at', r.created_at, 'edited', r.edits is not null) order by r.created_at desc), '[]'::jsonb)
    from public.webcapture_recordings r join public.webcapture_sessions s on s.id = r.session_id
   where s.code = upper(trim(p_code)) and s.expires_at > now()
$$;

-- Portal: one recording with its edits.
create or replace function public.webcapture_get_recording(p_code text, p_id uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('data', r.data, 'edits', r.edits)
    from public.webcapture_recordings r join public.webcapture_sessions s on s.id = r.session_id
   where s.code = upper(trim(p_code)) and r.id = p_id and s.expires_at > now()
$$;

-- Portal: save edits (trim, cuts, look, titles, camera shots). The recorded tracks never change.
create or replace function public.webcapture_save_edits(p_code text, p_id uuid, p_edits jsonb) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  if octet_length(p_edits::text) > 512 * 1024 then raise exception 'Edits larger than 512 KB'; end if;
  update public.webcapture_recordings r set edits = p_edits, edited_at = now()
    from public.webcapture_sessions s
   where s.id = r.session_id and s.code = upper(trim(p_code)) and r.id = p_id and s.expires_at > now();
  return found;
end $$;

revoke all on function public.webcapture_new_code() from public, anon, authenticated;
revoke all on function public.webcapture_create_session(text), public.webcapture_publish_scene(uuid, bigint, jsonb),
  public.webcapture_save_recording(uuid, jsonb), public.webcapture_end_session(uuid) from public, anon;
grant execute on function public.webcapture_create_session(text), public.webcapture_publish_scene(uuid, bigint, jsonb),
  public.webcapture_save_recording(uuid, jsonb), public.webcapture_end_session(uuid) to authenticated;
revoke all on function public.webcapture_get_session(text), public.webcapture_list_recordings(text),
  public.webcapture_get_recording(text, uuid), public.webcapture_save_edits(text, uuid, jsonb) from public;
grant execute on function public.webcapture_get_session(text), public.webcapture_list_recordings(text),
  public.webcapture_get_recording(text, uuid), public.webcapture_save_edits(text, uuid, jsonb) to anon, authenticated;

commit;

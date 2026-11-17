-- Web Capture: run this ONE file in the project's SQL Editor (safe to re-run). It is storage.sql + fixed-code.sql.
begin;
-- Web Capture 4.0.0 — Snap Cloud Storage for the heavy parts of a recording. Paste into the project's
-- SQL Editor and run once (safe to re-run). Requires setup.sql to have run first.
--
-- Why: a recording with real meshes, textures and the camera background is far bigger than the 6 MB a
-- database row may hold (a 10 s capture on Specs is ~10 MB). The Lens uploads the full recording as one
-- JSON file here and saves only a small row (meta.storage = {bucket, path, bytes}) through
-- webcapture_save_recording. The portal reads the row by session code, then downloads the file.
--
-- Privacy: the bucket is public-read but files are named <session uuid>/<recording id>.json. The session
-- uuid is never shown (the portal only knows the 6-character code); it is returned only together with a
-- recording row, so you need the code to find a file. Treat the code like a link: whoever has it can see
-- the camera frames in the recording. Camera frames are only recorded when the Lens turns on Capture
-- Background (on Specs: Use NDK Camera).
--
-- Only the signed-in owner of a live session can upload, and only into that session's folder.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('webcapture', 'webcapture', true, 52428800, array['application/json'])
on conflict (id) do update
  set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- The policy cannot read webcapture_sessions itself (clients have no table privileges), so it asks this
-- SECURITY DEFINER function: true only when the folder is a live session owned by the caller.
create or replace function public.webcapture_owns_session(p_folder text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(
    select 1 from public.webcapture_sessions s
     where s.id::text = p_folder and s.owner_id = auth.uid() and s.expires_at > now()
  )
$$;
revoke all on function public.webcapture_owns_session(text) from public, anon;
grant execute on function public.webcapture_owns_session(text) to authenticated;

drop policy if exists "webcapture owner uploads" on storage.objects;
create policy "webcapture owner uploads" on storage.objects for insert to authenticated
  with check (bucket_id = 'webcapture' and public.webcapture_owns_session((storage.foldername(name))[1]));


-- Web Capture 4.0.0 — a fixed capture code per project. Paste into the project's SQL Editor and run once
-- (safe to re-run). Requires setup.sql.
--
-- The Lens can now ask for a code of your choice (the "Capture Code" input). The same code is reused on every
-- run, so the portal shows all your captures under that one code and nobody has to type a new code per run.
-- A code that already belongs to another account is refused. Pick a long random one: the code is the key to
-- the recordings (and their camera frames). Leave the input empty to keep the old random code per run.

drop function if exists public.webcapture_create_session(text);
create or replace function public.webcapture_create_session(p_lens text default '', p_code text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  row_id uuid;
  new_code text;
  wanted text := nullif(upper(trim(coalesce(p_code, ''))), '');
begin
  if uid is null then raise exception 'Sign in first (Snapchat or anonymous)'; end if;
  if wanted is not null and wanted !~ '^[A-Z0-9-]{8,32}$' then
    raise exception 'Capture code: 8-32 letters, digits or dashes';
  end if;
  update public.webcapture_sessions set status = 'ended' where owner_id = uid and status = 'live' and expires_at <= now();

  if wanted is not null then
    -- Reuse the caller's session with this code (new run, same code); refuse a code owned by someone else.
    select id into row_id from public.webcapture_sessions where code = wanted and owner_id = uid;
    if row_id is not null then
      update public.webcapture_sessions
         set status = 'live', lens = left(coalesce(p_lens, ''), 80), updated_at = now(), expires_at = now() + interval '30 days'
       where id = row_id;
      return jsonb_build_object('id', row_id, 'code', wanted);
    end if;
    if exists(select 1 from public.webcapture_sessions where code = wanted) then
      raise exception 'This capture code is already used by another account: choose a different one';
    end if;
    new_code := wanted;
  else
    if (select count(*) from public.webcapture_sessions where owner_id = uid and status = 'live') >= 10 then
      update public.webcapture_sessions set status = 'ended'
      where id in (select id from public.webcapture_sessions where owner_id = uid and status = 'live' order by created_at asc limit 1);
    end if;
    new_code := public.webcapture_new_code();
  end if;

  insert into public.webcapture_sessions(code, owner_id, lens) values (new_code, uid, left(coalesce(p_lens, ''), 80))
  returning id into row_id;
  return jsonb_build_object('id', row_id, 'code', new_code);
end $$;

revoke all on function public.webcapture_create_session(text, text) from public, anon;
grant execute on function public.webcapture_create_session(text, text) to authenticated;


commit;

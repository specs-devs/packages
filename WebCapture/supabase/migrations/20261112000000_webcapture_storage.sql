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
begin;

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

commit;

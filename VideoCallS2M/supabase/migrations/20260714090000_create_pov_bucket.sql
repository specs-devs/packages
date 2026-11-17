-- POV streaming bucket for Watch Your Back / Call Friend (walkie-talkie v1).
--
-- Layout: pov/<session>/<streamer>/latest.jpg      (upserted ~1-2 fps)
--         pov/<session>/<streamer>/ahead.txt       (latest audio chunk seq)
--         pov/<session>/<streamer>/a<seq>.wav      (2 s audio chunks)
-- Streamers: phoneA (bonded phone), phoneB (friend phone), glasses.
--
-- PROTOTYPE POLICY: the anon role may write to this bucket so the iOS
-- companion apps can upload with just the public key (no auth flow).
-- Scoped strictly to bucket_id = 'pov'. Tighten before any production use.

INSERT INTO storage.buckets (id, name, public)
  VALUES ('pov', 'pov', true)
  ON CONFLICT DO NOTHING;

CREATE POLICY "pov_public_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'pov');

CREATE POLICY "pov_open_insert" ON storage.objects
  FOR INSERT TO anon, authenticated
  WITH CHECK (bucket_id = 'pov');

CREATE POLICY "pov_open_update" ON storage.objects
  FOR UPDATE TO anon, authenticated
  USING (bucket_id = 'pov')
  WITH CHECK (bucket_id = 'pov');

CREATE POLICY "pov_open_delete" ON storage.objects
  FOR DELETE TO anon, authenticated
  USING (bucket_id = 'pov');

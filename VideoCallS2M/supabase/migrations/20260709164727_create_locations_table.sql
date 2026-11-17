CREATE TABLE locations (
  id          uuid             DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     uuid             REFERENCES auth.users(id),
  session_id  text             NOT NULL,
  role        text             NOT NULL CHECK (role IN ('self','friend')),
  device_name text,
  lat         double precision NOT NULL,
  lon         double precision NOT NULL,
  accuracy    double precision,
  heading     double precision,
  recorded_at timestamptz      DEFAULT now() NOT NULL
);
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_insert" ON locations FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own_read"   ON locations FOR SELECT USING (auth.uid() = user_id);
CREATE INDEX locations_session_time ON locations (session_id, recorded_at);

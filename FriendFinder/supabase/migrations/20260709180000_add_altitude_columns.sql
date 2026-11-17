-- Altitude support: GPS altitude + vertical accuracy (meters) and raw
-- barometric pressure (kPa) per fix. Pressure differences between two nearby
-- phones give ~1 m relative height (weather cancels in the difference).
alter table public.locations
  add column if not exists alt double precision,
  add column if not exists v_acc double precision,
  add column if not exists pressure_kpa double precision;

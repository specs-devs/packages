-- Snap Cloud mailbox for the Glasses ↔ Glasses video call (Video Call S2S).
--
-- ONE table carries everything the two Glasses exchange through the cloud:
--   • the pairing handshake  — kind 'ring' | 'accept' | 'decline' | 'busy' | 'bye'
--   • the WebRTC signaling   — kind 'pov', t = 'offer' | 'answer' | 'cand'
--   • best-effort telemetry  — kind 'diag' (JSON in `sdp`, no IPs)
-- The media itself is peer-to-peer WebRTC and never touches the database.
--
-- Each Glasses shows a 4-digit pairing code. A call's `session` is derived from
-- the CALLEE's code ("s2s-<code>"); both peers insert rows there with their own
-- code as `sender` and poll for rows whose sender is not them
-- (WHERE session = ? AND sender <> <me> AND id > <cursor> ORDER BY id).
-- Rows are exchanged over PostgREST (HTTPS polling) — the Snap Cloud Realtime
-- WebSocket did not reach SUBSCRIBED on device, the REST API does.

create table if not exists public.rtc_signals (
    id         bigint generated always as identity primary key,
    session    text not null,               -- call session ("s2s-<callee code>")
    kind       text not null,               -- 'pov' | 'ring' | 'accept' | 'decline' | 'busy' | 'bye' | 'diag'
    sender     text not null,               -- the sender's pairing code
    t          text not null,               -- 'offer' | 'answer' | 'cand' | <kind> for lifecycle rows
    sdp        text,
    cand       text,
    mid        text,
    created_at timestamptz not null default now()
);

create index if not exists rtc_signals_session_id_idx
    on public.rtc_signals (session, id);

alter table public.rtc_signals enable row level security;

-- PROTOTYPE POLICY: each Glasses authenticates with its Snapchat id-token
-- (authenticated); the Lens Studio preview falls back to anonymous sign-in
-- (anon). Both peers must write their own rows and read the other's, so allow
-- both roles full access. Tighten (scope by session ownership) before any
-- non-prototype use.
create policy "rtc_open_insert" on public.rtc_signals
    for insert to anon, authenticated with check (true);
create policy "rtc_open_select" on public.rtc_signals
    for select to anon, authenticated using (true);
create policy "rtc_open_delete" on public.rtc_signals
    for delete to anon, authenticated using (true);

-- Housekeeping: signaling rows are worthless minutes after a call. Run this
-- periodically (pg_cron or a manual sweep) to keep the table small.
--   delete from public.rtc_signals where created_at < now() - interval '1 day';

-- WebRTC signaling mailbox for Call Friend.
--
-- The Realtime WebSocket on this Snap Cloud project won't answer channel joins
-- on device (see WEBRTC-CALL.md), and the BLE phone-relay is too unstable for
-- WebRTC's ICE handshake. So SDP/ICE is exchanged as ROWS over the Postgres
-- REST API (PostgREST/HTTPS), which works fine on device — each peer inserts
-- its outbound signals and polls for the other peer's rows. The media itself
-- stays peer-to-peer WebRTC; only these tiny signaling messages touch the DB.

create table if not exists public.rtc_signals (
    id         bigint generated always as identity primary key,
    session    text not null,               -- call session code (wrp-…)
    kind       text not null,               -- 'pov' | 'voice'
    sender     text not null,               -- 'glasses' | 'phoneB'
    t          text not null,               -- 'offer' | 'answer' | 'cand'
    sdp        text,
    cand       text,
    mid        text,
    created_at timestamptz not null default now()
);

-- Poll pattern: WHERE session = ? AND sender = <other> AND id > <cursor> ORDER BY id.
create index if not exists rtc_signals_session_id_idx
    on public.rtc_signals (session, id);

alter table public.rtc_signals enable row level security;

-- PROTOTYPE POLICY: the Glasses authenticates (snapchat id-token → authenticated)
-- and the friend phone uses the public anon key (anon). Both peers must be able
-- to write their own signals and read the other's, so allow both roles full
-- access to this signaling table. Tighten (scope by session ownership) before
-- any non-prototype use.
create policy "rtc_open_insert" on public.rtc_signals
    for insert to anon, authenticated with check (true);
create policy "rtc_open_select" on public.rtc_signals
    for select to anon, authenticated using (true);
create policy "rtc_open_delete" on public.rtc_signals
    for delete to anon, authenticated using (true);

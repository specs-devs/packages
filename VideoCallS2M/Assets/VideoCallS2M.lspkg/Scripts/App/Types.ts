// Types — shared constants + types for the VideoCallS2M mode system.
//
// Modes (picked on the Glasses start menu, ModeMenuUI):
//   watchYourBack — render the POV of one phone on a panel.
//   callFriend    — walkie-talkie: both POVs + voice chunks, live.
//   findFriend    — the original AR guidance feature.
// watchYourBack and callFriend are mutually exclusive; findFriend combines
// with either.
//
// Streaming transport (v2): Supabase Realtime broadcast — one channel per
// session (povChannelName), events `frame:<streamer>` / `audio:<streamer>`
// with the payload shapes below. Realtime.ts owns the channel on the
// Lens side; iOS/VideoCallS2M/RealtimeClient.swift speaks the same protocol.
// (v1 upserted JPEG/WAV files into the `pov` storage bucket and polled public
// URLs — 2-4 s behind. The bucket and its migration remain but are unused.)

export const STREAMER_PHONE_BONDED = "phoneA"
export const STREAMER_PHONE_FRIEND = "phoneB"
export const STREAMER_GLASSES = "glasses"
export const ALL_STREAMERS = [STREAMER_PHONE_BONDED, STREAMER_PHONE_FRIEND, STREAMER_GLASSES]

export interface ModeSelection {
    watchYourBack: boolean
    callFriend: boolean
    findFriend: boolean
    /**
     * Which phone streams in watchYourBack mode. Always "phoneA" (the
     * wearer's own bonded phone) since the menu redesign; kept on the wire
     * for iOS compatibility.
     */
    source: "phoneA" | "phoneB"
    /**
     * Find Friend self-location source, chosen on the start menu's GPS switch:
     *   true  — the iPhone's GPS relayed over Mobile Kit (the default, "Mobile
     *           application"). UWB refines the final approach.
     *   false — Glasses' own GeoLocation service.
     * Purely a Glasses-side decision (the phone always sends its fix either way),
     * so it never touches the wire — VideoCallS2MManager applies it locally.
     */
    usePhoneLocation: boolean
}

/** Realtime broadcast channel for a session's POV + audio streams. */
export function povChannelName(session: string): string {
    return "pov-" + session
}

/** `frame:<streamer>` payload — one JPEG video frame. */
export interface FramePayload {
    /** Base64 JPEG. */
    d: string
    /** Frame sequence number. */
    n: number
    /** Sender epoch ms. */
    t: number
}

/** `audio:<streamer>` payload — one voice chunk. */
export interface AudioPayload {
    /** Base64 WAV (16-bit PCM mono). */
    d: string
    /** Chunk sequence number. */
    n: number
    /** Sample rate in Hz. */
    r: number
    /** Sender epoch ms. */
    t: number
}

/**
 * WebRTC signaling kinds — two independent peer sessions per call:
 *   pov   — Glasses OFFERS (sends camera H.264 + mic Opus); the phone answers.
 *   voice — the PHONE offers (sends its mic Opus); Glasses answers.
 * Signaling rides the same Realtime channel as event `rtc:<kind>:<from>`.
 */
// "bye" is a call-lifecycle hangup (not media): whichever side ends the call
// posts a `bye` on the DB mailbox so the other end tears down too — the one
// channel both call peers share regardless of network (multipeer is local-only).
// It rides the RtcMailbox only, so it is intentionally NOT in RTC_KINDS (which
// drives the unused Realtime-channel bindings / the media session kinds).
export type RtcKind = "pov" | "voice" | "friendvid" | "bye"
export const RTC_KINDS: RtcKind[] = ["pov", "voice", "friendvid"]

export function rtcEventName(kind: RtcKind, from: string): string {
    return "rtc:" + kind + ":" + from
}

/** `rtc:<kind>:<from>` payload — one SDP description, ICE candidate, or a
 *  `bye` hangup (kind "bye"; sdp/cand/mid all unused). */
export interface RtcSignalPayload {
    t: "offer" | "answer" | "cand" | "bye"
    sdp?: string
    cand?: string
    mid?: string
}

/**
 * Transport that ferries WebRTC signaling (SDP/ICE) between the Glasses and the
 * friend's phone. WebRTCSession depends only on this — it doesn't care
 * whether the bytes ride Supabase Realtime (Realtime, legacy) or the
 * Mobile Kit → phoneA → Multipeer → phoneB relay (MobileKitLink, the WebRTC-only
 * call path that needs no cloud). Both implement this shape.
 */
export interface RtcSignalTransport {
    /** True when the underlying link can actually carry a message right now. */
    readonly isConnected: boolean
    onRtcSignal(kind: RtcKind, from: string, cb: (p: RtcSignalPayload) => void): void
    offRtcSignal(kind: RtcKind, from: string): void
    sendRtcSignal(kind: RtcKind, from: string, payload: RtcSignalPayload): boolean
    /**
     * Optional: write a fire-and-forget diagnostic snapshot (ICE states +
     * candidate counts, NO IPs) somewhere retrievable off-device. Only the DB
     * mailbox implements it; it lets us read the Glasses' side of a stuck call
     * without the flaky USB log tether. Carries no signaling meaning — the peer
     * pollers ignore the "diag" kind.
     */
    sendDiag?(state: string): void
}

/** Envelope for one signaling message carried over the phone relay (MobileKitLink). */
export interface RtcRelayMessage {
    type: "rtc"
    kind: RtcKind
    from: string
    sig: RtcSignalPayload
}

export function makeSessionCode(): string {
    return "wrp-" + Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36)
}

/**
 * Call Friend transport selection — the 3-way switch on the VideoCallS2M
 * inspector (`callTransport`). Numeric so it maps directly onto a ComboBox
 * `@input("int")`. All three degrade to STREAMING behaviour in the Lens Studio
 * preview, where the native WebRTC `.so` cannot load.
 *
 *   AUTO      — start on streaming, auto-upgrade to WebRTC when the peer
 *               connects, auto-degrade back on drop. Today's behaviour.
 *   WEBRTC    — force the WebRTC media path (device only). Streaming still
 *               bootstraps the call during negotiation and remains the voice
 *               fallback, but the video capture is NOT churned back to JPEG on
 *               a transient pov drop — WebRTC re-offers and recovers itself.
 *   STREAMING — JPEG/WAV over Realtime only; WebRTC is never attempted.
 */
export const CALL_TRANSPORT_AUTO = 0
export const CALL_TRANSPORT_WEBRTC = 1
export const CALL_TRANSPORT_STREAMING = 2

/** Short tag for the call caption / logs. */
export function callTransportLabel(mode: number): string {
    return mode === CALL_TRANSPORT_WEBRTC ? "webrtc"
        : mode === CALL_TRANSPORT_STREAMING ? "streaming"
        : "auto"
}

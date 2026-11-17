// Types — shared constants + types for the Remote Assistance call system.
//
// One mode: the remote-assistance call. The helper joins from a web browser
// (the package's web/ portal); they see the wearer's POV, two-way voice, and
// they can DRAW on their screen — the strokes render as 3D lines anchored in
// the wearer's world.
//
// Media transport: peer-to-peer WebRTC (H.264 + Opus). Signaling (SDP/ICE) and
// the drawing channel ride the Snap Cloud DB mailbox (RtcMailbox — rows in the
// `rtc_signals` table over PostgREST), the one channel both call peers share
// regardless of network.

// Wire sender ids in `rtc_signals` rows. "phoneB" is kept from the phone era
// so existing sessions/tools keep parsing — it now identifies the WEB helper.
export const STREAMER_HELPER = "phoneB"
export const STREAMER_GLASSES = "glasses"

/**
 * WebRTC signaling kinds — two independent peer sessions per call:
 *   pov   — Glasses OFFERS (sends camera H.264 + mic Opus; the helper's camera
 *           can ride back on the same duplex session); the helper answers.
 *   voice — the HELPER offers (sends its mic Opus); Glasses answers.
 * Signaling rides the DB mailbox as rows keyed (kind, sender).
 */
// "bye" is a call-lifecycle hangup (not media): whichever side ends the call
// posts a `bye` on the DB mailbox so the other end tears down too — the one
// channel both call peers share regardless of network.
// "draw" is the remote-assistance annotation channel: the helper draws on the
// POV video they are watching and posts stroke rows; the Glasses renders them
// as 3D lines in the wearer's world (AnnotationRenderer). Like "bye" it rides
// the DB mailbox only — it is NOT a media session kind, so it is
// intentionally NOT in RTC_KINDS.
export type RtcKind = "pov" | "voice" | "friendvid" | "bye" | "draw"
export const RTC_KINDS: RtcKind[] = ["pov", "voice", "friendvid"]

export function rtcEventName(kind: RtcKind, from: string): string {
    return "rtc:" + kind + ":" + from
}

/** `rtc:<kind>:<from>` payload — one SDP description, ICE candidate, a `bye`
 *  hangup, or a drawing message ("stroke"/"clear" — JSON rides `sdp`, see
 *  Drawing/AnnotationTypes.ts). */
export interface RtcSignalPayload {
    t: "offer" | "answer" | "cand" | "bye" | "stroke" | "clear"
    sdp?: string
    cand?: string
    mid?: string
}

/**
 * Transport that ferries WebRTC signaling (SDP/ICE) — and the drawing
 * channel — between the Glasses and the helper. WebRTCSession and
 * AnnotationRenderer depend only on this shape.
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

export function makeSessionCode(): string {
    return "wrp-" + Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36)
}

/**
 * Call transport selection — kept for WebRTCSession. All values degrade to
 * STREAMING behaviour in the Lens Studio preview, where the native WebRTC
 * `.so` cannot load.
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

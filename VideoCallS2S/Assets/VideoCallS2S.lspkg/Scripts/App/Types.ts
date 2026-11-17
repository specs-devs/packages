// Types — shared constants + types for Video Call S2S: a Glasses ↔ Glasses video call.
//
// Roles: the wearer who taps CALL FRIEND is the CALLER (the WebRTC offerer); the
// wearer who accepts the incoming call is the CALLEE (the answerer). One duplex
// WebRTC PeerConnection per call carries both cameras (H.264) and both mics
// (Opus) peer-to-peer. Snap Cloud carries only the small stuff — the pairing
// handshake (ring / accept / decline / busy / bye) and the SDP/ICE signaling —
// as rows in the `rtc_signals` table (see SnapCloud/RtcMailbox.ts).
//
// Pairing: every Glasses shows a 4-digit code on its home screen. Calling a friend
// means typing THEIR code: the call's mailbox session is derived from the
// callee's code (callSessionId), the caller rings into it, and both peers write
// rows there tagged with their own code as `sender`.

export const APP_TITLE = "VIDEO CALL S2S"

export type CallRole = "caller" | "callee"

/**
 * Row kinds on the Snap Cloud mailbox. `pov` carries the WebRTC signaling
 * (offer / answer / cand) for the one media session; the others are the
 * call-lifecycle handshake. `diag` rows are best-effort telemetry the peer ignores.
 */
export type RtcKind = "pov" | "ring" | "accept" | "decline" | "busy" | "bye" | "diag"

export type RtcSignalType =
    "offer" | "answer" | "cand" | "ring" | "accept" | "decline" | "busy" | "bye" | "diag"

/** One mailbox row payload: an SDP description, an ICE candidate, or a
 *  lifecycle message (sdp / cand / mid unused). */
export interface RtcSignalPayload {
    t: RtcSignalType
    sdp?: string
    cand?: string
    mid?: string
}

/**
 * Transport that ferries signaling between the two Glasses. WebRTCSession and the
 * manager depend only on this shape; RtcMailbox (Snap Cloud DB polling) is the
 * one implementation. Handlers receive the sender's pairing code as `from`.
 */
export interface RtcSignalTransport {
    /** True when the underlying link can actually carry a message right now. */
    readonly isConnected: boolean
    onRtcSignal(kind: RtcKind, cb: (p: RtcSignalPayload, from: string) => void): void
    offRtcSignal(kind: RtcKind): void
    sendRtcSignal(kind: RtcKind, payload: RtcSignalPayload): boolean
    /** Optional fire-and-forget diagnostic snapshot (ICE states, counters, NO IPs). */
    sendDiag?(state: string): void
}

// ── Pairing codes ─────────────────────────────────────────────────────────

export const PAIRING_CODE_LENGTH = 4

/** A fresh random pairing code for this Glasses (digits only — numpad friendly). */
export function makePairingCode(): string {
    let code = ""
    for (let i = 0; i < PAIRING_CODE_LENGTH; i++) {
        code += Math.floor(Math.random() * 10).toString()
    }
    return code
}

/** Digits-only normalization of a typed code; null unless exactly PAIRING_CODE_LENGTH digits. */
export function normalizePairingCode(raw: string): string | null {
    const digits = (raw || "").replace(/\D/g, "")
    return digits.length === PAIRING_CODE_LENGTH ? digits : null
}

/** The mailbox session both peers of a call share — keyed by the CALLEE's code. */
export function callSessionId(calleeCode: string): string {
    return "s2s-" + calleeCode
}

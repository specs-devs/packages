// WebRTCSession — drives the native duplex call session from JS.
//
// ONE PeerConnection per call carries everything: this Glasses' camera (H.264) +
// mic (Opus) out, the friend's camera + voice in. Signaling is MANUAL — SDP/ICE
// ride the RtcSignalTransport (Snap Cloud DB rows), the media flows peer-to-peer
// over RTP/SRTP.
//
//   caller — creates the session as OFFERER: the native module generates the
//            offer immediately; we ferry {offer, cand} out and apply the callee's
//            {answer, cand}. Re-offers (fresh ICE) after RETRY_S without a connect.
//   callee — creates the session as ANSWERER when the caller's offer arrives
//            (a FRESH session per offer, so a re-offer after a drop never hits a
//            stale PC), applies it, and ferries the generated {answer, cand} out.
//
// Both roles pull decoded friend-camera frames (pullInboundFrame → RGBA) and
// friend-voice PCM (rtcPollAudio, JS fallback while the native speaker is off).

import {
    NativeRtcAudio,
    NativeRtcSignal,
    RTC_KIND_FRIENDVID,
    RTC_KIND_POV,
    RTC_KIND_VOICE,
    RTC_ROLE_ANSWERER,
    RTC_ROLE_OFFERER,
    RTC_STATE_CLOSED,
    RTC_STATE_CONNECTED,
    RTC_STATE_FAILED,
    RTC_STATE_NEW,
    S2S_MODULE_GENERATION,
    VideoCallS2SWebRTCNativeExports,
} from "./WebRTCNativeModule"
import { CallRole, RtcSignalPayload, RtcSignalTransport } from "../App/Types"

// Public STUN keeps the prototype working across home NATs; empty string =
// LAN-only host candidates. Symmetric/corporate NAT has NO direct P2P path —
// the ONLY fix is a TURN relay. Drop an APPROVED-INFRA TURN URI here with
// embedded long-term credentials:
//   const TURN_URL = "turn:USER:CRED@turn.<approved-host>:3478?transport=udp"
// libdatachannel parses the credentialed `turn:` URI directly (no native rebuild).
const TURN_URL = ""
const STUN_URL = "stun:stun.l.google.com:19302"
const ICE_URL = TURN_URL || STUN_URL
// Bump on every lens change — surfaces in the DB diag as `v`.
const LENS_BUILD_TAG = "s2s-v1"
// POV video bitrate presets (kbps); rtcSetBitrate reaches the HW encoder live.
export const VIDEO_QUALITY_PRESETS_KBPS = [1000, 2000, 3500]
const VIDEO_BITRATE_DEFAULT_KBPS = 1000
// Encoder quality floor (max H.264 QP; 0 = encoder default). Capping it makes
// the encoder drop fps instead of quality under head motion.
const VIDEO_MAX_QP = 36
const VIDEO_FPS = 24
const VIDEO_MAX_WIDTH = 640
// Caller re-offers if the session hasn't (re)connected within this window.
const RETRY_S = 15
// Friend-camera pull cadence (~12/s): each pull is a ~1 MB bridge copy + GPU upload.
const FRIEND_PULL_INTERVAL_S = 1 / 12
const FRIEND_MAX_W = 1280
const FRIEND_MAX_H = 720

export class WebRTCSession {
    private pump: UpdateEvent | null = null
    private running = false
    private createdAt = 0
    private wasConnected = false
    private outSig = 0
    private inCand = 0
    private lastStateLogAt = 0
    // Callee: ICE candidates that land before the offer created the session.
    private pendingCands: { cand: string; mid: string }[] = []
    // Persistent RGBA scratch reused every pull — zero per-frame alloc.
    private friendRgba: Uint8Array | null = null
    private lastFriendPullAt = 0
    private friendFramesPulled = 0
    private povBitrateKbps = VIDEO_BITRATE_DEFAULT_KBPS

    /** Decoded friend-voice PCM (S16 mono bytes + sample rate) — JS speaker fallback. */
    onVoicePcm: ((pcm: Uint8Array, rate: number) => void) | null = null
    /** Fired when the call session connects/disconnects. */
    onConnected: ((connected: boolean) => void) | null = null
    /** Newest decoded friend-camera frame (RGBA8, w*h*4, vertically flipped). */
    onFriendVideoFrame: ((rgba: Uint8Array, width: number, height: number) => void) | null = null
    /** Extra key/values merged into the DB diag snapshot. */
    diagExtra: (() => { [k: string]: number | string }) | null = null

    constructor(
        private readonly script: BaseScriptComponent,
        private readonly sig: RtcSignalTransport,
        private readonly native: VideoCallS2SWebRTCNativeExports,
        readonly role: CallRole
    ) {}

    /** Whether this module build can run a Glasses ↔ Glasses call (answerer role + duplex audio). */
    static isS2SCapable(native: VideoCallS2SWebRTCNativeExports): boolean {
        try {
            return native.ping() >= S2S_MODULE_GENERATION
        } catch (e) {
            return false
        }
    }

    get connected(): boolean {
        return this.native.rtcState(RTC_KIND_POV) === RTC_STATE_CONNECTED
    }

    /** One-liner for the call caption. */
    statusLine(): string {
        const s = this.native.rtcState(RTC_KIND_POV)
        return "rtc " + (s === RTC_STATE_CONNECTED ? "✓" : s < 0 ? "–" : "…")
    }

    // Insert the H.264 fmtp if an SDP lacks it (iOS-era safety net; the engine
    // already declares profile-level-id + packetization-mode, so this is a no-op
    // between two Glasses).
    private static addH264Fmtp(sdp: string): string {
        if (/a=fmtp:\d+ [^\r\n]*packetization-mode/.test(sdp)) return sdp
        return sdp.replace(
            /(a=rtpmap:(\d+) H264\/90000\r?\n)/g,
            (_m, line, pt) => line +
                "a=fmtp:" + pt +
                " level-asymmetry-allowed=1;packetization-mode=1;profile-level-id=42e01f\r\n")
    }

    start(): void {
        if (this.running) return
        this.running = true
        this.sig.onRtcSignal("pov", (p) => this.onPovSignal(p))
        // The caller offers right away; the callee's session is created when the
        // offer arrives (see onPovSignal) so every offer gets a fresh PC.
        if (this.role === "caller") this.createSession()
        this.pump = this.script.createEvent("UpdateEvent")
        this.pump.bind(() => this.tick())
        print("[S2S-RTC] Session started as " + this.role + ".")
    }

    stop(): void {
        if (!this.running) return
        this.running = false
        if (this.pump) this.pump.enabled = false
        this.pump = null
        this.sig.offRtcSignal("pov")
        this.native.rtcStop(RTC_KIND_POV)
        this.native.rtcStop(RTC_KIND_VOICE)
        this.native.rtcStop(RTC_KIND_FRIENDVID)
        if (this.wasConnected && this.onConnected) this.onConnected(false)
        this.wasConnected = false
        this.pendingCands = []
    }

    /** Mic PCM (S16 mono, base64) → Opus over the call session (JS mic fallback). */
    sendMicPcm(b64Pcm: string, sampleRate: number): boolean {
        return this.native.rtcSendAudio(b64Pcm, sampleRate) === 0
    }

    nativeMicSupported(): boolean {
        return typeof this.native.rtcMicStart === "function" &&
            typeof this.native.rtcMicState === "function"
    }

    startNativeMic(useFocus: boolean): boolean {
        if (!this.nativeMicSupported()) return false
        return this.native.rtcMicStart!(useFocus ? 1 : 0) === 0
    }

    stopNativeMic(): void {
        if (this.native.rtcMicStop) this.native.rtcMicStop()
    }

    /** 0 idle, 1 starting, 2 active, -1 failed (0 when unsupported). */
    nativeMicState(): number {
        return this.native.rtcMicState ? this.native.rtcMicState() : 0
    }

    /** PCM frames captured since the native mic last started; -1 when unsupported. */
    nativeMicFrames(): number {
        return this.native.rtcMicFrames ? this.native.rtcMicFrames() : -1
    }

    /** Receive-side audio stats ("rx_pkts=.. plc_frames=..") for the diag line. */
    audioRxStats(): string {
        return this.native.rtcAudioRxStats ? this.native.rtcAudioRxStats(RTC_KIND_POV) : ""
    }

    nativeSpeakerSupported(): boolean {
        return typeof this.native.rtcSpeakerStart === "function" &&
            typeof this.native.rtcSpeakerState === "function"
    }

    startNativeSpeaker(): boolean {
        if (!this.nativeSpeakerSupported()) return false
        return this.native.rtcSpeakerStart!() === 0
    }

    stopNativeSpeaker(): void {
        if (this.native.rtcSpeakerStop) this.native.rtcSpeakerStop()
    }

    /** 0 idle, 1 starting, 2 active, -1 failed (0 when unsupported). */
    nativeSpeakerState(): number {
        return this.native.rtcSpeakerState ? this.native.rtcSpeakerState() : 0
    }

    /** Live video quality change (kbps). Returns the applied kbps. */
    setVideoBitrate(kbps: number): number {
        const clamped = Math.max(300, Math.min(6000, Math.round(kbps)))
        this.povBitrateKbps = clamped
        const rc = this.native.rtcSetBitrate(clamped)
        print("[S2S-RTC] video bitrate -> " + clamped + " kbps (rc " + rc + ")")
        return clamped
    }

    get videoBitrateKbps(): number {
        return this.povBitrateKbps
    }

    /** (Re)create the native call session in this role. */
    private createSession(): void {
        const role = this.role === "caller" ? RTC_ROLE_OFFERER : RTC_ROLE_ANSWERER
        const rc = this.native.rtcCreate(
            RTC_KIND_POV, this.povBitrateKbps, VIDEO_FPS, VIDEO_MAX_WIDTH, ICE_URL,
            VIDEO_MAX_QP, role)
        this.createdAt = getTime()
        if (rc !== 0) print("[S2S-RTC] rtcCreate(" + this.role + ") failed: " + rc)
    }

    private onPovSignal(p: RtcSignalPayload): void {
        if (!this.running) return
        if (p.t === "offer" && p.sdp) {
            if (this.role !== "callee") {
                print("[S2S-RTC] Ignoring an offer — we are the caller.")
                return
            }
            // Every incoming offer gets a FRESH answering session: the caller
            // re-offers after a drop and a stale PC can't renegotiate.
            this.createSession()
            const rc = this.native.rtcSetRemoteDescription(RTC_KIND_POV, 0, p.sdp)
            print("[S2S-RTC] Offer applied (rc " + rc + ") — answering.")
            if (this.pendingCands.length > 0) {
                for (const c of this.pendingCands) {
                    this.native.rtcAddRemoteCandidate(RTC_KIND_POV, c.cand, c.mid)
                }
                print("[S2S-RTC] Flushed " + this.pendingCands.length + " buffered candidate(s).")
                this.pendingCands = []
            }
        } else if (p.t === "answer" && p.sdp) {
            if (this.role !== "caller") {
                print("[S2S-RTC] Ignoring an answer — we are the callee.")
                return
            }
            const rc = this.native.rtcSetRemoteDescription(RTC_KIND_POV, 1, p.sdp)
            print("[S2S-RTC] Answer applied (rc " + rc + ").")
        } else if (p.t === "cand" && p.cand) {
            const n = (this.inCand += 1)
            if (n <= 14) print("[S2S-RTC] in-cand #" + n + ": " + p.cand)
            // Only add once a session exists; before that (callee, pre-offer) buffer.
            if (this.native.rtcState(RTC_KIND_POV) >= RTC_STATE_NEW) {
                this.native.rtcAddRemoteCandidate(RTC_KIND_POV, p.cand, p.mid ?? "")
            } else {
                this.pendingCands.push({ cand: p.cand, mid: p.mid ?? "" })
            }
        }
    }

    // Per-frame: ferry outbound signaling, drain voice PCM, pull video, watch state.
    private tick(): void {
        if (!this.running) return

        // Hold outbound signaling in the native queue until the mailbox is up.
        if (this.sig.isConnected) {
            for (let i = 0; i < 8; i++) { // bounded drain per frame
                const raw = this.native.rtcPollSignal(RTC_KIND_POV)
                if (!raw) break
                let nativeSig: NativeRtcSignal
                try {
                    nativeSig = JSON.parse(raw) as NativeRtcSignal
                } catch (e) {
                    print("[S2S-RTC] Bad native signal JSON: " + e)
                    continue
                }
                if (nativeSig.sdp && (nativeSig.t === "offer" || nativeSig.t === "answer")) {
                    nativeSig.sdp = WebRTCSession.addH264Fmtp(nativeSig.sdp)
                }
                this.sig.sendRtcSignal("pov", nativeSig as RtcSignalPayload)
                const n = (this.outSig += 1)
                if (n <= 14 || n % 25 === 0) {
                    const detail = nativeSig.t === "cand" ? ": " + (nativeSig.cand ?? "") : ""
                    print("[S2S-RTC] out #" + n + " " + nativeSig.t + detail)
                }
            }
        }

        // Friend voice: decoded PCM (only flows while the native speaker isn't ACTIVE).
        for (let i = 0; i < 16; i++) {
            const rawAudio = this.native.rtcPollAudio()
            if (!rawAudio || !this.onVoicePcm) break
            try {
                const a = JSON.parse(rawAudio) as NativeRtcAudio
                const pcm = Base64.decode(a.d)
                if (pcm.length > 1) this.onVoicePcm(pcm, a.r)
            } catch (e) {
                print("[S2S-RTC] Bad native audio payload: " + e)
            }
        }

        // Friend camera: newest decoded RGBA into the reused scratch (width 0 = none).
        if (this.onFriendVideoFrame && this.native.pullInboundFrame
            && getTime() - this.lastFriendPullAt >= FRIEND_PULL_INTERVAL_S) {
            this.lastFriendPullAt = getTime()
            if (!this.friendRgba) this.friendRgba = new Uint8Array(FRIEND_MAX_W * FRIEND_MAX_H * 4)
            const info = this.native.pullInboundFrame(this.friendRgba.buffer)
            if (info && info.width > 0 && info.height > 0) {
                this.friendFramesPulled += 1
                this.onFriendVideoFrame(this.friendRgba, info.width, info.height)
            }
        }

        // Connection state drives the camera grab and the caller's re-offer loop.
        const up = this.connected
        if (up !== this.wasConnected) {
            this.wasConnected = up
            print("[S2S-RTC] call session " + (up ? "CONNECTED — media over RTP." : "lost."))
            if (this.onConnected) this.onConnected(up)
        }
        if (up) {
            this.native.rtcEnsureCamera()
            // Keep the re-offer clock fresh while connected so a transient drop
            // gets a full RETRY_S window to recover before we re-offer.
            this.createdAt = getTime()
        } else if (this.role === "caller") {
            // Only re-create on a TERMINAL state or after RETRY_S still not
            // connected — recreating mid-CONNECTING resets ICE for nothing.
            const st = this.native.rtcState(RTC_KIND_POV)
            const stuck = st === RTC_STATE_FAILED || st === RTC_STATE_CLOSED
            const waited = getTime() - this.createdAt
            if (stuck || waited > RETRY_S) {
                print("[S2S-RTC] not connected (state " + st + ") after " +
                    waited.toFixed(1) + " s — re-offering.")
                this.createSession()
            }
        }
        // (callee: a wedged session is replaced when the caller's next offer arrives.)

        // Raw-state heartbeat (~2 s) + DB diag mirror (NO IPs).
        const now = getTime()
        if (now - this.lastStateLogAt > 2) {
            this.lastStateLogAt = now
            const st = this.native.rtcState(RTC_KIND_POV)
            print("[S2S-RTC] state=" + st + " role=" + this.role +
                " sig=" + this.sig.isConnected + " out=" + this.outSig + " in=" + this.inCand +
                " frames=" + this.friendFramesPulled)
            if (this.sig.sendDiag) {
                const extra = this.diagExtra ? this.diagExtra() : {}
                this.sig.sendDiag(JSON.stringify({
                    r: this.role,
                    v: LENS_BUILD_TAG,
                    st,
                    inCand: this.inCand,
                    outSig: this.outSig,
                    frames: this.friendFramesPulled,
                    kbps: this.povBitrateKbps,
                    sig: this.sig.isConnected,
                    spk: this.native.rtcSpeakerDiag ? this.native.rtcSpeakerDiag() : "n/a",
                    ...extra,
                }))
            }
        }
    }
}

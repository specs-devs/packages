// WebRTCSession — drives the native WebRTC call path from JS.
//
// Owns the two native sessions and ferries their signaling over the shared
// Realtime channel (MANUAL signaling — SDP/ICE ride the same Supabase
// channel the JPEG/WAV fallback uses; the *media* flows peer-to-peer over
// RTP/SRTP, bypassing the 250 KB Realtime cap entirely):
//
//   pov   (kind 0): Glasses OFFERS camera H.264 + mic Opus. We emit
//                   rtc:pov:glasses {offer,cand}; the phone answers with
//                   rtc:pov:phoneB {answer,cand}.
//   voice (kind 1): the phone OFFERS its mic. We receive rtc:voice:phoneB
//                   {offer,cand}, answer with rtc:voice:glasses {answer,cand},
//                   and hand decoded PCM to onVoicePcm (the caller's jitter
//                   buffer plays it exactly like the WAV-chunk path).
//
// Reconnect: a pov session that sits unconnected for RETRY_S is destroyed and
// re-offered (fresh ICE). The phone mirrors this by re-answering any new offer
// and re-offering voice whenever its side drops.

import {
    NativeRtcAudio,
    NativeRtcSignal,
    RTC_KIND_POV,
    RTC_KIND_VOICE,
    RTC_KIND_FRIENDVID,
    RTC_STATE_NEW,
    RTC_STATE_CONNECTED,
    RTC_STATE_DISCONNECTED,
    RTC_STATE_FAILED,
    RTC_STATE_CLOSED,
    RemoteAssistanceWebRTCNativeExports,
} from "./WebRTCNativeModule"
import { RtcSignalPayload, RtcSignalTransport, STREAMER_HELPER, STREAMER_GLASSES } from "../App/Types"

// Public STUN keeps the prototype working across home NATs; empty string =
// LAN-only host candidates. Symmetric/corporate NAT (the Glasses sit on a 10.x
// enterprise subnet, the phone on a different 192.168.x/cellular one) has NO
// direct P2P path — ICE gathers host+srflx, finds zero workable pairs, and sits
// in `checking` forever (proven from the exchanged candidate lines). The ONLY
// fix is a TURN relay: it adds a `relay` candidate that both peers can reach.
//
// Drop an APPROVED-INFRA TURN URI here with embedded long-term credentials:
//   const TURN_URL = "turn:USER:CRED@turn.<approved-host>:3478?transport=udp"
// libdatachannel parses the credentialed `turn:` URI directly, so the native
// module needs NO rebuild. A TURN server also answers STUN binding requests, so
// we still get srflx from it — one URI yields both srflx AND relay candidates.
// Empty ⇒ STUN-only (same-network / LAN calls only). See WEBRTC-CALL.md.
const TURN_URL = ""
const STUN_URL = "stun:stun.l.google.com:19302"
// Bump on every lens change — surfaces in the DB diag as `v` so a stale lens
// on the device is instantly visible (several test runs were burned on one).
const LENS_BUILD_TAG = "v12-native-audio"
// The single ICE server handed to the native engine. Prefer TURN when set (it
// supersets STUN); otherwise fall back to public STUN.
const ICE_URL = TURN_URL || STUN_URL
// POV video bitrate is now a runtime-tunable preset (rtcSetBitrate reaches the
// HW encoder live — no renegotiation). Default is the LOW preset: 3500 looked
// great on the phone but competes with voice for the uplink and lags on weak
// Wi-Fi; 1000 kbps ≈ softer but stable, and the max-QP floor still bounds the
// macroblocking. Presets (1000/2000/3500) cycle from the phone's Video button
// and the Glasses panel's quality button — see RemoteAssistanceManager.
export const VIDEO_QUALITY_PRESETS_KBPS = [1000, 2000, 3500]
const VIDEO_BITRATE_DEFAULT_KBPS = 1000
// Encoder quality floor (max H.264 QP; 0 = encoder default, i.e. unbounded).
// BLOCKY video = the HW encoder quantizing into mush under head motion; capping
// QP makes it drop fps instead of quality. 36 balances detail against the
// 3500 kbps budget; lower = sharper but choppier. Requires the module ≥ the
// 2026-08-06 rebuild (older .so ignores the extra arg harmlessly).
const VIDEO_MAX_QP = 36
const VIDEO_FPS = 24
const VIDEO_MAX_WIDTH = 640
// Re-offer if the pov session hasn't (re)connected within this window. ICE over
// the phone-relay signaling can take longer than a direct socket, and tearing
// the PC down mid-negotiation resets ICE — so be patient (only re-create when
// genuinely stuck, or after this long still CONNECTING).
const RETRY_S = 15
// Friend camera → Glasses (wearer sees friend). Now delivered on the DUPLEX POV
// session (the native module runs video_duplex on POV via the Decart engine — the
// friend's camera is the inbound leg of the same PC that sends the Glasses camera).
// So there is NO separate friendvid session anymore; we just pull the decoded
// frames each tick. (The old 3rd-session approach crashed this engine at setup.)
const ENABLE_FRIEND_VIDEO = true

export class WebRTCSession {
    private native: RemoteAssistanceWebRTCNativeExports
    private pump: UpdateEvent | null = null
    private running = false
    private povCreatedAt = 0
    private povWasConnected = false
    private voiceWasConnected = false
    // Diagnostics. outSig/inCand count signaling msgs per kind so we can log the
    // first several ICE candidates VERBATIM: an `srflx` candidate proves the Glasses
    // completed a STUN round-trip (public reachability OK); `host`-only means STUN
    // failed — UDP egress blocked from the sandbox or the STUN server unreachable —
    // which kills every media leg once the peers are on different networks.
    private outSig: { [k: string]: number } = { pov: 0, voice: 0, friendvid: 0 }
    private inCand: { [k: string]: number } = { pov: 0, voice: 0, friendvid: 0 }
    private lastStateLogAt = 0
    // Voice ICE candidates received before the answering session exists (the
    // phone's candidate rows can land before its offer row). Flushed on offer.
    private pendingVoiceCands: { cand: string; mid: string }[] = []
    // Same buffering for the friend-camera video session (phone offers, we answer).
    private pendingFriendVidCands: { cand: string; mid: string }[] = []
    // Persistent RGBA scratch (max 1280×720) reused every pull — zero per-frame
    // alloc. The native decoder writes the newest friend-camera frame into it.
    private friendRgba: Uint8Array | null = null
    private lastFriendPullAt = 0
    // Count of friend-camera frames actually pulled from native (surfaced in the
    // DB diag so we can see, without device logs, how far the decode got before a
    // crash: >0 = frames decoded+pulled; 0 with fvid=2 = connected but no frames).
    private friendFramesPulled = 0
    // Current POV encode bitrate (runtime-tunable quality preset).
    private povBitrateKbps = VIDEO_BITRATE_DEFAULT_KBPS

    /** Decoded friend-voice PCM (S16 mono bytes + sample rate) for playback. */
    onVoicePcm: ((pcm: Uint8Array, rate: number) => void) | null = null
    /** Fired when the pov session connects/disconnects (drives capture handover). */
    onPovConnected: ((connected: boolean) => void) | null = null
    /** Newest decoded friend-camera frame (RGBA8, w*h*4, vertically flipped for
     *  direct texture upload). Fired each frame a new one is available. */
    onFriendVideoFrame: ((rgba: Uint8Array, width: number, height: number) => void) | null = null
    /** Extra key/values merged into the DB diag snapshot — audio playback
     *  counters + lens fps live in CallStreamer, not here. */
    diagExtra: (() => { [k: string]: number | string }) | null = null

    constructor(
        private readonly script: BaseScriptComponent,
        // Signaling transport (SDP/ICE). Either Realtime (Supabase, legacy)
        // (the Snap Cloud DB mailbox).
        private readonly sig: RtcSignalTransport,
        native: RemoteAssistanceWebRTCNativeExports
    ) {
        this.native = native
    }

    get povConnected(): boolean {
        return this.native.rtcState(RTC_KIND_POV) === RTC_STATE_CONNECTED
    }

    get voiceConnected(): boolean {
        return this.native.rtcState(RTC_KIND_VOICE) === RTC_STATE_CONNECTED
    }

    /** One-liner for the call caption: "rtc: pov ✓ voice …". */
    statusLine(): string {
        const mark = (kind: number) => {
            const s = this.native.rtcState(kind)
            return s === RTC_STATE_CONNECTED ? "✓" : s < 0 ? "–" : "…"
        }
        return "rtc: pov " + mark(RTC_KIND_POV) + " voice " + mark(RTC_KIND_VOICE)
    }

    // Insert the H.264 fmtp libdatachannel omits from its offer, right after the
    // `a=rtpmap:<pt> H264/90000` line, so iOS libwebrtc accepts the video m-line.
    // packetization-mode=1 (FU-A, required for real frame sizes) + constrained-
    // baseline profile-level-id 42e01f (broadest iOS HW decode support). Matches
    // the H.264 params libwebrtc itself offers, so codec negotiation succeeds.
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

        // Phone → us: answers/candidates for pov, offers/candidates for voice +
        // the friend's camera video (both phone-offered; we answer & decode).
        this.sig.onRtcSignal("pov", STREAMER_HELPER, (p) => this.onPovSignal(p))
        this.sig.onRtcSignal("voice", STREAMER_HELPER, (p) => this.onVoiceSignal(p))
        // NOTE: no "friendvid" subscription — the friend's camera now rides the duplex
        // POV session (native video_duplex), not a separate session. We just pull the
        // decoded inbound frames in tick(). (onFriendVidSignal is kept but unused.)

        this.createPov()

        this.pump = this.script.createEvent("UpdateEvent")
        this.pump.bind(() => this.tick())
        print("[RemoteAssistanceRTC] Session started (offering pov; awaiting voice offer).")
    }

    stop(): void {
        if (!this.running) return
        this.running = false
        if (this.pump) this.pump.enabled = false
        this.sig.offRtcSignal("pov", STREAMER_HELPER)
        this.sig.offRtcSignal("voice", STREAMER_HELPER)
        this.sig.offRtcSignal("friendvid", STREAMER_HELPER)
        this.native.rtcStop(RTC_KIND_POV)
        this.native.rtcStop(RTC_KIND_VOICE)
        this.native.rtcStop(RTC_KIND_FRIENDVID)
        if (this.povWasConnected && this.onPovConnected) this.onPovConnected(false)
        this.povWasConnected = false
        this.voiceWasConnected = false
        this.pendingVoiceCands = []
        this.pendingFriendVidCands = []
    }

    /** Mic PCM (S16 mono, base64) → Opus over the pov session. */
    sendMicPcm(b64Pcm: string, sampleRate: number): boolean {
        return this.native.rtcSendAudio(b64Pcm, sampleRate) === 0
    }

    /** Whether this module build supports native (echo-cancelled) mic capture. */
    nativeMicSupported(): boolean {
        return typeof this.native.rtcMicStart === "function" &&
            typeof this.native.rtcMicState === "function"
    }

    /** Kick off native mic capture on the pov session (async; poll nativeMicState). */
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

    /** PCM frames captured since the native mic last started; -1 when the
     *  module predates rtcMicFrames (stall watchdog then stays off). */
    nativeMicFrames(): number {
        return this.native.rtcMicFrames ? this.native.rtcMicFrames() : -1
    }

    /** Voice-session receive stats ("rx_pkts=.. plc_frames=..") for the diag line. */
    audioRxStats(): string {
        return this.native.rtcAudioRxStats ? this.native.rtcAudioRxStats(RTC_KIND_VOICE) : ""
    }

    /** Whether this module build supports the native friend-voice speaker. */
    nativeSpeakerSupported(): boolean {
        return typeof this.native.rtcSpeakerStart === "function" &&
            typeof this.native.rtcSpeakerState === "function"
    }

    /** Kick off the native speaker (async; poll nativeSpeakerState). While it
     *  is ACTIVE, decoded voice goes decode-thread → speaker ring and the JS
     *  PCM poll runs dry — the AudioOutput fallback simply stops receiving. */
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

    private createPov(): void {
        const rc = this.native.rtcCreate(
            RTC_KIND_POV, this.povBitrateKbps, VIDEO_FPS, VIDEO_MAX_WIDTH, ICE_URL,
            VIDEO_MAX_QP)
        this.povCreatedAt = getTime()
        if (rc !== 0) print("[RemoteAssistanceRTC] pov rtcCreate failed: " + rc)
    }

    /** Live POV quality change: reaches the HW encoder via SpecsMediaCodec
     *  setParameters (no renegotiation, no video gap); a later pov re-offer
     *  also creates at this rate. Returns the applied kbps. */
    setVideoBitrate(kbps: number): number {
        const clamped = Math.max(300, Math.min(6000, Math.round(kbps)))
        this.povBitrateKbps = clamped
        const rc = this.native.rtcSetBitrate(clamped)
        print("[RemoteAssistanceRTC] video bitrate -> " + clamped + " kbps (rc " + rc + ")")
        return clamped
    }

    get videoBitrateKbps(): number {
        return this.povBitrateKbps
    }

    private onPovSignal(p: RtcSignalPayload): void {
        if (!this.running) return
        if (p.t === "answer" && p.sdp) {
            const rc = this.native.rtcSetRemoteDescription(RTC_KIND_POV, 1, p.sdp)
            print("[RemoteAssistanceRTC] pov answer applied (rc " + rc + ").")
        } else if (p.t === "cand" && p.cand) {
            const n = (this.inCand["pov"] += 1)
            if (n <= 14) print("[RemoteAssistanceRTC] pov in-cand #" + n + ": " + p.cand)
            this.native.rtcAddRemoteCandidate(RTC_KIND_POV, p.cand, p.mid ?? "")
        }
    }

    private onVoiceSignal(p: RtcSignalPayload): void {
        if (!this.running) return
        if (p.t === "offer" && p.sdp) {
            // Every incoming offer gets a FRESH answering session (the phone
            // re-offers after its side drops; stale PCs can't renegotiate).
            const rcCreate = this.native.rtcCreate(RTC_KIND_VOICE, 0, 0, 0, ICE_URL)
            const rc = this.native.rtcSetRemoteDescription(RTC_KIND_VOICE, 0, p.sdp)
            print("[RemoteAssistanceRTC] voice offer applied (create " + rcCreate + ", sdp " + rc +
                ") — answering.")
            // Flush candidates that arrived BEFORE the offer created the session.
            // The phone's voice ICE candidates and its offer are separate async DB
            // inserts, so a candidate row often lands first — without this buffer
            // those candidates hit a null session and were silently dropped.
            if (this.pendingVoiceCands.length > 0) {
                for (const c of this.pendingVoiceCands) {
                    this.native.rtcAddRemoteCandidate(RTC_KIND_VOICE, c.cand, c.mid)
                }
                print("[RemoteAssistanceRTC] voice flushed " + this.pendingVoiceCands.length +
                    " buffered candidate(s).")
                this.pendingVoiceCands = []
            }
        } else if (p.t === "cand" && p.cand) {
            const n = (this.inCand["voice"] += 1)
            if (n <= 14) print("[RemoteAssistanceRTC] voice in-cand #" + n + ": " + p.cand)
            // Only add once the answering session exists (rtcState ≥ NEW). Before
            // that, buffer — dropping pre-offer candidates was starving voice ICE.
            if (this.native.rtcState(RTC_KIND_VOICE) >= RTC_STATE_NEW) {
                this.native.rtcAddRemoteCandidate(RTC_KIND_VOICE, p.cand, p.mid ?? "")
            } else {
                this.pendingVoiceCands.push({ cand: p.cand, mid: p.mid ?? "" })
            }
        }
    }

    // Friend camera video (phone OFFERS its camera H.264; we ANSWER and the native
    // module decodes to RGBA). Mirrors onVoiceSignal — same answerer pattern, same
    // pre-offer candidate buffering.
    private onFriendVidSignal(p: RtcSignalPayload): void {
        if (!this.running) return
        if (p.t === "offer" && p.sdp) {
            const rcCreate = this.native.rtcCreate(RTC_KIND_FRIENDVID, 0, 0, 0, ICE_URL)
            const rc = this.native.rtcSetRemoteDescription(RTC_KIND_FRIENDVID, 0, p.sdp)
            print("[RemoteAssistanceRTC] friendvid offer applied (create " + rcCreate + ", sdp " + rc +
                ") — answering.")
            if (this.pendingFriendVidCands.length > 0) {
                for (const c of this.pendingFriendVidCands) {
                    this.native.rtcAddRemoteCandidate(RTC_KIND_FRIENDVID, c.cand, c.mid)
                }
                print("[RemoteAssistanceRTC] friendvid flushed " + this.pendingFriendVidCands.length +
                    " buffered candidate(s).")
                this.pendingFriendVidCands = []
            }
        } else if (p.t === "cand" && p.cand) {
            const n = (this.inCand["friendvid"] += 1)
            if (n <= 14) print("[RemoteAssistanceRTC] friendvid in-cand #" + n + ": " + p.cand)
            if (this.native.rtcState(RTC_KIND_FRIENDVID) >= RTC_STATE_NEW) {
                this.native.rtcAddRemoteCandidate(RTC_KIND_FRIENDVID, p.cand, p.mid ?? "")
            } else {
                this.pendingFriendVidCands.push({ cand: p.cand, mid: p.mid ?? "" })
            }
        }
    }

    // Per-frame: ferry outbound signaling, drain voice PCM, watch states.
    private tick(): void {
        if (!this.running) return

        for (const kind of [RTC_KIND_POV, RTC_KIND_VOICE, RTC_KIND_FRIENDVID]) {
            // Hold outbound signaling in the native queue until the Supabase
            // channel is up — a drained-but-unsendable offer would be lost
            // until the next retry cycle. (Media itself is P2P: the rest of
            // this tick must run even with the channel down.)
            if (!this.sig.isConnected) break
            for (let i = 0; i < 8; i++) { // bounded drain per frame
                const raw = this.native.rtcPollSignal(kind)
                if (!raw) break
                let nativeSig: NativeRtcSignal
                try {
                    nativeSig = JSON.parse(raw) as NativeRtcSignal
                } catch (e) {
                    print("[RemoteAssistanceRTC] Bad native signal JSON: " + e)
                    continue
                }
                const label = kind === RTC_KIND_POV ? "pov"
                    : kind === RTC_KIND_VOICE ? "voice" : "friendvid"
                // libdatachannel emits H.264 (PT 96) with an a=rtpmap but NO a=fmtp
                // line — on BOTH the pov OFFER (Glasses→phone) and the friendvid
                // ANSWER (phone→Glasses). iOS libwebrtc can't match an H.264 profile
                // without packetization-mode/profile-level-id, so it rejects the
                // video m-line (the real reason POV video never appeared). Inject
                // the fmtp iOS HW codec expects on any outgoing SDP. (No native
                // rebuild; SDP without an H.264 line — e.g. voice — is untouched.)
                if (nativeSig.sdp && (nativeSig.t === "offer" || nativeSig.t === "answer")) {
                    nativeSig.sdp = WebRTCSession.addH264Fmtp(nativeSig.sdp)
                }
                this.sig.sendRtcSignal(label, STREAMER_GLASSES, nativeSig as RtcSignalPayload)
                // Log the first several outbound signals per kind; for candidates
                // print the whole line so host/srflx/relay is visible.
                const n = (this.outSig[label] = (this.outSig[label] ?? 0) + 1)
                if (n <= 14 || n % 25 === 0) {
                    const detail = nativeSig.t === "cand" ? ": " + (nativeSig.cand ?? "") : ""
                    print("[RemoteAssistanceRTC] " + label + " out #" + n + " " + nativeSig.t + detail)
                }
            }
        }

        // Friend voice: decoded PCM straight into the caller's playback path.
        // Drain the WHOLE native queue (bounded): this used to pull ONE chunk
        // per tick, so whenever the lens dropped below the chunk rate the
        // native queue backed up and voice went choppy, then died.
        for (let i = 0; i < 16; i++) {
            const rawAudio = this.native.rtcPollAudio()
            if (!rawAudio || !this.onVoicePcm) break
            try {
                const a = JSON.parse(rawAudio) as NativeRtcAudio
                const pcm = Base64.decode(a.d)
                if (pcm.length > 1) this.onVoicePcm(pcm, a.r)
            } catch (e) {
                print("[RemoteAssistanceRTC] Bad native audio payload: " + e)
            }
        }

        // Friend camera video: pull the newest decoded RGBA into the reused scratch
        // (zero per-frame alloc) and hand it to the display. width 0 = no new frame.
        // Throttled to ~12/s: each pull is a ~1.2 MB bridge copy + GPU upload, and
        // doing it every tick was a top cost in the 6-9 fps in-call lens slowdown.
        // The native side keeps only the NEWEST frame, so skipped ticks drop stale
        // frames for free instead of building a backlog.
        if (ENABLE_FRIEND_VIDEO && this.onFriendVideoFrame && this.native.pullInboundFrame
            && getTime() - this.lastFriendPullAt >= 1 / 12) {
            this.lastFriendPullAt = getTime()
            if (!this.friendRgba) this.friendRgba = new Uint8Array(1280 * 720 * 4)
            const info = this.native.pullInboundFrame(this.friendRgba.buffer)
            if (info && info.width > 0 && info.height > 0) {
                this.friendFramesPulled += 1
                this.onFriendVideoFrame(this.friendRgba, info.width, info.height)
            }
        }

        // pov state transitions drive the capture handover + retry loop.
        const povUp = this.povConnected
        if (povUp !== this.povWasConnected) {
            this.povWasConnected = povUp
            print("[RemoteAssistanceRTC] pov " + (povUp ? "CONNECTED — media over RTP." : "lost."))
            if (this.onPovConnected) this.onPovConnected(povUp)
        }
        if (povUp) {
            // Grab the camera for the pov video track once connected (no-op
            // once already running).
            this.native.rtcEnsureCamera()
            // Keep the re-offer clock fresh while connected. povCreatedAt is the
            // "how long have we been waiting to (re)connect" timer read in the
            // else branch below. If we only stamped it at createPov(), then a
            // call that has been up longer than RETRY_S would satisfy
            // `waited > RETRY_S` on the VERY FIRST transient DISCONNECTED and get
            // torn down + re-offered immediately — the re-offer churn the retry
            // logic is meant to avoid. Refreshing it here means a mid-call drop
            // gets a full RETRY_S window for ICE to recover before we re-offer.
            this.povCreatedAt = getTime()
        } else {
            // Diagnostic: log the raw pov state so we can see WHERE it's stuck —
            // 0 NEW, 1 CONNECTING (ICE in progress), 3 DISCONNECTED, 4 FAILED,
            // 5 CLOSED. Only re-create when genuinely stuck/failed, or after
            // RETRY_S still not connected — recreating mid-CONNECTING resets ICE.
            const st = this.native.rtcState(RTC_KIND_POV)
            // Only re-create on a TERMINAL state. DISCONNECTED is transient — ICE
            // routinely recovers from it, and tearing the PC down mid-recovery
            // (new ufrag) throws away candidates the phone already answered,
            // which is exactly the re-offer churn that starved connection. Still
            // re-offer after RETRY_S so a genuinely wedged CONNECTING recovers.
            const stuck = st === RTC_STATE_FAILED || st === RTC_STATE_CLOSED
            const waited = getTime() - this.povCreatedAt
            if (stuck || waited > RETRY_S) {
                print("[RemoteAssistanceRTC] pov not connected (state " + st + ") after " +
                    waited.toFixed(1) + " s — re-offering.")
                this.createPov()
            }
        }

        const voiceUp = this.voiceConnected
        if (voiceUp !== this.voiceWasConnected) {
            this.voiceWasConnected = voiceUp
            print("[RemoteAssistanceRTC] voice " + (voiceUp ? "CONNECTED — friend audio over RTP." : "lost."))
        }

        // Raw-state heartbeat (~2 s) — see WHERE each session is stuck without
        // waiting for the RETRY_S re-offer log. States: -1 none 0 new 1 connecting
        // 2 CONNECTED 3 disconnected 4 failed 5 closed. outX = candidates WE sent,
        // inX = candidates the phone sent US (0 = phone's ICE never reaches us).
        const now = getTime()
        if (now - this.lastStateLogAt > 2) {
            this.lastStateLogAt = now
            const povSt = this.native.rtcState(RTC_KIND_POV)
            const voiceSt = this.native.rtcState(RTC_KIND_VOICE)
            print("[RemoteAssistanceRTC] states pov=" + povSt +
                " voice=" + voiceSt +
                " sigConn=" + this.sig.isConnected +
                " out(pov " + (this.outSig["pov"] ?? 0) + "/voice " + (this.outSig["voice"] ?? 0) + ")" +
                " in(pov " + this.inCand["pov"] + "/voice " + this.inCand["voice"] + ")")
            // Mirror the same snapshot to the DB (NO IPs) so the Glasses side of a
            // stuck call is readable without the USB log tether. inX = candidates
            // the phone sent US (0 ⇒ its ICE never reached us); outX = ours sent.
            if (this.sig.sendDiag) {
                const extra = this.diagExtra ? this.diagExtra() : {}
                this.sig.sendDiag(JSON.stringify({
                    r: "glasses",
                    v: LENS_BUILD_TAG,
                    pov: povSt, voice: voiceSt,
                    fvid: this.native.rtcState(RTC_KIND_FRIENDVID),
                    inPov: this.inCand["pov"], inVoice: this.inCand["voice"],
                    inFvid: this.inCand["friendvid"],
                    outPov: this.outSig["pov"] ?? 0, outVoice: this.outSig["voice"] ?? 0,
                    fvidFrames: this.friendFramesPulled,
                    kbps: this.povBitrateKbps,
                    sig: this.sig.isConnected,
                    spk: this.native.rtcSpeakerDiag ? this.native.rtcSpeakerDiag() : "n/a",
                    ...extra,
                }))
            }
        }
    }
}

// CallStreamer — this Glasses' side of the call: the WebRTC session + the AUDIO
// LIFECYCLE (native-first on both ends).
//
//   • WebRTCSession — one duplex PeerConnection (see WebRTCSession.ts).
//   • Mic: native VOICE_CALL capture (echo-cancelled) started once per
//     connection under the shared AUDIO_IN_OUT focus; the JS
//     MicrophoneAudioProvider is a fallback that opens ONLY if the native
//     path fails. Speaker: native pull-mode playback started once per
//     connection; the JS AudioOutput ring is the fallback (it keeps receiving
//     PCM whenever the native speaker isn't ACTIVE).
//     NO watchdog ever cycles open/close at the audio service: repeated opens
//     at an unhealthy service wedge the whole audio stack — failures get ONE
//     fallback and a caption, not churn.
//   • Friend video: the native module HW-decodes the inbound H.264 → RGBA and
//     uploadFriendFrame turns it into the panel texture (onFriendVideoTexture).
//
// The camera is owned entirely by the native module (grabbed when the session
// connects, via rtcEnsureCamera) — this class never touches it.

import { WebRTCController } from "./WebRTCController"
import { WebRTCSession } from "./WebRTCSession"
import { CallRole, RtcSignalTransport } from "../App/Types"

const MIC_ASSET = requireAsset("../../Audio/MicInput.micaudio") as AudioTrackAsset
// Streaming friend-voice playback: ONE persistent Audio Output asset fed PCM
// continuously (no per-chunk asset churn).
const VOICE_OUT_ASSET = requireAsset("../../Audio/RtcVoiceOutput.audioOutput") as AudioTrackAsset

// JS mic chunking: 60 ms bursts — the engine re-chunks into 20 ms Opus frames.
const AUDIO_CHUNK_S = 0.06
const SAMPLE_RATE = 16000
// JS mic dead-air policy: ONE restart at the alternate rate, then a caption.
const MIC_RETRY_S = 4
const MIC_MAX_RETRIES = 1
const MIC_FALLBACK_RATE = 44100
const MIC_SILENT_WARN_S = 3
// Auto-gain for the JS mic path (the raw Glasses mic is quiet).
const GAIN_TARGET_PEAK = 0.45
const GAIN_MAX = 30
const GAIN_ENV_DECAY = 0.997
const GAIN_ENV_FLOOR = 0.005
// Native mic: ONE attempt per connection; stall / stuck-start → JS fallback.
const NATIVE_MIC_ENABLED = true
const NATIVE_MIC_STALL_S = 3
const NATIVE_MIC_START_TIMEOUT_S = 8
const NATIVE_MIC_USE_FOCUS = true
// Hold the VOICE_CALL mic until the native speaker is ACTIVE, so the speaker
// binds to the media route before the mic flips the device into communication
// audio mode. Opening the mic first routes the speaker to the silent voice-call
// output — the answerer "I can't hear the other side" bug (the two device opens
// race on detached native threads, and the answerer's mic usually wins). Bounded
// so a slow or failed speaker never mutes this side's mic.
const NATIVE_MIC_WAIT_SPEAKER_S = 1.5

export class CallStreamer {
    private running = false
    private rtcSession: WebRTCSession | null = null
    private _unavailableReason: string | null = null

    // Friend camera → ProceduralTexture (created once per size).
    private friendProcTex: Texture | null = null
    private friendProcProvider: ProceduralTextureProvider | null = null
    private friendTexW = 0
    private friendTexH = 0
    private friendFrameCount = 0
    /** Fired with the friend-video Texture when it's (re)created — wire to the panel. */
    onFriendVideoTexture: ((tex: Texture) => void) | null = null

    // JS mic fallback state
    private micControl: MicrophoneAudioProvider | null = null
    private micUpdate: UpdateEvent | null = null
    private frames: Float32Array[] = []
    private sampleCount = 0
    private sendSeq = 0
    private actualRate = SAMPLE_RATE
    private micStartedAt = 0
    private micEverProduced = false
    private micSilentWarned = false
    private micRetryCount = 0
    private lastMicActivityAt = 0
    private chunkPeak = 0
    private zeroPeakChunks = 0
    private zeroPeakWarned = false
    private peakEnv = GAIN_ENV_FLOOR
    private micGain = 1
    // Native mic state — one attempt per connection (latched until reconnect).
    private nativeMicActive = false
    private nativeMicFailed = false
    private nativeMicStrikes = 0
    private nativeMicStartedAt = 0
    private nativeMicLastFrames = -1
    private nativeMicLastAdvanceAt = 0
    private nativeMicGateStartedAt = 0 // when we began waiting for the speaker (0 = not waiting)
    // Native speaker: one start per connection.
    private nativeSpeakerTried = false
    private lastHealthLogAt = 0

    // Friend voice (JS fallback): S16 → F32 into the Audio Output provider.
    private recvCount = 0
    private playedCount = 0
    private inRate = 0
    private audioOut: AudioComponent
    private voiceOut: AudioOutputProvider | null = null
    private f32Scratch: Float32Array | null = null

    constructor(
        private readonly script: BaseScriptComponent,
        private readonly signal: RtcSignalTransport,
        readonly role: CallRole
    ) {
        this.audioOut = script.getSceneObject()
            .createComponent("Component.AudioComponent") as AudioComponent
        this.audioOut.volume = 1.0
        try {
            this.voiceOut = VOICE_OUT_ASSET.control as AudioOutputProvider
            this.voiceOut.sampleRate = 48000 // Opus clock; re-set on the first chunk
            this.audioOut.audioTrack = VOICE_OUT_ASSET
            this.audioOut.play(-1) // continuous; the provider supplies samples
        } catch (e) {
            this.voiceOut = null
            print("[Call] Audio Output unavailable (" + e + ") — no JS voice fallback.")
        }
    }

    /** Why media can't run here (preview / missing or outdated module), else null. */
    get unavailableReason(): string | null {
        return this._unavailableReason
    }

    /** One-line audio health for the call caption. */
    micStatusLine(): string {
        const spkSt = this.rtcSession ? this.rtcSession.nativeSpeakerState() : 0
        const spk = spkSt === 2 ? " · spk native ✓" : spkSt === -1 ? " · spk js" : ""
        const inbound = " · in " + this.recvCount + spk
        if (this.nativeMicActive) {
            const st = this.rtcSession ? this.rtcSession.nativeMicState() : 0
            return (st === 2 ? "mic native ✓" : "mic native starting…") + inbound
        }
        if (!this.micControl) {
            return (this.nativeMicFailed
                ? "mic: native failed — JS fallback…"
                : "mic: waiting for connect…") + inbound
        }
        if (this.micSilentWarned) return "mic DEAD — reboot Glasses?" + inbound
        if (!this.micEverProduced) {
            const silentFor = getTime() - this.micStartedAt
            return (silentFor > MIC_SILENT_WARN_S || this.micRetryCount > 0
                ? "mic: NO SAMPLES — check permission"
                : "mic: starting…") + inbound
        }
        if (this.zeroPeakChunks >= 10) return "mic SILENT (peak 0)" + inbound
        return "mic js ×" + this.micGain.toFixed(0) + " · sent " + this.sendSeq + inbound
    }

    /** Transport health for the caption. */
    transportLine(): string {
        return this.rtcSession ? this.rtcSession.statusLine() : "rtc unavailable"
    }

    /** Whether the friend's camera is arriving. */
    friendVideoLine(): string {
        return this.friendFrameCount > 0
            ? "friend cam " + this.friendFrameCount + " frames"
            : "friend cam waiting…"
    }

    /** Live video quality change (kbps); 0 when no session is running. */
    setVideoBitrate(kbps: number): number {
        return this.rtcSession ? this.rtcSession.setVideoBitrate(kbps) : 0
    }

    /** True once the media session is up. */
    get mediaConnected(): boolean {
        return this.rtcSession !== null && this.rtcSession.connected
    }

    start(): void {
        if (this.running) return
        this.running = true
        this.startRtc()
        // No JS mic at call start: the pump drives the native mic/speaker
        // lifecycle (start-on-connect) and opens the JS provider only on failure.
        this.startMicPump()
        print("[Call] Call started as " + this.role + " (WebRTC, native-first audio).")
    }

    stop(): void {
        this.running = false
        if (this.rtcSession) {
            this.rtcSession.stopNativeMic()
            this.rtcSession.stopNativeSpeaker()
            this.rtcSession.stop()
            this.rtcSession = null
        }
        this.nativeMicActive = false
        this.nativeMicFailed = false
        this.nativeMicLastFrames = -1
        this.nativeMicGateStartedAt = 0
        this.nativeSpeakerTried = false
        if (this.micControl) {
            try { this.micControl.stop() } catch (e) { /* already stopped */ }
        }
        if (this.micUpdate) this.micUpdate.enabled = false
        // Kill this call's audio output FOR REAL: each call constructs a fresh
        // streamer with its own AudioComponent draining the shared Audio Output
        // provider — without stop+destroy a zombie component garbles the next call.
        try { this.audioOut.stop(false) } catch (e) { /* not playing */ }
        try { this.audioOut.destroy() } catch (e) { /* already destroyed */ }
        this.voiceOut = null
        this.friendProcTex = null
        this.friendProcProvider = null
        this.friendTexW = 0
        this.friendTexH = 0
    }

    // ── WebRTC session ──────────────────────────────────────────────────

    private startRtc(): void {
        const native = WebRTCController.native
        if (!native) {
            this._unavailableReason = "WebRTC runs on device only"
            print("[Call] WebRTC native module unavailable (preview?) — nothing to stream here.")
            return
        }
        if (!WebRTCSession.isS2SCapable(native)) {
            this._unavailableReason = "native module too old — rebuild VideoCallS2SWebRTCModule"
            print("[Call] " + this._unavailableReason + " (ping " + native.ping() + ").")
            return
        }
        this.rtcSession = new WebRTCSession(this.script, this.signal, native, this.role)
        this.rtcSession.onVoicePcm = (pcm, rate) => this.enqueueRtcPcm(pcm, rate)
        this.rtcSession.diagExtra = () => ({
            aIn: this.recvCount,
            aPlay: this.playedCount,
            fps: Math.round(1 / Math.max(getDeltaTime(), 0.001)),
            mic: this.nativeMicActive
                ? (this.rtcSession ? this.rtcSession.nativeMicState() : 0) : -2,
            micF: this.rtcSession ? this.rtcSession.nativeMicFrames() : -1,
            micStrikes: this.nativeMicStrikes,
            sent: this.sendSeq,
            spkSt: this.rtcSession ? this.rtcSession.nativeSpeakerState() : 0,
            arx: this.rtcSession ? this.rtcSession.audioRxStats() : "",
        })
        this.rtcSession.onConnected = (up) => {
            print("[Call] media " + (up ? "connected — call is live." : "lost."))
        }
        this.rtcSession.onFriendVideoFrame = (rgba, w, h) => this.uploadFriendFrame(rgba, w, h)
        this.rtcSession.start()
    }

    /** Friend voice PCM (JS fallback): S16 → F32 straight into the Audio Output ring. */
    private enqueueRtcPcm(pcm: Uint8Array, rate: number): void {
        if (!this.running || !this.voiceOut) return
        this.recvCount += 1
        if (this.recvCount === 1) print("[Call] First friend voice PCM over WebRTC.")
        if (rate !== this.inRate) {
            this.inRate = rate
            this.voiceOut.sampleRate = rate
        }
        const n = pcm.length >> 1
        if (!this.f32Scratch || this.f32Scratch.length < n) {
            this.f32Scratch = new Float32Array(Math.max(n, 4800))
        }
        const dv = new DataView(pcm.buffer, pcm.byteOffset, pcm.length)
        for (let i = 0; i < n; i++) this.f32Scratch[i] = dv.getInt16(i * 2, true) / 32768
        this.voiceOut.enqueueAudioFrame(this.f32Scratch.subarray(0, n), new vec3(n, 1, 1))
        this.playedCount += 1
    }

    /** Friend camera frame (RGBA8, already vertically flipped) → ProceduralTexture.
     *  Recreated ONLY on a genuine size change (tracked by our own ints — never
     *  getWidth(), which can report padded sizes and cause per-frame recreation). */
    private uploadFriendFrame(rgba: Uint8Array, w: number, h: number): void {
        if (!this.running || w <= 0 || h <= 0 || w > 1920 || h > 1920) return
        const need = w * h * 4
        if (rgba.length < need) return
        if (!this.friendProcTex || this.friendTexW !== w || this.friendTexH !== h) {
            this.friendProcTex = ProceduralTextureProvider.createWithFormat(
                w, h, TextureFormat.RGBA8Unorm)
            this.friendProcProvider = this.friendProcTex.control as ProceduralTextureProvider
            this.friendTexW = w
            this.friendTexH = h
            if (this.onFriendVideoTexture) this.onFriendVideoTexture(this.friendProcTex)
            print("[Call] Friend-video texture created " + w + "x" + h)
        }
        const px = rgba.length === need ? rgba : rgba.subarray(0, need) as Uint8Array
        this.friendProcProvider!.setPixels(0, 0, w, h, px)
        this.friendFrameCount += 1
        if (this.friendFrameCount === 1) print("[Call] First friend-camera frame decoded → texture.")
    }

    // ── Audio lifecycle ─────────────────────────────────────────────────

    /**
     * Native-mic state machine, run once per pump tick. Returns true while
     * native capture owns the mic (JS processing must idle).
     *   connect ──▶ rtcMicStart(focus) — ONE attempt per connection
     *   start FAILS / STALLS / stuck starting ──▶ stop it, latch, JS fallback ONCE
     *   drop ──▶ rtcMicStop, clear the latch (a reconnect earns a fresh attempt)
     */
    private manageNativeMic(): boolean {
        if (!NATIVE_MIC_ENABLED || this.nativeMicFailed) return false
        const rtc = this.rtcSession
        if (!rtc || !rtc.nativeMicSupported()) return false

        if (!this.nativeMicActive) {
            if (!rtc.connected) return false
            // Speaker-first gate (see NATIVE_MIC_WAIT_SPEAKER_S): wait for the
            // native speaker to reach ACTIVE before opening the VOICE_CALL mic,
            // but never past the timeout so a slow/failed speaker can't block us.
            if (rtc.nativeSpeakerSupported() && rtc.nativeSpeakerState() !== 2) {
                if (this.nativeMicGateStartedAt === 0) this.nativeMicGateStartedAt = getTime()
                if (getTime() - this.nativeMicGateStartedAt < NATIVE_MIC_WAIT_SPEAKER_S) return false
                print("[Call] Speaker not active after " + NATIVE_MIC_WAIT_SPEAKER_S +
                    " s — starting mic anyway.")
            }
            this.nativeMicGateStartedAt = 0
            try { if (this.micControl) this.micControl.stop() } catch (e) { /* already stopped */ }
            this.frames = []
            this.sampleCount = 0
            if (rtc.startNativeMic(NATIVE_MIC_USE_FOCUS)) {
                this.nativeMicActive = true
                this.nativeMicStartedAt = getTime()
                this.nativeMicLastFrames = -1
                this.nativeMicLastAdvanceAt = getTime()
                print("[Call] Native mic starting (VOICE_CALL, echo-cancelled).")
                return true
            }
            this.noteNativeMicFailure("native mic rejected")
            return false
        }

        const st = rtc.nativeMicState()
        if (st === -1) {
            rtc.stopNativeMic()
            this.nativeMicActive = false
            this.noteNativeMicFailure("native mic failed to open")
            return false
        }
        if (!rtc.connected) {
            rtc.stopNativeMic()
            this.nativeMicActive = false
            this.nativeMicFailed = false // fresh connection, fresh attempt
            this.nativeMicGateStartedAt = 0 // re-arm the speaker-first gate for the next connection
            print("[Call] session dropped — native mic stopped (restarts on reconnect).")
            return false
        }
        if (st === 2) {
            const frames = rtc.nativeMicFrames()
            if (frames >= 0) {
                if (frames !== this.nativeMicLastFrames) {
                    this.nativeMicLastFrames = frames
                    this.nativeMicLastAdvanceAt = getTime()
                } else if (getTime() - this.nativeMicLastAdvanceAt > NATIVE_MIC_STALL_S) {
                    rtc.stopNativeMic()
                    this.nativeMicActive = false
                    this.noteNativeMicFailure(
                        "native mic stalled (no frames for " + NATIVE_MIC_STALL_S + " s)")
                    return false
                }
            }
        } else if (getTime() - this.nativeMicStartedAt > NATIVE_MIC_START_TIMEOUT_S) {
            rtc.stopNativeMic()
            this.nativeMicActive = false
            this.noteNativeMicFailure("native mic stuck starting")
            return false
        }
        return true
    }

    /** Native speaker: ONE start per connection; on failure the JS fallback keeps playing. */
    private manageNativeSpeaker(): void {
        const rtc = this.rtcSession
        if (!rtc || !rtc.nativeSpeakerSupported()) return
        if (!rtc.connected) {
            this.nativeSpeakerTried = false // re-arm for the next connection
            return
        }
        if (this.nativeSpeakerTried) return
        this.nativeSpeakerTried = true
        if (rtc.startNativeSpeaker()) {
            print("[Call] Native speaker starting (friend voice).")
        } else {
            print("[Call] Native speaker unavailable — JS AudioOutput fallback.")
        }
    }

    /** One compact audio health line every ~5 s (native stderr never reaches the LS log). */
    private logMicHealth(): void {
        const now = getTime()
        if (now - this.lastHealthLogAt < 5) return
        this.lastHealthLogAt = now
        const rtc = this.rtcSession
        const mode = this.nativeMicActive
            ? "native st=" + (rtc ? rtc.nativeMicState() : "?") +
              " micF=" + (rtc ? rtc.nativeMicFrames() : -1)
            : "js sent=" + this.sendSeq + " gain=x" + this.micGain.toFixed(1) +
              " peak=" + this.chunkPeak.toFixed(3)
        print("[Call] audio health: " + mode +
            " strikes=" + this.nativeMicStrikes +
            " spkSt=" + (rtc ? rtc.nativeSpeakerState() : 0) +
            " in=" + this.recvCount + "/" + this.playedCount)
    }

    private noteNativeMicFailure(why: string): void {
        this.nativeMicFailed = true
        this.nativeMicStrikes += 1
        this.restartJsMic(why + " — JS fallback for this connection")
    }

    private restartJsMic(why: string): void {
        print("[Call] Mic handover ← JS pipeline (" + why + ").")
        try {
            if (!this.micControl) {
                this.micControl = MIC_ASSET.control as MicrophoneAudioProvider
                this.micControl.sampleRate = SAMPLE_RATE
                this.actualRate = this.micControl.sampleRate
            }
            this.micControl.start()
            this.micStartedAt = getTime()
            this.lastMicActivityAt = getTime()
        } catch (e) {
            print("[Call] JS mic restart failed: " + e)
        }
    }

    private startMicPump(): void {
        this.micUpdate = this.script.createEvent("UpdateEvent")
        this.micUpdate.bind(() => this.pumpMic())
    }

    private pumpMic(): void {
        if (!this.running) return
        this.logMicHealth()
        this.manageNativeSpeaker()
        if (this.manageNativeMic()) return // native capture owns the mic this frame
        if (!this.micControl) return       // JS fallback not opened; native-only
        const frameSize = this.micControl.maxFrameSize
        let frame = new Float32Array(frameSize)
        const shape = this.micControl.getAudioFrame(frame)
        if (shape.x === 0) {
            const silentFor = getTime() - this.lastMicActivityAt
            if (silentFor > MIC_RETRY_S && this.micRetryCount < MIC_MAX_RETRIES) {
                this.micRetryCount += 1
                const rate = this.micRetryCount % 2 === 1 ? MIC_FALLBACK_RATE : SAMPLE_RATE
                print("[Call] Mic silent — restart #" + this.micRetryCount + " at " + rate + " Hz.")
                try {
                    this.micControl.stop()
                    this.micControl.sampleRate = rate
                    this.actualRate = this.micControl.sampleRate
                    this.micControl.start()
                    this.micStartedAt = getTime()
                    this.lastMicActivityAt = getTime()
                } catch (e) {
                    print("[Call] Mic restart failed: " + e)
                }
                return
            }
            if (!this.micSilentWarned && this.micRetryCount >= MIC_MAX_RETRIES) {
                this.micSilentWarned = true
                print("[Call] WARNING: mic dead after " + MIC_MAX_RETRIES +
                    " restart(s) — the friend cannot hear you. If friend voice is ALSO " +
                    "silent, the device audio service is wedged — reboot the Glasses.")
            }
            return
        }
        this.micEverProduced = true
        this.lastMicActivityAt = getTime()
        if (this.micRetryCount > 0 || this.micSilentWarned) {
            this.micRetryCount = 0
            this.micSilentWarned = false
        }
        frame = frame.subarray(0, shape.x) as Float32Array
        for (let i = 0; i < frame.length; i++) {
            const a = Math.abs(frame[i])
            if (a > this.chunkPeak) this.chunkPeak = a
        }
        this.frames.push(frame)
        this.sampleCount += shape.x
        if (this.sampleCount >= AUDIO_CHUNK_S * this.actualRate) {
            this.peakEnv = Math.max(this.chunkPeak, this.peakEnv * GAIN_ENV_DECAY, GAIN_ENV_FLOOR)
            const desiredGain = Math.min(GAIN_MAX, Math.max(1, GAIN_TARGET_PEAK / this.peakEnv))
            this.micGain += (desiredGain - this.micGain) * 0.3
            const pcmBytes = this.pcmFromFrames(this.frames, this.sampleCount, this.micGain)
            this.frames = []
            this.sampleCount = 0
            const sent = (this.rtcSession && this.rtcSession.connected)
                ? this.rtcSession.sendMicPcm(Base64.encode(pcmBytes), this.actualRate)
                : false
            if (sent) {
                if (this.sendSeq === 0) print("[Call] First voice chunk sent (Opus/RTP).")
                this.sendSeq += 1
            }
            if (this.chunkPeak < 0.0005) {
                this.zeroPeakChunks += 1
                if (this.zeroPeakChunks === 10 && !this.zeroPeakWarned) {
                    this.zeroPeakWarned = true
                    print("[Call] WARNING: mic frames are silent (peak ~0).")
                }
            } else {
                this.zeroPeakChunks = 0
            }
            this.chunkPeak = 0
        }
    }

    /** Float frames → gain-scaled S16 mono PCM bytes. */
    private pcmFromFrames(frames: Float32Array[], totalSamples: number, gain: number): Uint8Array {
        const pcm = new Int16Array(totalSamples)
        let offset = 0
        for (const frame of frames) {
            for (let i = 0; i < frame.length; i++) {
                const s = Math.max(-1, Math.min(1, frame[i] * gain))
                pcm[offset + i] = s * 32767
            }
            offset += frame.length
        }
        return new Uint8Array(pcm.buffer)
    }
}

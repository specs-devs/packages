// CallStreamer — the Glasses side of Call Friend, WebRTC-ONLY.
//
// The call is now pure WebRTC (H.264 POV + Opus voice over RTP/SRTP, peer-to-
// peer with the friend's phone). Snap Cloud / Supabase is NOT in the call path
// at all: the SDP/ICE signaling rides the Mobile Kit → phoneA → Multipeer →
// web helper portal, and the media flows
// directly between the Glasses and the friend's phone. The old JPEG/WAV-over-
// Realtime fallback has been removed from the call — it depended on a Realtime
// channel that never subscribes on device (Snap Cloud backend not answering
// joins; see WEBRTC-CALL.md / journal 2026-07-21).
//
// What this class still owns:
//   • the WebRTC session (WebRTCSession) — offers pov, answers voice;
//   • the AUDIO LIFECYCLE (v12, XR-AI parity): native-first on both ends.
//     Mic: native VOICE_CALL capture started once per pov connection under
//     the shared AUDIO_IN_OUT focus; the JS MicrophoneAudioProvider is a
//     fallback that opens ONLY if the native path fails. Speaker: native
//     pull-mode playback started once per voice connection; the JS
//     AudioOutput ring is the fallback (it simply keeps receiving PCM
//     whenever the native speaker isn't ACTIVE).
//     NO watchdog ever cycles open/close at the audio service: repeated
//     opens at an unhealthy service are how the whole audio stack wedged
//     (2026-08-07) — failures now get ONE fallback and a caption, not churn.
//
// The camera is owned entirely by the native WebRTC module (it grabs it when
// the pov session connects, via rtcEnsureCamera) — this class no longer touches
// the camera. Phone → Glasses video IS built: the phone's camera rides the inbound
// (recvonly) leg of the duplex pov session; the native module HW-decodes H.264 →
// RGBA and uploadFriendFrame turns it into the panel texture (onFriendVideoTexture).

import { WebRTCController } from "./WebRTCController"
import { WebRTCSession } from "./WebRTCSession"
import { RtcSignalTransport, STREAMER_GLASSES } from "../App/Types"

const MIC_ASSET = requireAsset("../../Audio/MicInput.micaudio") as AudioTrackAsset
// Streaming friend-voice playback: ONE persistent Audio Output asset fed PCM
// continuously. Replaces the WAV-batch path (a fresh DynamicResource + a
// RemoteMedia-loaded AudioTrackAsset every ~0.5 s), whose asset churn dragged
// the in-call lens to 6-9 fps over minutes and made audio come and go.
const VOICE_OUT_ASSET = requireAsset("../../Audio/RtcVoiceOutput.audioOutput") as AudioTrackAsset
const remoteMediaModule = require("LensStudio:RemoteMediaModule") as RemoteMediaModule

// 60 ms (was 0.3 s). The engine re-chunks whatever arrives into 20 ms Opus
// frames, so the JS chunk size only sets the WIRE BURST: 0.3 s chunks left the
// phone's NetEQ absorbing 15 back-to-back RTP packets every 300 ms (it stretches
// its buffer to cover the burst gap and time-warps speech = the choppy/warbly
// fallback voice). 60 ms = 3-packet bursts, and a lens fps dip degrades the
// cadence gracefully instead of multiplying an already-huge burst.
const AUDIO_CHUNK_S = 0.06
const SAMPLE_RATE = 16000
// JS mic is FALLBACK-ONLY (v12): it opens only after the native mic fails.
// Dead-air policy: ONE restart at the alternate rate, then report via the
// caption — the old restart-until-samples timer cycling opens at a sick
// audio service is the suspected trigger of the full audio-stack wedge.
const MIC_RETRY_S = 4
const MIC_MAX_RETRIES = 1
const MIC_FALLBACK_RATE = 44100
// WebRTC voice arrives as smoothly-paced 20 ms RTP frames, so a short prime
// keeps latency low without underruns.
const RTC_PLAY_BUFFER_START_S = 0.5
const PLAY_BUFFER_MAX_S = 4
// 0.5 s batches (was 0.25): every batch is a DynamicResource + a freshly
// loaded AudioTrackAsset — that churn (plus GC of the retired ones) is a
// prime suspect for the in-call lens fps dips and the audio dying on long
// calls. Fewer, bigger batches halve the churn for +250 ms worst-case lag.
const PLAY_BATCH_MIN_S = 0.5
// Warn when the mic has been started but produced no samples for this long.
const MIC_SILENT_WARN_S = 3
// Auto-gain: on device the Glasses mic delivers speech peaks of only ~0.01–0.05
// — normalize toward GAIN_TARGET_PEAK using a slow-decaying speech-peak
// envelope; GAIN_MAX bounds how far the noise floor can be amplified.
const GAIN_TARGET_PEAK = 0.45
const GAIN_MAX = 30
// Retuned for the 60 ms chunks: same wall-clock time constant the 0.3 s
// pipeline had at 0.985/chunk (envelope halves in ~4.5 s either way).
const GAIN_ENV_DECAY = 0.997 // per chunk
const GAIN_ENV_FLOOR = 0.005
// Native mic (module ≥ 2026-08-06 rebuild): SpecsAudioRecord VOICE_CALL source
// — hardware echo cancellation, no JS-side auto-gain needed, frames flow on a
// native thread regardless of lens fps. Handover happens once pov connects
// (the JS MicrophoneAudioProvider is stopped first — mic ownership); on native
// failure the JS pipeline resumes as the fallback. Flip NATIVE_MIC_ENABLED to
// false to force the old JS path without a rebuild.
const NATIVE_MIC_ENABLED = true
// Native-mic reliability policy (v12): ONE attempt per pov connection. A
// failed open, a stuck start, or a stall (rtcMicState()==2 with a frozen
// rtcMicFrames() counter = the record stream silently died) each hand over
// to the JS fallback ONCE and stop touching the native path until the pov
// leg reconnects. Retry timers/cooldown cycling were removed on the
// 2026-08-10 evidence: when the native open fails the audio service is
// sick (kernel -ENODEV) and more opens only make it worse.
const NATIVE_MIC_STALL_S = 3
// rtcMicStart resolves on a worker (awaitReady ≤ 2 s); if state is still
// "starting" after this long the open wedged — fall back instead of waiting.
const NATIVE_MIC_START_TIMEOUT_S = 8
// Hold the shared AUDIO_IN_OUT focus session while capturing (XR-AI parity:
// the platform docs say raw capture + playback users should hold one so the
// coordinator arbitrates the hardware for them). Friend voice now plays
// through the NATIVE speaker under the same session, so the old concern —
// the reservation preempting lens-side playback — no longer applies to the
// primary path. (Edge case: if the native speaker fails and voice falls back
// to lens-side AudioOutput while the mic holds focus, playback may duck —
// visible in the caption as "spk: js".)
const NATIVE_MIC_USE_FOCUS = true

export class CallStreamer {
    private running = false

    // The WebRTC media path. Requires libRemoteAssistanceWebRTCModule.so (device only);
    // in preview the native module is absent and the call cannot run.
    private rtcSession: WebRTCSession | null = null

    // Friend camera video (phone → Glasses). The native friendvid session decodes
    // H.264 → RGBA; we upload it into this ProceduralTexture and hand the Texture
    // to the display panel via onFriendVideoTexture (fired once per (re)create).
    private friendProcTex: Texture | null = null
    private friendProcProvider: ProceduralTextureProvider | null = null
    // Cache the texture dims OURSELVES — do NOT call texture.getWidth()/getHeight()
    // to decide recreation. On some LS runtimes a ProceduralTexture reports a
    // padded/zero size back, so a getWidth()-based guard is always-true and
    // recreates the texture EVERY frame → ~1 MB leaked/frame → GPU OOM crash in
    // seconds. Tracking the dims here means we create the texture exactly once.
    private friendTexW = 0
    private friendTexH = 0
    private friendFrameCount = 0
    /** Fired with the friend-video Texture when it's (re)created — wire to the
     *  POV panel's setFrameTexture so the wearer sees the friend. */
    onFriendVideoTexture: ((tex: Texture) => void) | null = null

    // Audio out (mic → Opus via the native pov session)
    private micControl: MicrophoneAudioProvider | null = null
    private micUpdate: UpdateEvent | null = null
    private frames: Float32Array[] = []
    private sampleCount = 0
    private sendSeq = 0
    private actualRate = SAMPLE_RATE
    // Mic diagnostics: catch the silent-failure modes (mic delivers nothing /
    // delivers all-zero samples) that are invisible without logging.
    private micStartedAt = 0
    private micEverProduced = false
    private micSilentWarned = false
    private micRetryCount = 0
    // Last time the JS mic delivered samples OR was (re)started — the dead-air
    // clock for the restart cycle (works mid-call, not just at start).
    private lastMicActivityAt = 0
    // Native mic state (see NATIVE_MIC_ENABLED). One attempt per pov
    // connection: `nativeMicFailed` latches until the pov leg reconnects.
    private nativeMicActive = false
    private nativeMicFailed = false
    private nativeMicStrikes = 0      // lifetime failure count (diag only)
    private nativeMicStartedAt = 0    // for the stuck-in-starting timeout
    private nativeMicLastFrames = -1  // stall watchdog: last rtcMicFrames() seen
    private nativeMicLastAdvanceAt = 0
    // Native speaker state: one start per voice connection; -1 state means the
    // JS AudioOutput fallback keeps playing (it still receives the PCM).
    private nativeSpeakerTried = false
    private lastHealthLogAt = 0       // ~5 s cadence for the streamed health line
    private chunkPeak = 0
    private zeroPeakChunks = 0
    private zeroPeakWarned = false
    private peakEnv = GAIN_ENV_FLOOR
    private micGain = 1

    // Audio in (jitter-buffered): decoded friend-voice PCM accumulates in
    // pcmQueue; batches are concatenated into one WAV and played seamlessly.
    private pcmQueue: Uint8Array[] = []
    private queuedBytes = 0
    private inRate = 0
    private playbackStarted = false
    private loadingBatch = false
    private recvCount = 0
    private playedCount = 0
    private decodeFails = 0
    private audioOut: AudioComponent
    private playbackPump: UpdateEvent | null = null
    // Streaming playback provider (see VOICE_OUT_ASSET) + reused S16→F32 scratch.
    private voiceOut: AudioOutputProvider | null = null
    private f32Scratch: Float32Array | null = null

    constructor(
        private readonly script: BaseScriptComponent,
        // Signaling transport for SDP/ICE — the Snap Cloud DB mailbox.
        private readonly signal: RtcSignalTransport
    ) {
        this.audioOut = script.getSceneObject()
            .createComponent("Component.AudioComponent") as AudioComponent
        this.audioOut.volume = 1.0
        // Deliberately default (LowPower) playback mode: LowLatency broke
        // playback of per-chunk dynamically-loaded tracks on device.
        try {
            this.voiceOut = VOICE_OUT_ASSET.control as AudioOutputProvider
            this.voiceOut.sampleRate = 48000 // WebRTC Opus voice; re-set on first chunk
            this.audioOut.audioTrack = VOICE_OUT_ASSET
            this.audioOut.play(-1) // continuous; the provider supplies samples
        } catch (e) {
            // No Audio Output asset (old project state) — the legacy WAV-batch
            // pump below still works, just with the known churn cost.
            this.voiceOut = null
            print("[Call] Audio Output unavailable (" + e + ") — WAV-batch fallback.")
        }
    }

    /**
     * One-line mic health for the call panel — the on-device answer to
     * "why can't my friend hear me" without a connected debugger.
     */
    micStatusLine(): string {
        const spkSt = this.rtcSession ? this.rtcSession.nativeSpeakerState() : 0
        const spk = spkSt === 2 ? " · spk: native ✓"
            : spkSt === -1 ? " · spk: js" : ""
        const inbound = " · in " + this.recvCount + "/" + this.playedCount +
            (this.decodeFails > 0 ? " (" + this.decodeFails + " bad)" : "") + spk
        if (this.nativeMicActive) {
            const st = this.rtcSession ? this.rtcSession.nativeMicState() : 0
            return (st === 2 ? "mic: native EC ✓" : "mic: native starting…") + inbound
        }
        if (!this.micControl) {
            return (this.nativeMicFailed
                ? "mic: native failed — JS fallback opening…"
                : "mic: waiting for connect…") + inbound
        }
        if (this.micSilentWarned) return "mic: DEAD — reboot Glasses?" + inbound
        if (!this.micEverProduced) {
            const silentFor = getTime() - this.micStartedAt
            return (silentFor > MIC_SILENT_WARN_S || this.micRetryCount > 0
                ? "mic: NO SAMPLES (try " + this.micRetryCount + ") — check permission"
                : "mic: starting…") + inbound
        }
        if (this.zeroPeakChunks >= 10) return "mic: SILENT (peak 0)" + inbound
        return "mic: JS ×" + this.micGain.toFixed(0) + " · sent " + this.sendSeq + inbound
    }

    /** Transport health for the caption ("rtc: pov ✓ voice …"). */
    transportLine(): string {
        return this.rtcSession ? this.rtcSession.statusLine() : "rtc: unavailable (preview / no module)"
    }

    /** Live POV quality change (kbps). Returns the applied value, or 0 when
     *  the WebRTC session isn't running (preview / module missing). */
    setVideoBitrate(kbps: number): number {
        return this.rtcSession ? this.rtcSession.setVideoBitrate(kbps) : 0
    }

    /** True once either media leg is up — flips the panel caption from the
     *  playful connecting loader to the real status line. */
    get mediaConnected(): boolean {
        return this.rtcSession !== null &&
            (this.rtcSession.povConnected || this.rtcSession.voiceConnected)
    }

    start(): void {
        if (this.running) return
        this.running = true
        this.startRtc()
        // v12: NO JS mic at call start. The pump loop below drives the native
        // mic/speaker lifecycle (start-on-connect) and only opens the JS
        // provider if the native mic fails.
        this.startMicPump()
        if (!this.voiceOut) this.startPlaybackPump() // WAV-batch fallback only
        print("[Call] Call started (WebRTC-only; native-first audio).")
    }

    stop(): void {
        this.running = false
        if (this.rtcSession) {
            this.rtcSession.stopNativeMic()     // also covered by rtcStop natively
            this.rtcSession.stopNativeSpeaker() // idem (voice destroy_slot)
            this.rtcSession.stop()
            this.rtcSession = null
        }
        this.nativeMicActive = false
        this.nativeMicFailed = false
        this.nativeMicLastFrames = -1
        this.nativeSpeakerTried = false
        if (this.micControl) this.micControl.stop()
        if (this.micUpdate) this.micUpdate.enabled = false
        if (this.playbackPump) this.playbackPump.enabled = false
        // Kill this call's audio output FOR REAL. Each call constructs a fresh
        // streamer, and the constructor adds a new AudioComponent playing the
        // ONE shared Audio Output provider with play(-1). Without stop+destroy
        // here, every call after the first had a zombie component draining the
        // same provider ring buffer alongside the live one — friend voice went
        // garbled/unstable on redial while call #1 sounded fine.
        try { this.audioOut.stop(false) } catch (e) { /* not playing */ }
        try { this.audioOut.destroy() } catch (e) { /* already destroyed */ }
        this.voiceOut = null
        this.pcmQueue = []
        this.queuedBytes = 0
        this.playbackStarted = false
        this.friendProcTex = null
        this.friendProcProvider = null
        this.friendTexW = 0
        this.friendTexH = 0
    }

    // ── WebRTC session ──────────────────────────────────────────────────

    private startRtc(): void {
        const native = WebRTCController.native
        if (!native) {
            // Preview or the .so isn't deployed — the WebRTC-only call cannot
            // run (there is no Realtime fallback anymore, by design).
            print("[Call] WebRTC native module unavailable (preview?) — " +
                "call is WebRTC-only, nothing to stream here.")
            return
        }
        this.rtcSession = new WebRTCSession(this.script, this.signal, native)
        this.rtcSession.onVoicePcm = (pcm, rate) => this.enqueueRtcPcm(pcm, rate)
        // Audio playback + lens health in the DB diag: aIn = PCM chunks
        // received, aPlay = WAV batches played, aErr = batch load failures,
        // aQms = jitter-buffer depth (ms), fps = lens frame rate. aIn growing
        // while aPlay stalls = the RemoteMedia playback path wedged; fps
        // decaying across minutes = the per-batch asset churn starving the lens.
        this.rtcSession.diagExtra = () => ({
            aIn: this.recvCount,
            aPlay: this.playedCount,
            aErr: this.decodeFails,
            aQms: this.inRate > 0
                ? Math.round(this.queuedBytes / (this.inRate * 2) * 1000) : 0,
            fps: Math.round(1 / Math.max(getDeltaTime(), 0.001)),
            // Native-mic state + voice-leg network health (reorder/PLC), so
            // "friend can't hear me" / "friend sounds robotic" are diagnosable
            // straight from rtc_signals diag rows.
            mic: this.nativeMicActive
                ? (this.rtcSession ? this.rtcSession.nativeMicState() : 0) : -2,
            // Native-mic liveness: PCM frames captured since the last start
            // (frozen while mic==2 ⇒ stall) + lifetime failure count.
            micF: this.rtcSession ? this.rtcSession.nativeMicFrames() : -1,
            micStrikes: this.nativeMicStrikes,
            // Outbound JS-path liveness (0 while the native mic owns capture) —
            // the 2026-08-10 diagnosis had to guess this from the LS log.
            sent: this.sendSeq,
            // Native speaker state: 2 = friend voice plays fully natively.
            spkSt: this.rtcSession ? this.rtcSession.nativeSpeakerState() : 0,
            arx: this.rtcSession ? this.rtcSession.audioRxStats() : "",
        })
        this.rtcSession.onPovConnected = (up) => {
            print("[Call] WebRTC pov " + (up ? "connected — POV live to friend." : "lost — re-offering."))
        }
        this.rtcSession.onFriendVideoFrame = (rgba, w, h) => this.uploadFriendFrame(rgba, w, h)
        this.rtcSession.start()
    }

    /** Friend voice over WebRTC: decoded mono PCM. Streaming path: S16→F32
     *  straight into the Audio Output provider's ring buffer — no batching,
     *  no per-chunk assets, immune to low lens fps. Falls back to the legacy
     *  WAV-batch jitter buffer when the provider is unavailable. */
    private enqueueRtcPcm(pcm: Uint8Array, rate: number): void {
        if (!this.running) return
        this.recvCount += 1
        if (this.recvCount === 1) print("[Call] First friend voice PCM over WebRTC.")
        if (this.voiceOut) {
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
            return
        }
        if (this.inRate !== 0 && rate !== this.inRate) this.resetPlaybackBuffer()
        this.inRate = rate
        this.pcmQueue.push(pcm)
        this.queuedBytes += pcm.length
        const maxBytes = PLAY_BUFFER_MAX_S * this.inRate * 2
        while (this.queuedBytes > maxBytes && this.pcmQueue.length > 1) {
            this.queuedBytes -= this.pcmQueue.shift()!.length
        }
    }

    /** Friend camera frame (RGBA8, already vertically flipped) → ProceduralTexture.
     *  Recreates the texture on a size change and hands it to the panel once. */
    private uploadFriendFrame(rgba: Uint8Array, w: number, h: number): void {
        // Sanity-clamp dims — a garbage w/h from the decoder would make a huge
        // allocation and take the lens down; ignore anything out of range.
        if (!this.running || w <= 0 || h <= 0 || w > 1920 || h > 1920) return
        const need = w * h * 4
        if (rgba.length < need) return
        // Recreate the ProceduralTexture ONLY on a genuine size change (tracked by
        // our own ints, never getWidth()). Steady state = created once, then
        // setPixels every frame into the SAME texture (no per-frame GPU alloc).
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

    /** One-liner for the call caption — whether the friend's camera is arriving. */
    friendVideoLine(): string {
        return this.friendFrameCount > 0
            ? "friend cam: " + this.friendFrameCount + " frames"
            : "friend cam: waiting…"
    }

    // ── Audio out: mic → Opus over the native pov session ───────────────

    /**
     * Native-mic state machine, run once per pump tick. Returns true while
     * native capture owns the mic (JS processing must idle).
     *
     *   pov connects ──▶ rtcMicStart(focus) — ONE attempt per connection
     *   native ──start FAILS / opens then STALLS / stuck starting──▶ stop it,
     *       latch nativeMicFailed, open the JS fallback ONCE. No retry timers:
     *       a failed open means the audio service is sick, and hammering
     *       VOICE_CALL opens at it wedges the whole stack.
     *   pov drops ──▶ rtcMicStop, clear the latch (a reconnect is a fresh
     *       connection and earns a fresh attempt; not a strike)
     */
    private manageNativeMic(): boolean {
        if (!NATIVE_MIC_ENABLED || this.nativeMicFailed) return false
        const rtc = this.rtcSession
        if (!rtc || !rtc.nativeMicSupported()) return false

        if (!this.nativeMicActive) {
            if (!rtc.povConnected) return false
            // Single mic owner: make sure the JS provider is closed before the
            // native record stream opens. Drop any half-built JS chunk so a
            // later fallback never sends stale audio.
            try { if (this.micControl) this.micControl.stop() } catch (e) { /* already stopped */ }
            this.frames = []
            this.sampleCount = 0
            if (rtc.startNativeMic(NATIVE_MIC_USE_FOCUS)) {
                this.nativeMicActive = true
                this.nativeMicStartedAt = getTime()
                this.nativeMicLastFrames = -1
                this.nativeMicLastAdvanceAt = getTime()
                print("[Call] Native mic starting (VOICE_CALL, echo-cancelled, focus=" +
                    NATIVE_MIC_USE_FOCUS + ").")
                return true
            }
            this.noteNativeMicFailure("native mic rejected")
            return false
        }

        // Native capture active (or still starting) — watch for failure/drop/stall.
        const st = rtc.nativeMicState()
        if (st === -1) {
            rtc.stopNativeMic()
            this.nativeMicActive = false
            this.noteNativeMicFailure("native mic failed to open")
            return false
        }
        if (!rtc.povConnected) {
            rtc.stopNativeMic()
            this.nativeMicActive = false
            this.nativeMicFailed = false // fresh connection, fresh attempt
            print("[Call] pov dropped — native mic stopped (restarts on reconnect).")
            return false
        }
        if (st === 2) {
            // Stall watchdog: ACTIVE but the frame counter froze ⇒ the record
            // stream silently died. Detect and fall back — never restart the
            // native stream mid-call (churn at a sick service).
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
            // Stuck in "starting" — the async open never resolved either way.
            rtc.stopNativeMic()
            this.nativeMicActive = false
            this.noteNativeMicFailure("native mic stuck starting")
            return false
        }
        return true
    }

    /**
     * Native-speaker lifecycle, run once per pump tick. ONE start per voice
     * connection; on failure (state -1) nothing else to do — the module keeps
     * routing decoded PCM to the JS AudioOutput fallback automatically.
     */
    private manageNativeSpeaker(): void {
        const rtc = this.rtcSession
        if (!rtc || !rtc.nativeSpeakerSupported()) return
        if (!rtc.voiceConnected) {
            this.nativeSpeakerTried = false // re-arm for the next connection
            return
        }
        if (this.nativeSpeakerTried) return
        this.nativeSpeakerTried = true
        if (rtc.startNativeSpeaker()) {
            print("[Call] Native speaker starting (friend voice, decode-thread fed).")
        } else {
            print("[Call] Native speaker unavailable — JS AudioOutput fallback.")
        }
    }

    /**
     * One compact outbound-audio health line every ~5 s, print()ed so it
     * streams into the LS log over push-to-device. The native module's stderr
     * (mic ACTIVE / start FAILED) does NOT reach that log, so without this the
     * failing path on device is invisible — exactly what made "audio unstable
     * on the second call" undiagnosable.
     */
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
        print("[Call] mic health: " + mode +
            " strikes=" + this.nativeMicStrikes +
            " spkSt=" + (rtc ? rtc.nativeSpeakerState() : 0) +
            " in=" + this.recvCount + "/" + this.playedCount +
            (this.decodeFails > 0 ? " err=" + this.decodeFails : ""))
    }

    /** Latch the native-mic failure for this pov connection and open the JS
     *  fallback ONCE. Every failure mode lands here — a failed open, a stall,
     *  a stuck start — and none of them triggers another native attempt:
     *  open/close churn at an unhealthy audio service is what wedged the
     *  whole stack (mic AND speaker dead until a Glasses reboot, 2026-08-07;
     *  kernel-level -ENODEV capture death, 2026-08-10). */
    private noteNativeMicFailure(why: string): void {
        this.nativeMicFailed = true
        this.nativeMicStrikes += 1
        this.restartJsMic(why + " — JS fallback for this connection")
    }

    private restartJsMic(why: string): void {
        print("[Call] Mic handover ← JS pipeline (" + why + ").")
        try {
            if (!this.micControl) {
                // JS provider never opened at call start — try again now (the
                // flaky-mic mode is often transient).
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
        // v12: the pump drives the whole audio lifecycle (native mic AND
        // native speaker start-on-connect, health logging, JS fallback). The
        // JS MicrophoneAudioProvider is NOT opened here — restartJsMic opens
        // it on the first native-mic failure.
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
            // Dead air — covers BOTH the flaky start (never produced anything)
            // and a MID-CALL death (produced fine, then silently stopped: the
            // state the JS mic lands in after a native-mic strike-out on an
            // unhealthy audio service). The old guard returned forever once
            // micEverProduced was true, so a later death had zero recovery.
            const silentFor = getTime() - this.lastMicActivityAt
            if (silentFor > MIC_RETRY_S && this.micRetryCount < MIC_MAX_RETRIES) {
                this.micRetryCount += 1
                const rate = this.micRetryCount % 2 === 1 ? MIC_FALLBACK_RATE : SAMPLE_RATE
                print("[Call] Mic silent — restart #" + this.micRetryCount +
                    " at " + rate + " Hz.")
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
                    " restarts — friend cannot hear you. If friend-voice playback " +
                    "is ALSO silent, the device audio service is wedged — REBOOT the Glasses.")
            }
            return
        }
        this.micEverProduced = true
        this.lastMicActivityAt = getTime()
        if (this.micRetryCount > 0 || this.micSilentWarned) {
            // Samples flow again — re-arm the dead-air recovery for next time.
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
            // Adapt gain to the observed speech envelope, smoothed between
            // chunks so it doesn't pump.
            this.peakEnv = Math.max(this.chunkPeak, this.peakEnv * GAIN_ENV_DECAY, GAIN_ENV_FLOOR)
            const desiredGain = Math.min(GAIN_MAX, Math.max(1, GAIN_TARGET_PEAK / this.peakEnv))
            this.micGain += (desiredGain - this.micGain) * 0.3
            const pcmBytes = this.pcmFromFrames(this.frames, this.sampleCount, this.micGain)
            this.frames = []
            this.sampleCount = 0
            // WebRTC-only: feed Opus over the pov session once it's connected;
            // before that there's nowhere to send (no fallback) — just drop.
            const sent = (this.rtcSession && this.rtcSession.povConnected)
                ? this.rtcSession.sendMicPcm(Base64.encode(pcmBytes), this.actualRate)
                : false
            if (sent) {
                if (this.sendSeq === 0) print("[Call] First voice chunk sent (Opus/RTP).")
                else if (this.sendSeq % 100 === 0) { // ~6 s at the 60 ms chunk rate
                    print("[Call] Voice chunks sent: " + this.sendSeq +
                        " (last peak " + this.chunkPeak.toFixed(3) +
                        " · gain ×" + this.micGain.toFixed(1) + ")")
                }
                this.sendSeq += 1
            }
            if (this.chunkPeak < 0.0005) {
                this.zeroPeakChunks += 1
                if (this.zeroPeakChunks === 10 && !this.zeroPeakWarned) {
                    this.zeroPeakWarned = true
                    print("[Call] WARNING: mic frames are silent (peak ~0) — " +
                        "friend will hear nothing.")
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

    /** 16-bit PCM mono bytes → WAV (for the RemoteMediaModule playback path). */
    private wavFromPcm(pcmBytes: Uint8Array, sampleRate: number): Uint8Array {
        const dataSize = pcmBytes.length
        const header = new ArrayBuffer(44)
        const view = new DataView(header)
        view.setUint32(0, 0x52494646, false)  // "RIFF"
        view.setUint32(4, 36 + dataSize, true)
        view.setUint32(8, 0x57415645, false)  // "WAVE"
        view.setUint32(12, 0x666d7420, false) // "fmt "
        view.setUint32(16, 16, true)
        view.setUint16(20, 1, true)           // PCM
        view.setUint16(22, 1, true)           // mono
        view.setUint32(24, sampleRate, true)
        view.setUint32(28, sampleRate * 2, true)
        view.setUint16(32, 2, true)
        view.setUint16(34, 16, true)
        view.setUint32(36, 0x64617461, false) // "data"
        view.setUint32(40, dataSize, true)
        const wav = new Uint8Array(44 + dataSize)
        wav.set(new Uint8Array(header), 0)
        wav.set(pcmBytes, 44)
        return wav
    }

    // ── Audio in: jitter-buffered, batch-concatenated playback ──────────

    private resetPlaybackBuffer(): void {
        this.pcmQueue = []
        this.queuedBytes = 0
        this.inRate = 0
        this.playbackStarted = false
    }

    private startPlaybackPump(): void {
        this.playbackPump = this.script.createEvent("UpdateEvent")
        this.playbackPump.bind(() => this.pumpPlayback())
    }

    private pumpPlayback(): void {
        if (!this.running || this.loadingBatch || this.audioOut.isPlaying()) return
        if (this.inRate === 0) return
        if (this.pcmQueue.length === 0) {
            // Sender stalled and we drained — go back to initial buffering.
            this.playbackStarted = false
            return
        }
        const queuedS = this.queuedBytes / (this.inRate * 2)
        const threshold = this.playbackStarted ? PLAY_BATCH_MIN_S : RTC_PLAY_BUFFER_START_S
        if (queuedS < threshold) return

        // Concatenate everything queued into one seamless WAV.
        const pcm = new Uint8Array(this.queuedBytes)
        let offset = 0
        for (const c of this.pcmQueue) {
            pcm.set(c, offset)
            offset += c.length
        }
        this.pcmQueue = []
        this.queuedBytes = 0
        const wav = this.wavFromPcm(pcm, this.inRate)

        this.loadingBatch = true
        try {
            const resource = DynamicResource.createWithBuffer(wav)
            remoteMediaModule.loadResourceAsAudioTrackAsset(
                resource,
                (track: AudioTrackAsset) => {
                    this.loadingBatch = false
                    this.audioOut.audioTrack = track
                    this.audioOut.play(1)
                    this.playbackStarted = true
                    this.playedCount += 1
                    if (this.playedCount === 1) print("[Call] Voice playback started (buffered).")
                },
                (err: string) => {
                    this.loadingBatch = false
                    this.decodeFails += 1
                    if (this.decodeFails <= 3 || this.decodeFails % 20 === 0) {
                        print("[Call] Voice batch load failed (#" +
                            this.decodeFails + "): " + err)
                    }
                }
            )
        } catch (e) {
            this.loadingBatch = false
            this.decodeFails += 1
            print("[Call] Voice batch error: " + e)
        }
    }
}

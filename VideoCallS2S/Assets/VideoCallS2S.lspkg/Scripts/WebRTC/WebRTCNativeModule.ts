/**
 * SpecsNDK native bridge for libVideoCallS2SWebRTCModule.so — the WebRTC media
 * path of the Glasses ↔ Glasses call (H.264 hardware encode/decode + Opus over RTP via
 * libSpecsWebRTC). Field decorator + loader, mirroring the SpecsNDK CoreJs pattern.
 */

/** Session kinds (mirror the C++ constants). The call uses kind 0 only. */
export const RTC_KIND_POV = 0 // the ONE duplex call session: camera + mic out, friend camera + voice in
export const RTC_KIND_VOICE = 1 // legacy: audio-only answerer (unused by the Glasses ↔ Glasses call)
export const RTC_KIND_FRIENDVID = 2 // legacy: video-only answerer (unused)

/** rtcCreate role argument for kind 0. */
export const RTC_ROLE_OFFERER = 0 // the CALLER: generates the offer immediately
export const RTC_ROLE_ANSWERER = 1 // the CALLEE: waits for the caller's offer, then answers

/** ping() value of the first module build that supports the Glasses ↔ Glasses call
 *  (pov answerer role + duplex audio). Older builds report 2. */
export const S2S_MODULE_GENERATION = 3

/** swrtc_state values surfaced by rtcState(). */
export const RTC_STATE_NONE = -1
export const RTC_STATE_NEW = 0
export const RTC_STATE_CONNECTING = 1
export const RTC_STATE_CONNECTED = 2
export const RTC_STATE_DISCONNECTED = 3
export const RTC_STATE_FAILED = 4
export const RTC_STATE_CLOSED = 5

/** One message from rtcPollSignal(kind), JSON-parsed. */
export interface NativeRtcSignal {
    t: "offer" | "answer" | "cand"
    sdp?: string
    cand?: string
    mid?: string
}

/** One message from rtcPollAudio(), JSON-parsed. */
export interface NativeRtcAudio {
    /** Sample rate of the decoded PCM (Opus clock, 48000). */
    r: number
    /** Base64 S16 mono PCM. */
    d: string
}

export type VideoCallS2SWebRTCNativeExports = {
    /** Module generation: 2 = Glasses ↔ phone builds, 3+ = Glasses ↔ Glasses capable. */
    ping: () => number
    /** UDP egress probe: >=0 bytes sent, <0 -(1000+errno)/-(2000+errno). */
    udpProbe: (b0: number, b1: number, b2: number, b3: number, port: number) => number
    /**
     * Create/replace the session of `kind`. For kind 0 the optional `role`
     * picks OFFERER (caller — the offer is generated immediately; ferry
     * rtcPollSignal(0) output to the peer) or ANSWERER (callee — wait for the
     * peer's offer, apply it with rtcSetRemoteDescription(0, 0, sdp), and the
     * answer appears on rtcPollSignal(0)). Returns 0 ok, else a negative swrtc_result.
     */
    rtcCreate: (kind: number, bitrateKbps: number, fps: number, maxWidth: number,
        stunUrl: string, maxQp?: number, role?: number) => number
    /** Apply the peer's SDP. type: 0 offer (auto-answers), 1 answer. */
    rtcSetRemoteDescription: (kind: number, type: number, sdp: string) => number
    rtcAddRemoteCandidate: (kind: number, candidate: string, mid: string) => number
    /** One queued local signaling message as JSON, or undefined. Drain per frame. */
    rtcPollSignal: (kind: number) => string | undefined
    rtcState: (kind: number) => number
    rtcStop: (kind: number) => number
    /** Retry the camera grab once the pov session is CONNECTED (returns 1 if running). */
    rtcEnsureCamera: () => number
    /** Feed mic PCM (base64 S16 mono at `sampleRate`) into the pov session (JS mic fallback). */
    rtcSendAudio: (b64Pcm16Mono: string, sampleRate: number) => number
    /** Drain decoded friend-voice PCM as JSON {r,d}, or undefined (JS speaker fallback). */
    rtcPollAudio: () => string | undefined
    rtcSetBitrate: (kbps: number) => number
    /** Native speaker state ("rate=48000 ch=1 burst=480 underruns=0"). */
    rtcSpeakerDiag?: () => string
    /** Receive-side audio network stats for `kind`, "" if no session. */
    rtcAudioRxStats?: (kind: number) => string
    /**
     * Start NATIVE echo-cancelled mic capture (VOICE_CALL source) feeding the pov
     * session. Async — poll rtcMicState(). Stop the JS mic provider FIRST.
     * useFocus=1 additionally holds an AUDIO_IN_OUT focus session.
     */
    rtcMicStart?: (useFocus: number) => number
    rtcMicStop?: () => number
    /** 0 idle, 1 starting, 2 active, -1 failed. */
    rtcMicState?: () => number
    /** PCM frames delivered by the native record stream since the last rtcMicStart
     *  (liveness signal: frozen while state==2 ⇒ capture silently died). */
    rtcMicFrames?: () => number
    /**
     * Start the NATIVE friend-voice speaker (pull-mode playback under the shared
     * AUDIO_IN_OUT focus). Async — poll rtcSpeakerState(). While ACTIVE decoded
     * voice goes straight to the speaker and rtcPollAudio returns nothing.
     */
    rtcSpeakerStart?: () => number
    rtcSpeakerStop?: () => number
    /** 0 idle, 1 starting, 2 active, -1 failed. */
    rtcSpeakerState?: () => number
    /**
     * Copy the newest decoded friend-camera RGBA frame into a caller-owned
     * PERSISTENT ArrayBuffer (zero per-frame alloc). width 0 = no new frame since
     * the last poll. Size the buffer to maxWidth*maxHeight*4.
     */
    pullInboundFrame: (buffer: ArrayBuffer) => { width: number; height: number }
}

const VideoCallS2SWebRTCNativeFieldKey = Symbol.for("specsndk.clad.VideoCallS2SWebRTCModule.nativeField")

/**
 * Loads **`../Modules/libVideoCallS2SWebRTCModule.so`**, assigns exports to the
 * **`@WebRTCNativeModule()`** field, then calls **`onLoaded.call(self, exports)`**.
 */
async function loadWebRTCNativeModule(
    self: BaseScriptComponent,
    onLoaded: (this: BaseScriptComponent, lib: VideoCallS2SWebRTCNativeExports) => void
): Promise<VideoCallS2SWebRTCNativeExports | null> {
    const inst = self as any
    const propKey = inst[VideoCallS2SWebRTCNativeFieldKey] as string | symbol | undefined
    if (propKey == null) {
        print(
            "WebRTCNativeModule.load: decorate a field with @" +
                "WebRTCNativeModule() before calling load()."
        )
        return null
    }

    try {
        const asset = (await requireAsset("../../Modules/libVideoCallS2SWebRTCModule.so")) as any
        const exports = (await asset.load()) as VideoCallS2SWebRTCNativeExports
        inst[propKey] = exports
        onLoaded.call(self, exports)
        return exports
    } catch (err) {
        print("WebRTCNativeModule: failed to load libVideoCallS2SWebRTCModule.so: " + err)
        inst[propKey] = null
        return null
    }
}

type WebRTCNativeModuleApi = (() => (
    _target: undefined,
    context: ClassFieldDecoratorContext
) => void) & {
    load: typeof loadWebRTCNativeModule
}

/**
 * **`@WebRTCNativeModule()`** — field decorator only: initializes the field
 * to **`null`** and records where **`load`** assigns exports.
 */
export const WebRTCNativeModule: WebRTCNativeModuleApi = Object.assign(
    function WebRTCNativeModule(): (
        _target: undefined,
        context: ClassFieldDecoratorContext
    ) => void {
        return function (_target: undefined, context: ClassFieldDecoratorContext) {
            const propertyKey = context.name

            context.addInitializer(function (this: BaseScriptComponent) {
                const inst = this as any
                inst[propertyKey] = null
                if (
                    inst[VideoCallS2SWebRTCNativeFieldKey] != null &&
                    inst[VideoCallS2SWebRTCNativeFieldKey] !== propertyKey
                ) {
                    print(
                        "WebRTCNativeModule: only one @WebRTCNativeModule() field is supported per instance."
                    )
                }
                inst[VideoCallS2SWebRTCNativeFieldKey] = propertyKey
            })
        }
    },
    { load: loadWebRTCNativeModule }
) as WebRTCNativeModuleApi

/**
 * SpecsNDK native bridge for libFriendFinderWebRTCModule.so — the real WebRTC media
 * path (H.264 hardware encode + Opus over RTP via libSpecsWebRTC). Mirrors the
 * StreamNativeModule loader pattern.
 */

/** Session kinds (mirror the C++ constants). */
export const RTC_KIND_POV = 0 // Glasses OFFERS: camera H.264 + mic Opus out
export const RTC_KIND_VOICE = 1 // phone offers its mic; Glasses ANSWERS: voice in
export const RTC_KIND_FRIENDVID = 2 // phone offers its camera H.264; Glasses ANSWERS + decodes to texture

/** swrtc_state values surfaced by rtcState(). */
export const RTC_STATE_NONE = -1
export const RTC_STATE_NEW = 0
export const RTC_STATE_CONNECTING = 1
export const RTC_STATE_CONNECTED = 2
export const RTC_STATE_DISCONNECTED = 3
export const RTC_STATE_FAILED = 4
export const RTC_STATE_CLOSED = 5

/** One message from rtcPollSignal(kind) / rtcPollAudio(), JSON-parsed. */
export interface NativeRtcSignal {
    t: "offer" | "answer" | "cand"
    sdp?: string
    cand?: string
    mid?: string
}

export interface NativeRtcAudio {
    /** Sample rate of the decoded PCM (Opus clock, 48000). */
    r: number
    /** Base64 S16 mono PCM. */
    d: string
}

export type FriendFinderWebRTCNativeExports = {
    /** 2 = webrtc-capable module generation. */
    ping: () => number
    /** UDP egress probe: >=0 bytes sent, <0 -(1000+errno)/-(2000+errno). */
    udpProbe: (b0: number, b1: number, b2: number, b3: number, port: number) => number
    /**
     * Create/replace the session of `kind` (0 pov offerer / 1 voice answerer).
     * pov generates its offer immediately — ferry rtcPollSignal output to the
     * peer. Returns 0 ok, else a negative swrtc_result.
     */
    rtcCreate: (kind: number, bitrateKbps: number, fps: number, maxWidth: number,
        stunUrl: string, maxQp?: number) => number
    /** Apply the peer's SDP. type: 0 offer (voice — auto-answers), 1 answer (pov). */
    rtcSetRemoteDescription: (kind: number, type: number, sdp: string) => number
    rtcAddRemoteCandidate: (kind: number, candidate: string, mid: string) => number
    /** One queued local signaling message as JSON, or undefined. Drain per frame. */
    rtcPollSignal: (kind: number) => string | undefined
    rtcState: (kind: number) => number
    rtcStop: (kind: number) => number
    /** Retry the camera grab once the pov session is CONNECTED (returns 1 if running). */
    rtcEnsureCamera: () => number
    /** Feed mic PCM (base64 S16 mono at `sampleRate`) into the pov session. */
    rtcSendAudio: (b64Pcm16Mono: string, sampleRate: number) => number
    /** Drain decoded friend-voice PCM as JSON {r,d}, or undefined. */
    rtcPollAudio: () => string | undefined
    rtcSetBitrate: (kbps: number) => number
    /** Native speaker state ("rate=48000 ch=1 burst=480 underruns=0"); absent
     *  on modules older than the 2026-08-06 native-speaker rebuild. */
    rtcSpeakerDiag?: () => string
    /** Receive-side audio network stats for `kind` ("rx_pkts=.. reorder=..
     *  gaps=.. plc_frames=.."), "" if no session; absent on older modules. */
    rtcAudioRxStats?: (kind: number) => string
    /**
     * Start NATIVE echo-cancelled mic capture (VOICE_CALL source) feeding the
     * pov session. Async — poll rtcMicState(). Stop the JS mic provider FIRST
     * and stop pushing rtcSendAudio once state is 2. useFocus=1 additionally
     * holds an AUDIO_IN_OUT focus session (may preempt lens-side audio).
     * Absent on older modules.
     */
    rtcMicStart?: (useFocus: number) => number
    rtcMicStop?: () => number
    /** 0 idle, 1 starting, 2 active, -1 failed. Absent on older modules. */
    rtcMicState?: () => number
    /** PCM frames delivered by the native record stream since the last
     *  rtcMicStart — the liveness signal for the stall watchdog (a frozen
     *  value while state==2 means capture silently died). Absent on modules
     *  older than the audio-reliability rebuild. */
    rtcMicFrames?: () => number
    /**
     * Start the NATIVE friend-voice speaker (pull-mode SpecsAudioPlayback under
     * the shared AUDIO_IN_OUT focus). Async — poll rtcSpeakerState(). While
     * ACTIVE the module feeds decoded voice straight to the speaker and
     * rtcPollAudio returns nothing; on failure the JS fallback keeps flowing.
     * Call on voice connect, from JS only. Absent on modules older than the
     * v12 native-audio rebuild.
     */
    rtcSpeakerStart?: () => number
    rtcSpeakerStop?: () => number
    /** 0 idle, 1 starting, 2 active, -1 failed. Absent on older modules. */
    rtcSpeakerState?: () => number
    /**
     * Copy the newest decoded friend-camera RGBA frame (from the kind-2 friendvid
     * session) into a caller-owned PERSISTENT ArrayBuffer (zero per-frame alloc).
     * Returns the frame size; width 0 = no new frame since the last poll (skip the
     * texture upload). Size the buffer to maxWidth*maxHeight*4.
     */
    pullInboundFrame: (buffer: ArrayBuffer) => { width: number; height: number }
}

const FriendFinderWebRTCNativeFieldKey = Symbol.for("specsndk.clad.FriendFinderWebRTCModule.nativeField")

/**
 * Loads **`../Modules/libFriendFinderWebRTCModule.so`**, assigns exports to the
 * **`@WebRTCNativeModule()`** field, then calls **`onLoaded.call(self, exports)`**.
 */
async function loadWebRTCNativeModule(
    self: BaseScriptComponent,
    onLoaded: (this: BaseScriptComponent, lib: FriendFinderWebRTCNativeExports) => void
): Promise<FriendFinderWebRTCNativeExports | null> {
    const inst = self as any
    const propKey = inst[FriendFinderWebRTCNativeFieldKey] as string | symbol | undefined
    if (propKey == null) {
        print(
            "WebRTCNativeModule.load: decorate a field with @" +
                "WebRTCNativeModule() before calling load()."
        )
        return null
    }

    try {
        const asset = (await requireAsset("../../Modules/libFriendFinderWebRTCModule.so")) as any
        const exports = (await asset.load()) as FriendFinderWebRTCNativeExports
        inst[propKey] = exports
        onLoaded.call(self, exports)
        return exports
    } catch (err) {
        print("WebRTCNativeModule: failed to load libFriendFinderWebRTCModule.so: " + err)
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
                    inst[FriendFinderWebRTCNativeFieldKey] != null &&
                    inst[FriendFinderWebRTCNativeFieldKey] !== propertyKey
                ) {
                    print(
                        "WebRTCNativeModule: only one @WebRTCNativeModule() field is supported per instance."
                    )
                }
                inst[FriendFinderWebRTCNativeFieldKey] = propertyKey
            })
        }
    },
    { load: loadWebRTCNativeModule }
) as WebRTCNativeModuleApi

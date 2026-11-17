# RemoteAssistance native API

[← Agent usage index](../README.md)

## Use when

Inspect native capability, exact exports and binary limitations.

Both bridges load package-relative device libraries asynchronously through their field decorator. `WebRTCNativeModule()` / `StreamNativeModule()` mark one field; `.load(self,onLoaded)` returns `Promise<Exports | null>`, assigns the field, then calls `onLoaded.call(self,exports)`. Failure logs/returns null without calling completion. The controllers expose static nullable native handles; callbacks are protected and no public ready event exists. Wait for a non-null handle; do not invoke lifecycle methods manually.

Keep native camera ownership exclusive. `rtcEnsureCamera` and `startStream` cannot safely coexist with another native/JS camera client. Native PCM uses base64 S16 mono; incoming RGBA uses a persistent caller-owned ArrayBuffer. Session currently allocates 1280×720×4; consume reused buffers immediately rather than retaining mutable frame references.

Optional mic/speaker/stats methods reflect binary generations, not availability guarantees. Mic/speaker state: 0 idle, 1 starting, 2 active, -1 failed. Start/stop return codes and async state must both be checked. The current wrapper capabilities expose presence checks. No Lens-level overlay/video-push API is present.

## WebRTC constants, types and exact exports

Reference fragment from [WebRTCNativeModule.ts](../Scripts/WebRTC/WebRTCNativeModule.ts); this is an interface, not a script to attach:

```text
/**
 * SpecsNDK native bridge for libRemoteAssistanceWebRTCModule.so — the real WebRTC media
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

export type RemoteAssistanceWebRTCNativeExports = {
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


```

## Stream exact exports

Retained native camera JPEG API, not a fallback automatically used by CallStreamer:

```text
/**
 * SpecsNDK native bridge for libRemoteAssistanceStreamModule.so — types + field decorator + `load` for StreamController.
 * When you add native exports, extend RemoteAssistanceStreamNativeExports (and call sites) alongside the C++ module.
 */

/** Shape of JS values exported from the CoreJs native module (see assignNativeFunctions in C++). */
export type RemoteAssistanceStreamNativeExports = {
    ping: () => number;
    /**
     * Open the Glasses RGB camera and start the native encoder worker: camera frames
     * are downscaled to <= maxWidth, JPEG-encoded (4:2:0, `quality` 1-100) and
     * base64'd at `fps`, entirely off the JS thread. Idempotent; parameters are
     * applied on every call. Returns 0 ok, -1 camera failed.
     *
     * While the native stream runs, the Lens must NOT also request the camera via
     * CameraModule — a second camera client evicts the first.
     */
    startStream: (maxWidth: number, quality: number, fps: number) => number;
    /** Stop the encoder worker and release the camera. Returns 0. */
    stopStream: () => number;
    /**
     * The latest base64 JPEG frame, or undefined when no NEW frame was encoded
     * since the last call (never returns duplicates). Sub-millisecond: one string
     * copy — drop the result straight into the Realtime `frame:<streamer>` payload.
     */
    getEncodedFrame: () => string | undefined;
};

/** Marks which field receives native exports (one decorated field per instance). */

```

## Native build

Use the preserved [Guide](guide.md#native-development-specsndk). Target recorded by source instructions is SpecsNDK 1.1 (1.1.0). The host SDK and matching device Opus/patched libdatachannel build dependencies are separate distributions, not included by Lens Studio. Extract both package source ZIPs beside Assets; WebRTC uses Stream camera sources.

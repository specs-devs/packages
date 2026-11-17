# VideoCallS2S components

[← Agent usage index](../README.md)

## Use when

Import the installed revision’s public classes, functions and wire types, or wire component inputs. This reference was derived from TypeScript source declarations. Defaults are source initializers; prefab values may override them. Public signatures do not certify runtime availability. Lifecycle methods are included for accuracy, not as user commands.

Prefab `VideoCallS2S__PLACE_IN_SCENE` children: `SnapCloudRequirements` (the package's single SupabaseProject slot, left empty), then `CredentialsWarning`, `Guide` and `ExampleCarousel` (demo scaffolding, see [below](#demo-scaffolding-example)), then `VideoCallS2SDemo`, which holds `Core` (VideoCallS2SManager, snapCloud wired to the Snap Cloud object's SnapCloudModule, previewTestPattern true), `WebRTC · NDK` (WebRTCController) and `Snap Cloud` (SnapCloudModule + SupabaseRequirements, snapCloudRequirements wired to the `SnapCloudRequirements` object, deprecated supabaseProject unassigned).

## App/CallPanelUI.ts

Consumer import: `VideoCallS2S.lspkg/Scripts/App/CallPanelUI`.

Floating aspect-fit remote video/caption with hangup and quality-toggle events. Install listeners before use; setting a texture is not proof of native connectivity.

### CallPanelUI

Lens component. extends BaseScriptComponent.

No @inputs declared.

| Public member | Declaration / source default |
|---|---|
| `onHangUp` | `get onHangUp(): PublicApi<void>` |
| `onQualityToggle` | `get onQualityToggle(): PublicApi<void>` |
| `onAwake` | `method onAwake(): void` |
| `setQualityLabel` | `method setQualityLabel(text: string): void` |
| `setFrameTexture` | `method setFrameTexture(texture: Texture): void` |
| `setCaption` | `method setCaption(text: string): void` |

## App/HomeUI.ts

Consumer import: `VideoCallS2S.lspkg/Scripts/App/HomeUI`.

Home screen PublicApi<string> onCall emits entered peer code; setStatus supports info/ok/warn tones. Pairing code is not an authentication credential. Runtime initialization uses UIKit.

Source declaration (reference text, not a standalone snippet):

```text
export type StatusTone = "info" | "ok" | "warn"
```

### HomeUI

Lens component. extends BaseScriptComponent.

No @inputs declared.

| Public member | Declaration / source default |
|---|---|
| `onCall` | `get onCall(): PublicApi<string>` |
| `onAwake` | `method onAwake(): void` |
| `hide` | `method hide(): void` |
| `show` | `method show(): void` |
| `setCode` | `method setCode(code: string): void` |
| `setStatus` | `method setStatus(text: string, tone: StatusTone = "info"): void` |
| `setCallEnabled` | `method setCallEnabled(enabled: boolean): void` |
| `clearInput` | `method clearInput(): void` |

## App/IncomingCallUI.ts

Consumer import: `VideoCallS2S.lspkg/Scripts/App/IncomingCallUI`.

Incoming dialog exposes onAccept/onDeny PublicApi<void> and setCaller. Manager drives timeout/state, not this UI component alone.

### IncomingCallUI

Lens component. extends BaseScriptComponent.

No @inputs declared.

| Public member | Declaration / source default |
|---|---|
| `onAccept` | `get onAccept(): PublicApi<void>` |
| `onDeny` | `get onDeny(): PublicApi<void>` |
| `onAwake` | `method onAwake(): void` |
| `setCaller` | `method setCaller(code: string): void` |

## App/Types.ts

Consumer import: `VideoCallS2S.lspkg/Scripts/App/Types`.

Shared call protocol types and pairing helpers: the app title, `CallRole`, the `rtc_signals` message kinds and payload, the `RtcSignalTransport` interface implemented by RtcMailbox, the 4-digit pairing code (`makePairingCode`, `normalizePairingCode`) and `callSessionId` (`s2s-` + callee code).

Source declaration (reference text, not a standalone snippet):

```text
export const APP_TITLE = "VIDEO CALL S2S"
```

Source declaration (reference text, not a standalone snippet):

```text
export type CallRole = "caller" | "callee"
```

Source declaration (reference text, not a standalone snippet):

```text
export type RtcKind = "pov" | "ring" | "accept" | "decline" | "busy" | "bye" | "diag"
```

Source declaration (reference text, not a standalone snippet):

```text
export type RtcSignalType =
    "offer" | "answer" | "cand" | "ring" | "accept" | "decline" | "busy" | "bye" | "diag"
```

Source declaration (reference text, not a standalone snippet):

```text
export interface RtcSignalPayload {
    t: RtcSignalType
    sdp?: string
    cand?: string
    mid?: string
}
```

Source declaration (reference text, not a standalone snippet):

```text
export interface RtcSignalTransport {
    /** True when the underlying link can actually carry a message right now. */
    readonly isConnected: boolean
    onRtcSignal(kind: RtcKind, cb: (p: RtcSignalPayload, from: string) => void): void
    offRtcSignal(kind: RtcKind): void
    sendRtcSignal(kind: RtcKind, payload: RtcSignalPayload): boolean
    /** Optional fire-and-forget diagnostic snapshot (ICE states, counters, NO IPs). */
    sendDiag?(state: string): void
}
```

Source declaration (reference text, not a standalone snippet):

```text
export const PAIRING_CODE_LENGTH = 4
```

Source declaration (reference text, not a standalone snippet):

```text
export function makePairingCode(): string
```

Source declaration (reference text, not a standalone snippet):

```text
export function normalizePairingCode(raw: string): string | null
```

Source declaration (reference text, not a standalone snippet):

```text
export function callSessionId(calleeCode: string): string
```

## App/VideoCallS2SManager.ts

Consumer import: `VideoCallS2S.lspkg/Scripts/App/VideoCallS2SManager`.

Manager builds runtime home/dialog/panel and owns private idle/calling/ringing/in-call state. No public call/start/accept/hangup API. snapCloud is allowed undefined for preview but required for real calling. previewTestPattern opens synthetic UI only when cloud is not ready, in editor; default true, no effect on device. Outgoing ring timeout 45s, incoming 60s.

### VideoCallS2SManager

Lens component. extends BaseScriptComponent.

| Input | Type | Source default | Meaning / annotation |
|---|---|---|---|
| `snapCloud` | `SnapCloudModule` | `unassigned` | Snap Cloud block — the ▸ Snap Cloud object (SnapCloudModule + SupabaseRequirements). REQUIRED for calling: it carries the pairing handshake and WebRTC signaling., @allowUndefined |
| `previewTestPattern` | `boolean` | `true` | Lens Studio preview only: with no Snap Cloud project assigned, CALL FRIEND (any code) opens the call panel with a synthetic test pattern so the call UI stays iterable. Has no effect on device. |

| Public member | Declaration / source default |
|---|---|
| `onAwake` | `method onAwake(): void` |

## SnapCloud/RtcMailbox.ts

Consumer import: `VideoCallS2S.lspkg/Scripts/SnapCloud/RtcMailbox`.

DB rtc_signals handshake/signaling. Starts async, exposes readiness/schema-missing callbacks and schemaMissing flag; constructor public readonly session/me fields. Poll defaults 0.4s active/1.5s idle; seeds cursor to newest row on join. Auth tries Snapchat first, anonymous fallback. stop releases polling, not an automatic manager state transition.

Source declaration (reference text, not a standalone snippet):

```text
export const POLL_ACTIVE_S = 0.4
```

Source declaration (reference text, not a standalone snippet):

```text
export const POLL_IDLE_S = 1.5
```

Source declaration (reference text, not a standalone snippet):

```text
export const SCHEMA_MISSING_HINT =
    "Snap Cloud schema missing (rtc_signals) — open the project in Lens Studio to apply it, or run: supabase db push"
```

### RtcMailbox

Helper class, not an Inspector component. implements RtcSignalTransport.

No @inputs declared.

| Public member | Declaration / source default |
|---|---|
| `schemaMissing` | `schemaMissing: inferred = false` |
| `session` | `session: string = [constructor supplied]` |
| `me` | `me: string = [constructor supplied]` |
| `constructor` | `constructor constructor(private readonly script: BaseScriptComponent, readonly session: string, readonly me: string, pollInterval: number = POLL_ACTIVE_S)` |
| `isConnected` | `get isConnected(): boolean` |
| `onReady` | `set onReady(cb: (() => void) \| null): inferred` |
| `onSchemaMissing` | `set onSchemaMissing(cb: (() => void) \| null): inferred` |
| `setPollInterval` | `method setPollInterval(seconds: number): void` |
| `start` | `method start(): void` |
| `onRtcSignal` | `method onRtcSignal(kind: RtcKind, cb: (p: RtcSignalPayload, from: string) => void): void` |
| `offRtcSignal` | `method offRtcSignal(kind: RtcKind): void` |
| `sendRtcSignal` | `method sendRtcSignal(kind: RtcKind, payload: RtcSignalPayload): boolean` |
| `sendDiag` | `method sendDiag(state: string): void` |
| `stop` | `method stop(): void` |

## SnapCloud/SnapCloudModule.ts

Consumer import: `VideoCallS2S.lspkg/Scripts/SnapCloud/SnapCloudModule`.

Requires active hierarchy and a SupabaseProject assigned on SnapCloudRequirements (read through SupabaseRequirements). createRtcMailbox returns null otherwise; caller drives start/stop. Presence of asset is not authentication success.

### SnapCloudModule

Lens component. extends BaseScriptComponent.

No @inputs declared.

| Public member | Declaration / source default |
|---|---|
| `isConfigured` | `method isConfigured(): boolean` |
| `createRtcMailbox` | `method createRtcMailbox(session: string, me: string, pollInterval?: number): RtcMailbox \| null` |

## SnapCloud/SupabaseRequirements.ts

Consumer import: `VideoCallS2S.lspkg/Scripts/SnapCloud/SupabaseRequirements`.

On the `Snap Cloud` object. Reads the SupabaseProject from the root `SnapCloudRequirements` component and hands it to RtcMailbox (see [SnapCloudRequirements](#snapcloudrequirements-credentials)).

### SupabaseRequirements

Lens component. extends BaseScriptComponent.

| Input | Type | Source default | Meaning / annotation |
|---|---|---|---|
| `snapCloudRequirements` | `SnapCloudRequirements` | `unassigned` | SnapCloudRequirements component holding the SupabaseProject, @allowUndefined |
| `supabaseProject` | `SupabaseProject` | `unassigned` | Deprecated: use snapCloudRequirements (only read when it isn't wired), @allowUndefined |
| `text` | `Text` | `unassigned` | Optional Text that shows a setup warning until the asset is assigned, @allowUndefined |

| Public member | Declaration / source default |
|---|---|
| `onAwake` | `method onAwake(): void` |
| `isConfigured` | `method isConfigured(): boolean` |
| `getSupabaseProject` | `method getSupabaseProject(): SupabaseProject \| null` |
| `getProject` | `static method getProject(caller: string): SupabaseProject \| null` |

## WebRTC/CallStreamer.ts

Consumer import: `VideoCallS2S.lspkg/Scripts/WebRTC/CallStreamer`.

Owns native-first camera/audio/video path and JS audio fallback. Exposes unavailableReason for missing/too-old native module and mediaConnected for actual session state. Constructor readonly role is public. Device media is not established by the editor synthetic feed.

### CallStreamer

Helper class, not an Inspector component. .

No @inputs declared.

| Public member | Declaration / source default |
|---|---|
| `onFriendVideoTexture` | `onFriendVideoTexture: ((tex: Texture) => void) \| null = null` |
| `role` | `role: CallRole = [constructor supplied]` |
| `constructor` | `constructor constructor(private readonly script: BaseScriptComponent, private readonly signal: RtcSignalTransport, readonly role: CallRole)` |
| `unavailableReason` | `get unavailableReason(): string \| null` |
| `micStatusLine` | `method micStatusLine(): string` |
| `transportLine` | `method transportLine(): string` |
| `friendVideoLine` | `method friendVideoLine(): string` |
| `setVideoBitrate` | `method setVideoBitrate(kbps: number): number` |
| `mediaConnected` | `get mediaConnected(): boolean` |
| `start` | `method start(): void` |
| `stop` | `method stop(): void` |

## WebRTC/PreviewVideoSource.ts

Consumer import: `VideoCallS2S.lspkg/Scripts/WebRTC/PreviewVideoSource`.

SyntheticVideoSource generates 320x180 animated gradient/scanline texture; manager uses it only in editor. Helper has no built-in device gate itself, so consumers must preserve intended preview-only ownership.

### SyntheticVideoSource

Helper class, not an Inspector component. .

No @inputs declared.

| Public member | Declaration / source default |
|---|---|
| `onTexture` | `onTexture: ((tex: Texture) => void) \| null = null` |
| `constructor` | `constructor constructor(private readonly script: BaseScriptComponent)` |
| `start` | `method start(): void` |
| `statusLine` | `method statusLine(): string` |
| `stop` | `method stop(): void` |

## WebRTC/WebRTCController.ts

Consumer import: `VideoCallS2S.lspkg/Scripts/WebRTC/WebRTCController`.

Loads Modules/libVideoCallS2SWebRTCModule.so and publishes static native after decorator loader success. Source-only docs do not certify prebuilt binary generation or device execution.

### WebRTCController

Lens component. extends BaseScriptComponent.

No @inputs declared.

| Public member | Declaration / source default |
|---|---|
| `native` | `static native: VideoCallS2SWebRTCNativeExports \| null = null` |
| `onAwake` | `method onAwake(): inferred` |

## WebRTC/WebRTCNativeModule.ts

Consumer import: `VideoCallS2S.lspkg/Scripts/WebRTC/WebRTCNativeModule`.



Source declaration (reference text, not a standalone snippet):

```text
export const RTC_KIND_POV = 0
```

Source declaration (reference text, not a standalone snippet):

```text
export const RTC_KIND_VOICE = 1
```

Source declaration (reference text, not a standalone snippet):

```text
export const RTC_KIND_FRIENDVID = 2
```

Source declaration (reference text, not a standalone snippet):

```text
export const RTC_ROLE_OFFERER = 0
```

Source declaration (reference text, not a standalone snippet):

```text
export const RTC_ROLE_ANSWERER = 1
```

Source declaration (reference text, not a standalone snippet):

```text
export const S2S_MODULE_GENERATION = 3
```

Source declaration (reference text, not a standalone snippet):

```text
export const RTC_STATE_NONE = -1
```

Source declaration (reference text, not a standalone snippet):

```text
export const RTC_STATE_NEW = 0
```

Source declaration (reference text, not a standalone snippet):

```text
export const RTC_STATE_CONNECTING = 1
```

Source declaration (reference text, not a standalone snippet):

```text
export const RTC_STATE_CONNECTED = 2
```

Source declaration (reference text, not a standalone snippet):

```text
export const RTC_STATE_DISCONNECTED = 3
```

Source declaration (reference text, not a standalone snippet):

```text
export const RTC_STATE_FAILED = 4
```

Source declaration (reference text, not a standalone snippet):

```text
export const RTC_STATE_CLOSED = 5
```

Source declaration (reference text, not a standalone snippet):

```text
export interface NativeRtcSignal {
    t: "offer" | "answer" | "cand"
    sdp?: string
    cand?: string
    mid?: string
}
```

Source declaration (reference text, not a standalone snippet):

```text
export interface NativeRtcAudio {
    /** Sample rate of the decoded PCM (Opus clock, 48000). */
    r: number
    /** Base64 S16 mono PCM. */
    d: string
}
```

Source declaration (reference text, not a standalone snippet):

```text
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
```

Exported binding `WebRTCNativeModule` is a class-field decorator with a `.load(self, onLoaded)` loader. Exactly one decorated field is supported per instance. Loader assigns native exports then calls `onLoaded.call(self, exports)`; returns a Promise of exports or null on load failure. This is a native loading utility, not a component.

## WebRTC/WebRTCSession.ts

Consumer import: `VideoCallS2S.lspkg/Scripts/WebRTC/WebRTCSession`.

One duplex POV native peer session with role caller/offerer or callee/answerer; not the S2M multi-kind call protocol. Native capability test ping >= 3. Optional native audio support methods must be checked, callbacks assigned before start, and owned sessions stopped. Quality presets 1000/2000/3500 kbps.

Source declaration (reference text, not a standalone snippet):

```text
export const VIDEO_QUALITY_PRESETS_KBPS = [1000, 2000, 3500]
```

### WebRTCSession

Helper class, not an Inspector component. .

No @inputs declared.

| Public member | Declaration / source default |
|---|---|
| `onVoicePcm` | `onVoicePcm: ((pcm: Uint8Array, rate: number) => void) \| null = null` |
| `onConnected` | `onConnected: ((connected: boolean) => void) \| null = null` |
| `onFriendVideoFrame` | `onFriendVideoFrame: ((rgba: Uint8Array, width: number, height: number) => void) \| null = null` |
| `diagExtra` | `diagExtra: (() => { [k: string]: number \| string }) \| null = null` |
| `role` | `role: CallRole = [constructor supplied]` |
| `constructor` | `constructor constructor(private readonly script: BaseScriptComponent, private readonly sig: RtcSignalTransport, private readonly native: VideoCallS2SWebRTCNativeExports, readonly role: CallRole)` |
| `isS2SCapable` | `static method isS2SCapable(native: VideoCallS2SWebRTCNativeExports): boolean` |
| `connected` | `get connected(): boolean` |
| `statusLine` | `method statusLine(): string` |
| `start` | `method start(): void` |
| `stop` | `method stop(): void` |
| `sendMicPcm` | `method sendMicPcm(b64Pcm: string, sampleRate: number): boolean` |
| `nativeMicSupported` | `method nativeMicSupported(): boolean` |
| `startNativeMic` | `method startNativeMic(useFocus: boolean): boolean` |
| `stopNativeMic` | `method stopNativeMic(): void` |
| `nativeMicState` | `method nativeMicState(): number` |
| `nativeMicFrames` | `method nativeMicFrames(): number` |
| `audioRxStats` | `method audioRxStats(): string` |
| `nativeSpeakerSupported` | `method nativeSpeakerSupported(): boolean` |
| `startNativeSpeaker` | `method startNativeSpeaker(): boolean` |
| `stopNativeSpeaker` | `method stopNativeSpeaker(): void` |
| `nativeSpeakerState` | `method nativeSpeakerState(): number` |
| `setVideoBitrate` | `method setVideoBitrate(kbps: number): number` |
| `videoBitrateKbps` | `get videoBitrateKbps(): number` |

## SnapCloudRequirements (credentials)

`VideoCallS2S.lspkg/SnapCloudRequirements.ts`, at the package root (not under `Scripts/`); consumer import `VideoCallS2S.lspkg/SnapCloudRequirements`. On the prefab's first child, `SnapCloudRequirements`. It holds the `SupabaseProject` that `SupabaseRequirements.snapCloudRequirements` and `CredentialsWarning` read. It imports `Utilities.lspkg/Scripts/Utils/Logger` and `SnapDecorators.lspkg/decorators`.

| Input | Type | Default | Notes |
|---|---|---|---|
| `supabaseProject` | `SupabaseProject` | none | Created with *Window → Supabase → Import Credentials*. Empty in the shipped prefab |
| `text` | `Text` | none | Optional; shows the "not configured" warning, disabled once configured. Unassigned on the prefab |
| `disableWarningsWhenConfigured` | boolean | `true` | |
| `showSetupInstructions` | boolean | `true` | Prints setup steps at awake while unconfigured (only when logging is on) |
| `enableDebugLogs` | boolean | `true` | Stored and set by `setDebugLogging()`; prints are gated by the two flags below |
| `enableLogging` | boolean | `false` | Gates all of its prints, including the console warning |
| `enableLoggingLifecycle` | boolean | `false` | Lifecycle prints |

| Member | Signature | Notes |
|---|---|---|
| `getSupabaseProject` | `(): SupabaseProject` | The assigned project (undefined when unset) |
| `isConfigured` | `(): boolean` | `true` when a project is assigned (checked at awake and by `revalidate()`) |
| `getSupabaseUrl` / `getSupabasePublicToken` | `(): string` | `""` when unset |
| `getSupabaseHeaders` | `(): {[key: string]: string}` | `Content-Type`, `apikey`, `Authorization: Bearer <publicToken>`; `{}` when unset |
| `getStorageApiUrl` / `getRestApiUrl` / `getFunctionsApiUrl` | `(): string` | Project URL + `/storage/v1/object/public/`, `/rest/v1/`, `/functions/v1/` |
| `setDebugLogging` | `(enabled: boolean): void` | Sets `enableDebugLogs` |
| `revalidate` | `(): void` | Re-checks the configuration after you assign a project from code |

## Demo scaffolding (`Example/`)

The prefab carries its own demo UI, shipped in `VideoCallS2S.lspkg/Example/`. These are demo scripts, not call API: reuse them for a demo, not as a Lens pattern. They import InteractionKit and UIKit.

### CredentialsWarning

`Example/CredentialsWarning/CredentialsWarning.ts`, on the prefab's `CredentialsWarning` child (after `SnapCloudRequirements`, before `Guide`). While the SupabaseProject on `SnapCloudRequirements` is missing it shows a red-framed "Credentials needed" panel that lists what to set and holds the guide (and what the guide hides) until "Continue without credentials". Everything configured: it turns itself off and the guide shows directly.

| Input | Type | Default | Meaning |
|---|---|---|---|
| `guide` | `SceneObject` | — | guide shown after the warning; the prefab's `Guide` |
| `snapCloudRequirements` | `ScriptComponent` | unassigned | wired to the prefab's `SnapCloudRequirements`; empty = Snap Cloud not checked |
| `rsgCredentials` | `ScriptComponent` | unassigned | Remote Service Gateway credentials; empty on the prefab (not used) |
| `requireSnapToken` / `requireOpenAIToken` / `requireGoogleToken` | `boolean` | `false` | RSG tokens the examples need; all `false` on the prefab |
| `buttonLabel` | `string` | `"Continue without credentials"` | button label |

Public `findMissing(): string[]` returns the list it shows (empty when everything is set).

### ExampleCarousel

`Example/ExampleCarousel/ExampleCarousel.ts`, on the prefab's `ExampleCarousel` child. A UIKit panel with the example name, a description, Previous / Next (only with more than one example) and a minimize button.

| Input | Type | Default | Meaning |
|---|---|---|---|
| `examples` | `SceneObject[]` | `[]` | example roots; the prefab lists its `VideoCallS2SDemo` child |
| `exampleInfo` | `string[]` | `[]` | description per example |
| `steps` | `SceneObject[]` | `[]` | optional sub-examples stepped through one at a time; empty on the prefab |
| `stepInfo` | `string[]` | `[]` | description per entry of `steps` (same order); empty entries fall back to the example's info; empty on the prefab |
| `startIndex` | `number` | `0` | example shown first |
| `previousLabel` / `nextLabel` | `string` | `"Previous"` / `"Next"` | button labels |
| `examplesPushBack` | `number` | `20` | extra distance (cm) of the examples behind the panel |
| `anchorExamples` | `boolean` | `true` | move the examples to the head pose; `false` on the prefab (the manager places its own UI) |
| `startMinimized` | `boolean` | `false` | start collapsed to the title bar; `true` on the prefab |
| `extraPanelDrop` | `number` | `0` | extra drop (cm) of the panel; `-31` on the prefab, so it sits above the home panel |

### GuideDismissPanel

`Example/GuideDismissPanel/GuideDismissPanel.ts`, on the prefab's `Guide` child (next to a UIKit `Frame`, with a `GuideText` and an `OkButton` child). It shows the guide in front of the user and closes it on "Ok, I understood".

| Input | Type | Default | Meaning |
|---|---|---|---|
| `buttonLabel` | `string` | `"Ok, I understood"` | button label when the panel is built at runtime |
| `hideUntilDismissed` | `SceneObject[]` | `[]` | objects hidden while the guide shows; the prefab lists `ExampleCarousel` and `VideoCallS2SDemo`, never the prefab root |

Because `VideoCallS2SDemo` stays disabled until the guide is closed, the manager starts (and shows its pairing code) only after "Ok, I understood".

## Assets

- `Audio/MicInput.micaudio` (microphone) and `Audio/RtcVoiceOutput.audioOutput` (friend's voice), loaded by CallStreamer.
- `Audio/ConnectChime.wav` (connect chime) and `Audio/TargetPing.wav` (ring), loaded by VideoCallS2SManager.
- `Materials/ImageMaterial.mat` (on `Shaders/flat.graphShader`), loaded by CallPanelUI for the remote video; `Images/Image.png`.
- `Modules/libVideoCallS2SWebRTCModule.so`: the native module (runs only on a SPECS device, not in the Lens Studio Preview); its rebuild sources are `ExtractAtProjectRoot/VideoCallS2SWebRTCModule.zip` (see [setup](setup.md)).

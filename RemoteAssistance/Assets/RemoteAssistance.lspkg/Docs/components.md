# RemoteAssistance components and protocol

[← Agent usage index](../README.md)

## Use when

Configure exact public inputs, methods, callbacks and payloads.

## Prefab and lifecycle

Drag [RemoteAssistance__PLACE_IN_SCENE.prefab](../RemoteAssistance__PLACE_IN_SCENE.prefab) into a scene with InteractionKit/UIKit camera/interactor setup. `SnapCloudRequirements` has an empty SupabaseProject reference (assign your own; see [Setup](setup.md)); manager cloud/annotation handles and stroke material are wired. Native loaders and annotations are identity-scale objects. Manager creates its own world root/menu/panel at runtime; do not move annotation geometry with a carousel. Prefab children, in order: `SnapCloudRequirements` (the Snap Cloud project), `CredentialsWarning` (red "Credentials needed" panel), `Guide` (onboarding panel, see [Demo scaffolding](#demo-scaffolding-example)), `ExampleCarousel`, and the demo group `RemoteAssistanceDemo [RemoteAssistance]`. The group carries RemoteAssistanceManager and holds StreamController, WebRTCController, SnapCloud (SnapCloudModule, whose `snapCloudRequirements` is wired to the `SnapCloudRequirements` object, plus an old disabled warning Text) and Annotations3D. The prefab root itself has no components.

The two native modules (`Modules/*.so`, loaded by StreamController and WebRTCController) run only on a SPECS device. In the Lens Studio Preview they don't load and `static native` stays null, so a call sends no media; what you see there is the manager's `simulateInPreview` demo drawing (Editor only).

The runtime root (`Remote Assistance` → UIPanel/ModeMenu, VideoCall, plus the reparented Annotations3D) is a new scene ROOT, not a child of the prefab instance. Disabling the instance after its Awake does not hide the menu. The shipped Guide gates the demo group before it awakes; to use your own guide instead, disable the demo group (or the instance) before it awakes (e.g. a guide script higher in the hierarchy).

Lifecycle hooks below are Lens entry points, not calls that consumers should replay. Fields marked inputs are writable Inspector configuration. Unless explicitly listed, scripts have no public events.

## Demo scaffolding (`Example/`)

These scripts ship in `RemoteAssistance.lspkg/Example/` and are wired inside
`RemoteAssistance__PLACE_IN_SCENE.prefab`. They only present the demo; the
RemoteAssistance scripts don't import them.

| Object / script | Class | Key inputs |
|---|---|---|
| `CredentialsWarning`: `Example/CredentialsWarning/CredentialsWarning.ts` | `CredentialsWarning` | `guide: SceneObject` (the `Guide`), `snapCloudRequirements: ScriptComponent` (the `SnapCloudRequirements` object), `rsgCredentials: ScriptComponent` (empty: this package uses no Remote Service Gateway tokens), `requireSnapToken` / `requireOpenAIToken` / `requireGoogleToken: boolean = false`, `buttonLabel: string = "Continue without credentials"`. Public `findMissing(): string[]` returns the lines it shows (empty when everything is set). When the Snap Cloud project isn't assigned, it shows a red-framed "Credentials needed" panel in front of the user before the guide, listing what is missing; the guide and what it hides wait until the button is pressed. When everything is configured, the object turns itself off and the guide shows directly. It must stay below `SnapCloudRequirements`, which resolves its state on awake |
| `Guide`: `Example/GuideDismissPanel/GuideDismissPanel.ts` | `GuideDismissPanel` | `hideUntilDismissed: SceneObject[]` lists the objects hidden until "Ok, I understood" is pressed (here: `ExampleCarousel` and `RemoteAssistanceDemo [RemoteAssistance]`). `buttonLabel: string = "Ok, I understood"` is only used when the panel is built at runtime |
| `ExampleCarousel`: `Example/ExampleCarousel/ExampleCarousel.ts` | `ExampleCarousel` | `examples: SceneObject[]` (here: the `RemoteAssistanceDemo [RemoteAssistance]` group; the bracket is the panel title), `exampleInfo: string[]` (one line per example), `steps: SceneObject[]` (empty here), `stepInfo: string[]` (empty here; one line per entry of `steps`, an empty entry falls back to the example's info), `startIndex: number = 0`, `previousLabel` / `nextLabel`, `examplesPushBack: number = 20`, `anchorExamples: boolean = false` (keep it off: annotation geometry must not move with the carousel), `startMinimized: boolean = true`, `extraPanelDrop: number = -33` |

Both inputs point at the demo group rather than the prefab root, because
hiding the root would also hide the guide and the carousel. Because the group
stays disabled until the guide is dismissed, RemoteAssistanceManager builds the
start menu only after "Ok, I understood".

## ModeMenuUI

Source [Scripts/App/ModeMenuUI.ts](../Scripts/App/ModeMenuUI.ts). Consumer import `RemoteAssistance.lspkg/Scripts/App/ModeMenuUI`.

No Inspector inputs. Runtime UIKit frame 34×30 cm. `onStartCall` is PublicApi<void>; button hides menu before emitting. `setSessionCode` updates displayed text; `show`/`hide` change the SceneObject enabled state.

Exact public method/getter signatures (reference fragments):

```text
get onStartCall(): PublicApi<void>
onAwake(): void
hide(): void
show(): void
setSessionCode(code: string): void
```

## RemoteAssistanceManager

Source [Scripts/App/RemoteAssistanceManager.ts](../Scripts/App/RemoteAssistanceManager.ts). Consumer import `RemoteAssistance.lspkg/Scripts/App/RemoteAssistanceManager`.

| Input | Type | Default | Meaning |
|---|---|---|---|
| `snapCloud` | `SnapCloudModule` | unassigned, allowUndefined | Optional component handle; inactive/missing block returns no mailbox. |
| `annotations` | `AnnotationRenderer` | unassigned | Required renderer handle. |
| `simulateInPreview` | `boolean` | true | Local demo only when the manager OnStart also sees Editor. |

`onAwake` builds a runtime identity root, moves annotations under it, creates menu and binds call actions. OnStart sets the Preview flag. Call start, quality cycle [1000,2000,3500], clear, teardown and menu return are private. Optional missing cloud block runs a local demo but returns before enabling clear row. A present cloud block can still fail auth. No public startCall/stopCall method or public events; no OnDestroy cleanup. Status delayed events are not retained/cancelled.

Exact public method/getter signatures (reference fragments):

```text
onAwake(): void
```

## AnnotationRenderer

Source [Scripts/Drawing/AnnotationRenderer.ts](../Scripts/Drawing/AnnotationRenderer.ts). Consumer import `RemoteAssistance.lspkg/Scripts/Drawing/AnnotationRenderer`.

| Input | Type | Default | Meaning |
|---|---|---|---|
| `strokeMaterial` | `Material` | unassigned | Required unlit ribbon material; cloned per stroke and made two-sided. |
| `anchorDepthCm` | `number` | 200 | Plane depth in centimeters; Inspector 50–500. |
| `povHorizontalFovDeg` | `number` | 66 | Horizontal camera FOV; Inspector 30–110. |
| `strokeWidthCm` | `number` | 1.0 | Fallback ribbon width; Inspector 0.2–5. |
| `poseLagMs` | `number` | 400 | Pose-history offset; Inspector 0–2000. |

Update stores at most 256 head poses. `applyStroke` fixes pose/material/aspect/width at first appearance and rebuilds cumulative mesh; `done` IDs reject updates. `handleSignal` parses stroke/clear. `simulateDemo` schedules circle, arrow and dot over ~6 s; each run starts a new demo generation. `clearStroke` removes one root; `clearAll` removes all and also drops any pending demo strokes (CLEAR DRAWINGS and call teardown both call it). No public events.

Exact public method/getter signatures (reference fragments):

```text
onAwake(): void
handleSignal(p: RtcSignalPayload): void
statusLine(): string
applyStroke(p: StrokePayload): void
clearStroke(id: string): void
clearAll(): void
simulateDemo(): void
```

## RtcMailbox

Source [Scripts/SnapCloud/RtcMailbox.ts](../Scripts/SnapCloud/RtcMailbox.ts). Consumer import `RemoteAssistance.lspkg/Scripts/SnapCloud/RtcMailbox`.

No Inspector inputs.

Constructor receives BaseScriptComponent, session code, sender ID and an optional project source (SnapCloudModule passes its SnapCloudRequirements; omitted, the deprecated `SupabaseRequirements.getProject` is used). `start` begins asynchronous auth: Snapchat ID token with empty token, then anonymous fallback. Connected means auth/cursor setup completed. One callback slot per kind/from; adding replaces it. Poll excludes self, limit 50, ascending ID; starts cursor at zero to replay historical signals/draws, suppressing stale bye rows. `sendRtcSignal` returns queued true before asynchronous insert succeeds. `sendDiag` is best effort. `stop` disables event and clears state, without cancelling in-flight connect/poll.

Exact public method/getter signatures (reference fragments):

```text
constructor(script: BaseScriptComponent, session: string, me: string, projectSource?: () => SupabaseProject | null)  // me = our sender id ("glasses"); rows from other senders are read
get isConnected(): boolean
start(): void
onRtcSignal(kind: RtcKind, from: string, cb: (p: RtcSignalPayload) => void): void
offRtcSignal(kind: RtcKind, from: string): void
sendRtcSignal(kind: RtcKind, from: string, payload: RtcSignalPayload): boolean
sendDiag(state: string): void
stop(): void
```

## SnapCloudModule

Source [Scripts/SnapCloud/SnapCloudModule.ts](../Scripts/SnapCloud/SnapCloudModule.ts). Consumer import `RemoteAssistance.lspkg/Scripts/SnapCloud/SnapCloudModule`.

| Input | Type | Default | Meaning |
|---|---|---|---|
| `snapCloudRequirements` | `SnapCloudRequirements` | wired in the prefab, allowUndefined | Where mailboxes read the SupabaseProject. Empty: falls back to the deprecated `SupabaseRequirements` component. |

No lifecycle hooks. `createRtcMailbox(session,streamer)` returns null if component/hierarchy inactive; otherwise a mailbox, even when credentials are absent.

Exact public method/getter signatures (reference fragments):

```text
createRtcMailbox(session: string, streamer: string): RtcMailbox | null
```

## SnapCloudRequirements (credentials)

Source [SnapCloudRequirements.ts](../SnapCloudRequirements.ts), at the package root (not `Scripts/`). Consumer import `RemoteAssistance.lspkg/SnapCloudRequirements`. It holds the `SupabaseProject` that `SnapCloudModule.snapCloudRequirements` (and through it RtcMailbox) and `CredentialsWarning` read. It sits first in the prefab so it has checked its project before the warning wakes up.

| Input | Type | Default | Notes |
|---|---|---|---|
| `supabaseProject` | `SupabaseProject` | none | Created with *Window → Supabase → Import Credentials*. Empty in the shipped prefab |
| `text` | `Text` | none | Optional; shows the "not configured" warning, disabled once configured |
| `disableWarningsWhenConfigured` | boolean | `true` | |
| `showSetupInstructions` | boolean | `true` | Prints setup steps at awake while unconfigured (only when logging is on) |
| `enableDebugLogs` | boolean | `true` | Stored and set by `setDebugLogging()`; prints are gated by the two flags below |
| `enableLogging` | boolean | `false` | Gates all of its prints, including the console warning |
| `enableLoggingLifecycle` | boolean | `false` | Lifecycle prints |

| Member | Signature | Notes |
|---|---|---|
| `getSupabaseProject` | `(): SupabaseProject` | The assigned project (undefined when unset) |
| `isConfigured` | `(): boolean` | `true` when a project is assigned (checked at awake and by `revalidate()`); asset presence only, no authentication or schema check |
| `getSupabaseUrl` / `getSupabasePublicToken` | `(): string` | `""` when unset |
| `getSupabaseHeaders` | `(): {[key: string]: string}` | `Content-Type`, `apikey`, `Authorization: Bearer <publicToken>`; `{}` when unset |
| `getStorageApiUrl` / `getRestApiUrl` / `getFunctionsApiUrl` | `(): string` | Project URL + `/storage/v1/object/public/`, `/rest/v1/`, `/functions/v1/` |
| `setDebugLogging` | `(enabled: boolean): void` | Sets `enableDebugLogs` |
| `revalidate` | `(): void` | Re-checks the configuration after you assign a project from code |

## SupabaseRequirements (deprecated)

Deprecated: use `SnapCloudRequirements`. Kept for existing scenes; the prefab no longer carries it. RtcMailbox only reads it when SnapCloudModule has no `snapCloudRequirements`.

Source [Scripts/SnapCloud/SupabaseRequirements.ts](../Scripts/SnapCloud/SupabaseRequirements.ts). Consumer import `RemoteAssistance.lspkg/Scripts/SnapCloud/SupabaseRequirements`.

| Input | Type | Default | Meaning |
|---|---|---|---|
| `supabaseProject` | `SupabaseProject` | unassigned, allowUndefined | Asset configured through Snap Cloud tools; prefab reference null. |
| `text` | `Text` | unassigned, allowUndefined | Optional configuration-status label. |

Awake establishes static instance and binds Start. `isConfigured` checks asset presence only; `getSupabaseProject` returns it/null. Static `getProject(caller)` warns once on missing asset. Start hides the optional status text when configured; no authentication or schema validation occurs here.

Exact public method/getter signatures (reference fragments):

```text
onAwake(): void
isConfigured(): boolean
getSupabaseProject(): SupabaseProject | null
static getProject(caller: string): SupabaseProject | null
```

## CallStreamer

Source [Scripts/WebRTC/CallStreamer.ts](../Scripts/WebRTC/CallStreamer.ts). Consumer import `RemoteAssistance.lspkg/Scripts/WebRTC/CallStreamer`.

No Inspector inputs.

Constructor takes BaseScriptComponent and RtcSignalTransport, creates an AudioComponent and continuous AudioOutputProvider when available. Start creates a WebRTCSession only if static native exports loaded; missing module leaves media unavailable. Public callback `onFriendVideoTexture` receives the procedural texture when created/resized; subsequent frames mutate it. `mediaConnected` is POV **or** voice connected. Bitrate setter returns zero before a session exists. Mic/transport/friend-video status lines are diagnostics. Stop tears down pumps, native/JS audio and destroys its AudioComponent; construct a fresh streamer per call as the manager does. Native mic gets one attempt per POV connection; rejection/stall/start timeout opens JS fallback. JS dead-air retry is bounded.

Exact public method/getter signatures (reference fragments):

```text
constructor(script: BaseScriptComponent, signal: RtcSignalTransport)  // signal = SDP/ICE transport (the Snap Cloud DB mailbox)
micStatusLine(): string
transportLine(): string
setVideoBitrate(kbps: number): number
get mediaConnected(): boolean
start(): void
stop(): void
friendVideoLine(): string
```

Public fields: `onFriendVideoTexture: ((tex: Texture) => void) | null = null`.

## PovPanelUI

Source [Scripts/WebRTC/PovPanelUI.ts](../Scripts/WebRTC/PovPanelUI.ts). Consumer import `RemoteAssistance.lspkg/Scripts/WebRTC/PovPanelUI`.

No Inspector inputs. Runtime portrait video area 27×48 cm and button rows; clear row initially hidden. `onClose`, `onQualityToggle`, `onClearDrawings` are PublicApi<void>. Setters update visibility, label, Texture/aspect-fit and caption. Update follows flattened camera forward at 100 cm, 11 cm left, with rate 6 smoothing; this overrides authored position.

Exact public method/getter signatures (reference fragments):

```text
get onClose(): PublicApi<void>
get onQualityToggle(): PublicApi<void>
get onClearDrawings(): PublicApi<void>
onAwake(): void
setClearDrawingsVisible(on: boolean): void
setQualityLabel(text: string): void
setFrameTexture(texture: Texture): void
setCaption(text: string): void
```

## RtcVoicePlayer

Source [Scripts/WebRTC/RtcVoicePlayer.ts](../Scripts/WebRTC/RtcVoicePlayer.ts). Consumer import `RemoteAssistance.lspkg/Scripts/WebRTC/RtcVoicePlayer`.

No Inspector inputs.

Helper constructor takes a BaseScriptComponent. `start` creates a playback pump; `enqueue` only accepts while running, resets on sample-rate changes, caps queue at 4 s. Initial buffering 0.5 s, subsequent minimum batch 0.25 s, PCM16 mono WAV via RemoteMediaModule. `stop` clears queue and disables pump, but does not destroy/stop AudioComponent or cancel pending decode callbacks. Current CallStreamer has its own audio path.

Exact public method/getter signatures (reference fragments):

```text
constructor(private readonly script: BaseScriptComponent)
start(): void
stop(): void
enqueue(pcm: Uint8Array, rate: number): void
```

## StreamController

Source [Scripts/WebRTC/StreamController.ts](../Scripts/WebRTC/StreamController.ts). Consumer import `RemoteAssistance.lspkg/Scripts/WebRTC/StreamController`.

No Inspector inputs.

No inputs. Static `native` starts null; Awake loads Stream `.so`, protected hook stores exports/ping. Retained controller, not the current call media path. No public completion event or static reset.

Exact public method/getter signatures (reference fragments):

```text
onAwake()
```

Public fields: `static native: RemoteAssistanceStreamNativeExports | null = null`.

## WebRTCController

Source [Scripts/WebRTC/WebRTCController.ts](../Scripts/WebRTC/WebRTCController.ts). Consumer import `RemoteAssistance.lspkg/Scripts/WebRTC/WebRTCController`.

No Inspector inputs.

No inputs. Public static `native` starts null; Awake loads WebRTC `.so`, protected native-loaded hook assigns static exports and prints ping, then probes UDP 8.8.8.8:19302. No public completion event and no destroy/reset of static handle. The fallback wording in its log is historical, not current media behavior.

Exact public method/getter signatures (reference fragments):

```text
onAwake()
```

Public fields: `static native: RemoteAssistanceWebRTCNativeExports | null = null`.

## WebRTCSession

Source [Scripts/WebRTC/WebRTCSession.ts](../Scripts/WebRTC/WebRTCSession.ts). Consumer import `RemoteAssistance.lspkg/Scripts/WebRTC/WebRTCSession`.

No Inspector inputs.

Constructor takes BaseScriptComponent, RtcSignalTransport, native exports. Callback fields `onVoicePcm(pcm,rate)`, `onPovConnected(connected)`, `onFriendVideoFrame(rgba,width,height)`, and `diagExtra()` are nullable single slots. POV/voice getters independently check native connected state. Start offers POV and subscribes helper POV/voice signals; duplex helper video uses POV. The retained friendvid kind is stopped but not subscribed by start. Update drains signals/audio, polls reused RGBA buffer up to 12 Hz, ensures camera and retries failed/closed or unconnected POV after 15 s. Video bitrate clamps/rounds 300–6000 kbps; defaults 1000 kbps, 24 fps, 640 px max width, maxQP36; exported presets [1000,2000,3500]. Mic/speaker wrappers expose optional native capability and state; unsupported mic/speaker state defaults 0, mic frames -1, stats empty string. `sendMicPcm` returns rc==0. `stop` disables pump/unsubscribes/stops three native kinds; CallStreamer owns audio shutdown.

Exact public method/getter signatures (reference fragments):

```text
constructor(script: BaseScriptComponent, sig: RtcSignalTransport, native: RemoteAssistanceWebRTCNativeExports)  // sig = SDP/ICE transport (the Snap Cloud DB mailbox)
get povConnected(): boolean
get voiceConnected(): boolean
statusLine(): string
start(): void
stop(): void
sendMicPcm(b64Pcm: string, sampleRate: number): boolean
nativeMicSupported(): boolean
startNativeMic(useFocus: boolean): boolean
stopNativeMic(): void
nativeMicState(): number
nativeMicFrames(): number
audioRxStats(): string
nativeSpeakerSupported(): boolean
startNativeSpeaker(): boolean
stopNativeSpeaker(): void
nativeSpeakerState(): number
setVideoBitrate(kbps: number): number
get videoBitrateKbps(): number
```

Public fields: `onVoicePcm`, `onPovConnected`, `onFriendVideoFrame`, `diagExtra` as described above.

## Assets

| Asset | Used by |
|---|---|
| `Modules/libRemoteAssistanceWebRTCModule.so`, `Modules/libRemoteAssistanceStreamModule.so` | WebRTCController / StreamController (`requireAsset`); device only |
| `ExtractAtProjectRoot/RemoteAssistanceWebRTCModule.zip`, `RemoteAssistanceStreamModule.zip` | C++ sources of the two modules; extract at the project root to rebuild ([Guide](guide.md#native-development-specsndk)) |
| `Materials/StrokeMat.mat` (on `Shaders/unlit.graphShader`) | `AnnotationRenderer.strokeMaterial` on `Annotations3D`; cloned per stroke |
| `Materials/ImageMaterial.mat` (on `Shaders/flat.graphShader`, texture `Images/Image.png`) | PovPanelUI video image (`requireAsset`) |
| `Audio/ConnectChime.wav` | RemoteAssistanceManager connect chime (`requireAsset`) |
| `Audio/MicInput.micaudio`, `Audio/RtcVoiceOutput.audioOutput` | CallStreamer microphone input and voice output (`requireAsset`) |
| `Audio/TargetPing.wav` | Shipped, not referenced by any script or the prefab |
| `Docs/media/RemoteAssistance.png` | README image |

## Protocol helpers

Source [Types.ts](../Scripts/App/Types.ts) exports sender IDs `STREAMER_HELPER="phoneB"`, `STREAMER_GLASSES="glasses"`; `RtcKind` includes pov/voice/friendvid/bye/draw, while `RTC_KINDS` contains only three media kinds. `rtcEventName(kind,from)` returns `rtc:<kind>:<from>`. `makeSessionCode()` generates `wrp-` plus date/random. `CALL_TRANSPORT_AUTO=0`, WEBRTC=1, STREAMING=2 and `callTransportLabel(mode)` remain compatibility helpers; the manager does not expose a transport selector.

Exact protocol declarations (reference fragments):

```text
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

```

## Drawing parser

[AnnotationTypes.ts](../Scripts/Drawing/AnnotationTypes.ts) exports StrokePayload, ClearPayload, `parseStrokePayload(json: string | undefined): StrokePayload | null` and `parseClearPayload(json: string | undefined): ClearPayload`. Stroke parsing requires string ID/even finite numeric coordinates, but does not clamp them to 0..1 or fully validate optional color/width/aspect. Invalid or empty clear JSON becomes `{}`, interpreted as clear all. Direct `applyStroke` bypasses parser validation.

Exact payload types:

```text
// AnnotationTypes — wire format for the remote-assistance drawing channel.
//
// The helper's phone draws on the POV video it is watching and posts drawing
// messages onto the SAME transport as the WebRTC signaling (the Snap Cloud
// `rtc_signals` DB mailbox — see RtcMailbox): rows with kind "draw",
// sender "phoneB". Two message types, discriminated by the row's `t` column:
//
//   t = "stroke" — one stroke create/update. The JSON below rides the row's
//                  `sdp` text column. Each update carries the FULL point list
//                  so far (cumulative — the receiver just rebuilds the stroke);
//                  `done: true` marks the final update.
//   t = "clear"  — remove drawings. `sdp` is optional JSON {"id": "<stroke>"}
//                  to clear one stroke; absent/empty or {"scope":"all"} clears
//                  everything.
//
// Coordinates are NORMALIZED TO THE VIDEO FRAME the annotator is viewing
// (u: 0 left → 1 right, v: 0 top → 1 bottom). If the phone letterboxes the
// video on screen, it must map touch points into frame space before sending.
//
// This file owns parsing only; rendering lives in AnnotationRenderer.ts.

export interface StrokePayload {
    /** Stroke id, unique within the call session (e.g. "s1", "s2"…). */
    id: string
    /** RGB 0..1. Optional — the receiver auto-assigns a palette color. */
    color?: [number, number, number]
    /** Stroke width as a fraction of frame height. Optional. */
    w?: number
    /** Aspect ratio (frame width / height) of the video the annotator saw.
     *  Lets the receiver reconstruct the exact framing. Optional (defaults
     *  to the Glasses camera's 4:3). */
    ar?: number
    /** True on the final update for this stroke. */
    done?: boolean
    /** Flat [u0,v0, u1,v1, …] normalized frame coords (v down). */
    pts: number[]
}

export interface ClearPayload {
    /** Clear one stroke by id; absent = clear all. */
    id?: string
    scope?: "all"
}

/** Parse a stroke JSON string; null (with a log) on malformed input. */

```

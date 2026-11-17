# VideoCallS2M components

[← Agent usage index](../README.md)

## Use when

Import the installed package's public classes, functions and wire types, or wire component inputs. This reference was derived from TypeScript source declarations. Defaults are source initializers; prefab values may override them. Public signatures do not certify runtime availability. Lifecycle methods are included for accuracy, not as user commands.

## Prefab: `VideoCallS2M__PLACE_IN_SCENE`

The prefab root carries no script. Its children, in order:

- `SnapCloudRequirements`: carries `SnapCloudRequirements` (see [SnapCloudRequirements](#snapcloudrequirementsts)) and `SupabaseRequirements` (its `snapCloudRequirements` input points at the component next to it; deprecated `supabaseProject` and `text` empty). `SnapCloudRequirements.supabaseProject` is empty in the shipped prefab. It sits first so it has checked its project before the warning wakes up.
- `CredentialsWarning`: the red **Credentials needed** panel shown before the guide while the project is missing (see [Demo scaffolding](#demo-scaffolding-example-not-supported-api)).
- `Guide`: the guide panel (UIKit `Frame` + `GuideDismissPanel`, children `GuideText` and `OkButton`).
- `ExampleCarousel`: the example panel that frames the demo.
- `Video Call S2M`: the call experience, with one child per block:
  - `Core` > `VideoCallS2MManager`: `VideoCallS2MManager` with `uiLabel` → `Navigation/FriendMarkerUI`, `mobileKit` → `PhoneLink · Mobile Kit`, `snapCloud` → `Snap Cloud`, `simulateInPreview` / `usePhoneLocation` / `showMiniMap` all `true`.
  - `WebRTC · NDK` > `WebRTCController` (`WebRTCController`) and `StreamController` (`StreamController`): the native-module loaders (`WebRTCController` loads `libVideoCallS2MWebRTCModule.so` and `StreamController` loads `libVideoCallS2MStreamModule.so` at Lens start). The `.so` files load only on a SPECS device; in the Lens Studio Preview loading fails and the native exports stay `null`.
  - `Snap Cloud`: `SnapCloudModule`. Disable this object to run without cloud history, checkpoints and the Call Friend mailbox.
  - `Navigation` > `FriendMarkerUI`: `FriendMarkerUI`.
  - `PhoneLink · Mobile Kit`: `MobileKitModule` (the only `LensStudio:SpectaclesMobileKitModule` require).

The rest of the UI (start menu, incoming-call panel, POV panel, arrow, marker, minimap) is built at runtime by `VideoCallS2MManager`. For your own Lens, keep `SnapCloudRequirements` and `Video Call S2M`; `CredentialsWarning`, `Guide` and `ExampleCarousel` can be deleted.

## Demo scaffolding (`Example/`, not supported API)

Shipped in `VideoCallS2M.lspkg/Example/` and used only by `VideoCallS2M__PLACE_IN_SCENE.prefab` to present the example. They aren't part of the package API; do not import them from your own scripts.

| File | Used by | Key inputs |
|---|---|---|
| `Example/CredentialsWarning/CredentialsWarning.ts` | `CredentialsWarning` | `guide` (`Guide`), `snapCloudRequirements` (`SnapCloudRequirements`), `rsgCredentials` (empty: no Remote Service Gateway), `requireSnapToken` / `requireOpenAIToken` / `requireGoogleToken` (`false`), `buttonLabel` (`"Continue without credentials"`). Missing Snap Cloud project: prints `CredentialsWarning: …`, holds the guide (and what it hides) and shows a red-framed list until closed. All set: turns itself off. Public `findMissing(): string[]` returns the list it shows (empty when everything is set) |
| `Example/GuideDismissPanel/GuideDismissPanel.ts` | `Guide` | `buttonLabel` (`"Ok, I understood"`; only used when the panel is built at runtime), `hideUntilDismissed: SceneObject[]` (`ExampleCarousel`, `Video Call S2M`): hidden while the guide shows, enabled when it's closed |
| `Example/ExampleCarousel/ExampleCarousel.ts` | `ExampleCarousel` | `examples: SceneObject[]` (`Video Call S2M`), `exampleInfo: string[]` (one line of panel text), `steps: SceneObject[]` (empty), `stepInfo: string[]` (empty; one line per step, same order as `steps`, an empty entry falls back to the step's example info), `startIndex` (`0`), `previousLabel` / `nextLabel` (`"Previous"` / `"Next"`), `examplesPushBack` (`20` cm), `anchorExamples` (prefab `false`, source default `true`: the call UI places itself), `startMinimized` (prefab `true`, source default `false`), `extraPanelDrop` (prefab `-31` cm, source default `0`) |

With a single example the carousel shows only its title, the description and the minimize button; Previous / Next appear when `examples` lists more than one object.

## Assets loaded by path

These files are loaded with hard-coded `requireAsset` paths; moving or renaming them breaks the script at load.

| Asset | Loaded by |
|---|---|
| `Meshes/DestinationPointer.glb`, `Meshes/MarkerSphere.mesh`, `Materials/MarkerMat.mat`, `Audio/ConnectChime.wav`, `Audio/TargetPing.wav` | `Scripts/App/VideoCallS2MManager.ts` (pointer arrow, world marker, connect chime, target ping) |
| `Audio/MicInput.micaudio`, `Audio/RtcVoiceOutput.audioOutput` | `Scripts/WebRTC/CallStreamer.ts` (mic input; persistent Audio Output fed with friend-voice PCM) |
| `Images/person_pin_circle.png` | `Scripts/Geolocation/FriendMarkerUI.ts` |
| `Materials/MarkerMat.mat` | `Scripts/Geolocation/MiniMapUI.ts` |
| `Materials/ImageMaterial.mat` | `Scripts/WebRTC/PovPanelUI.ts` |
| `Modules/libVideoCallS2MWebRTCModule.so` | `Scripts/WebRTC/WebRTCNativeModule.ts` (device only) |
| `Modules/libVideoCallS2MStreamModule.so` | `Scripts/WebRTC/StreamNativeModule.ts` (device only) |

Other shipped assets:

- `RawLocationPermission.rawLocationModule` (package root): the raw-location module asset; `VideoCallS2MManager.ts` calls `require("LensStudio:RawLocationModule")` so the module is included in the Lens. Keep it in the project.
- `Materials/ArrowMat.mat`, `Meshes/ArrowHeadMesh.mesh`, `Meshes/ArrowShaftMesh.mesh`, `Images/Image.png`.
- `Shaders/flat.graphShader`, `Shaders/unlit.graphShader`, `Shaders/unlit_arrow.graphShader`.
- `GeneratedMeshes/preview/`: preview renders of `DestinationPointer` (front, side, three-quarter).
- `ExtractAtProjectRoot/`: `VideoCallS2MWebRTCModule.zip`, `VideoCallS2MStreamModule.zip` (native source) and `iOS.zip` (companion app), see [setup](setup.md).

## App/IncomingCallUI.ts

Consumer import: `VideoCallS2M.lspkg/Scripts/App/IncomingCallUI`.



### IncomingCallUI

Lens component. extends BaseScriptComponent.

No @inputs declared.

| Public member | Declaration / source default |
|---|---|
| `onAccept` | `get onAccept(): PublicApi<void>` |
| `onDeny` | `get onDeny(): PublicApi<void>` |
| `onAwake` | `method onAwake(): void` |
| `setRequester` | `method setRequester(name: string): void` |

## App/ModeMenuUI.ts

Consumer import: `VideoCallS2M.lspkg/Scripts/App/ModeMenuUI`.

Runtime UIKit menu. onStartSelected is PublicApi<ModeSelection>; Watch Your Back and Call Friend are mutually exclusive, Find Friend can combine with either. Switch callbacks read `sw.isOn` (UIKit's `onFinished` passes the explicit flag, not the state). show/hide affect menu display. ModeSelection includes the local GPS-source choice.

### ModeMenuUI

Lens component. extends BaseScriptComponent.

No @inputs declared.

| Public member | Declaration / source default |
|---|---|
| `onStartSelected` | `get onStartSelected(): PublicApi<ModeSelection>` |
| `onAwake` | `method onAwake(): void` |
| `hide` | `method hide(): void` |
| `show` | `method show(): void` |

## App/Types.ts

Consumer import: `VideoCallS2M.lspkg/Scripts/App/Types`.



Source declaration (reference text, not a standalone snippet):

```text
export const STREAMER_PHONE_BONDED = "phoneA"
```

Source declaration (reference text, not a standalone snippet):

```text
export const STREAMER_PHONE_FRIEND = "phoneB"
```

Source declaration (reference text, not a standalone snippet):

```text
export const STREAMER_GLASSES = "glasses"
```

Source declaration (reference text, not a standalone snippet):

```text
export const ALL_STREAMERS = [STREAMER_PHONE_BONDED, STREAMER_PHONE_FRIEND, STREAMER_GLASSES]
```

Source declaration (reference text, not a standalone snippet):

```text
export interface ModeSelection {
    watchYourBack: boolean
    callFriend: boolean
    findFriend: boolean
    /**
     * Which phone streams in watchYourBack mode. Always "phoneA" (the
     * wearer's own bonded phone) since the menu redesign; kept on the wire
     * for iOS compatibility.
     */
    source: "phoneA" | "phoneB"
    /**
     * Find Friend self-location source, chosen on the start menu's GPS switch:
     *   true  — the iPhone's GPS relayed over Mobile Kit (the default, "Mobile
     *           application"). UWB refines the final approach.
     *   false — Glasses' own GeoLocation service.
     * Purely a Glasses-side decision (the phone always sends its fix either way),
     * so it never touches the wire — VideoCallS2MManager applies it locally.
     */
    usePhoneLocation: boolean
}
```

Source declaration (reference text, not a standalone snippet):

```text
export function povChannelName(session: string): string
```

Source declaration (reference text, not a standalone snippet):

```text
export interface FramePayload {
    /** Base64 JPEG. */
    d: string
    /** Frame sequence number. */
    n: number
    /** Sender epoch ms. */
    t: number
}
```

Source declaration (reference text, not a standalone snippet):

```text
export interface AudioPayload {
    /** Base64 WAV (16-bit PCM mono). */
    d: string
    /** Chunk sequence number. */
    n: number
    /** Sample rate in Hz. */
    r: number
    /** Sender epoch ms. */
    t: number
}
```

Source declaration (reference text, not a standalone snippet):

```text
export type RtcKind = "pov" | "voice" | "friendvid" | "bye"
```

Source declaration (reference text, not a standalone snippet):

```text
export const RTC_KINDS: RtcKind[] = ["pov", "voice", "friendvid"]
```

Source declaration (reference text, not a standalone snippet):

```text
export function rtcEventName(kind: RtcKind, from: string): string
```

Source declaration (reference text, not a standalone snippet):

```text
export interface RtcSignalPayload {
    t: "offer" | "answer" | "cand" | "bye"
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
```

Source declaration (reference text, not a standalone snippet):

```text
export interface RtcRelayMessage {
    type: "rtc"
    kind: RtcKind
    from: string
    sig: RtcSignalPayload
}
```

Source declaration (reference text, not a standalone snippet):

```text
export function makeSessionCode(): string
```

Source declaration (reference text, not a standalone snippet):

```text
export const CALL_TRANSPORT_AUTO = 0
```

Source declaration (reference text, not a standalone snippet):

```text
export const CALL_TRANSPORT_WEBRTC = 1
```

Source declaration (reference text, not a standalone snippet):

```text
export const CALL_TRANSPORT_STREAMING = 2
```

Source declaration (reference text, not a standalone snippet):

```text
export function callTransportLabel(mode: number): string
```

## App/VideoCallS2MManager.ts

Consumer import: `VideoCallS2M.lspkg/Scripts/App/VideoCallS2MManager`.

Main component constructs Friend Finder/UI/video/geolocation roots onAwake and resolves required MobileKitModule and optional SnapCloudModule on OnStart. No public start-mode or hangup method is declared; mode operations are internal UI-driven. simulateInPreview only enables fake GPS when isEditor() is true. Watch Your Back chooses synthetic/editor versus native/device once. Call Friend signaling uses a Snap Cloud DB mailbox in current manager code.

### VideoCallS2MManager

Lens component. extends BaseScriptComponent.

| Input | Type | Source default | Meaning / annotation |
|---|---|---|---|
| `uiLabel` | `FriendMarkerUI` | `unassigned` | Friend marker label UI (wired by scene bootstrap) |
| `simulateInPreview` | `boolean` | `true` | Feed fake self+friend GPS in the Lens Studio preview (no phone connection exists there). The prefab also ships `true`. |
| `usePhoneLocation` | `boolean` | `true` | Default GPS source before the menu picks one: ON = iPhone (Mobile application), OFF = Glasses GeoLocation. The start menu's GPS SOURCE switch overrides this at launch. |
| `showMiniMap` | `boolean` | `true` | North-up debug minimap panel in Find Friend mode — compare against the phone app's map |
| `mobileKit` | `MobileKitModule` | `unassigned` | PhoneLink block — the ▸ PhoneLink · Mobile Kit object (MobileKitModule). REQUIRED transport. |
| `snapCloud` | `SnapCloudModule` | `unassigned` | Snap Cloud block — the ▸ Snap Cloud object (SnapCloudModule). OPTIONAL: unwire or disable its object to run offline (no path logging / checkpoints / cloud call-signaling)., @allowUndefined |

| Public member | Declaration / source default |
|---|---|
| `onAwake` | `method onAwake(): void` |

## Geolocation/FriendMarkerUI.ts

Consumer import: `VideoCallS2M.lspkg/Scripts/Geolocation/FriendMarkerUI`.



### FriendMarkerUI

Lens component. extends BaseScriptComponent.

No @inputs declared.

| Public member | Declaration / source default |
|---|---|
| `onAwake` | `method onAwake(): void` |
| `setName` | `method setName(name: string): void` |
| `setDistanceMeters` | `method setDistanceMeters(meters: number \| null, heightDiffM: number \| null = null): void` |
| `setStatus` | `method setStatus(status: string): void` |
| `setVisible` | `method setVisible(visible: boolean): void` |

## Geolocation/FriendPositionEstimator.ts

Consumer import: `VideoCallS2M.lspkg/Scripts/Geolocation/FriendPositionEstimator`.

In-memory position history up to 8 fixes; fresh <=4s returns real fix, stale uses capped speed <=8m/s and extrapolation <=30s, near stationary <0.2m/s holds position. Seed does not override live history. Estimates are not fresh GPS/UWB evidence.

Source declaration (reference text, not a standalone snippet):

```text
export interface PositionEstimate {
    lat: number
    lon: number
    /** Seconds since the last real fix. */
    ageS: number
    /** True when the position is extrapolated/held rather than a live fix. */
    estimated: boolean
    accuracyM: number | null
}
```

### FriendPositionEstimator

Helper class, not an Inspector component.

No @inputs declared.

| Public member | Declaration / source default |
|---|---|
| `addFix` | `method addFix(lat: number, lon: number, accuracyM: number \| null): void` |
| `seed` | `method seed(lat: number, lon: number, accuracyM: number \| null, ageS: number): void` |
| `hasData` | `method hasData(): boolean` |
| `estimate` | `method estimate(): PositionEstimate \| null` |
| `reset` | `method reset(): void` |

## Geolocation/GeoMath.ts

Consumer import: `VideoCallS2M.lspkg/Scripts/Geolocation/GeoMath`.



Source declaration (reference text, not a standalone snippet):

```text
export const FEET_PER_METER = 3.28084;
```

Source declaration (reference text, not a standalone snippet):

```text
export const FEET_PER_MILE = 5280;
```

Source declaration (reference text, not a standalone snippet):

```text
export function formatFeetMiles(meters: number): string
```

Source declaration (reference text, not a standalone snippet):

```text
export function toRad(deg: number): number
```

Source declaration (reference text, not a standalone snippet):

```text
export function toDeg(rad: number): number
```

Source declaration (reference text, not a standalone snippet):

```text
export function haversineMeters(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
): number
```

Source declaration (reference text, not a standalone snippet):

```text
export function initialBearing(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
): number
```

Source declaration (reference text, not a standalone snippet):

```text
export function directionFromHeading(
    targetBearingDeg: number,
    userHeadingDeg: number
): vec3
```

Source declaration (reference text, not a standalone snippet):

```text
export function shortestAngleDeg(aDeg: number, bDeg: number): number
```

Source declaration (reference text, not a standalone snippet):

```text
export function smoothFactor(ratePerSecond: number, dt: number): number
```

## Geolocation/MiniMapUI.ts

Consumer import: `VideoCallS2M.lspkg/Scripts/Geolocation/MiniMapUI`.



Source declaration (reference text, not a standalone snippet):

```text
export interface MiniMapData {
    selfLat: number
    selfLon: number
    selfAccM: number | null
    selfSource: string
    selfAgeS: number | null
    friendLat: number
    friendLon: number
    friendAccM: number | null
    friendAgeS: number | null
    /** Fresh UWB phone-to-phone distance (m); null when out of range/stale. */
    uwbDistM: number | null
    headingDeg: number
    headingSource: string
    phoneHeadingDeg: number | null
    bearingDeg: number
    distanceM: number
}
```

### MiniMapUI

Lens component. extends BaseScriptComponent.

No @inputs declared.

| Public member | Declaration / source default |
|---|---|
| `onClose` | `get onClose(): PublicApi<void>` |
| `onAwake` | `method onAwake(): void` |
| `setWaiting` | `method setWaiting(message: string): void` |
| `setData` | `method setData(d: MiniMapData): void` |

## MobileKit/MobileKitLink.ts

Consumer import: `VideoCallS2M.lspkg/Scripts/MobileKit/MobileKitLink`.



Source declaration (reference text, not a standalone snippet):

```text
export interface LocationFix {
    lat: number
    lon: number
    accuracy: number | null
    heading: number | null
    name: string | null
    alt: number | null
    vAcc: number | null
    pressure: number | null
    /** Phone-to-phone UWB distance (m), present only while fresh (<2 s). */
    uwbDist: number | null
}
```

### MobileKitLink

Helper class, not an Inspector component. implements RtcSignalTransport.

No @inputs declared.

| Public member | Declaration / source default |
|---|---|
| `onSelfFix` | `get onSelfFix(): PublicApi<LocationFix>` |
| `onFriendFix` | `get onFriendFix(): PublicApi<LocationFix>` |
| `onConnection` | `get onConnection(): PublicApi<boolean>` |
| `onTestMessage` | `get onTestMessage(): PublicApi<string>` |
| `onCallRequest` | `get onCallRequest(): PublicApi<string>` |
| `onCallCancel` | `get onCallCancel(): PublicApi<void>` |
| `onModeExit` | `get onModeExit(): PublicApi<void>` |
| `onQualityRequest` | `get onQualityRequest(): PublicApi<number>` |
| `isConnected` | `get isConnected(): boolean` |
| `onRtcSignal` | `method onRtcSignal(kind: RtcKind, from: string, cb: (p: RtcSignalPayload) => void): void` |
| `offRtcSignal` | `method offRtcSignal(kind: RtcKind, from: string): void` |
| `sendRtcSignal` | `method sendRtcSignal(kind: RtcKind, from: string, payload: RtcSignalPayload): boolean` |
| `constructor` | `constructor constructor(private readonly script: BaseScriptComponent, private readonly module: SpectaclesMobileKitModule \| null)` |
| `start` | `method start(simulate: boolean): void` |
| `sendControl` | `method sendControl(control: object): void` |
| `sendOneShot` | `method sendOneShot(message: object): void` |

## MobileKit/MobileKitModule.ts

Consumer import: `VideoCallS2M.lspkg/Scripts/MobileKit/MobileKitModule`.

Required phone-link block; getLink is lazy so higher-in-hierarchy manager initialization can resolve it safely. The single LensStudio:SpectaclesMobileKitModule require belongs here; do not create a second module asset/instance.

### MobileKitModule

Lens component. extends BaseScriptComponent.

No @inputs declared.

| Public member | Declaration / source default |
|---|---|
| `getLink` | `method getLink(): MobileKitLink` |

## SnapCloud/CloudCheckpoints.ts

Consumer import: `VideoCallS2M.lspkg/Scripts/SnapCloud/CloudCheckpoints`.



Source declaration (reference text, not a standalone snippet):

```text
export interface CheckpointVisitNote {
    who: string          // actor display/device name ("Friend" / "Phone A")
    checkpoint: string   // checkpoint label
    ageS: number         // seconds since entered_at
}
```

### CloudCheckpoints

Helper class, not an Inspector component.

No @inputs declared.

| Public member | Declaration / source default |
|---|---|
| `onVisit` | `onVisit: ((note: CheckpointVisitNote) => void) \| null = null` |
| `constructor` | `constructor constructor(private readonly script: BaseScriptComponent, private readonly cloud: CloudPathLogger)` |
| `start` | `method start(): void` |
| `stop` | `method stop(): void` |
| `noteFix` | `method noteFix(role: "self" \| "friend", who: string, lat: number, lon: number): void` |

## SnapCloud/CloudPathLogger.ts

Consumer import: `VideoCallS2M.lspkg/Scripts/SnapCloud/CloudPathLogger`.



### CloudPathLogger

Helper class, not an Inspector component.

No @inputs declared.

| Public member | Declaration / source default |
|---|---|
| `constructor` | `constructor constructor(private readonly script: BaseScriptComponent)` |
| `start` | `method start(): void` |
| `logFix` | `method logFix(role: "self" \| "friend", fix: LocationFix): void` |
| `getClient` | `method getClient(): SupabaseClient \| null` |
| `isReady` | `method isReady(): boolean` |
| `getSessionId` | `method getSessionId(): string` |
| `getUid` | `method getUid(): string \| null` |

## SnapCloud/PovFrameReceiver.ts

Consumer import: `VideoCallS2M.lspkg/Scripts/SnapCloud/PovFrameReceiver`.



### PovFrameReceiver

Helper class, not an Inspector component.

No @inputs declared.

| Public member | Declaration / source default |
|---|---|
| `onFrame` | `get onFrame(): PublicApi<Texture>` |
| `onWaiting` | `get onWaiting(): PublicApi<void>` |
| `constructor` | `constructor constructor(private readonly script: BaseScriptComponent, private readonly rt: Realtime, private readonly streamer: string)` |
| `start` | `method start(): void` |
| `stop` | `method stop(): void` |

## SnapCloud/Realtime.ts

Consumer import: `VideoCallS2M.lspkg/Scripts/SnapCloud/Realtime`.



### Realtime

Helper class, not an Inspector component.

No @inputs declared.

| Public member | Declaration / source default |
|---|---|
| `constructor` | `constructor constructor(private readonly script: BaseScriptComponent)` |
| `isConnected` | `get isConnected(): boolean` |
| `onFrame` | `method onFrame(streamer: string, cb: (p: FramePayload) => void): void` |
| `offFrame` | `method offFrame(streamer: string): void` |
| `onAudio` | `method onAudio(streamer: string, cb: (p: AudioPayload) => void): void` |
| `offAudio` | `method offAudio(streamer: string): void` |
| `onRtcSignal` | `method onRtcSignal(kind: RtcKind, from: string, cb: (p: RtcSignalPayload) => void): void` |
| `offRtcSignal` | `method offRtcSignal(kind: RtcKind, from: string): void` |
| `connect` | `method connect(session: string): Promise<void>` |
| `sendFrame` | `method sendFrame(streamer: string, b64Jpeg: string, seq: number): boolean` |
| `sendRtcSignal` | `method sendRtcSignal(kind: RtcKind, from: string, payload: RtcSignalPayload): boolean` |
| `sendAudio` | `method sendAudio(streamer: string, b64Wav: string, seq: number, sampleRate: number): boolean` |
| `disconnect` | `method disconnect(): void` |

## SnapCloud/RtcMailbox.ts

Consumer import: `VideoCallS2M.lspkg/Scripts/SnapCloud/RtcMailbox`.

Implements RtcSignalTransport with rtc_signals table inserts and ~0.4-second REST polling. Tries Snapchat ID-token authentication first, then anonymous fallback; backend configuration determines whether either works. Seeds/replays signaling with a stale-bye boundary. start is fire-and-forget; check isConnected rather than assuming ready.

### RtcMailbox

Helper class, not an Inspector component. implements RtcSignalTransport.

No @inputs declared.

| Public member | Declaration / source default |
|---|---|
| `constructor` | `constructor constructor(private readonly script: BaseScriptComponent, private readonly session: string, private readonly me: string)` |
| `isConnected` | `get isConnected(): boolean` |
| `start` | `method start(): void` |
| `onRtcSignal` | `method onRtcSignal(kind: RtcKind, from: string, cb: (p: RtcSignalPayload) => void): void` |
| `offRtcSignal` | `method offRtcSignal(kind: RtcKind, from: string): void` |
| `sendRtcSignal` | `method sendRtcSignal(kind: RtcKind, from: string, payload: RtcSignalPayload): boolean` |
| `sendDiag` | `method sendDiag(state: string): void` |
| `stop` | `method stop(): void` |

## SnapCloud/SnapCloudModule.ts

Consumer import: `VideoCallS2M.lspkg/Scripts/SnapCloud/SnapCloudModule`.

Optional active-in-hierarchy cloud block. Getters return null while inactive. Returned logger/checkpoint/mailbox objects are caller-started services; resolving an object does not prove authentication or connection.

### SnapCloudModule

Lens component. extends BaseScriptComponent.

No @inputs declared.

| Public member | Declaration / source default |
|---|---|
| `getPathLogger` | `method getPathLogger(): CloudPathLogger \| null` |
| `createCheckpoints` | `method createCheckpoints(): CloudCheckpoints \| null` |
| `createRtcMailbox` | `method createRtcMailbox(session: string, streamer: string): RtcMailbox \| null` |

## SnapCloud/SupabaseRequirements.ts

Consumer import: `VideoCallS2M.lspkg/Scripts/SnapCloud/SupabaseRequirements`.

Bridge between the SnapCloud transports and the package's single `SnapCloudRequirements`. All inputs are allowed undefined. With no project, accessors return null and cloud features warn/disable. Configuration presence is not an authenticated-service success check. In the prefab it sits on the `SnapCloudRequirements` object.

### SupabaseRequirements

Lens component. extends BaseScriptComponent.

| Input | Type | Source default | Meaning / annotation |
|---|---|---|---|
| `snapCloudRequirements` | `SnapCloudRequirements` | `unassigned` | SnapCloudRequirements component holding the SupabaseProject, @allowUndefined |
| `supabaseProject` | `SupabaseProject` | `unassigned` | Deprecated: use snapCloudRequirements. Only read when `snapCloudRequirements` isn't wired, @allowUndefined |
| `text` | `Text` | `unassigned` | Optional Text that shows a setup warning until the asset is assigned, @allowUndefined |

| Public member | Declaration / source default |
|---|---|
| `onAwake` | `method onAwake(): void` |
| `isConfigured` | `method isConfigured(): boolean` |
| `getSupabaseProject` | `method getSupabaseProject(): SupabaseProject \| null` |
| `getProject` | `static method getProject(caller: string): SupabaseProject \| null` |

## SnapCloudRequirements.ts

Consumer import: `VideoCallS2M.lspkg/SnapCloudRequirements` (package root, not `Scripts/`).

`VideoCallS2M.lspkg/SnapCloudRequirements.ts` holds the `SupabaseProject` that `SupabaseRequirements` (and through it Realtime, RtcMailbox and CloudPathLogger) and `CredentialsWarning` read. It imports SnapDecorators and Utilities.

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
| `isConfigured` | `(): boolean` | `true` when a project is assigned (checked at awake and by `revalidate()`) |
| `getSupabaseUrl` / `getSupabasePublicToken` | `(): string` | `""` when unset |
| `getSupabaseHeaders` | `(): {[key: string]: string}` | `Content-Type`, `apikey`, `Authorization: Bearer <publicToken>`; `{}` when unset |
| `getStorageApiUrl` / `getRestApiUrl` / `getFunctionsApiUrl` | `(): string` | Project URL + `/storage/v1/object/public/`, `/rest/v1/`, `/functions/v1/` |
| `setDebugLogging` | `(enabled: boolean): void` | Sets `enableDebugLogs` |
| `revalidate` | `(): void` | Re-checks the configuration after you assign a project from code |

## WebRTC/CallStreamer.ts

Consumer import: `VideoCallS2M.lspkg/Scripts/WebRTC/CallStreamer`.

Current implementation is native WebRTC media only; accepts a RtcSignalTransport. Manager supplies RtcMailbox, despite this file’s stale relay-only header comments. No JPEG/WAV media transport fallback is selected here. Native mic/speaker have optional support checks and JS audio fallbacks; these audio paths are separate from media-transport selection.

### CallStreamer

Helper class, not an Inspector component.

No @inputs declared.

| Public member | Declaration / source default |
|---|---|
| `onFriendVideoTexture` | `onFriendVideoTexture: ((tex: Texture) => void) \| null = null` |
| `constructor` | `constructor constructor(private readonly script: BaseScriptComponent, private readonly signal: RtcSignalTransport)` |
| `micStatusLine` | `method micStatusLine(): string` |
| `transportLine` | `method transportLine(): string` |
| `setVideoBitrate` | `method setVideoBitrate(kbps: number): number` |
| `mediaConnected` | `get mediaConnected(): boolean` |
| `start` | `method start(): void` |
| `stop` | `method stop(): void` |
| `friendVideoLine` | `method friendVideoLine(): string` |

## WebRTC/PovPanelUI.ts

Consumer import: `VideoCallS2M.lspkg/Scripts/WebRTC/PovPanelUI`.



### PovPanelUI

Lens component. extends BaseScriptComponent.

No @inputs declared.

| Public member | Declaration / source default |
|---|---|
| `onClose` | `get onClose(): PublicApi<void>` |
| `onQualityToggle` | `get onQualityToggle(): PublicApi<void>` |
| `onAwake` | `method onAwake(): void` |
| `setQualityLabel` | `method setQualityLabel(text: string): void` |
| `setFrameTexture` | `method setFrameTexture(texture: Texture): void` |
| `setCaption` | `method setCaption(text: string): void` |

## WebRTC/PovVideoSource.ts

Consumer import: `VideoCallS2M.lspkg/Scripts/WebRTC/PovVideoSource`.

SyntheticPovSource produces a 180x320 animated RGBA test texture in editor. WebRtcWatchYourBackSource uses native WebRTC + RtcMailbox on device, rear camera from own phone, one-way inbound voice. Its retained STUB comment is obsolete relative to implementation. No runtime swap to synthetic feed when device WebRTC fails.

Source declaration (reference text, not a standalone snippet):

```text
export interface PovVideoSource {
    /** Fired when the display Texture is (re)created and ready to show. Wire it
     *  to PovPanelUI.setFrameTexture. */
    onTexture: ((tex: Texture) => void) | null
    /** Short status for the panel caption (source-specific). */
    statusLine(): string
    start(): void
    stop(): void
}
```

### SyntheticPovSource

Helper class, not an Inspector component. implements PovVideoSource.

No @inputs declared.

| Public member | Declaration / source default |
|---|---|
| `onTexture` | `onTexture: ((tex: Texture) => void) \| null = null` |
| `constructor` | `constructor constructor(private readonly script: BaseScriptComponent)` |
| `start` | `method start(): void` |
| `statusLine` | `method statusLine(): string` |
| `stop` | `method stop(): void` |

### WebRtcWatchYourBackSource

Helper class, not an Inspector component. implements PovVideoSource.

No @inputs declared.

| Public member | Declaration / source default |
|---|---|
| `onTexture` | `onTexture: ((tex: Texture) => void) \| null = null` |
| `constructor` | `constructor constructor(private readonly script: BaseScriptComponent, private readonly sessionCode: string)` |
| `start` | `method start(): void` |
| `statusLine` | `method statusLine(): string` |
| `stop` | `method stop(): void` |

## WebRTC/RtcVoicePlayer.ts

Consumer import: `VideoCallS2M.lspkg/Scripts/WebRTC/RtcVoicePlayer`.



### RtcVoicePlayer

Helper class, not an Inspector component.

No @inputs declared.

| Public member | Declaration / source default |
|---|---|
| `constructor` | `constructor constructor(private readonly script: BaseScriptComponent)` |
| `start` | `method start(): void` |
| `stop` | `method stop(): void` |
| `enqueue` | `method enqueue(pcm: Uint8Array, rate: number): void` |

## WebRTC/StreamController.ts

Consumer import: `VideoCallS2M.lspkg/Scripts/WebRTC/StreamController`.

Legacy native JPEG encoder loader retained as an export. Static native starts null. Native camera capture must not compete with another CameraModule client; it is not the current CallStreamer media fallback.

### StreamController

Lens component. extends BaseScriptComponent.

No @inputs declared.

| Public member | Declaration / source default |
|---|---|
| `native` | `static native: VideoCallS2MStreamNativeExports \| null = null` |
| `onAwake` | `method onAwake(): inferred` |

## WebRTC/StreamNativeModule.ts

Consumer import: `VideoCallS2M.lspkg/Scripts/WebRTC/StreamNativeModule`.



Source declaration (reference text, not a standalone snippet):

```text
export type VideoCallS2MStreamNativeExports = {
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
```

Exported binding `StreamNativeModule` is a class-field decorator with a `.load(self, onLoaded)` loader. Exactly one decorated field is supported per instance. Loader assigns native exports then calls `onLoaded.call(self, exports)`; returns a Promise of exports or null on load failure. This is a native loading utility, not a component.

## WebRTC/WebRTCController.ts

Consumer import: `VideoCallS2M.lspkg/Scripts/WebRTC/WebRTCController`.

Loads the package native module, publishes static native, and performs a UDP probe on native load. Preview native load fails gracefully. Its printed Realtime-fallback message is stale; actual CallStreamer does not switch to cloud JPEG/WAV. Probe success does not establish an ICE/media connection.

### WebRTCController

Lens component. extends BaseScriptComponent.

No @inputs declared.

| Public member | Declaration / source default |
|---|---|
| `native` | `static native: VideoCallS2MWebRTCNativeExports \| null = null` |
| `onAwake` | `method onAwake(): inferred` |

## WebRTC/WebRTCNativeModule.ts

Consumer import: `VideoCallS2M.lspkg/Scripts/WebRTC/WebRTCNativeModule`.



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
export type VideoCallS2MWebRTCNativeExports = {
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

Exported binding `WebRTCNativeModule` is a class-field decorator with a `.load(self, onLoaded)` loader. Exactly one decorated field is supported per instance. Loader assigns native exports then calls `onLoaded.call(self, exports)`; returns a Promise of exports or null on load failure. This is a native loading utility, not a component.

## WebRTC/WebRTCSession.ts

Consumer import: `VideoCallS2M.lspkg/Scripts/WebRTC/WebRTCSession`.

Session wraps native POV/voice/friend-video paths, drains signaling and frames, and exposes nullable callbacks. Install callbacks before start and stop owned resources. Presets are 1000/2000/3500 kbps; source TURN_URL is empty, STUN configured. Optional native audio functions depend on binary revision.

Source declaration (reference text, not a standalone snippet):

```text
export const VIDEO_QUALITY_PRESETS_KBPS = [1000, 2000, 3500]
```

### WebRTCSession

Helper class, not an Inspector component.

No @inputs declared.

| Public member | Declaration / source default |
|---|---|
| `onVoicePcm` | `onVoicePcm: ((pcm: Uint8Array, rate: number) => void) \| null = null` |
| `onPovConnected` | `onPovConnected: ((connected: boolean) => void) \| null = null` |
| `onFriendVideoFrame` | `onFriendVideoFrame: ((rgba: Uint8Array, width: number, height: number) => void) \| null = null` |
| `diagExtra` | `diagExtra: (() => { [k: string]: number \| string }) \| null = null` |
| `constructor` | `constructor constructor(private readonly script: BaseScriptComponent, private readonly sig: RtcSignalTransport, native: VideoCallS2MWebRTCNativeExports)` |
| `povConnected` | `get povConnected(): boolean` |
| `voiceConnected` | `get voiceConnected(): boolean` |
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


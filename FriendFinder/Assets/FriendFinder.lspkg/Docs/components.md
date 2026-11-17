# FriendFinder components

[← Agent usage index](../README.md)

## Use when

Read exact public declarations, Inspector defaults and source semantics before wiring components.

## Runtime contracts

FriendFinderManager inputs are uiLabel, simulateInPreview=true (script default and prefab value; editor-only), usePhoneLocation=true, showMiniMap=true, required mobileKit, optional snapCloud and menuDrop=0 (cm the start menu sits below eye level; the prefab sets 8 to make room for its carousel above). Its OnAwake creates UI/root groups; OnStart obtains the shared phone link and cloud services after all components awaken. It creates a runtime root named `Friend Finder`, with UI/video/geographic groups; required pointer/chime assets are loaded by requireAsset. Do not duplicate the manager's link startup in a consumer.

MobileKitLink retries native session creation every three seconds until a session can be joined. Connection subscriptions carry location, tests, requests and RTC relay. Pending mode/control commands are resent after reconnect; one-shot commands are not queued. Callback maps retain one RTC callback per kind/from key. There is no public stop API. LocationFix nullable metadata must be checked, including UWB distance.

FriendPositionEstimator records up to eight fixes, caps inferred speed at 8m/s and treats velocity below 0.2m/s as stationary. After four seconds without a fix it extrapolates for at most 30 seconds, then holds that projected position. seed supports a cold-start estimate only before live data; its existence does not establish manager cloud-seeding wiring. Accuracy is passed through. Main prioritizes fresh UWB distance (three seconds) for guidance and otherwise uses GPS; a marker is placed 5–30m away regardless of a longer displayed distance. GeoMath uses degrees/meters, then formatFeetMiles formats below 1000ft as feet and larger distances as miles.

CloudPathLogger authenticates with the device token when available, retries the specified transient failure, then can use anonymous auth. Logging is throttled per role to three seconds; its session ID is not automatically the RTC session code. CloudCheckpoints uses a 25m visit radius, 120s debounce, 20s checkpoint reload and 4s visit polling; first poll suppresses historical notifications, and friend visits produce notes. stop disables its events.

RtcMailbox polls at 0.4s with at most 50 rows after its cursor. Startup replays SDP/ICE but filters bye messages at or before its preexisting-row boundary. send success only reports initiating the insert. stop clears the client/handlers and disables polling, but an already in-flight completion can still schedule work; verify shutdown races on device/backend.

SnapCloudModule methods return null when the component is disabled or outside the enabled hierarchy. getPathLogger is lazy/shared; createCheckpoints uses its client. Device WebRtcWatchYourBackSource constructs its own mailbox and bypasses that enabled gate. SupabaseRequirements.getProject reads the project from the `SnapCloudRequirements` component wired on it (falling back to its deprecated own `supabaseProject` only when that isn't wired) and returns null with a setup warning until the consumer assigns an asset.

CallStreamer creates a voice AudioComponent, prefers a 48kHz AudioOutputProvider and otherwise uses WAV audio batches. WebRTCSession owns the native POV/voice streams and stop cleanup. Video bitrate presets are 1000/2000/3500kbps. Device Watch Your Back uses the shared duplex POV session, including glasses camera capture even though its visible panel is the phone camera, plus one-way phone audio. No current manager path instantiates Realtime/PovFrameReceiver.

## Prefab layout

`FriendFinder__PLACE_IN_SCENE.prefab` (root at the origin) has these children in order:

- `SnapCloudRequirements`: the one place the Snap Cloud project lives (`supabaseProject` ships EMPTY). `Snap Cloud` > SupabaseRequirements and `CredentialsWarning` read it.
- `CredentialsWarning`: red-framed "Credentials needed" panel shown before the guide while the project is missing.
- `Guide` (local 0, 0, −100): the guide panel (GuideDismissPanel + UIKit Frame, `GuideText`, `OkButton`).
- `ExampleCarousel`: the carousel. It starts minimized and doesn't anchor the example (`anchorExamples` off), `extraPanelDrop` −32.
- `FriendFinderDemo`: the demo itself — `Core` (FriendFinderManager, `menuDrop` 8), `WebRTC · NDK`, `Snap Cloud`, `Navigation`, `PhoneLink · Mobile Kit`.

## Demo scaffolding (`Example/`)

These scripts ship in `FriendFinder.lspkg/Example/` and are wired inside `FriendFinder__PLACE_IN_SCENE.prefab`. They only present the demo, and the FriendFinder scripts don't need them.

| Object / script | Class | Key inputs |
| --- | --- | --- |
| `CredentialsWarning`: `Example/CredentialsWarning/CredentialsWarning.ts` | `CredentialsWarning` | `guide: SceneObject` (the `Guide`), `snapCloudRequirements: ScriptComponent` (the `SnapCloudRequirements` object), `rsgCredentials: ScriptComponent` (empty here: no Remote Service Gateway), `requireSnapToken` / `requireOpenAIToken` / `requireGoogleToken: boolean = false` (all off here), `buttonLabel: string = "Continue without credentials"`. When something is missing it holds the guide (and what the guide hides) until the button is pressed; when everything is set it disables itself. Public `findMissing(): string[]` returns the list it shows (empty when everything is set) |
| `Guide`: `Example/GuideDismissPanel/GuideDismissPanel.ts` | `GuideDismissPanel` | `hideUntilDismissed: SceneObject[]` lists the objects hidden until "Ok, I understood" is pressed (here: ExampleCarousel, `FriendFinderDemo`). `buttonLabel: string = "Ok, I understood"` is only used when the panel is built at runtime |
| `ExampleCarousel`: `Example/ExampleCarousel/ExampleCarousel.ts` | `ExampleCarousel` | `examples: SceneObject[]` (here the single `FriendFinderDemo`), `exampleInfo: string[]` (one line per example), `steps: SceneObject[]` (empty here), `stepInfo: string[]` (empty here; one description per entry of `steps`, same order; an empty entry falls back to the example's info), `startIndex: number = 0`, `previousLabel` / `nextLabel`, `examplesPushBack: number = 20`, `anchorExamples: boolean = true` (off here), `startMinimized: boolean = false` (on here), `extraPanelDrop: number = 0` (−32 here) |

Both inputs point at the `FriendFinderDemo` group rather than the prefab root, because hiding the root would also hide the guide and the carousel.

## Shipped assets

| Asset | Used by |
| --- | --- |
| `Meshes/DestinationPointer.glb` (previews in `GeneratedMeshes/preview/`) | FriendFinderManager (`requireAsset`), the destination pointer |
| `Meshes/MarkerSphere.mesh`, `Materials/MarkerMat.mat` (on `unlit.graphShader`) | FriendFinderManager friend marker; MiniMapUI base material |
| `Meshes/ArrowHeadMesh.mesh`, `Meshes/ArrowShaftMesh.mesh`, `Materials/ArrowMat.mat` (on `unlit_arrow.graphShader`) | Arrow meshes and material; no script or the prefab references them (the pointer is `DestinationPointer.glb`) |
| `Materials/ImageMaterial.mat` (on `flat.graphShader`, default texture `Images/Image.png`) | PovPanelUI video panel |
| `Audio/ConnectChime.wav`, `Audio/TargetPing.wav` | FriendFinderManager connect and target sounds |
| `Audio/MicInput.micaudio`, `Audio/RtcVoiceOutput.audioOutput` | CallStreamer mic input and voice output |
| `Images/person_pin_circle.png` | FriendMarkerUI person icon |
| `RawLocationPermission.rawLocationModule` | Location permission module |
| `Modules/libFriendFinderWebRTCModule.so`, `Modules/libFriendFinderStreamModule.so` | WebRTCNativeModule / StreamNativeModule loaders; SPECS device only, never in the Lens Studio Preview |

Keep these files in place: the scripts load several of them by relative `requireAsset` path.

## Exact source inventory

All exported modules/classes/types/constants/functions are listed below, with public members and every Inspector input (including private inputs). Private implementation members are omitted. Initializers express source defaults, not guarantees that unwired required scene inputs can run. Native declaration sets describe the device ABI and do not execute in Preview.

## Scripts/App/FriendFinderManager

Import `FriendFinder.lspkg/Scripts/App/FriendFinderManager`.

### FriendFinderManager


Exact source declarations (reference, not a runnable script):

```text
@input
    @hint("Friend marker label UI (wired by scene bootstrap)")
    uiLabel!: FriendMarkerUI

@input
    @hint("Feed fake self+friend GPS in the Lens Studio preview (no phone connection exists there)")
    simulateInPreview: boolean = true

@input
    @hint("Default GPS source before the menu picks one: ON = iPhone (Mobile application), OFF = Glasses GeoLocation. The start menu's GPS SOURCE switch overrides this at launch.")
    usePhoneLocation: boolean = true

@input
    @hint("North-up debug minimap panel in Find Friend mode — compare against the phone app's map")
    showMiniMap: boolean = true

@input
    @hint("PhoneLink block — the ▸ PhoneLink · Mobile Kit object (MobileKitModule). REQUIRED transport.")
    mobileKit!: MobileKitModule

@input
    @allowUndefined
    @hint("Snap Cloud block — the ▸ Snap Cloud object (SnapCloudModule). OPTIONAL: unwire or disable its object to run offline (no path logging / checkpoints / cloud call-signaling).")
    snapCloud!: SnapCloudModule

@input
    @hint("Lower the start menu by this much (cm) below eye level, e.g. to leave room for a panel above it")
    menuDrop: number = 0

onAwake(): void
```

## Scripts/App/IncomingCallUI

Import `FriendFinder.lspkg/Scripts/App/IncomingCallUI`.

### IncomingCallUI


Exact source declarations (reference, not a runnable script):

```text
get onAccept(): PublicApi<void>

get onDeny(): PublicApi<void>

onAwake(): void

setRequester(name: string): void
```

## Scripts/App/ModeMenuUI

Import `FriendFinder.lspkg/Scripts/App/ModeMenuUI`.

### ModeMenuUI


Exact source declarations (reference, not a runnable script):

```text
get onStartSelected(): PublicApi<ModeSelection>

onAwake(): void

hide(): void

show(): void
```

## Scripts/App/Types

Import `FriendFinder.lspkg/Scripts/App/Types`.

### STREAMER_PHONE_BONDED


Exact source declarations (reference, not a runnable script):

```text
export const STREAMER_PHONE_BONDED = "phoneA"
```

### STREAMER_PHONE_FRIEND


Exact source declarations (reference, not a runnable script):

```text
export const STREAMER_PHONE_FRIEND = "phoneB"
```

### STREAMER_GLASSES


Exact source declarations (reference, not a runnable script):

```text
export const STREAMER_GLASSES = "glasses"
```

### ALL_STREAMERS


Exact source declarations (reference, not a runnable script):

```text
export const ALL_STREAMERS = [STREAMER_PHONE_BONDED, STREAMER_PHONE_FRIEND, STREAMER_GLASSES]
```

### ModeSelection


Exact source declarations (reference, not a runnable script):

```text
watchYourBack: boolean

callFriend: boolean

findFriend: boolean

source: "phoneA" | "phoneB"

usePhoneLocation: boolean
```

### povChannelName

Realtime broadcast channel for a session's POV + audio streams.

Exact source declarations (reference, not a runnable script):

```text
export function povChannelName(session: string): string
```

### FramePayload

`frame:<streamer>` payload — one JPEG video frame.

Exact source declarations (reference, not a runnable script):

```text
d: string

n: number

t: number
```

### AudioPayload

`audio:<streamer>` payload — one voice chunk.

Exact source declarations (reference, not a runnable script):

```text
d: string

n: number

r: number

t: number
```

### RtcKind

WebRTC signaling kinds — two independent peer sessions per call:
   pov   — Glasses OFFERS (sends camera H.264 + mic Opus); the phone answers.
   voice — the PHONE offers (sends its mic Opus); Glasses answers.
 Signaling rides the same Realtime channel as event `rtc:<kind>:<from>`.

Exact source declarations (reference, not a runnable script):

```text
export type RtcKind = "pov" | "voice" | "friendvid" | "bye"
```

### RTC_KINDS


Exact source declarations (reference, not a runnable script):

```text
export const RTC_KINDS: RtcKind[] = ["pov", "voice", "friendvid"]
```

### rtcEventName


Exact source declarations (reference, not a runnable script):

```text
export function rtcEventName(kind: RtcKind, from: string): string
```

### RtcSignalPayload

`rtc:<kind>:<from>` payload — one SDP description, ICE candidate, or a
  `bye` hangup (kind "bye"; sdp/cand/mid all unused).

Exact source declarations (reference, not a runnable script):

```text
t: "offer" | "answer" | "cand" | "bye"

sdp?: string

cand?: string

mid?: string
```

### RtcSignalTransport

Transport that ferries WebRTC signaling (SDP/ICE) between the Glasses and the
 friend's phone. WebRTCSession depends only on this — it doesn't care
 whether the bytes ride Supabase Realtime (Realtime, legacy) or the
 Mobile Kit → phoneA → Multipeer → phoneB relay (MobileKitLink, the WebRTC-only
 call path that needs no cloud). Both implement this shape.

Exact source declarations (reference, not a runnable script):

```text
readonly isConnected: boolean

onRtcSignal(kind: RtcKind, from: string, cb: (p: RtcSignalPayload) => void): void

offRtcSignal(kind: RtcKind, from: string): void

sendRtcSignal(kind: RtcKind, from: string, payload: RtcSignalPayload): boolean

sendDiag?(state: string): void
```

### RtcRelayMessage

Envelope for one signaling message carried over the phone relay (MobileKitLink).

Exact source declarations (reference, not a runnable script):

```text
type: "rtc"

kind: RtcKind

from: string

sig: RtcSignalPayload
```

### makeSessionCode


Exact source declarations (reference, not a runnable script):

```text
export function makeSessionCode(): string
```

### CALL_TRANSPORT_AUTO

Call Friend transport selection — the 3-way switch on the FriendFinder
 inspector (`callTransport`). Numeric so it maps directly onto a ComboBox
 `@input("int")`. All three degrade to STREAMING behaviour in the Lens Studio
 preview, where the native WebRTC `.so` cannot load.

   AUTO      — start on streaming, auto-upgrade to WebRTC when the peer
               connects, auto-degrade back on drop. Today's behaviour.
   WEBRTC    — force the WebRTC media path (device only). Streaming still
               bootstraps the call during negotiation and remains the voice
               fallback, but the video capture is NOT churned back to JPEG on
               a transient pov drop — WebRTC re-offers and recovers itself.
   STREAMING — JPEG/WAV over Realtime only; WebRTC is never attempted.

Exact source declarations (reference, not a runnable script):

```text
export const CALL_TRANSPORT_AUTO = 0
```

### CALL_TRANSPORT_WEBRTC


Exact source declarations (reference, not a runnable script):

```text
export const CALL_TRANSPORT_WEBRTC = 1
```

### CALL_TRANSPORT_STREAMING


Exact source declarations (reference, not a runnable script):

```text
export const CALL_TRANSPORT_STREAMING = 2
```

### callTransportLabel

Short tag for the call caption / logs.

Exact source declarations (reference, not a runnable script):

```text
export function callTransportLabel(mode: number): string
```

## Scripts/Geolocation/FriendMarkerUI

Import `FriendFinder.lspkg/Scripts/Geolocation/FriendMarkerUI`.

### FriendMarkerUI


Exact source declarations (reference, not a runnable script):

```text
onAwake(): void

setName(name: string): void

setDistanceMeters(meters: number | null, heightDiffM: number | null = null): void

setStatus(status: string): void

setVisible(visible: boolean): void
```

## Scripts/Geolocation/FriendPositionEstimator

Import `FriendFinder.lspkg/Scripts/Geolocation/FriendPositionEstimator`.

### PositionEstimate


Exact source declarations (reference, not a runnable script):

```text
lat: number

lon: number

ageS: number

estimated: boolean

accuracyM: number | null
```

### FriendPositionEstimator


Exact source declarations (reference, not a runnable script):

```text
addFix(lat: number, lon: number, accuracyM: number | null): void

seed(lat: number, lon: number, accuracyM: number | null, ageS: number): void

hasData(): boolean

estimate(): PositionEstimate | null

reset(): void
```

## Scripts/Geolocation/GeoMath

Import `FriendFinder.lspkg/Scripts/Geolocation/GeoMath`.

### FEET_PER_METER


Exact source declarations (reference, not a runnable script):

```text
export const FEET_PER_METER = 3.28084;
```

### FEET_PER_MILE


Exact source declarations (reference, not a runnable script):

```text
export const FEET_PER_MILE = 5280;
```

### formatFeetMiles

"618 ft" below 1000 ft, "1.24 mi" above — mirrors the phone app.

Exact source declarations (reference, not a runnable script):

```text
export function formatFeetMiles(meters: number): string
```

### toRad


Exact source declarations (reference, not a runnable script):

```text
export function toRad(deg: number): number
```

### toDeg


Exact source declarations (reference, not a runnable script):

```text
export function toDeg(rad: number): number
```

### haversineMeters

Haversine distance in meters between two lat/lon points.

Exact source declarations (reference, not a runnable script):

```text
export function haversineMeters(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
): number
```

### initialBearing

Initial bearing from (lat1, lon1) to (lat2, lon2) in degrees, clockwise from true north.

Exact source declarations (reference, not a runnable script):

```text
export function initialBearing(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
): number
```

### directionFromHeading

Convert a target bearing (clockwise from north) and the user's current heading
 (clockwise from north) into a world-space direction vector.

 Lens world coordinates: +X right, +Y up, -Z forward.
 Heading 0 means facing north, so forward (-Z) maps to north.

Exact source declarations (reference, not a runnable script):

```text
export function directionFromHeading(
    targetBearingDeg: number,
    userHeadingDeg: number
): vec3
```

### shortestAngleDeg

Signed shortest angular difference (b - a) wrapped to [-180, 180] degrees.

Exact source declarations (reference, not a runnable script):

```text
export function shortestAngleDeg(aDeg: number, bDeg: number): number
```

### smoothFactor

Frame-rate-independent exponential smoothing factor for lerp-style filters:
 value += (target - value) * smoothFactor(rate, dt)

Exact source declarations (reference, not a runnable script):

```text
export function smoothFactor(ratePerSecond: number, dt: number): number
```

## Scripts/Geolocation/MiniMapUI

Import `FriendFinder.lspkg/Scripts/Geolocation/MiniMapUI`.

### MiniMapData


Exact source declarations (reference, not a runnable script):

```text
selfLat: number

selfLon: number

selfAccM: number | null

selfSource: string

selfAgeS: number | null

friendLat: number

friendLon: number

friendAccM: number | null

friendAgeS: number | null

uwbDistM: number | null

headingDeg: number

headingSource: string

phoneHeadingDeg: number | null

bearingDeg: number

distanceM: number
```

### MiniMapUI


Exact source declarations (reference, not a runnable script):

```text
get onClose(): PublicApi<void>

onAwake(): void

setWaiting(message: string): void

setData(d: MiniMapData): void
```

## Scripts/MobileKit/MobileKitLink

Import `FriendFinder.lspkg/Scripts/MobileKit/MobileKitLink`.

### LocationFix


Exact source declarations (reference, not a runnable script):

```text
lat: number

lon: number

accuracy: number | null

heading: number | null

name: string | null

alt: number | null

vAcc: number | null

pressure: number | null

uwbDist: number | null
```

### MobileKitLink


Exact source declarations (reference, not a runnable script):

```text
get onSelfFix(): PublicApi<LocationFix>

get onFriendFix(): PublicApi<LocationFix>

get onConnection(): PublicApi<boolean>

get onTestMessage(): PublicApi<string>

get onCallRequest(): PublicApi<string>

get onCallCancel(): PublicApi<void>

get onModeExit(): PublicApi<void>

get onQualityRequest(): PublicApi<number>

get isConnected(): boolean

onRtcSignal(kind: RtcKind, from: string, cb: (p: RtcSignalPayload) => void): void

offRtcSignal(kind: RtcKind, from: string): void

sendRtcSignal(kind: RtcKind, from: string, payload: RtcSignalPayload): boolean

constructor(
        private readonly script: BaseScriptComponent,
        private readonly module: SpectaclesMobileKitModule | null
    )

start(simulate: boolean): void

sendControl(control: object): void

sendOneShot(message: object): void
```

## Scripts/MobileKit/MobileKitModule

Import `FriendFinder.lspkg/Scripts/MobileKit/MobileKitModule`.

### MobileKitModule


Exact source declarations (reference, not a runnable script):

```text
getLink(): MobileKitLink
```

## Scripts/SnapCloud/CloudCheckpoints

Import `FriendFinder.lspkg/Scripts/SnapCloud/CloudCheckpoints`.

### CheckpointVisitNote


Exact source declarations (reference, not a runnable script):

```text
who: string

checkpoint: string

ageS: number
```

### CloudCheckpoints


Exact source declarations (reference, not a runnable script):

```text
onVisit: ((note: CheckpointVisitNote) => void) | null = null

constructor(
        private readonly script: BaseScriptComponent,
        private readonly cloud: CloudPathLogger,
    )

start(): void

stop(): void

noteFix(role: "self" | "friend", who: string, lat: number, lon: number): void
```

## Scripts/SnapCloud/CloudPathLogger

Import `FriendFinder.lspkg/Scripts/SnapCloud/CloudPathLogger`.

### CloudPathLogger


Exact source declarations (reference, not a runnable script):

```text
constructor(private readonly script: BaseScriptComponent)

start(): void

logFix(role: "self" | "friend", fix: LocationFix): void

getClient(): SupabaseClient | null

isReady(): boolean

getSessionId(): string

getUid(): string | null
```

## Scripts/SnapCloud/PovFrameReceiver

Import `FriendFinder.lspkg/Scripts/SnapCloud/PovFrameReceiver`.

### PovFrameReceiver


Exact source declarations (reference, not a runnable script):

```text
get onFrame(): PublicApi<Texture>

get onWaiting(): PublicApi<void>

constructor(
        private readonly script: BaseScriptComponent,
        private readonly rt: Realtime,
        private readonly streamer: string
    )

start(): void

stop(): void
```

## Scripts/SnapCloud/Realtime

Import `FriendFinder.lspkg/Scripts/SnapCloud/Realtime`.

### Realtime


Exact source declarations (reference, not a runnable script):

```text
constructor(private readonly script: BaseScriptComponent)

get isConnected(): boolean

onFrame(streamer: string, cb: (p: FramePayload) => void): void

offFrame(streamer: string): void

onAudio(streamer: string, cb: (p: AudioPayload) => void): void

offAudio(streamer: string): void

onRtcSignal(kind: RtcKind, from: string, cb: (p: RtcSignalPayload) => void): void

offRtcSignal(kind: RtcKind, from: string): void

async connect(session: string): Promise<void>

sendFrame(streamer: string, b64Jpeg: string, seq: number): boolean

sendRtcSignal(kind: RtcKind, from: string, payload: RtcSignalPayload): boolean

sendAudio(streamer: string, b64Wav: string, seq: number, sampleRate: number): boolean

disconnect(): void
```

## Scripts/SnapCloud/RtcMailbox

Import `FriendFinder.lspkg/Scripts/SnapCloud/RtcMailbox`.

### RtcMailbox


Exact source declarations (reference, not a runnable script):

```text
constructor(
        private readonly script: BaseScriptComponent,
        private readonly session: string,
        /** Our sender id ("glasses") — we read rows NOT from us. */
        private readonly me: string
    )

get isConnected(): boolean

start(): void

onRtcSignal(kind: RtcKind, from: string, cb: (p: RtcSignalPayload) => void): void

offRtcSignal(kind: RtcKind, from: string): void

sendRtcSignal(kind: RtcKind, from: string, payload: RtcSignalPayload): boolean

sendDiag(state: string): void

stop(): void
```

## Scripts/SnapCloud/SnapCloudModule

Import `FriendFinder.lspkg/Scripts/SnapCloud/SnapCloudModule`.

### SnapCloudModule


Exact source declarations (reference, not a runnable script):

```text
getPathLogger(): CloudPathLogger | null

createCheckpoints(): CloudCheckpoints | null

createRtcMailbox(session: string, streamer: string): RtcMailbox | null
```

## Scripts/SnapCloud/SupabaseRequirements

Import `FriendFinder.lspkg/Scripts/SnapCloud/SupabaseRequirements`.

### SupabaseRequirements


Exact source declarations (reference, not a runnable script):

```text
@input
    @hint("SnapCloudRequirements component holding the SupabaseProject")
    @allowUndefined
    snapCloudRequirements: SnapCloudRequirements

@input
    @hint("Deprecated: use snapCloudRequirements")
    @allowUndefined
    supabaseProject: SupabaseProject

@input
    @hint("Optional Text that shows a setup warning until the asset is assigned")
    @allowUndefined
    text: Text

onAwake(): void

isConfigured(): boolean

getSupabaseProject(): SupabaseProject | null

static getProject(caller: string): SupabaseProject | null
```

## SnapCloudRequirements

Import `FriendFinder.lspkg/SnapCloudRequirements` (same file as SnapCloudExamples' `SnapCloudRequirements`).

### SnapCloudRequirements

The one component holding the Snap Cloud project (`supabaseProject`, shipped empty in the prefab). Validated on awake, so it sits above `CredentialsWarning` and the guide.

```text
@input @allowUndefined supabaseProject: SupabaseProject
@input @allowUndefined text: Text
@input disableWarningsWhenConfigured: boolean = true
@input showSetupInstructions: boolean = true
@input enableDebugLogs: boolean = true
@input enableLogging: boolean = false
@input enableLoggingLifecycle: boolean = false

getSupabaseProject(): SupabaseProject
isConfigured(): boolean
getSupabaseUrl(): string
getSupabasePublicToken(): string
getSupabaseHeaders(): {[key: string]: string}
getStorageApiUrl(): string
getRestApiUrl(): string
getFunctionsApiUrl(): string
setDebugLogging(enabled: boolean): void
revalidate(): void
```

## Scripts/WebRTC/CallStreamer

Import `FriendFinder.lspkg/Scripts/WebRTC/CallStreamer`.

### CallStreamer


Exact source declarations (reference, not a runnable script):

```text
onFriendVideoTexture: ((tex: Texture) => void) | null = null

constructor(
        private readonly script: BaseScriptComponent,
        // Signaling transport for SDP/ICE — MobileKitLink (Mobile Kit relay).
        private readonly signal: RtcSignalTransport
    )

micStatusLine(): string

transportLine(): string

setVideoBitrate(kbps: number): number

get mediaConnected(): boolean

start(): void

stop(): void

friendVideoLine(): string
```

## Scripts/WebRTC/PovPanelUI

Import `FriendFinder.lspkg/Scripts/WebRTC/PovPanelUI`.

### PovPanelUI


Exact source declarations (reference, not a runnable script):

```text
get onClose(): PublicApi<void>

get onQualityToggle(): PublicApi<void>

onAwake(): void

setQualityLabel(text: string): void

setFrameTexture(texture: Texture): void

setCaption(text: string): void
```

## Scripts/WebRTC/PovVideoSource

Import `FriendFinder.lspkg/Scripts/WebRTC/PovVideoSource`.

### PovVideoSource


Exact source declarations (reference, not a runnable script):

```text
onTexture: ((tex: Texture) => void) | null

statusLine(): string

start(): void

stop(): void
```

### SyntheticPovSource


Exact source declarations (reference, not a runnable script):

```text
onTexture: ((tex: Texture) => void) | null = null

constructor(private readonly script: BaseScriptComponent)

start(): void

statusLine(): string

stop(): void
```

### WebRtcWatchYourBackSource


Exact source declarations (reference, not a runnable script):

```text
onTexture: ((tex: Texture) => void) | null = null

constructor(
        private readonly script: BaseScriptComponent,
        private readonly sessionCode: string,
    )

start(): void

statusLine(): string

stop(): void
```

## Scripts/WebRTC/RtcVoicePlayer

Import `FriendFinder.lspkg/Scripts/WebRTC/RtcVoicePlayer`.

### RtcVoicePlayer


Exact source declarations (reference, not a runnable script):

```text
constructor(private readonly script: BaseScriptComponent)

start(): void

stop(): void

enqueue(pcm: Uint8Array, rate: number): void
```

## Scripts/WebRTC/StreamController

Import `FriendFinder.lspkg/Scripts/WebRTC/StreamController`.

### StreamController


Exact source declarations (reference, not a runnable script):

```text
static native: FriendFinderStreamNativeExports | null = null;

onAwake()
```

## Scripts/WebRTC/StreamNativeModule

Import `FriendFinder.lspkg/Scripts/WebRTC/StreamNativeModule`.

### FriendFinderStreamNativeExports

SpecsNDK native bridge for libFriendFinderStreamModule.so — types + field decorator + `load` for StreamController.
 When you add native exports, extend FriendFinderStreamNativeExports (and call sites) alongside the C++ module.
 
 Shape of JS values exported from the CoreJs native module (see assignNativeFunctions in C++).

Exact source declarations (reference, not a runnable script):

```text
export type FriendFinderStreamNativeExports = {
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

### StreamNativeModule

**`@StreamNativeModule()`** — field decorator only: initializes the field to **`null`**
 and records where **`load`** assigns exports. It does **not** load the `.so`.

 **`StreamNativeModule.load(this, onLoaded)`** — loads the library, assigns the field, then
 **`onLoaded.call(this, exports)`** (use **`this.onNativeLibraryLoaded`** or any **`(lib) => { … }`**).

Exact source declarations (reference, not a runnable script):

```text
export const StreamNativeModule: StreamNativeModuleApi = Object.assign(
    function StreamNativeModule(): (
        _target: undefined,
        context: ClassFieldDecoratorContext
    ) => void {
        return function (_target: undefined, context: ClassFieldDecoratorContext) {
            const propertyKey = context.name;

            context.addInitializer(function (this: BaseScriptComponent) {
                const inst = this as any;
                inst[propertyKey] = null;
                if (inst[FriendFinderStreamNativeFieldKey] != null && inst[FriendFinderStreamNativeFieldKey] !== propertyKey) {
                    print(
                        "StreamNativeModule: only one @StreamNativeModule() field is supported per instance."
                    );
                }
                inst[FriendFinderStreamNativeFieldKey] = propertyKey;
            });
        };
    },
    { load: loadStreamNativeModule }
) as StreamNativeModuleApi;
```

## Scripts/WebRTC/WebRTCController

Import `FriendFinder.lspkg/Scripts/WebRTC/WebRTCController`.

### WebRTCController


Exact source declarations (reference, not a runnable script):

```text
static native: FriendFinderWebRTCNativeExports | null = null

onAwake()
```

## Scripts/WebRTC/WebRTCNativeModule

Import `FriendFinder.lspkg/Scripts/WebRTC/WebRTCNativeModule`.

### RTC_KIND_POV

SpecsNDK native bridge for libFriendFinderWebRTCModule.so — the real WebRTC media
 path (H.264 hardware encode + Opus over RTP via libSpecsWebRTC). Mirrors the
 StreamNativeModule loader pattern.
 
 Session kinds (mirror the C++ constants).

Exact source declarations (reference, not a runnable script):

```text
export const RTC_KIND_POV = 0
```

### RTC_KIND_VOICE


Exact source declarations (reference, not a runnable script):

```text
export const RTC_KIND_VOICE = 1
```

### RTC_KIND_FRIENDVID


Exact source declarations (reference, not a runnable script):

```text
export const RTC_KIND_FRIENDVID = 2
```

### RTC_STATE_NONE

swrtc_state values surfaced by rtcState().

Exact source declarations (reference, not a runnable script):

```text
export const RTC_STATE_NONE = -1
```

### RTC_STATE_NEW


Exact source declarations (reference, not a runnable script):

```text
export const RTC_STATE_NEW = 0
```

### RTC_STATE_CONNECTING


Exact source declarations (reference, not a runnable script):

```text
export const RTC_STATE_CONNECTING = 1
```

### RTC_STATE_CONNECTED


Exact source declarations (reference, not a runnable script):

```text
export const RTC_STATE_CONNECTED = 2
```

### RTC_STATE_DISCONNECTED


Exact source declarations (reference, not a runnable script):

```text
export const RTC_STATE_DISCONNECTED = 3
```

### RTC_STATE_FAILED


Exact source declarations (reference, not a runnable script):

```text
export const RTC_STATE_FAILED = 4
```

### RTC_STATE_CLOSED


Exact source declarations (reference, not a runnable script):

```text
export const RTC_STATE_CLOSED = 5
```

### NativeRtcSignal

One message from rtcPollSignal(kind) / rtcPollAudio(), JSON-parsed.

Exact source declarations (reference, not a runnable script):

```text
t: "offer" | "answer" | "cand"

sdp?: string

cand?: string

mid?: string
```

### NativeRtcAudio


Exact source declarations (reference, not a runnable script):

```text
r: number

d: string
```

### FriendFinderWebRTCNativeExports


Exact source declarations (reference, not a runnable script):

```text
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
```

### WebRTCNativeModule

**`@WebRTCNativeModule()`** — field decorator only: initializes the field
 to **`null`** and records where **`load`** assigns exports.

Exact source declarations (reference, not a runnable script):

```text
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
```

## Scripts/WebRTC/WebRTCSession

Import `FriendFinder.lspkg/Scripts/WebRTC/WebRTCSession`.

### VIDEO_QUALITY_PRESETS_KBPS


Exact source declarations (reference, not a runnable script):

```text
export const VIDEO_QUALITY_PRESETS_KBPS = [1000, 2000, 3500]
```

### WebRTCSession


Exact source declarations (reference, not a runnable script):

```text
onVoicePcm: ((pcm: Uint8Array, rate: number) => void) | null = null

onPovConnected: ((connected: boolean) => void) | null = null

onFriendVideoFrame: ((rgba: Uint8Array, width: number, height: number) => void) | null = null

diagExtra: (() => { [k: string]: number | string }) | null = null

constructor(
        private readonly script: BaseScriptComponent,
        // Signaling transport (SDP/ICE). Either Realtime (Supabase, legacy)
        // or MobileKitLink (Mobile Kit relay — the cloud-free WebRTC call path).
        private readonly sig: RtcSignalTransport,
        native: FriendFinderWebRTCNativeExports
    )

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

## Source member notes

- `Scripts/App/Types::ModeSelection.source`: * Which phone streams in watchYourBack mode. Always "phoneA" (the
     * wearer's own bonded phone) since the menu redesign; kept on the wire
     * for iOS compatibility.
- `Scripts/App/Types::ModeSelection.usePhoneLocation`: * Find Friend self-location source, chosen on the start menu's GPS switch:
     *   true  — the iPhone's GPS relayed over Mobile Kit (the default, "Mobile
     *           application"). UWB refines the final approach.
     *   false — Glasses' own GeoLocation service.
     * Purely a Glasses-side decision (the phone always sends its fix either way),
     * so it never touches the wire — FriendFinderManager applies it locally.
- `Scripts/App/Types::FramePayload.d`: Base64 JPEG.
- `Scripts/App/Types::FramePayload.n`: Frame sequence number.
- `Scripts/App/Types::FramePayload.t`: Sender epoch ms.
- `Scripts/App/Types::AudioPayload.d`: Base64 WAV (16-bit PCM mono).
- `Scripts/App/Types::AudioPayload.n`: Chunk sequence number.
- `Scripts/App/Types::AudioPayload.r`: Sample rate in Hz.
- `Scripts/App/Types::AudioPayload.t`: Sender epoch ms.
- `Scripts/App/Types::RtcSignalTransport.isConnected`: True when the underlying link can actually carry a message right now.
- `Scripts/App/Types::RtcSignalTransport.sendDiag`: * Optional: write a fire-and-forget diagnostic snapshot (ICE states +
     * candidate counts, NO IPs) somewhere retrievable off-device. Only the DB
     * mailbox implements it; it lets us read the Glasses' side of a stuck call
     * without the flaky USB log tether. Carries no signaling meaning — the peer
     * pollers ignore the "diag" kind.
- `Scripts/Geolocation/FriendPositionEstimator::PositionEstimate.ageS`: Seconds since the last real fix.
- `Scripts/Geolocation/FriendPositionEstimator::PositionEstimate.estimated`: True when the position is extrapolated/held rather than a live fix.
- `Scripts/Geolocation/FriendPositionEstimator::FriendPositionEstimator.addFix`: Record a real fix (called from every friend GPS update).
- `Scripts/Geolocation/FriendPositionEstimator::FriendPositionEstimator.seed`: Seed from a Snap Cloud last-known row on cold start (no live fixes yet).
- `Scripts/Geolocation/FriendPositionEstimator::FriendPositionEstimator.estimate`: Best estimate of where the friend is NOW; null until the first fix.
- `Scripts/Geolocation/MiniMapUI::MiniMapData.uwbDistM`: Fresh UWB phone-to-phone distance (m); null when out of range/stale.
- `Scripts/Geolocation/MiniMapUI::MiniMapUI.onClose`: EXIT pressed — the manager returns to the mode menu.
- `Scripts/Geolocation/MiniMapUI::MiniMapUI.setWaiting`: No usable fixes yet: hide the geo layer, park a status line.
- `Scripts/MobileKit/MobileKitLink::LocationFix.uwbDist`: Phone-to-phone UWB distance (m), present only while fresh (<2 s).
- `Scripts/MobileKit/MobileKitLink::MobileKitLink.onCallRequest`: Friend phone wants to start a video call (name of the requester).
- `Scripts/MobileKit/MobileKitLink::MobileKitLink.onCallCancel`: Friend phone cancelled its pending call request (dismiss the dialog).
- `Scripts/MobileKit/MobileKitLink::MobileKitLink.onModeExit`: Phone asked to leave the current mode (same as CHANGE MODES on device).
- `Scripts/MobileKit/MobileKitLink::MobileKitLink.onQualityRequest`: Friend phone asked for a video-quality preset (kbps).
- `Scripts/MobileKit/MobileKitLink::MobileKitLink.isConnected`: True while the Mobile Kit session to the bonded phone is up.
- `Scripts/MobileKit/MobileKitLink::MobileKitLink.sendRtcSignal`: Glasses → phone: one SDP/ICE message. Rides sendData as {type:"rtc",…}.
- `Scripts/MobileKit/MobileKitLink::MobileKitLink.sendControl`: * Send a control message to the bonded phone (Glasses → phone, one-way).
     * Arrives on iOS as a `.notify` request; the phone forwards it to the
     * friend phone over multipeer. Queued + re-sent on every reconnect.
- `Scripts/MobileKit/MobileKitLink::MobileKitLink.sendOneShot`: * Fire-and-forget message to the bonded phone. Unlike sendControl it is
     * NOT queued for re-send on reconnect — used for call accept/deny replies.
- `Scripts/MobileKit/MobileKitModule::MobileKitModule.getLink`: The shared MobileKitLink, constructed once and owned by this component.
     *  Lazy so it resolves correctly regardless of script init order (Core may
     *  ask for it in onAwake, before this module's own onAwake has run).
- `Scripts/SnapCloud/CloudCheckpoints::CloudCheckpoints.onVisit`: Fired for a NEW visit by the OTHER actor (role='friend') — wire to a banner.
- `Scripts/SnapCloud/CloudCheckpoints::CloudCheckpoints.noteFix`: Feed every fix here; inserts a debounced visit when inside a checkpoint.
- `Scripts/SnapCloud/CloudPathLogger::CloudPathLogger.start`: Fire-and-forget init — never blocks the caller.
- `Scripts/SnapCloud/CloudPathLogger::CloudPathLogger.logFix`: Throttled fire-and-forget insert. Never throws; never blocks.
- `Scripts/SnapCloud/Realtime::Realtime.onRtcSignal`: WebRTC signaling sent BY `from` (SDP offers/answers + ICE candidates).
- `Scripts/SnapCloud/Realtime::Realtime.sendFrame`: Broadcast a video frame. Returns false when dropped (not connected / oversize).
- `Scripts/SnapCloud/Realtime::Realtime.sendRtcSignal`: Broadcast one WebRTC signaling message (SDP/candidate — small, always sent).
- `Scripts/SnapCloud/Realtime::Realtime.sendAudio`: Broadcast a voice chunk. Returns false when dropped.
- `Scripts/SnapCloud/RtcMailbox::RtcMailbox.start`: Fire-and-forget connect: auth, seed the cursor, start polling.
- `Scripts/SnapCloud/RtcMailbox::RtcMailbox.sendDiag`: * Write a diagnostic snapshot row (kind "diag") — ICE states + candidate
     * counts as JSON in the `sdp` text column, NO IPs. The peer's poller sees
     * it (sender ≠ me) but has no "diag" handler, so it's ignored; we read it
     * back with a `kind=eq.diag` REST query — the tether-free window into a
     * stuck call's Glasses side.
- `Scripts/SnapCloud/SnapCloudModule::SnapCloudModule.getPathLogger`: The shared position-history logger (fire-and-forget), or null when the
     *  module is inactive. Constructed once, owned by this component. Caller
     *  still drives its lifecycle (start()), preserving the original timing.
- `Scripts/SnapCloud/SnapCloudModule::SnapCloudModule.createCheckpoints`: Checkpoint geofence detector bound to the shared logger, or null when the
     *  module is inactive. Caller drives onVisit + start().
- `Scripts/SnapCloud/SnapCloudModule::SnapCloudModule.createRtcMailbox`: A WebRTC signaling mailbox for one session/streamer, or null when the
     *  module is inactive (Call Friend's cloud signaling is then unavailable).
- `Scripts/SnapCloud/SupabaseRequirements::SupabaseRequirements.getProject`: * Static accessor used by the SnapCloud transports. Returns null (with a
     * one-time console hint) when the asset — or this component itself — is
     * missing from the scene, so callers disable their feature instead of
     * crashing the lens.
- `Scripts/WebRTC/CallStreamer::CallStreamer.onFriendVideoTexture`: Fired with the friend-video Texture when it's (re)created — wire to the
     *  POV panel's setFrameTexture so the wearer sees the friend.
- `Scripts/WebRTC/CallStreamer::CallStreamer.micStatusLine`: * One-line mic health for the call panel — the on-device answer to
     * "why can't my friend hear me" without a connected debugger.
- `Scripts/WebRTC/CallStreamer::CallStreamer.transportLine`: Transport health for the caption ("rtc: pov ✓ voice …").
- `Scripts/WebRTC/CallStreamer::CallStreamer.setVideoBitrate`: Live POV quality change (kbps). Returns the applied value, or 0 when
     *  the WebRTC session isn't running (preview / module missing).
- `Scripts/WebRTC/CallStreamer::CallStreamer.mediaConnected`: True once either media leg is up — flips the panel caption from the
     *  playful connecting loader to the real status line.
- `Scripts/WebRTC/CallStreamer::CallStreamer.friendVideoLine`: One-liner for the call caption — whether the friend's camera is arriving.
- `Scripts/WebRTC/PovPanelUI::PovPanelUI.setQualityLabel`: Reflect the applied quality preset on the button ("VIDEO · 1K").
- `Scripts/WebRTC/PovVideoSource::PovVideoSource.onTexture`: Fired when the display Texture is (re)created and ready to show. Wire it
     *  to PovPanelUI.setFrameTexture.
- `Scripts/WebRTC/PovVideoSource::PovVideoSource.statusLine`: Short status for the panel caption (source-specific).
- `Scripts/WebRTC/RtcVoicePlayer::RtcVoicePlayer.enqueue`: Decoded mono S16 PCM (+ its sample rate) into the jitter buffer.
- `Scripts/WebRTC/StreamController::StreamController.native`: Native exports once loaded (device only); null in preview / before build.
- `Scripts/WebRTC/WebRTCController::WebRTCController.native`: Native exports once loaded (device only); null in preview / before build.
- `Scripts/WebRTC/WebRTCNativeModule::NativeRtcAudio.r`: Sample rate of the decoded PCM (Opus clock, 48000).
- `Scripts/WebRTC/WebRTCNativeModule::NativeRtcAudio.d`: Base64 S16 mono PCM.
- `Scripts/WebRTC/WebRTCSession::WebRTCSession.onVoicePcm`: Decoded friend-voice PCM (S16 mono bytes + sample rate) for playback.
- `Scripts/WebRTC/WebRTCSession::WebRTCSession.onPovConnected`: Fired when the pov session connects/disconnects (drives capture handover).
- `Scripts/WebRTC/WebRTCSession::WebRTCSession.onFriendVideoFrame`: Newest decoded friend-camera frame (RGBA8, w*h*4, vertically flipped for
     *  direct texture upload). Fired each frame a new one is available.
- `Scripts/WebRTC/WebRTCSession::WebRTCSession.diagExtra`: Extra key/values merged into the DB diag snapshot — audio playback
     *  counters + lens fps live in CallStreamer, not here.
- `Scripts/WebRTC/WebRTCSession::WebRTCSession.statusLine`: One-liner for the call caption: "rtc: pov ✓ voice …".
- `Scripts/WebRTC/WebRTCSession::WebRTCSession.sendMicPcm`: Mic PCM (S16 mono, base64) → Opus over the pov session.
- `Scripts/WebRTC/WebRTCSession::WebRTCSession.nativeMicSupported`: Whether this module build supports native (echo-cancelled) mic capture.
- `Scripts/WebRTC/WebRTCSession::WebRTCSession.startNativeMic`: Kick off native mic capture on the pov session (async; poll nativeMicState).
- `Scripts/WebRTC/WebRTCSession::WebRTCSession.nativeMicState`: 0 idle, 1 starting, 2 active, -1 failed (0 when unsupported).
- `Scripts/WebRTC/WebRTCSession::WebRTCSession.nativeMicFrames`: PCM frames captured since the native mic last started; -1 when the
     *  module predates rtcMicFrames (stall watchdog then stays off).
- `Scripts/WebRTC/WebRTCSession::WebRTCSession.audioRxStats`: Voice-session receive stats ("rx_pkts=.. plc_frames=..") for the diag line.
- `Scripts/WebRTC/WebRTCSession::WebRTCSession.nativeSpeakerSupported`: Whether this module build supports the native friend-voice speaker.
- `Scripts/WebRTC/WebRTCSession::WebRTCSession.startNativeSpeaker`: Kick off the native speaker (async; poll nativeSpeakerState). While it
     *  is ACTIVE, decoded voice goes decode-thread → speaker ring and the JS
     *  PCM poll runs dry — the AudioOutput fallback simply stops receiving.
- `Scripts/WebRTC/WebRTCSession::WebRTCSession.nativeSpeakerState`: 0 idle, 1 starting, 2 active, -1 failed (0 when unsupported).
- `Scripts/WebRTC/WebRTCSession::WebRTCSession.setVideoBitrate`: Live POV quality change: reaches the HW encoder via SpecsMediaCodec
     *  setParameters (no renegotiation, no video gap); a later pov re-offer
     *  also creates at this rate. Returns the applied kbps.

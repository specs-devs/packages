# DecartAI components and API

[← Agent usage index](../README.md)

## Use when

Read when binding public inputs or calling package methods.

All consumer imports below begin `DecartAI.lspkg/Scripts/`. Required inputs without initializers have no usable default; bind them before the component starts. Lifecycle methods such as `onAwake` are engine callbacks, not application commands. No package-defined public event stream is exposed by these components.

## DecartRealtimeRestyle

Import `DecartAI.lspkg/Scripts/DecartRealtimeRestyle`, export `DecartRealtimeRestyle`.

| Input | Type / source default | Meaning |
|---|---|---|
| `target` | string / `auto` | ComboBox: `auto`, `editor`, `device` (old label text is mapped back in `onAwake`); unrecognized values follow auto resolution |
| `mode` | string / `bridge` | ComboBox, Mac path: `bridge` or `http` (old label text is mapped back in `onAwake`); branching checks `bridge`, otherwise HTTP |
| `bridgeUrl` | string / `ws://localhost:8765` | Mac companion WebSocket |
| `bridgeSendFps` | number / 10 | Send cadence uses at least 1 fps |
| `nativeEndpoint` | string / `wss://api3.decart.ai/v1/stream` | Compatibility input, overridden in main engine |
| `nativeModel` | string / `lucy-2.5` | Compatibility input, overridden by `lucy-restyle-2` |
| `nativeUseH265` | boolean / false | Compatibility input, overridden false |
| `nativeFps` | number / 30 | Native session fps, floor and clamp to at least 1 |
| `nativeBitrateKbps` | number / 6000 | Compatibility input, overridden 4000 |
| `nativeMaxWidth` | number / 1280 | Native capture max width, floor and clamp to at least 240 |
| `nativeDownlinkKbps` | number / 2500 | Explicitly inactive |
| `displayZoom` | number / 2.09 | Uniform display zoom; values above 1 overscan/crop |
| `displayOffsetX` | number / 11 | Local X offset cm added to authored quad position |
| `displayOffsetY` | number / 7 | Local Y offset cm |
| `displayOffsetZ` | number / 0.15 | Local depth offset cm |
| `matchAspect` | boolean / true | Uses decoded aspect in native path; initial aspect 16:9 elsewhere |
| `apiKey` | string / `PASTE_YOUR_DECART_API_KEY` | HTTP/native key, fallback to requirements component |
| `prompt` | string / zombie restyle instruction | Whole-scene style preserving subjects/layout/motion; old shipped defaults migrate on Awake |
| `resolution` | string / `480p` | HTTP output resolution (`480p`/`720p`) |
| `seed` | number / 1234 | HTTP seed floored/clamped to 0…4294967295 |
| `enhancePrompt` | boolean / true | HTTP field and bridge prompt flag; native session always sends true |
| `autoStart` | boolean / false | Transport waits for Start by default |
| `targetImage` | Image / required | Display material cloned at Start; receives output texture |
| `statusText` | Text / optional | Status, frame/error readout |
| `startDelaySeconds` | number / 3 | First HTTP frame delay clamped >=0 |
| `editorWarmupSeconds` | number / 40 | Extra delay only for HTTP editor autoStart |

Public method signatures (reference fragments, not complete runnable scripts):

```text
startLoop(): void
stopLoop(): void
setPrompt(newPrompt: string): void
isRunning(): boolean
setDisplayZoom(zoom: number): void
setDisplayOffsetX(x: number): void
setDisplayOffsetY(y: number): void
setDisplayOffsetZ(z: number): void
getDisplayZoom(): number
getDisplayOffsetX(): number
getDisplayOffsetY(): number
getDisplayOffsetZ(): number
```

`isRunning()` is requested loop state, not network connected/decoded-frame state. `setPrompt` ignores empty strings, updates the user field, and appends a facing-preservation clause at send time. Native and connected bridge apply prompts live; HTTP applies the prompt sampled for each new request. Display setters update immediately after Start captured the authored baseline; before that they only update fields. Setters have no range clamp; UI sliders provide ranges.

## DecartControlsUI

Import `DecartAI.lspkg/Scripts/DecartControlsUI`, export `DecartControlsUI`. Its only input is required `decartScript: DecartRealtimeRestyle` (bind the actual ScriptComponent).

Creates a 34×33 cm UIKit panel with prompt TextInputField, Zombie/Anime/Water/Cyber/Clay/Snow presets, Start/Stop, display readout, sliders and sibling Menu/Hide toggle. Slider ranges: scale 0.5…3.5, X/Y -50…50 cm, Z -60…40 cm. Sliders are initialized 0.2 seconds after Start. Presets update the engine and field. UI Start reads fresh nonempty field text before calling startLoop. Hide only disables panel body; it does not stop streaming. No extra public application method/event is exposed.

## DecartRequirements

Import `DecartAI.lspkg/Scripts/DecartRequirements`, exports `DecartRequirements` and `DECART_API_KEY_PLACEHOLDER`.
Inputs: optional `apiKey: string='PASTE_YOUR_DECART_API_KEY'`; optional `text: Text`.

```text
static isRealKey(key: string | undefined | null): boolean
static getApiKey(caller: string): string | null
static markConfigured(): void
```

A real key is merely nonempty and unequal to the placeholder; no server validation or whitespace trimming occurs. A one-time missing-key warning accompanies lookup. `markConfigured` hides the reminder through a shared flag. Engine input key wins over requirements; `getApiKey` alone only checks the requirements instance. This component does not set bridge credentials.

## LazyTether

Import `DecartAI.lspkg/Scripts/LazyTether`, export `LazyTether`.

| Input | Type / default | Meaning |
|---|---|---|
| `cameraObject` | SceneObject / required | Follow reference |
| `distanceCm` | number / 80 | Forward resting distance |
| `heightOffsetCm` | number / 0 | Eye-height offset |
| `deadzoneDegrees` | number / 12 | Follow begins after view-angle drift |
| `distanceToleranceCm` | number / 30 | Follow begins after radial/height drift |
| `smoothing` | number / 4 | Exponential easing strength |

On Start it snaps in front of the reference, then Update follows only outside deadzones, with yaw-only facing. Missing camera input logs and leaves behavior inactive. No public application methods/events beyond inputs.

## Native module and session

Import `DecartAI.lspkg/Scripts/DecartWebRTCNativeModule` for `DecartWebRTCNativeModule`, `DecartWebRTCNativeExports`, `DecartWebRTCFrameRGBA`, `DecartWebRTCSignalingOut` and `DecartWebRTCState`.

`@DecartWebRTCNativeModule()` decorates one field and initializes it null; it does not load the library. `load(self: BaseScriptComponent, onLoaded): Promise<DecartWebRTCNativeExports|null>` requires a decorated field, first runs `requireAsset("../NativeModules/libSpecsWebRTC.so")` as a bundling anchor (the module's WebRTC engine, which nothing else references, so it is packaged beside the module; a failure here only prints a note), then loads `../NativeModules/libDecartWebRTCModule.so`, assigns exports and invokes callback with `this=self` only on success. Failures print, return null and leave the field null. Caller must inspect the returned promise if failure UI is needed.

State enum: New=0, Connecting=1, Connected=2, Disconnected=3, Failed=4, Closed=5, Streaming=6.

Export signatures (types mirror native ABI; use device validation):

```text
ping(): number
startSession(useH265: number, fps: number, bitrateKbps: number, cameraMaxWidth: number): number
stopSession(): number
setRemoteAnswer(sdp: string): number
addRemoteCandidate(candidate: string, mid: string): number
getSignalingOut(): {kind: "offer"|"answer"|"cand"|"none"; sdp?: string; candidate?: string; mid?: string}
getState(): number
requestKeyframe(): number
requestDownlinkKbps(kbps: number): number // included C++ is no-op; not a bitrate cap
getFrameRGBA(): {buffer: ArrayBuffer; width: number; height: number}
pullFrameInto(buffer: ArrayBuffer): {width: number; height: number}
```

`getFrameRGBA` can return an animated fallback gradient. `pullFrameInto` uses a persistent caller buffer, returns width 0 when no new decoded frame, and is the main engine path; the engine allocates capacity 1280×768×4 bytes.

Import `DecartAI.lspkg/Scripts/DecartWebRTCSession` for `DecartWebRTCSession`. Constructor: `(lib, internetModule, endpoint, apiKey, model, log)`; methods `start(prompt, useH265, fps, bitrateKbps, cameraMaxWidth): void`, `pump(): void`, `setPrompt(prompt): void`, `stop(): void`. Start calls native startSession then opens signaling; its result is logged rather than checked before opening. Pump drains up to eight offer/candidate items per Update. First prompt is sent after answer; updates use WebSocket. No automatic reconnect/auth/token refresh is provided.

## DecartWebRTCController

Import `DecartAI.lspkg/Scripts/DecartWebRTCController`, export `DecartWebRTCController`. Optional standalone smoke test with no Inspector inputs. Loads `../Prefabs/FlippedImage.lspkg/FlippedImage.prefab` (a nested package: an `Image` prefab with its own `Flipped Image.mat`, `flipped image.graphShader` and placeholder texture; the controller instantiates it under the camera and writes frames into its `Image`), finds a Camera/Main Camera/Camera Object by name, then loads native exports and displays polled getFrameRGBA output. It does not start a Decart session or provide prompt/signaling itself.

Public `updateImageTexture(buffer: ArrayBuffer, width: number, height: number)` uploads only exact width×height×4 RGBA length. Use separately from the main engine; no transport success can be inferred from its gradient.

## Demo scaffolding (Example/)

Demo-only scripts shipped in `DecartAI.lspkg/Example/` so the prefab works on its own. They aren't part of the package API. Remove `Guide` and `ExampleCarousel` when you build your own Lens; `DecartDemo` works without them.

| Script | Object | Key inputs (prefab values) |
| --- | --- | --- |
| `Example/GuideDismissPanel/GuideDismissPanel.ts` | `Guide` (UIKit Frame at local (0, 0, −100), `GuideText`, `OkButton`) | `buttonLabel` (`"Ok, I understood"`), `hideUntilDismissed: SceneObject[]` (`DecartDemo`, `ExampleCarousel`): hidden while the guide shows, enabled when it's closed |
| `Example/ExampleCarousel/ExampleCarousel.ts` | `ExampleCarousel` (local (0, 0, 0)) | `examples: SceneObject[]` (`DecartDemo`), `exampleInfo: string[]` (one entry), `steps: SceneObject[]` (empty), `stepInfo: string[]` (empty; one description per entry of `steps`, an empty entry falls back to the step's example info), `startIndex` (`0`), `previousLabel` / `nextLabel`, `examplesPushBack` (`20` cm), `anchorExamples` (`false`, the demo stays where it is authored), `startMinimized` (`true`), `extraPanelDrop` (`5` cm) |
| `Example/HeadLockedDisplay/HeadLockedDisplay.ts` | `DecartDemo/DecartDisplay` (local (0, 0, 0), scale 1; parent of `DecartDisplayQuad`, which sits at local (0, 0, −80) with scale 64×36) | No inputs. Copies the InteractionKit world camera's (`WorldCameraFinderProvider`) position and rotation onto its object in `LateUpdateEvent`, so the display quad behaves like a camera child |

With a single example the carousel only shows its title bar, the info text and the minimize button.

## Assets

| Asset | Used by |
| --- | --- |
| `NativeModules/libDecartWebRTCModule.so` | Native module loaded by `DecartWebRTCNativeModule.load` (device only) |
| `NativeModules/libSpecsWebRTC.so` | WebRTC engine the module links against; required as a bundling anchor before the module loads (device only) |
| `Materials/Image 2.mat` | Material of the prefab's `DecartDisplayQuad` `Image`; the engine clones it at start, so runtime texture writes don't change the asset. Uses `Shaders/flat.graphShader` and `Images/Image.png` |
| `Materials/Image.mat` | Not referenced by the prefab |
| `Prefabs/FlippedImage.lspkg` | `DecartWebRTCController` smoke test only |
| `ExtractAtProjectRoot/DecartBridge.zip`, `DecartWebRTCModule.zip` | Mac bridge and native module sources; extract at the project root (see [setup](setup.md) and the [tutorial](tutorial.md#native-development-specsndk)) |

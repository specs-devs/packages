# EasyTeleprompter components

[← Agent usage index](../README.md)

## Use when

Import scripts, wire inputs, or distinguish local navigation from optional remote helpers. Inputs below list TypeScript source defaults; prefab instances can override them. “Unassigned” means the source provides no initializer, not permission to omit a dereferenced input.

Every class uses a named export. All @component classes extend BaseScriptComponent. The shared logging inputs are listed per component for completeness. None exports a custom public Event or callback signal. Lifecycle methods are not navigation controls.

## Prefabs

- `EasyTeleprompter.lspkg/EasyTeleprompter__PLACE_IN_SCENE.prefab` (children in order: Guide, ExampleCarousel, `[Controllers-Static or Google?]`, `[StaticPresentationExample]`, `[GooglePresentationExample]`): local `[StaticPresentationExample]` enabled, `[GooglePresentationExample]` disabled; `[Controllers-Static or Google?]` carries controller wiring. GoogleSlideBridge and WebSocketController components are serialized disabled.
  - The root carries a UIKit `Frame` (draggable panel) at local (0, 0, −80) cm, scale 0.8; drop the prefab at the scene root so it opens 80 cm in front of the start pose.
  - `Guide` (local 0, 0, −25) is the guide panel (GuideDismissPanel). At start it places itself about 100 cm in front of the head pose. `ExampleCarousel` (local 0, −27.5, 0) is the carousel, which starts minimized. Both are demo scaffolding ([below](#demo-scaffolding-example)).
  - `[StaticPresentationExample]/Slides` holds 16 slide objects (`Slide`, `Slide 1` … `Slide 15`), each a `Texture` Image plus a notes `Text`.
  - Each example has round `Previous` / `Next` / `EnableVoice` UIKit buttons whose `triggerUpCallbacks` call `previous` / `next` and `SpeechToText.toggleListening`. In the static example they target `PresentationSwitcher`, in the Google example `GoogleSlideBridge` (see [troubleshooting](troubleshooting.md#google-example-arrows-do-nothing)).
  - `PreviousCollider` / `NextCollider` are the wrist soft-press pads (SoftPressController, left / right hand), at local (∓13, −11.5, +51) — about 40 cm in front of the user and 9 cm below eye level once the root scale applies. Their press volumes span roughly 33–45 cm out, which can overlap the reach toward the round buttons ([device check](troubleshooting.md#wrist-pads-trigger-while-reaching-for-the-round-buttons)). `useGoogleSlide` is off in the static example and on in the Google example.
- `EasyTeleprompter.lspkg/Prefabs/Slide.prefab`: a slide building block. Root `Slide` with a `Texture` child holding an `Image` (the slide picture) and `Text` children for the notes. Duplicate it under the switcher's slide parent to add slides.
- `EasyTeleprompter.lspkg/Prefabs/HandRef.prefab`: wrist interactor used by soft press. Root `RightHandRef` (scale 0.3) with a Physics collider and a disabled Render Mesh Visual. All four SoftPressController instances in the demo prefab use it as `interactorPrefab`.

## Assets

- `Presentation/`: the 16 sample slide images (`[MASTER] GDC Glasses*.jpg`) and one material per slide (`Image[MASTER] GDC Glasses*.mat`, on `Shaders/image_unlit.graphShader`). Each slide's `Image` uses its own material. To swap a slide picture, change that material's texture, or give the slide's `Image` a new material.
- `Textures/ImageMateriaMic.mat`, `ImageMaterialArrow.mat`, `ImageMateriaFrame.mat` (all on `image_unlit`): the mic button, round-arrow and frame images. `mic-no.png` and `mic.png` are wired to SpeechToText's `normalMicImage` / `listeningMicImage`; SpeechToText swaps them on the mic button's material `baseTex`.
- `Materials/PBR*.mat` (on `Shaders/pbr.graphShader`): `PBR.mat` draws the soft-press pads (`PreviousCollider` / `NextCollider`); `PBR 3.mat` draws their vertex, center and closest-point markers. `Materials/Image*.mat` use `Shaders/flat.graphShader` or `image_unlit`.
- `Mesh/Sphere.mesh`.

## Demo scaffolding (`Example/`)

These scripts ship in `EasyTeleprompter.lspkg/Example/` and are wired inside `EasyTeleprompter__PLACE_IN_SCENE.prefab`. They only present the demo, and the teleprompter scripts don't need them.

| Object / script | Class | Key inputs |
| --- | --- | --- |
| `Guide`: `Example/GuideDismissPanel/GuideDismissPanel.ts` | `GuideDismissPanel` | `hideUntilDismissed: SceneObject[]` lists the objects hidden until "Ok, I understood" is pressed (here: ExampleCarousel, `[Controllers-Static or Google?]`, `[StaticPresentationExample]`, `[GooglePresentationExample]`). Only the ones enabled at start are re-enabled, so the Google example stays off. `buttonLabel: string = "Ok, I understood"` is only used when the panel is built at runtime |
| `ExampleCarousel`: `Example/ExampleCarousel/ExampleCarousel.ts` | `ExampleCarousel` | `examples: SceneObject[]` (here the single `[StaticPresentationExample]`), `exampleInfo: string[]` (one line per example), `steps: SceneObject[]`, `stepInfo: string[] = []` (one line per step, same order as `steps`; empty entries fall back to the step's example info; unset here), `startIndex: number = 0`, `previousLabel` / `nextLabel`, `examplesPushBack: number = 20`, `anchorExamples: boolean = true` (off here), `startMinimized: boolean = false` (on here), `extraPanelDrop: number = 0` (−31 here) |

Both inputs point at the child groups rather than the prefab root, because hiding the root would also hide the guide and the carousel. The root's own UIKit `Frame` stays visible while the guide is shown.

## PresentationSwitcher

Import: `EasyTeleprompter.lspkg/Scripts/PresentationSwitcher`. Export: `PresentationSwitcher`.

Local slides collected on onAwake in direct child order. Only the first is enabled initially. No public current-index/count getter or navigation event.

Public surface: `next(): void`, `previous(): void` — both wrap; no slides means no-op.

| Input | Type | Source default | Meaning |
|---|---|---|---|
| `parentObject` | `SceneObject` | `Unassigned` | Direct child SceneObjects become slides; falls back to the script object when unassigned. |
| `enableLogging` | `boolean` | `false` | Enable component debug logging. |
| `enableLoggingLifecycle` | `boolean` | `false` | Enable lifecycle logging (also enables its Logger). |

## SpeechToText

Import: `EasyTeleprompter.lspkg/Scripts/VoiceController`. Export: `SpeechToText`.

The exported class is SpeechToText, not VoiceController. Creates HighAccuracy ASR options once on onAwake with silenceUntilTerminationMs=1000; starts listening only when toggled. Recognizes exact normalized final phrases next/next., previous/previous., go back/go back.; default confirmation delay 2 seconds. Pending command is canceled when displayed transcription changes or listening is turned off. No onDestroy stop hook is present.

Public surface: `toggleListening(): void` — starts/stops the ASR module, swaps optional mic textures, clears transcription/pending state when stopped.

| Input | Type | Source default | Meaning |
|---|---|---|---|
| `text` | `Text` | `Unassigned` | Transcription Text; dereferenced by ASR callbacks and stop-listening without a null guard. |
| `presentationSwitcher` | `PresentationSwitcher` | `Unassigned` | Local PresentationSwitcher component used when useGoogleSlide is false. |
| `googleSlideBridge` | `GoogleSlideBridge` | `Unassigned` | Remote GoogleSlideBridge component used when useGoogleSlide is true. |
| `commandDelay` | `number` | `2.0` | Seconds before a matched final phrase is confirmed against displayed text. |
| `buttonImage` | `Image` | `Unassigned` | Image whose material baseTex is changed for microphone status; guarded. |
| `normalMicImage` | `Texture` | `Unassigned` | Idle microphone texture; guarded. |
| `listeningMicImage` | `Texture` | `Unassigned` | Active microphone texture; guarded. |
| `useGoogleSlide` | `boolean` | `false` | Choose remote bridge instead of local switcher; not a global mode switch. |
| `enableLogging` | `boolean` | `false` | Enable component debug logging. |
| `enableLoggingLifecycle` | `boolean` | `false` | Enable lifecycle logging (also enables its Logger). |

## SimpleAsrTest

Import: `EasyTeleprompter.lspkg/Scripts/SimpleAsrTest`. Export: `SimpleAsrTest`.

Diagnostic component: starts ASR immediately on onAwake, writes optional outputText, stops onDestroy. Do not run it alongside SpeechToText without deciding ASR ownership.

Public surface: No custom public command methods; `onDestroy()` is lifecycle cleanup.

| Input | Type | Source default | Meaning |
|---|---|---|---|
| `outputText` | `Text` | `Unassigned` | Optional display for transcription/error text; guarded by source. |
| `enableLogging` | `boolean` | `false` | Enable component debug logging. |
| `enableLoggingLifecycle` | `boolean` | `false` | Enable lifecycle logging (also enables its Logger). |

## MobileController

Import: `EasyTeleprompter.lspkg/Scripts/MobileController`. Export: `MobileController`.

Subscribes to SIK.MobileInputData.motionController touch on OnStart. Only Ended phase navigates: normalized x < 0.5 previous; otherwise next. Does not send WebSocket commands itself.

Public surface: No custom public command methods; `onStart()` performs lifecycle subscription.

| Input | Type | Source default | Meaning |
|---|---|---|---|
| `presentationSwitcher` | `PresentationSwitcher` | `Unassigned` | Local PresentationSwitcher component used when useGoogleSlide is false. |
| `googleSlideBridge` | `GoogleSlideBridge` | `Unassigned` | Remote GoogleSlideBridge component used when useGoogleSlide is true. |
| `useGoogleSlide` | `boolean` | `false` | Choose remote bridge instead of local switcher; not a global mode switch. |
| `enableLogging` | `boolean` | `false` | Enable component debug logging. |
| `enableLoggingLifecycle` | `boolean` | `false` | Enable lifecycle logging (also enables its Logger). |

## SoftPressController

Import: `EasyTeleprompter.lspkg/Scripts/SoftPressController`. Export: `SoftPressController`.

Searches active hierarchy for a selected HandVisual, instantiates interactorPrefab on the wrist, and observes matching collider overlap. Accepts entry above collider with up-direction dot > 0.5. Uses eight averaged vertices to measure normalized depth, fires once at threshold, and rearms only when depth returns to zero. resetDuration smooths after exit. No public press event/value.

Public surface: No custom public command methods; `onStart()` registers overlap subscriptions.

| Input | Type | Source default | Meaning |
|---|---|---|---|
| `colliderObject` | `SceneObject` | `Unassigned` | Object with Physics.ColliderComponent; dereferenced during setup. |
| `interactorPrefab` | `ObjectPrefab` | `Unassigned` | ObjectPrefab instantiated and attached to selected HandVisual wrist. |
| `useRightHand` | `boolean` | `true` | Select a HandVisual by right/left in its SceneObject name. |
| `closestPointMarker` | `SceneObject` | `Unassigned` | Optional visualization object, marked @allowUndefined. |
| `topVertex0` | `SceneObject` | `Unassigned` | One of four top-face SceneObjects; required to average the top of the collider line. |
| `topVertex1` | `SceneObject` | `Unassigned` | One of four top-face SceneObjects; required to average the top of the collider line. |
| `topVertex2` | `SceneObject` | `Unassigned` | One of four top-face SceneObjects; required to average the top of the collider line. |
| `topVertex3` | `SceneObject` | `Unassigned` | One of four top-face SceneObjects; required to average the top of the collider line. |
| `bottomVertex0` | `SceneObject` | `Unassigned` | One of four bottom-face SceneObjects; required to average the bottom of the collider line. |
| `bottomVertex1` | `SceneObject` | `Unassigned` | One of four bottom-face SceneObjects; required to average the bottom of the collider line. |
| `bottomVertex2` | `SceneObject` | `Unassigned` | One of four bottom-face SceneObjects; required to average the bottom of the collider line. |
| `bottomVertex3` | `SceneObject` | `Unassigned` | One of four bottom-face SceneObjects; required to average the bottom of the collider line. |
| `pressThreshold` | `number` | `0.7` | Depth fraction along averaged top-to-bottom line that triggers once. |
| `resetDuration` | `number` | `1.0` | Seconds to reset press depth after overlap exit; keep positive. |
| `presentationSwitcher` | `PresentationSwitcher` | `Unassigned` | Local PresentationSwitcher component used when useGoogleSlide is false. |
| `googleSlideBridge` | `GoogleSlideBridge` | `Unassigned` | Remote GoogleSlideBridge component used when useGoogleSlide is true. |
| `next` | `boolean` | `false` | True calls next; false calls previous (the Inspector hint is misleading). |
| `useGoogleSlide` | `boolean` | `false` | Choose remote bridge instead of local switcher; not a global mode switch. |
| `enableLogging` | `boolean` | `false` | Enable component debug logging. |
| `enableLoggingLifecycle` | `boolean` | `false` | Enable lifecycle logging (also enables its Logger). |

## GoogleSlideBridge

Import: `EasyTeleprompter.lspkg/Scripts/GoogleSlideBridge`. Export: `GoogleSlideBridge`.

Credentials gate onAwake and initialize. Fetches presentation, thumbnail and notes through InternetModule, RemoteServiceModule and RemoteMediaModule. Remote navigation is bounded rather than wraparound. Polling compares slide count only, not another presenter’s active slide. Public calls start asynchronous loading; no ready/slide-changed event is exported. `next()` / `previous()` return without doing anything until the presentation has loaded, including while the component is disabled. It warns only when enableLogging is on.

Public surface: `initialize(): void`, `update(): void` (polling helper); `goToSlide(index: number): void`; `goToSlideInGoogle(index: number): Promise<void>`; `next(): void`, `previous(): void`; `moveToNextSlideInGoogle(): Promise<void>`, `moveToPreviousSlideInGoogle(): Promise<void>`.

| Input | Type | Source default | Meaning |
|---|---|---|---|
| `presentationId` | `string` | `""` | Google presentation ID, empty until configured. |
| `accessToken` | `string` | `""` | Private Inspector input, empty until configured; authorization header format is inconsistent across source requests. |
| `slideImage` | `Image` | `Unassigned` | Image for remote thumbnail; guarded during image assignment. |
| `speakerNotes` | `Text` | `Unassigned` | Text for remote notes/fallback messages; not consistently guarded. |
| `syncNavigationToGoogle` | `boolean` | `true` | Enable remote navigation requests and next/previous WebSocket sends; does not implement the TODO sync callback. |
| `pollForChanges` | `boolean` | `true` | Enable slide-count polling after valid credentials. |
| `pollingInterval` | `number` | `5.0` | Seconds between remote slide-count checks. |
| `webSocketController` | `WebSocketController` | `Unassigned` | Optional; when set, remote next/previous mirror to the relay while syncNavigationToGoogle is true. |
| `enableLogging` | `boolean` | `false` | Enable component debug logging. |
| `enableLoggingLifecycle` | `boolean` | `false` | Enable lifecycle logging (also enables its Logger). |

## WebSocketController

Import: `EasyTeleprompter.lspkg/Scripts/WebSocketController`. Export: `WebSocketController`.

Creates InternetModule WebSocket, records next/previous command and Date.now()/1000 epoch timestamp. Receipts are not consumed by any other shipped script. No command event is exported. Retry timer binds onAwake; normal close can restart retries, including a close initiated by disconnect. No onDestroy disconnect hook exists.

Public surface: `connect(): void`, `disconnect(): void`, `isWebSocketConnected(): boolean`; `sendMessage(messageObj: any): boolean`, `sendCommand(command: string): boolean`, `next(): boolean`, `previous(): boolean`; `wasNextCommandReceived(sinceTime: number = 0): boolean`, `wasPreviousCommandReceived(sinceTime: number = 0): boolean`; `getLastCommand(): {command: string; timestamp: number}`, `clearLastCommand(): void`; `update(): void` (retry timer).

| Input | Type | Source default | Meaning |
|---|---|---|---|
| `serverUrl` | `string` | `External sample wss endpoint (source string)` | The demo prefab overrides it with the placeholder `YOUR-SERVER-URL`. Set it to your own relay, hosted on Snap-approved infrastructure. |
| `statusText` | `Text` | `Unassigned` | Optional text for connection/retry status; guarded. |
| `autoConnect` | `boolean` | `true` | Call connect on OnStart. |
| `maxReconnectAttempts` | `number` | `5` | Retry ceiling per reconnection sequence. |
| `reconnectInterval` | `number` | `3.0` | Seconds before each retry. |
| `enableLogging` | `boolean` | `false` | Enable component debug logging. |
| `enableLoggingLifecycle` | `boolean` | `false` | Enable lifecycle logging (also enables its Logger). |

## SmoothRepositioning

Import: `EasyTeleprompter.lspkg/Scripts/SmoothRespositioning`. Export: `SmoothRepositioning`.

The filename intentionally retained here is SmoothRespositioning.ts. Checks horizontal angle OR distance after cooldown (despite a source comment saying BOTH). Interpolates position and Y-facing rotation, preserves original Y plus yOffset. Uses CameraService Main; no public reposition trigger or completion event. Its target uses camera Transform.forward directly; verify actual front-of-camera placement on the intended runtime before relying on it.

Public surface: `getCameraPosition(): vec3`, `getCameraTransform(): Transform`.

| Input | Type | Source default | Meaning |
|---|---|---|---|
| `maxDistance` | `number` | `100` | Distance limit from camera in cm. |
| `maxAngleDegrees` | `number` | `45` | Horizontal angle limit in degrees. |
| `repositionSpeed` | `number` | `200` | Position interpolation speed in cm/s; keep positive. |
| `frontDistance` | `number` | `80` | Target offset along flattened camera transform.forward in cm. |
| `xOffset` | `number` | `0` | Target offset along flattened camera right in cm. |
| `yOffset` | `number` | `0` | Offset from this object’s original authored world Y in cm. |
| `cooldownTime` | `number` | `2.0` | Seconds after a completed reposition before another can start. |
| `enableLogging` | `boolean` | `false` | Enable component debug logging. |
| `enableLoggingLifecycle` | `boolean` | `false` | Enable lifecycle logging (also enables its Logger). |

## CameraService and CameraType

Import: `EasyTeleprompter.lspkg/Scripts/CameraService`. Named exports: `CameraService`, `CameraType`.

CameraService is a non-component singleton with no @inputs. `CameraService.getInstance(): CameraService` selects the main camera via SIK WorldCameraFinderProvider. `mainCameraTransform: Transform` is a public getter; `getCamera(cameraType: CameraType): Camera` selects a camera. Enum values are `Main = 0`, `GlassesLeft = 1`, `GlassesRight = 2`.

Only Main is initialized. GlassesLeft/GlassesRight print a warning and return their uninitialized fields; enum presence does not mean stereo camera support works. Invalid enum values throw. See [camera troubleshooting](troubleshooting.md#repositioning-or-stereo-camera-is-wrong).

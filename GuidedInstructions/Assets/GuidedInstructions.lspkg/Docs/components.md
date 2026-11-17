# GuidedInstructions components

[← Agent usage index](../README.md)

## Use when

Read before wiring or calling any script of this package. Every entry comes from the shipped `Scripts/*.ts`. Import paths use the prefix `GuidedInstructions.lspkg/Scripts/`. Every component also has `enableLogging` and `enableLoggingLifecycle` (boolean, default `false`). They aren't repeated below.

The prefab `GuidedInstructions__PLACE_IN_SCENE` already wires every reference listed here.

## Orchestration

### SceneController (`Scripts/SceneController`)

Flow: SpeechUI final transcript → depth snapshot → Gemini request with the camera image → response bubble, world labels and (AUTO) guidance step.

| Input | Type | Default | Meaning |
| --- | --- | --- | --- |
| showDebugVisuals | boolean | false (the shipped prefab sets `true`, so the demo draws debug visuals) | Draw the camera frame and the returned 2D points with DebugVisualizer |
| debugVisualizer | DebugVisualizer | — | Debug overlay |
| speechUI | SpeechUI | — | Speech button and transcript; subscribed to in OnStart |
| gemini | GeminiAPI | — | Request helper |
| responseUI | ResponseUI | — | Response bubble and world labels |
| loading | Loading | — | Loading visual |
| depthCache | DepthCache | — | Depth/color snapshots and pixel → world projection |
| guidancePanel | GuidancePanel | optional | When set, the current step is prepended to the prompt and `detectedStep` drives `setAutoStep` |
| testTexture | Texture | optional | Image sent to Gemini instead of the cached camera frame. Depth is still taken from DepthCache |

Public: `onSpeechRecieved(text: string)` (spelling as in source). It ignores calls while a request is running, but disables the speech collider first.

### GeminiAPI (`Scripts/GeminiAPI`)

No inputs besides logging. Uses RemoteServiceGateway `Gemini.models` with model `gemini-2.5-pro`, a PNG-encoded image and a structured JSON response.

Public: `makeGeminiRequest(texture: Texture, userQuery: string, callback: (response) => void)`. The callback receives `{aiMessage, points[{pixelPos: vec2, label, showArrow}], detectedStep, ...}`. On a Gemini error or an image-encoding failure it receives the fallback `{points: [], lines: [], aiMessage: "reponse error..."}`.

Also public (no access modifier): `sendGeminiChat(request: string, image64: string, texture: Texture, callback: (response: any) => void)`. `makeGeminiRequest` calls it after PNG-encoding the texture; call it directly only if you already have a base64 PNG. `texture` is still needed: its width/height convert the returned bounding boxes to pixel positions. Same callback shape and fallback as above.

## Speech

### ASRController (`Scripts/ASRController`)

Wraps `LensStudio:AsrModule` (mode `Balanced`, `silenceUntilTerminationMs = 500`).

Public: `onPartialVoiceEvent: Event<string>`, `onFinalVoiceEvent: Event<string>`, `startListening()`, `stopListening()`.

### SpeechUI (`Scripts/SpeechUI`)

Follows the camera every frame (50 cm in front, 9 cm below; the follow step is clamped so low frame rates cannot overshoot). In the demo prefab the speech bubble (`SpeechBoxAnchor`, local y 4.5) opens above the guidance panel's top row, clear of the step title.

| Input | Type | Meaning |
| --- | --- | --- |
| mainCamObj | SceneObject | Camera the UI follows |
| speecBocAnchor | SceneObject | Speech bubble root (scaled 0 ↔ 1). Spelling as in source |
| micRend | RenderMeshVisual | Mic icon; its material must expose `Tweak_N23`, `Tweak_N33`, `Tweak_N37` (the prefab uses `Materials/MyAi_Voice.mat`) |
| speechText | Text | Transcript text |
| asrVoiceController | ASRController | ASR source |
| speechButtonCollider | ColliderComponent | Enabled/disabled to block the button during a request |

Public: `onSpeechReady: Event<string>` (final transcript), `onSpeechButtonDown()`, `onSpeechButtonUp()` (pinch-up hook for the prefab button; doesn't stop listening, since ASR ends on the final transcript), `stopListening()`, `activateSpeechButton(activate: boolean)`.

### TouchDownButton (`Scripts/TouchDownButton`)

Needs an SIK `Interactable` on the same SceneObject (it throws in OnStart otherwise).

| Input | Type | Default | Meaning |
| --- | --- | --- | --- |
| editEventCallbacks | boolean | false | Enable the Inspector callbacks below |
| customFunctionForOnButtonPinchedDown | ScriptComponent | optional | Target for pinch down |
| onButtonPinchedDownFunctionNames | string[] | [] | Function names called on pinch down |
| customFunctionForOnButtonPinchedUp | ScriptComponent | optional | Target for pinch up |
| onButtonPinchedUpFunctionNames | string[] | [] | Function names called on pinch up |

Public: `onButtonPinchedDown`, `onButtonPinchedUp` (`PublicApi<InteractorEvent>`, fired on the Interactable's trigger start/end while the component is enabled).

## Depth

### DepthCache (`Scripts/DepthCache`)

Starts a `LensStudio:DepthModule` session and a `Left_Grayscale` camera request. It keeps the latest five camera frames and pairs each depth frame with the closest camera frame by timestamp.

| Input | Type | Meaning |
| --- | --- | --- |
| camModule | CameraModule | Camera module asset (`Modules/Camera Module.cameraModule`) |

Public:
- `saveDepthFrame(): number` caches the latest depth/color pair under a `Date.now()` id. The pair can be `null` before the first depth frame arrives.
- `hasDepthFrame(): boolean` is true once the first depth frame has been paired with a camera frame. SceneController skips a request (and logs a warning) until then, unless `testTexture` is set.
- `getCamImageWithID(id): Texture | null` returns the cached camera image, or `null` (with a warning) for an unknown id or an empty pair.
- `getWorldPositionWithID(pixelPos: vec2, id): vec3 | null` maps a color-frame pixel to world space (3×3 median depth). Returns `null` outside the depth frame or for an unknown id.
- `disposeDepthFrame(id)` only deletes non-null entries.

### DebugVisualizer (`Scripts/DebugVisualizer`)

Inputs: `sceneController: SceneController`, `pointPrefab: ObjectPrefab` (instantiated per point; the prefab wires `Prefabs/coloredPoint.prefab`, a single RenderMeshVisual object `pointLabeledColored` using `Materials/pointRedLabeled.mat`), `testCamVisualObj: SceneObject` (hosts the frame texture). Public: `updateCameraFrame(cameraFrame: Texture)`, `visualizeLocalPoint(pixelPos: vec2, cameraFrame: Texture)`.

## Responses and labels

### ResponseUI (`Scripts/ResponseUI`)

| Input | Type | Meaning |
| --- | --- | --- |
| responseAIText | Text | Bubble text |
| worldLabelPrefab | ObjectPrefab | Label prefab (`Prefabs/WorldLabel.prefab`, needs a WorldLabel with `textComp`) |
| worldArrowPrefab | ObjectPrefab | Arrow label prefab (`Prefabs/WorldArrow.prefab`) |
| responseUIObj | SceneObject | Bubble root |

Public: `openResponseBubble(message: string)`, `closeResponseBubble()`, `loadWorldLabel(label: string, worldPosition: vec3, useArrow: boolean)` (instantiates under ResponseUI's own SceneObject), `clearLabels()` (destroys **every** child of that SceneObject).

### WorldLabel (`Scripts/WorldLabel`)

Inputs: `frameRend: RenderMeshVisual`, `textComp: Text` (public). Scales in after a random 0–1.7 s delay; the frame is hidden while the text is empty.

### Labels (`Scripts/Labels`)

Input: `labelPrefab: ObjectPrefab`. Public: `loadLables(pointCloud, labelString)` (spelling as in source). It parses a JSON string `{objects: [{pos, label}]}` and places labels with `pointCloud.camLocalToWorld`. Not used by the prefab flow.

## Guidance UI

### GuidancePanel (`Scripts/GuidancePanel`)

Follows the camera every frame (50 cm in front, 8 cm above). Starts in MANUAL mode at the first step.

| Input | Type | Meaning |
| --- | --- | --- |
| mainCamObj | SceneObject | Camera the panel follows |
| stepCounterText | Text | e.g. `3 / 15  [DESCALING]` |
| stepTitleText | Text | Step title |
| stepDescText | Text | Description plus warning / time note |
| modeText | Text | `MANUAL` or `AUTO` |
| prevButton, nextButton, modeToggleButton | RectangleButton (UIKit) | Navigation |

Public:
- `onStepChanged: Event<number>` (zero-based index)
- `goToPrevStep()`, `goToNextStep()` (ignored in AUTO)
- `toggleMode()`
- `setAutoStep(stepId: number)` (one-based id, ignored in MANUAL or for 0)
- `currentStep: MaintenanceStep`
- `autoMode: boolean`

### Loading (`Scripts/Loading`)

Public: `activateLoder(activate: boolean)` (spelling as in source).

### APIKeyHint (`Scripts/APIKeyHint`)

Input: `text: Text`. In onAwake it shows "Set your API Token in the Remote Service Gateway Credentials component to use the examples" when any of the Snap / OpenAI / Google tokens is empty or still an `[INSERT …]` placeholder. Otherwise it disables the Text. The PLACE_IN_SCENE prefab no longer ships a hint Text (no floating text in the demo); attach APIKeyHint to a Text inside your own UI panel if you want the hint in your Lens.

### FaceCamera (`Scripts/FaceCamera`)

Input: `camera: SceneObject`. Rotates its object to face the camera horizontally every frame.

## Demo scaffolding (Example/)

Demo-only scripts shipped in `GuidedInstructions.lspkg/Example/` so the prefab works on its own. They aren't part of the package API. Remove `CredentialsWarning`, `Guide` and `ExampleCarousel` when you build your own Lens; `GuidedInstructionsDemo` works without them (keep `RemoteServiceGatewayCredentials`).

| Script | Object | Key inputs (prefab values) |
| --- | --- | --- |
| `Example/CredentialsWarning/CredentialsWarning.ts` | `CredentialsWarning` (above `Guide`; builds a red-framed UIKit Frame 100 cm in front of the user at start) | `guide` (`Guide`), `snapCloudRequirements` (empty: Snap Cloud isn't used), `rsgCredentials` (`RemoteServiceGatewayCredentials`), `requireGoogleToken` (`true`, Gemini), `requireSnapToken` / `requireOpenAIToken` (`false`), `buttonLabel` (`"Continue without credentials"`). When a required token is empty or an `[INSERT …]` placeholder it lists what's missing, holds the guide until the button is pressed, then shows it; otherwise it turns itself off |
| `Example/GuideDismissPanel/GuideDismissPanel.ts` | `Guide` (UIKit Frame at local (0, 0, −100), `GuideText`, `OkButton`) | `buttonLabel` (`"Ok, I understood"`), `hideUntilDismissed: SceneObject[]` (`ExampleCarousel`, `GuidedInstructionsDemo/SpeechUI`, `GuidedInstructionsDemo/GuidancePanel`): hidden while the guide shows, enabled when it's closed |
| `Example/ExampleCarousel/ExampleCarousel.ts` | `ExampleCarousel` (local (0, −22, −80)) | `examples: SceneObject[]` (`GuidedInstructionsDemo`), `exampleInfo: string[]` (one entry), `steps: SceneObject[]` (empty), `stepInfo: string[]` (empty; one line per step, same order as `steps`, empty entries fall back to the example info), `startIndex` (`0`), `previousLabel` / `nextLabel`, `examplesPushBack` (`20` cm), `anchorExamples` (`false`, the demo stays where it is authored), `startMinimized` (`true`), `extraPanelDrop` (`−30` cm, the panel sits above the step UI) |

With a single example the carousel only shows its title bar, the info text and the minimize button; the descaling steps are stepped with the demo's own Previous / Next / Auto Mode buttons.

## Shipped assets

- `Prefabs/WorldLabel.prefab`, `Prefabs/WorldArrow.prefab` (ResponseUI label prefabs), `Prefabs/coloredPoint.prefab` (DebugVisualizer point).
- `Modules/Camera Module.cameraModule` (DepthCache `camModule`).
- `Render/Render Target.renderTarget`, `Render/Device Camera Texture.deviceCameraTexture`, `Render/Echopark.hdr`.
- `Materials/*.mat` (CaptureTexture, CircleOutline, loadingGif, micIcon, MyAi_Voice, PinchButton, pointRedLabeled, SWIS_tile, White, WorldLabelFrame) and their `Shaders/*.graphShader`.
- `Mesh/*.mesh` (arrow, SWIS_tile_solid, Unit Box / Plane / Sphere), `Images/` (loading.gif, MicIcon.png, image materials).
- `Manuals/` (Vertuo descaling PDFs and machine image): demo scenario content only.

## Knowledge data (`Scripts/NespressoKnowledge`)

The demo scenario's content. Replace it for your own product.
- `interface MaintenanceStep {id, title, description, phase: "preparation" | "descaling" | "rinsing" | "cleanup", warning?, timeNote?, assistantFocus?}` and `interface TroubleshootIssue {symptom, fixes[]}`
- `DESCALING_STEPS: MaintenanceStep[]` (15 steps, ids 1–15), `TROUBLESHOOTING`, `CLEANING_STEPS`, `MACHINE_INFO`, `LIGHT_STATES`, `SAFETY_WARNINGS`, `AI_RESPONSE_POLICY`
- `formatGuidanceContextForPrompt(step): string` and `buildSystemPromptContext(): string` build the prompt text

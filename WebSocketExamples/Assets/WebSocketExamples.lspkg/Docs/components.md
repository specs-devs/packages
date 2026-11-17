# WebSocketExamples components

[← Agent usage index](../README.md)

## Use when

Configure every source input and use only existing public APIs.

## Shared lifecycle and imports

All package consumer paths below begin `WebSocketExamples.lspkg/Scripts/`. [Manifest](../package_dependencies.json) supplies SnapDecorators/Utilities plus SIK/UIKit/Motion/Icons. TextEcho/IMUData Awake create Logger using OR of general/lifecycle toggles, print setup notice regardless of toggles, and assert required references. `@bindStartEvent initialize` connects once. `@bindDestroyEvent cleanup` closes a socket if present; it does not null the handle/detach callbacks. There is no OnDisable handler or reconnect timer. Treat explicit lifecycle methods as Lens hooks, not calls to replay. No component below exposes public package events.

## TextEcho

Import `WebSocketExamples.lspkg/Scripts/TextEcho`; source [TextEcho.ts](../Scripts/TextEcho.ts).

| Input | Type | Source default | Meaning |
|---|---|---|---|
| internetModule | InternetModule | Unassigned, required | Creates WebSocket. |
| ipAddress | string | `ws://YOUR-IP-ADDRESS/ws` | Full server URL; saved prefab same placeholder. |
| enableLogging | boolean | false | Connection/message general log gate. |
| enableLoggingLifecycle | boolean | false | Awake/Start/Destroy log gate. |

Public `onAwake(): void`, `initialize(): void`, `cleanup(): void` are lifecycle hooks. `reconnect(): void` closes the current socket then calls private connect with current URL, without waiting for close. `sendMessage(message: string): void` checks readyState1 and sends text, logging/returning on failure; no success return or queue. `getConnectionStatus(): {isConnected: boolean; url: string}` reports current handle readiness and configured URL; no server identity/authentication proof.

On open it sends `"Message 1"` and Uint8Array bytes spelling `"Message 2"`. binaryType is blob. Binary receive awaits Blob.bytes then Blob.text, with no local async rejection guard; text receive logs directly. Placeholder detection checks empty/string containing YOUR-IP-ADDRESS; connect prints the setup warning and returns without creating a socket (no on-screen text — TextEcho is log-only). onclose logs only; onerror logs; neither retries. Callbacks reference mutable `this.socket`, so old open callbacks after reconnect could send on a new handle.

## IMUData

Import `WebSocketExamples.lspkg/Scripts/IMUData`; source [IMUData.ts](../Scripts/IMUData.ts).

| Input | Type | Source default | Meaning |
|---|---|---|---|
| internetModule | InternetModule | Unassigned, required | Creates WebSocket. |
| ipAddress | string | `ws://YOUR-IP-ADDRESS/ws` | Full server URL; saved prefab same placeholder. |
| screenText | Text | Unassigned, required | Visible connection/setup status. |
| cube | IMUCube | Unassigned, required | Rotation recipient. |
| enableLogging | boolean | false | Connection/data log gate. |
| enableLoggingLifecycle | boolean | false | Lifecycle log gate. |

Public lifecycle `onAwake(): void`, `initialize(): void`, `cleanup(): void`. Public `reconnect(): void` and `getConnectionStatus(): {isConnected: boolean; url: string}` behave as above; **no sendMessage API** is exposed. Source private connect returns for detected placeholder after setting `Setup required - set IP Address (see README)`.

Real URL sets `Waiting for connection...`; open sets Connected! and sends literal `HI FROM Glasses`. Text or async Blob.text payload splits comma and parseFloat maps each field; only length===3 and !some(isNaN) are checked before forwarding unchanged array. Leading/trailing spaces are accepted; trailing nonnumeric suffix after a number and Infinity can be accepted. No range, timestamp, axis remap, calibration or rate limiting. Close shows Disconnected or Connection error; error shows Socket error; create exception Connection failed. Async parse callbacks can outlive hide/destroy/reconnect and overwrite an obsolete state.

## IMUCube

Import `WebSocketExamples.lspkg/Scripts/IMUCube`; source [IMUCube.ts](../Scripts/IMUCube.ts).

| Input | Type | Source default | Meaning |
|---|---|---|---|
| camObj | SceneObject | Unassigned, allowUndefined | Optional camera; saved prefab reference null. |
| enableLogging | boolean | false | Rotation/follow logs. |
| enableLoggingLifecycle | boolean | false | Awake/Update/Destroy logs. |

Awake caches own Transform and optional camera Transform; changing camObj later does not rebuild that cache. Public lifecycle `onAwake(): void`, decorator-bound `onUpdate(): void`, `cleanup(): void`; cleanup only logs. Public methods:

```text
setRotationAngle(angle: number[]): void
getCurrentRotation(): number[]
resetRotation(): void
```

setRotationAngle requires non-null length3 only, constructs vec3 slots[0..2], converts degrees→radians via MathUtils.DegToRad, quat.fromEulerVec then immediately sets **world** rotation. It does not validate NaN/Infinity or smooth rotation. getCurrentRotation converts the stored desired quaternion to Euler degrees; equivalent angles can normalize/wrap, and external transform changes are not read. resetRotation sets stored quaternion and world rotation identity.

Update private softFollow, if camera cached, lerps world position toward `camera.position + camera.forward * -50cm` with raw factor `getDeltaTime()*6`. Large frame delta is not clamped. Euler coordinate interpretation is X,Y,Z, while the shipped sensor emits X,Z,Y with no remap. No sensor calibration/handedness conversion is provided.

## GuideDismissPanel

Import `WebSocketExamples.lspkg/Scripts/GuideDismissPanel/GuideDismissPanel`; source [GuideDismissPanel.ts](../Scripts/GuideDismissPanel/GuideDismissPanel.ts).

Input `buttonLabel: string = "Ok, I understood"`. Public onAwake binds OnStart; no other public methods/events. Searches first Text recursively, clones style to runtime UIKit Frame/RectangleButton, hides authored source Text. TriggerUp disables guide SceneObject. Missing Text logs/no-ops. Frame is translatable, does not auto-show/hide; package source-only pass retains existing guide.

This `Scripts/` copy is not used by the prefab; the Guide uses the demo copy in `Example/` (below).

## Demo scaffolding (Example/)

Shipped in [Example/](../Example/) for the prefab's own demo flow; not part of the WebSocket API.

- **GuideDismissPanel** — [Example/GuideDismissPanel/GuideDismissPanel.ts](../Example/GuideDismissPanel/GuideDismissPanel.ts), on the prefab's `Guide`. Inputs: `buttonLabel` (default "Ok, I understood"), `hideUntilDismissed: SceneObject[]` (objects kept disabled until the guide is closed; here ExampleCarousel, TextEcho, IMU Visualization — never the prefab root). Two modes, chosen on start:
  - **Authored panel** (the prefab's setup): a UIKit `Frame` sits on the same SceneObject, with a child Text (the message) and a child UIKit Button (`OkButton`). The script places the guide in front of the user, fits the Frame to the text, and closes the guide when the button is pressed. `buttonLabel` is ignored; edit the button's own label. If the Text or Button is missing it prints `GuideDismissPanel: the guide Frame needs a child Text and a child UIKit Button`.
  - **Text-only** (no Frame on the object): the Frame, a copy of the first child Text and a button labelled `buttonLabel` are built at runtime.
- **ExampleCarousel** — [Example/ExampleCarousel/ExampleCarousel.ts](../Example/ExampleCarousel/ExampleCarousel.ts), on the prefab's `ExampleCarousel`. Inputs: `examples: SceneObject[]` (one enabled at a time; here TextEcho, IMU Visualization), `exampleInfo: string[]` (per-example description), `steps` (optional sub-examples; empty), `stepInfo: string[]` (per-step description, same order as `steps`; empty entries fall back to the example's info; empty here), `startIndex` (0), `previousLabel`/`nextLabel` (default "Previous"/"Next"), `examplesPushBack` (20 cm), `anchorExamples`, `startMinimized`, `extraPanelDrop`. Previous/Next buttons and a minimize button in the header.

## Shipped assets

- `Meshes/BoxMesh.mesh` with `Materials/PBR.mat` (`Shaders/pbr.graphShader`, `Textures/{Base,Normal,MaterialParams}.png`): the IMU cube.
- `Modules/Internet Module.internetModule`: the InternetModule assigned to TextEcho and IMUData.
- Server references: `INO/`, `ESP-IDF/` (see [Hardware](hardware.md)).

## Prefab wiring

[WebSocketExamples__PLACE_IN_SCENE.prefab](../WebSocketExamples__PLACE_IN_SCENE.prefab) contains, in order: Guide (GuideDismissPanel, 100 cm in front of the origin), ExampleCarousel (0,−22,−80), TextEcho (no visuals) and IMU Visualization (local position 0,0,−80 = 80 cm in front of a head at the origin) with IMUCube → Box (10 cm cube) and IMUData → status Text 10 cm below the cube. InternetModule is assigned to both network scripts; IMUData's Text/cube handles are assigned; cube camera is null. Logging: TextEcho `enableLogging` true (`enableLoggingLifecycle` false); IMUData and IMUCube both false. Both URL placeholders must be replaced. The carousel's visibility switching does not substitute for socket cleanup.

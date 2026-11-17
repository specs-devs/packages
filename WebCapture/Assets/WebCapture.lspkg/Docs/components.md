# WebCapture components

[← Agent usage index](../README.md)

## Use when

Read when wiring Web Capture into a Lens or calling it from code: every input, default and method of
`WebCapture` and `WebCaptureTarget`, and what the transports do.

## `WebCapture` (`Scripts/WebCapture.ts`)

| Input | Default | Meaning |
|---|---|---|
| `mode` | `auto` | `auto` (local when the plugin answers, else Snap Cloud), `local`, `snapcloud`, `both`, `offline` (keep in memory) |
| `localPortalUrl` | `ws://127.0.0.1:47791` | The plugin's Lens socket |
| `snapCloudRequirements` | prefab child | Holds the `SupabaseProject` (Snap Cloud only) |
| `authMode` | `snapchat-then-anonymous` | Snap Cloud sign-in: also `snapchat`, `anonymous` |
| `captureOrigin` | prefab `WebCaptureDemo` | Reference frame for every pose; empty = this SceneObject |
| `includeTargets` | `true` | Capture every `WebCaptureTarget` in the scene |
| `trackedObjects` | `[]` | Extra SceneObjects (shape guessed from their mesh or Text) |
| `captureRoot` | — | Also capture every descendant with a RenderMeshVisual or Text |
| `camera` | — | Camera to record; empty = the first Camera in the scene |
| `liveSync` | `true` | Step 1: send snapshots while the Lens runs |
| `liveRate` | `10` | Snapshots per second (1–30), only when something changed, plus a resend every 5 s |
| `recordOnStart` | `false` | Record as soon as the Lens starts (waits for the first object). Off: the `CapturePanel` button or the portal starts it |
| `recordSeconds` | `30` | Stop and save after N s (max 90); `0` = 90 s. The panel's length button sets 30, 60 or 90 |
| `recordRate` | `30` | Samples per second while recording (5–60) |
| `positionTolerance` | `0.1` | cm; smaller moves store no keyframe |
| `rotationTolerance` | `0.001` | Max quaternion component change without a keyframe |
| `recordingName` | `""` | Empty = "<Lens> <date>" |
| `captureGeometry` | `true` | Record real mesh geometry, base-colour textures and culling instead of boxes |
| `captureBackground` | `true` | Record the camera as the background track |
| `backgroundTexture` | — | Texture recorded when the NDK camera is off (Device Camera Texture in Lens Studio) |
| `useNdkCamera` | `true` | On Specs, record the real camera through the `NDKCapture` module at its own resolution and aspect |
| `ndkVideo` | `false` | Record the camera as hardware-encoded H.265 (smooth, small, needed for the full replay quality) instead of JPEG frames |
| `keepCameraWarm` | `true` | Open the camera when the Lens opens so Start Capture doesn't wait; a stream that goes quiet is restarted |
| `recordReference` | `false` | Debug (needs **Debug Logs** on as well): also record the system's AR layer from the camera's viewpoint as a ground truth. Switched off for the run if the camera stalls |
| `ndkCameraWidth` / `ndkCameraFps` / `ndkCameraQuality` | `640` / `12` / `60` | JPEG-proxy camera settings (used when `ndkVideo` is off) |
| `backgroundFps` / `backgroundQuality` | `6` / high | Background frames per second and quality when a texture is recorded |
| `startButton` | — | Optional: a button object (with an Interactable) whose pinch toggles recording. `CapturePanel` replaces it |
| `showButtonWhenEnabled` | — | Optional: keep the Start button / panel hidden until this object is enabled (e.g. after the guide) |
| `statusText` | prefab `StatusText` | Shows connection / recording / save status |
| `debugLogs` | `false` | Print details to the Logger |

| Member | Description |
|---|---|
| `setRecordSeconds(seconds)` | Sets the length of the next capture (5 to 90 s) |
| `startRecording(name?): string` | Starts a recording (stopping and saving a running one); returns its id |
| `stopRecording(): Promise<Recording \| null>` | Stops and saves to every connected destination |
| `mark(label)` | Adds a labelled marker at the current recording time |
| `buildSnapshot(): SceneSnapshot` | The snapshot that would be sent now |
| `onRecordingSaved(cb)` | `cb(recording, saved[])` after each save; `saved[i].transport` is `local`, `snapcloud` or `offline` |
| `onStatusChanged(cb)` | Every status change |
| `attachPanel(button, setLabel)` | Used by `CapturePanel`: binds one Start / Stop button and a label sink; disables any other start button |
| `addCaptureRoot(root)` / `addPanelShape(object, shape)` | Capture an extra root, or record a flat UIKit panel (`size`, `radius`, `color`) |
| `isRecording`, `status`, `sessionCode`, `recording` | State getters (`sessionCode` = Snap Cloud code) |

The portal and the plugin panel send `start`, `stop` and `mark` commands to the running Lens in
Local mode; they call the same methods.

## `WebCaptureTarget` (`Scripts/WebCaptureTarget.ts`)

| Input | Default | Meaning |
|---|---|---|
| `targetId` | `""` | Stable id; empty = SceneObject name (max 80) |
| `primitive` | `auto` | `auto` (mesh bounds → `mesh`, Text → `text`, else `empty`), `box`, `sphere`, `cylinder`, `plane`, `text`, `empty` |
| `color` | teal | Colour in the portal |
| `useMaterialColor` | `true` | Read `mainPass.baseColor` from this object's RenderMeshVisual every sample |
| `recordVisibility` | `true` | Record `isEnabledInHierarchy` changes |
| `recordText` | `true` | Record Text changes |

`WebCaptureTarget.all` lists the registered targets. The component reads the mesh bounds and colour
of **its own** SceneObject; when the mesh is on a child (as in the demo), set `primitive` and `color`.

## Transports (`Scripts/CaptureTransports.ts`)

- `LocalPortalTransport`: `InternetModule.createWebSocket(localPortalUrl)`. Sends `hello`, `scene`
  and the recording as `recording-begin` / 32 KB `recording-chunk`s / `recording-end`; the plugin
  answers `saved` or `save-failed`, and sends `command` messages.
- `SnapCloudTransport`: `createClient` from SupabaseClient, sign-in, then
  `webcapture_create_session`, `webcapture_publish_scene` (newest snapshot only, one request in
  flight), `webcapture_save_recording`, `webcapture_end_session` on destroy.
- `OfflineTransport`: keeps `lastScene` / `lastRecording` in memory.

See [protocol](protocol.md) for the message and file formats.

## `CapturePanel` (`Scripts/CapturePanel.ts`)

A UIKit `Frame` built at runtime in front of the user (draggable) with a title, a short status, a small **Length** button (cycles 30 / 60 / 90 s; locked while recording) and **one** capture
button that reads *Start Capture* and becomes *Stop Capture · N s* with a red dot while recording. Add it
to any object and set **Web Capture**; **Distance** and **Height Offset** place it. It registers its
shapes with `WebCapture` so the panel appears in the replay. Its colours, margin and sizes follow the
UIKit System 3.0 design values; `WebCapturePortal/tests/uikit.test.mjs` fails if they drift.

## `CursorCapture` (`Scripts/CursorCapture.ts`)

Records the Interaction Kit cursors, which the system draws on Specs (so they are not scene objects). Each frame it
reads every cursor's position and visibility and moves a recorded round shape there; the shape shrinks while pinching.
`CapturePanel` starts it. Without the panel: `new CursorCapture(webCapture, parent)` after the scene starts, then
`update()` in a `LateUpdateEvent`.

## Camera layer (`Scripts/NdkCamera.ts`, `CaptureAssets.ts`, `CameraCalibration.ts`)

Internal helpers behind the camera inputs. `NdkCamera` wraps the `NDKCapture` native module (camera layer
H.265, optional AR layer); `CaptureAssets` (`BackgroundRecorder`) keeps the stream warm, polls packets,
aligns the packet clock with the pose clock (`offsetNs`) and restarts a stalled stream; `CameraCalibration`
reads the device camera's intrinsics.

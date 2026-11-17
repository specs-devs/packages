# Web Capture

A flexible capture framework for Specs Lenses: record several aligned layers (scene, camera video, head pose), keep them in your Snap Cloud project, and edit, export and schedule them in a local front end. Start with the [guide](guide.md).

## What it is
A package that mirrors a Specs Lens in a browser, records what happens while it plays and turns the
recording into an edited video. It ships the Lens components, a Lens Studio editor plugin that
serves a local portal, a self-contained web portal (live view + editor + video export) and the Snap
Cloud backend SQL for using it from Specs.

## What it does
1. Drop `WebCapture__PLACE_IN_SCENE` into the scene. In Local mode (default *Auto*) the Lens
   connects to the WebCapture plugin over `ws://127.0.0.1:47791`; in Snap Cloud mode it signs in and
   opens a session with a 6-character code.
2. **Step 1, scene sync:** every `WebCaptureTarget`, Tracked Object and mesh/Text under the Capture
   Root is sent as a `webcapture-scene/1` snapshot, relative to the Capture Origin, in cm, up to
   `liveRate` times per second and only when something changed. The portal's Live tab rebuilds it.
3. **Step 2, record:** with Record On Start, recording begins when the first object appears and
   stops after `recordSeconds` (or on `stopRecording()` / the portal's or plugin's Stop). Keyframes
   are stored only when an object moved past the tolerance. The `webcapture/1` file is saved to
   `WebCaptureRecordings/` (local) and/or the Snap Cloud session.
4. **Step 3, edit:** the portal opens the recording, replays it and exports MP4/WebM with the edits
   (trim, cuts, speed, camera, look, titles, music). Edits are stored in the recording's `edits`
   block; the recorded tracks never change.

## Highlights
- Cross-platform: the plugin uses only Lens Studio's Network/WebSocket/FileSystem modules; the
  portal is static HTML/JS (three.js vendored) and runs in Chrome, Edge, Firefox and Safari.
- No external hosting: the portal runs from your project folder; the only backend is your own Snap
  Cloud project.
- Light files: change-only keyframes; ten seconds of three moving objects at 30 Hz is ~25 KB.
- The portal can start and stop recordings in the running Lens (Local mode).

## Core scripts
| Script | What it does |
|---|---|
| `Scripts/WebCapture.ts` | Main component: collects objects, live sync, recording, saving, status, portal commands. |
| `Scripts/WebCaptureTarget.ts` | Per-object component: id, shape and colour in the portal, what to record. |
| `Scripts/CaptureRecorder.ts` | Relative poses and change-only keyframe tracks. |
| `Scripts/CaptureTransports.ts` | Local (plugin WebSocket), Snap Cloud (RPCs) and Offline destinations. |
| `Scripts/WebCaptureProtocol.ts` | Format types, limits and `validateRecording`. |
| `SnapCloudRequirements.ts` | Holds the `SupabaseProject` credentials asset (Snap Cloud mode). |
| `Example/WebCaptureDemoMotion.ts` | Demo-only motion for the three sample targets. |

## Docs
- [guide](guide.md) · [playbook](playbook.md) · [cheat sheet](cheat-sheet.md) · [setup](setup.md) · [components](components.md) · [portal](portal.md)
- [protocol](protocol.md) · [API status](api-status.md) · [examples](examples.md) · [troubleshooting](troubleshooting.md)

# Video Call S2M

## What it is
A Specs-to-mobile package: a Specs Lens plus an iPhone companion app for finding a friend in a crowd, watching your own
back through your phone's camera, and video-calling a friend's phone. Live media travels peer-to-peer over native
WebRTC modules, the phone link uses Mobile Kit, and position history, checkpoints and call signaling use Snap Cloud. It
is for developers building Specs experiences that pair with a phone for location and media.

## What it does
1. Drop `VideoCallS2M__PLACE_IN_SCENE.prefab` into a Specs scene and assign your project asset on the
   `SnapCloudRequirements` object (shipped empty; a "Credentials needed" panel shows until then).
2. After the guide, the start menu (`ModeMenuUI`) lets the wearer switch on modes:
   - **Find Friend** - a camera-anchored 3D arrow yaws toward the friend's phone, a pulsing world marker with a label
     shows their name and distance, and a north-up minimap shows both positions and GPS accuracy. The friend's location
     comes from the paired iPhone over Mobile Kit; when the link drops, `FriendPositionEstimator` extrapolates.
   - **Watch Your Back** - a 9:16 panel shows the rear camera and mic of the wearer's own phone over WebRTC.
   - **Call Friend** - two-way video and voice with the friend's phone; incoming calls show an accept/deny dialog.
3. Watch Your Back and Call Friend are mutually exclusive; Find Friend combines with either.
4. Location fixes are mirrored to Snap Cloud (`CloudPathLogger`) and checkpoint geofences record "was here" notes.

## Highlights
- Native media path: `libVideoCallS2MWebRTCModule.so` (H.264 encode and Opus voice) and `libVideoCallS2MStreamModule.so`
  (camera and encoder), loaded by `WebRTCController` and `StreamController`; they fail gracefully in the Preview.
- `PovVideoSource` enforces "editor or device, never both": the Preview shows a synthetic test pattern instead.
- WebRTC signaling (SDP/ICE) goes through a Snap Cloud table mailbox (`RtcMailbox`).
- Building blocks are drop-in components: `MobileKitModule` (required phone link) and `SnapCloudModule` (cloud services).
- Optional rebuild sources for the native modules and the iOS companion ship as archives in `ExtractAtProjectRoot/`.

## Core scripts
| Script | What it does |
|---|---|
| `Scripts/App/VideoCallS2MManager.ts` | Core: modes, AR arrow and friend marker, location sources, call orchestration. |
| `Scripts/App/ModeMenuUI.ts` | UI Kit start menu with the mode switches. |
| `Scripts/MobileKit/MobileKitModule.ts` | Phone-link block owning the single Mobile Kit transport. |
| `Scripts/SnapCloud/SnapCloudModule.ts` | Snap Cloud block providing path logging, checkpoints and signaling. |
| `Scripts/SnapCloud/RtcMailbox.ts` | WebRTC signaling over a Snap Cloud table. |
| `Scripts/WebRTC/CallStreamer.ts` | Specs side of Call Friend (WebRTC video and voice). |
| `Scripts/WebRTC/WebRTCSession.ts` | Drives the native WebRTC sessions and their signaling. |
| `Scripts/WebRTC/PovVideoSource.ts` | Picks the synthetic (editor) or WebRTC (device) video source. |
| `Scripts/Geolocation/FriendPositionEstimator.ts` | Estimates the friend's probable position during dropouts. |
| `Scripts/Geolocation/MiniMapUI.ts` | North-up minimap for Find Friend. |

## Extra info
- **Requires:** InteractionKit, UIKit, Motion, Icons, SnapDecorators, SupabaseClient, Utilities. The iPhone companion app
  and a paired phone; a configured Snap Cloud project with the expected tables for calls and history. Native modules run
  only on Specs; in the Lens Studio Preview, Watch Your Back shows a test pattern, Call Friend stops at connecting and
  GPS can be simulated. Do not start another camera capture while the native stream owns the camera.
- **Get started:** `VideoCallS2M__PLACE_IN_SCENE.prefab` (credentials warning, guide, carousel and the Core, WebRTC,
  Snap Cloud, Navigation and PhoneLink blocks); wire `MobileKitModule` to the manager.
- **More docs:**
  - [cheat-sheet.md](cheat-sheet.md) - required blocks and transport boundaries, read first.
  - [setup.md](setup.md) - credentials, companion archives and native modules.
  - [components.md](components.md) - prefab hierarchy, classes, inputs and native types.
  - [examples.md](examples.md) - import paths and typed helper usage.
  - [guide.md](guide.md) - modes, architecture, companion app and native-build tutorial.
  - [api-status.md](api-status.md) - device-only exports, simulation boundaries and legacy helpers.
  - [troubleshooting.md](troubleshooting.md) - missing blocks, waiting calls and estimated GPS.

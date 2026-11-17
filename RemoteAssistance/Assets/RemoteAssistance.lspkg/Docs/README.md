# Remote Assistance

## What it is
Remote Assistance is a package that lets a Specs wearer call a helper who uses a web browser. The helper sees the
wearer's point of view live, talks with them, and draws guidance on the video that lands as 3D lines in the wearer's
world. Media runs over native WebRTC modules; Snap Cloud carries the signaling and drawing rows. It is for
developers building remote guidance, support or training experiences on Specs.

## What it does
1. You drop `RemoteAssistance__PLACE_IN_SCENE.prefab` into a scene and assign your Snap Cloud `SupabaseProject` on its
   `SnapCloudRequirements` child. Until you do, a red "Credentials needed" panel shows before the guide.
2. After the guide is dismissed, `RemoteAssistanceManager` builds a start menu at runtime that shows a session code
   and a START CALL button.
3. Starting a call opens a Snap Cloud mailbox for that session code and a WebRTC session: the wearer's POV camera
   is streamed to the helper, with two-way voice and an optional incoming helper webcam.
4. A call panel follows the wearer's view with the video, caption status and QUIT CALL, VIDEO (cycles 1K / 2K / MAX
   quality) and CLEAR DRAWINGS buttons.
5. The helper enters the same session code in the browser helper portal and draws on the video; each stroke is
   received through the mailbox and rendered by `AnnotationRenderer` as a 3D ribbon at a fixed depth in front of
   the pose the wearer had when the stroke began.
6. In the Lens Studio Preview the native modules don't load; with `simulateInPreview` on, START CALL plays a local
   demo drawing (circle, arrow and dot about 200 cm ahead).

## Highlights
- Peer-to-peer WebRTC media from native modules (`libRemoteAssistanceWebRTCModule.so`), with their C++ sources
  shipped as zips in `ExtractAtProjectRoot/`.
- Snap Cloud mailbox (`RtcMailbox`) for SDP / ICE signaling and drawing rows, with Snapchat ID or anonymous auth.
- World-anchored annotations: stroke points arrive in normalized video coordinates and are mapped through a
  configurable FOV, depth and pose-lag history.
- Selectable video quality presets and a bounded bitrate range.
- Menu and call panels are built in code with UI Kit; `ModeMenuUI.onStartCall` is the event to consume.

## Core scripts
| Script | What it does |
|---|---|
| `Scripts/App/RemoteAssistanceManager.ts` | Builds the menu and call panel, runs the call lifecycle and the Preview demo drawing. |
| `Scripts/App/ModeMenuUI.ts` | Runtime start menu with the session code and the `onStartCall` event. |
| `Scripts/WebRTC/CallStreamer.ts` | Per-call media: WebRTC session, microphone and voice playback, incoming helper video. |
| `Scripts/WebRTC/WebRTCSession.ts` | Wraps the native WebRTC exports: POV offer, voice, helper video, bitrate presets. |
| `Scripts/WebRTC/WebRTCController.ts` | Loads the native WebRTC module on awake. |
| `Scripts/WebRTC/PovPanelUI.ts` | The call panel: video area, captions and the call buttons. |
| `Scripts/SnapCloud/RtcMailbox.ts` | Snap Cloud mailbox for signaling and drawing rows of one session. |
| `Scripts/SnapCloud/SnapCloudModule.ts` | Creates mailboxes from the project assigned on `SnapCloudRequirements`. |
| `Scripts/Drawing/AnnotationRenderer.ts` | Turns helper strokes into 3D ribbons anchored in the wearer's world. |
| `SnapCloudRequirements.ts` | Holds the Snap Cloud project every script reads. |

## Extra info
- **Requires:** InteractionKit, UIKit, Motion, Icons, SnapDecorators, SupabaseClient and Utilities. A Snap Cloud
  project with the shipped schema applied, and the browser helper portal; both live outside `RemoteAssistance.lspkg`
  (`supabase/` and `web/` at the project root), so an Asset Library import doesn't include them. The native modules
  run only on Specs: the Preview can show local demo annotations but no media, voice or end-to-end call. STUN without
  TURN is not a connectivity guarantee on every network.
- **Get started:** `RemoteAssistance__PLACE_IN_SCENE.prefab`, then follow [setup.md](setup.md) to assign credentials
  and apply the database schema, and [helper-portal.md](helper-portal.md) to run the helper page.
- **More docs:**
  - [cheat-sheet.md](cheat-sheet.md) - startup and camera ownership rules, read first
  - [setup.md](setup.md) - Snap Cloud credentials and the Credentials needed panel
  - [components.md](components.md) - every script, input, callback, method and protocol type
  - [native-api.md](native-api.md) - native exports, loaders and optional features
  - [drawing-protocol.md](drawing-protocol.md) - drawing wire format
  - [helper-portal.md](helper-portal.md) - browser helper setup
  - [guide.md](guide.md) - full setup and native build tutorial
  - [examples.md](examples.md) - typed parser, annotation and menu consumers
  - [api-status.md](api-status.md) - current surface, historical claims and gaps
  - [troubleshooting.md](troubleshooting.md) - signaling, lifecycle, audio and alignment

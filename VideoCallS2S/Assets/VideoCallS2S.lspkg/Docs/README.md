# Video Call S2S

## What it is
A package for a Specs-to-Specs video call between two wearers, with no phone companion. Native WebRTC carries
both cameras and both voices peer-to-peer over one duplex connection; Snap Cloud database rows carry the
pairing handshake and SDP/ICE signaling. It is for developers building wearer-to-wearer calling or real-time
media experiences.

## What it does
1. Drop `VideoCallS2S__PLACE_IN_SCENE` into the scene and assign your `SupabaseProject` on its
   `SnapCloudRequirements` object.
2. **Home** shows your 4-digit pairing code, a field for a friend's code, **CALL FRIEND** and a status line
   (Snap Cloud readiness, call outcomes). An inbox mailbox keyed by your code polls for rings.
3. **CALL FRIEND** rings the friend's code; the caller becomes the WebRTC offerer.
4. The other wearer sees **Incoming call** with **ACCEPT** / **DENY**; unanswered calls time out as missed.
   Accepting makes them the answerer.
5. The **Call panel** shows the friend's camera (aspect-fit), a live caption (link, mic, speaker, frames),
   **HANG UP** and a **VIDEO** quality cycler (1K / 2K / MAX), and follows your head.
6. In the Lens Studio Preview the native module does not load; with `previewTestPattern` on, CALL FRIEND opens
   the call panel with a synthetic test pattern for UI review only.

## Highlights
- One duplex PeerConnection per call: H.264 video and Opus voice in both directions.
- Signaling over the Snap Cloud `rtc_signals` table via PostgREST (ring, accept, decline, busy, bye, SDP/ICE).
- Native echo-cancelled voice capture started once per connection.
- Prebuilt `Modules/libVideoCallS2SWebRTCModule.so`; the C++ source ships as a zip for rebuilding with SpecsNDK.
- Graceful editor behaviour: `WebRTCController.native` stays null in the Preview and media reports device only.

## Core scripts
| Script | What it does |
|---|---|
| `Scripts/App/VideoCallS2SManager.ts` | Orchestrator: idle, calling, ringing, in-call and hang-up flow. |
| `Scripts/App/Types.ts` | Shared constants, roles and pairing-code helpers. |
| `Scripts/App/HomeUI.ts` | Home screen: pairing code, friend code field and CALL FRIEND. |
| `Scripts/App/IncomingCallUI.ts` | Accept / deny dialog for incoming rings. |
| `Scripts/App/CallPanelUI.ts` | In-call panel: friend video, caption, HANG UP and quality cycler. |
| `Scripts/SnapCloud/RtcMailbox.ts` | Handshake and WebRTC signaling as rows in `rtc_signals`. |
| `Scripts/SnapCloud/SnapCloudModule.ts` | Drop-in component owning the mailbox and handing it to the manager. |
| `Scripts/WebRTC/CallStreamer.ts` | This wearer's side of the call: WebRTC session and audio lifecycle. |
| `Scripts/WebRTC/WebRTCSession.ts` | Drives the native duplex session and its manual signaling. |
| `Scripts/WebRTC/WebRTCController.ts` | Loads the native WebRTC library at start (null in Preview). |

## Extra info
- **Requires:** InteractionKit, UIKit, Motion, Icons, SnapDecorators, SupabaseClient, Utilities. Your own Snap
  Cloud project with the `rtc_signals` schema and policies. Two Specs; the native module runs only on device,
  so no real call, camera or voice is possible in the Lens Studio Preview. No TURN relay is configured: test on
  a shared Wi-Fi or hotspot. Pairing codes identify sessions, not authenticated users.
- **Get started:** `VideoCallS2S__PLACE_IN_SCENE.prefab`; wire `manager.snapCloud` to the active
  `SnapCloudModule`. Until a `SupabaseProject` is assigned, a "Credentials needed" panel appears before the guide.
- **More docs:**
  - [cheat-sheet.md](cheat-sheet.md) — wiring and role rules; read first
  - [setup.md](setup.md) — cloud credentials, schema and native build prerequisites
  - [components.md](components.md) — every public class, input, event, helper and native export
  - [api-status.md](api-status.md) — source, Preview and native boundaries
  - [examples.md](examples.md) — pairing helper and capability-check imports
  - [troubleshooting.md](troubleshooting.md) — ring, accept, timeout, media and schema issues
  - [guide.md](guide.md) — full workflow, architecture and native-build tutorial

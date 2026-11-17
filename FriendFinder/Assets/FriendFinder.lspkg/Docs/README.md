# Friend Finder

## What it is
A package for a Specs experience with an iPhone companion: find a friend in a crowd, watch your own back
through your phone's camera, or video-call a friend. Real-time media uses peer-to-peer WebRTC through native
modules; position history, checkpoints and call signaling use Snap Cloud (Supabase). It is for developers
building phone-assisted location and calling experiences.

## What it does
Drop `FriendFinder__PLACE_IN_SCENE` into a Specs scene; `FriendFinderManager` creates a `Friend Finder` root at
runtime and a mode menu offers three modes:
- **Find Friend** — a 3D arrow, world marker and minimap guide you to your friend, using phone GPS and UWB
  distance relayed over Mobile Kit (BLE).
- **Watch Your Back** — your own phone's rear camera on a floating panel with one-way audio; flip, mute and
  quit from the phone.
- **Call Friend** — your friend's phone camera on a panel with two-way voice; they see your POV. An incoming-call
  UI lets you accept or decline.

Watch Your Back and Call Friend are mutually exclusive; Find Friend can run with either. In the Lens Studio
Preview, location is simulated (`simulateInPreview`) and media is a synthetic test pattern.

## Highlights
- Native WebRTC (H.264 video + Opus voice) via prebuilt `Modules/libFriendFinderWebRTCModule.so` and
  `Modules/libFriendFinderStreamModule.so`; C++ sources ship as zips for rebuilding.
- Snap Cloud `rtc_signals` mailbox for WebRTC signaling, plus `locations` and `checkpoints` tables for path
  logging.
- Pure location math (`GeoMath`, `FriendPositionEstimator`) usable on its own: haversine distance, bearing,
  smoothing, feet/miles formatting.
- Single shared Mobile Kit link (`MobileKitModule` / `MobileKitLink`) to the bonded iPhone.
- Editor vs device paths chosen once at startup by environment, not as a runtime fallback.

## Core scripts
| Script | What it does |
|---|---|
| `Scripts/App/FriendFinderManager.ts` | Entry point: starts the services and switches between the three modes. |
| `Scripts/App/ModeMenuUI.ts` | Mode menu for Find Friend / Watch Your Back / Call Friend. |
| `Scripts/MobileKit/MobileKitModule.ts` | Owns the shared Mobile Kit link to the companion iPhone. |
| `Scripts/Geolocation/FriendPositionEstimator.ts` | Estimates the friend's position from location fixes. |
| `Scripts/Geolocation/GeoMath.ts` | Distance, bearing and unit-formatting helpers. |
| `Scripts/WebRTC/WebRTCController.ts` | Loads the native WebRTC library at start and exposes its exports (null in Preview). |
| `Scripts/WebRTC/WebRTCSession.ts` | Drives the native POV and voice sessions and their signaling. |
| `Scripts/SnapCloud/RtcMailbox.ts` | Snap Cloud mailbox for WebRTC signaling messages. |
| `Scripts/SnapCloud/SnapCloudModule.ts` | Optional drop-in owning path logging, checkpoints and the RTC mailbox. |
| `SnapCloudRequirements.ts` | Holds the `SupabaseProject` credentials asset all cloud scripts read. |

## Extra info
- **Requires:** SnapDecorators, Solvers, InteractionKit, UIKit, SupabaseClient, Utilities, Motion, Icons. Your
  own Snap Cloud project with the migrations applied (Anonymous provider enabled for Preview). The companion
  iOS app (`ExtractAtProjectRoot/iOS.zip`, run on both phones). Native `.so` modules run only on Specs, not in
  the Lens Studio Preview; device media and phone links need device testing.
- **Get started:** `FriendFinder__PLACE_IN_SCENE.prefab`; assign your `SupabaseProject` on its
  `SnapCloudRequirements` object (until then a "Credentials needed" panel appears; "Continue without
  credentials" runs with Snap Cloud off).
- **More docs:**
  - [cheat-sheet.md](cheat-sheet.md) — lifecycle and mode rules; read first
  - [setup.md](setup.md) — phones, cloud tables and native modules
  - [components.md](components.md) — every source input, API, wire type and native declaration
  - [api-status.md](api-status.md) — current versus retained legacy paths
  - [examples.md](examples.md) — typed geographic and estimator consumers
  - [troubleshooting.md](troubleshooting.md) — phone, cloud and media issues
  - [guide.md](guide.md) — native build recipes, modes, architecture and tutorial

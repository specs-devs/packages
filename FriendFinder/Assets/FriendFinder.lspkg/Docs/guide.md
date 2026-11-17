# FriendFinder guide

[← Agent usage index](../README.md)

## Use when

Read the original human tutorial, native build recipes and companion architecture.

The original human tutorial is retained below with installed-path, dependency and executable-mode clarifications. Native build recipes and existing connectivity statements are source guidance, not a new hardware test. Realtime/PovFrameReceiver are retained modules rather than the current manager's Preview fallback. Device Watch Your Back uses cloud mailbox signaling; anonymous auth is also a possible device fallback. Runtime services initialize on OnStart.

This README documents the **package** (`Assets/FriendFinder.lspkg`). For the
project-level overview, native-module build recipes, and the WebRTC deep
dive, see the repository: `FriendFinder/README.md` and
`FriendFinder/WEBRTC-CALL.md` in specs-packages.

---


## Native development (SpecsNDK)

**Download and install SpecsNDK before building or modifying this package's
native C++ modules.** The included prebuilt `.so` files can be used without
installing the NDK. Native execution must be tested on a compatible SPECS
device; the device libraries do not run in Lens Studio preview.

### Download and configure SpecsNDK

**Download SpecsNDK from https://github.com/specs-devs/ndk.**
SpecsNDK is a separate download and is not included in this package or Lens Studio.

These native modules are built with **SpecsNDK 1.1 (1.1.0)**. Use the matching
distribution for your host, follow its installation instructions, and extract
it into a directory you choose. Replace the placeholder below with that
absolute directory; no particular username or workspace layout is required.

```bash
export SPECSNDK_ROOT="/path/to/extracted/SpecsNDK"

test -f "$SPECSNDK_ROOT/SpecsNDK-Toolchain-Clang.cmake"
test -f "$SPECSNDK_ROOT/sysroots/armv8a-snap-linux/usr/include/snap/corejs_abi/abi.h"
```

Both checks must succeed before building. The root should contain the toolchain
file and `sysroots/` directly, rather than another nested SDK directory. Install
the host prerequisites specified by the SDK distribution, including a working
CMake and Bash environment for the commands below.

### Get the source

From an Asset Library import, extract the native-module ZIPs in
`ExtractAtProjectRoot/` into your Lens Studio project root (the directory
containing `Assets/`). If you cloned this project, use the module folders
already at its root. Run the following commands from that project root.

### WebRTC build dependencies

The WebRTC module also needs matching, device-targeted **Opus and the patched
libdatachannel** headers and static libraries. These are separate from SpecsNDK
and are not included in the source ZIP. Obtain the matching dependency bundle
or build instructions from the SPECS team; an arbitrary system installation of
libdatachannel is not a substitute.

Set the directory containing `opus/`, `libdatachannel/`, `build-opus/libopus.a`
and `build-dc/libdatachannel-static.a` (including its dependent libraries):

```bash
export SPECS_WEBRTC_THIRD_PARTY="/path/to/matching/third_party"
```

The engine source is included in the WebRTC module's `SpecsWebRTC/` folder.
Extract the StreamModule ZIP too: the WebRTC build uses its camera sources.

### Build and test

```bash
bash FriendFinderStreamModule/build.sh "$SPECSNDK_ROOT"
bash FriendFinderWebRTCModule/build.sh "$SPECSNDK_ROOT"
```

The scripts copy the resulting libraries into `Assets/FriendFinder.lspkg/Modules/`.
They accept the SDK root as the first argument or through `SPECSNDK_ROOT`;
no local SDK directory is assumed. Reopen or refresh Lens Studio after a
rebuild, export to your SPECS device, and test the native behavior there.

## Modes

| Mode | What you see | Who's involved |
|---|---|---|
| **Find Friend** | 3D arrow + world marker + minimap guiding you to your friend | Your phone + friend's phone (GPS / UWB) |
| **Watch Your Back** | Your **own** phone's rear camera on a floating panel with one-way audio; flip / mute / quit from the phone | Just your phone |
| **Call Friend** | Friend's phone camera on a panel + two-way voice; they see your POV | Friend's phone |

`Watch Your Back` and `Call Friend` are mutually exclusive; `Find Friend`
combines with either.

## Quick start

1. **Drop the prefab in your scene:** `FriendFinder__PLACE_IN_SCENE.prefab`.
   The manager creates a single `Friend Finder` root at runtime.
2. **Configure Snap Cloud (required for cloud features):**
   - Create your own Snap Cloud project: **Window > Supabase**, log in,
     create/import a project, then **Import Credentials** — this creates a
     `SupabaseProject` asset in your Asset Browser.
   - Assign that asset on the prefab's **`SnapCloudRequirements`** object
     (`SnapCloudRequirements.ts` at the package root). Every cloud script reads
     the project from there through `Snap Cloud` > `SupabaseRequirements`
     (its own `supabaseProject` input is deprecated). Until it is assigned, a
     red-framed "Credentials needed" panel (`CredentialsWarning`) appears
     before the guide; "Continue without credentials" runs the demo with Snap
     Cloud off.
   - Apply the SQL migrations (tables `locations`, `checkpoints`,
     `rtc_signals`) with `supabase db push`. The migration files live in the
     [SPECS packages repository](https://github.com/specs-devs/packages) under `FriendFinder/supabase/migrations/`.
   - **Without a configured project**, geographic/synthetic paths can remain usable, but device media signaling and cloud logging are unavailable. Device Watch Your Back constructs its own mailbox; the manager cloud-module switch alone does not gate it.
3. **Companion pieces (device builds):** unzip everything in
   `ExtractAtProjectRoot/` **at your project root**:
   - `iOS.zip` → `iOS/` — the SwiftUI iPhone companion app (both phones run
     it). Build with `cd iOS && xcodegen generate`, open the generated
     `FriendFinder.xcodeproj`.
   - `FriendFinderWebRTCModule.zip` → C++ NDK source for
     `libFriendFinderWebRTCModule.so` (WebRTC engine bridge).
   - `FriendFinderStreamModule.zip` → C++ NDK source for
     `libFriendFinderStreamModule.so` (camera capture).
   - Prebuilt `.so` binaries are already included in `Modules/` — you only
     need the C++ sources if you change them (see [Native development (SpecsNDK)](#native-development-specsndk)).

## Editor vs device

Chosen once at startup by environment — never a runtime fallback:

| | Lens Studio preview | SPECS device |
|---|---|---|
| Media | Synthetic test pattern (`PovVideoSource.ts`) | Native WebRTC (H.264 + Opus) via `Modules/*.so` |
| Location | Simulated GPS (`simulateInPreview`, on in the prefab) | Phone GPS + UWB over Mobile Kit (BLE) |
| Auth | Anonymous (enable the Anonymous provider on your Snap Cloud project) | Snapchat id-token |

## Architecture

```
                   ┌────────────────────────────┐
                   │   Snap Cloud (Supabase)    │
                   │ rtc_signals mailbox ·      │
                   │ locations · checkpoints    │
                   └──────▲──────────────▲──────┘
                          │ REST/poll    │ REST/poll
    ┌──────────────┐  BLE │ ┌────────────┴──┐   ┌──────────────────┐
    │  SPECS Lens  │◄────►│ │  Your iPhone  │   │ Friend's iPhone  │
    │ (TypeScript  │ Mobile Kit │ "phoneA"  │◄─►│     "phoneB"     │
    │  + C++ .so)  │      │ └───────────────┘ MP+UWB └─────────────┘
    └──────▲───────┘                                       │
           └───────── WebRTC media (peer-to-peer RTP) ─────┘
```

| Transport | Connects | Carries |
|---|---|---|
| **SPECS Mobile Kit** (BLE) | SPECS ↔ phoneA | Location, mode control, flip/quit commands |
| **MultipeerConnectivity** | phoneA ↔ phoneB | Friend location, UWB tokens |
| **NearbyInteraction** (UWB) | phoneA ↔ phoneB | Precise distance (~±10 cm) |
| **Snap Cloud** (PostgREST) | everyone | WebRTC signaling mailbox, position history, checkpoints |
| **WebRTC** (RTP/SRTP, P2P) | SPECS ↔ phone | H.264 video + Opus voice — the live media |

## Package contents

```
FriendFinder/                       (this package)
├── FriendFinder__PLACE_IN_SCENE.prefab   ← drop this in your scene
├── Scene.scene                     # authoring scene for the prefab content
├── Scripts/
│   ├── App/                        # orchestration + UI
│   │   ├── FriendFinderManager.ts  # THE orchestrator — spawns everything
│   │   ├── ModeMenuUI.ts           # in-lens mode picker
│   │   ├── IncomingCallUI.ts       # accept/decline call prompt
│   │   └── Types.ts                # shared modes, roles, wire formats
│   ├── Geolocation/
│   │   ├── FriendPositionEstimator.ts  # most-probable position on link loss
│   │   ├── FriendMarkerUI.ts       # 3D arrow + world marker
│   │   ├── MiniMapUI.ts            # minimap rendering
│   │   └── GeoMath.ts              # lat/lon ↔ local-space math
│   ├── MobileKit/
│   │   ├── MobileKitLink.ts        # BLE session with the phone (location, commands)
│   │   └── MobileKitModule.ts      # native Mobile Kit module loader
│   ├── SnapCloud/
│   │   ├── SupabaseRequirements.ts # reads the project from SnapCloudRequirements
│   │   ├── Realtime.ts             # broadcast channel (POV frames / voice push)
│   │   ├── RtcMailbox.ts           # WebRTC signaling over the rtc_signals table
│   │   ├── CloudPathLogger.ts      # throttled GPS history → locations table
│   │   ├── CloudCheckpoints.ts     # user checkpoints + "was here" visits
│   │   ├── PovFrameReceiver.ts     # retained legacy JPEG receiver, not current manager fallback
│   │   └── SnapCloudModule.ts      # client bootstrap helpers
│   └── WebRTC/
│       ├── WebRTCController.ts     # native WebRTC lifecycle (device path)
│       ├── WebRTCSession.ts        # SDP/ICE session state machine
│       ├── WebRTCNativeModule.ts   # loads Modules/libFriendFinderWebRTCModule.so
│       ├── StreamController.ts     # camera capture control (device path)
│       ├── StreamNativeModule.ts   # loads Modules/libFriendFinderStreamModule.so
│       ├── CallStreamer.ts    # outbound POV stream (call path)
│       ├── PovVideoSource.ts       # editor-vs-device media gate (synthetic ↔ WebRTC)
│       ├── PovPanelUI.ts           # floating video panel
│       └── RtcVoicePlayer.ts       # inbound voice playback
├── Modules/                        # prebuilt native modules (device only)
│   ├── libFriendFinderWebRTCModule.so
│   └── libFriendFinderStreamModule.so
├── ExtractAtProjectRoot/           # companion sources — unzip at project root
│   ├── iOS.zip                     # SwiftUI iPhone companion app
│   ├── FriendFinderWebRTCModule.zip# NDK source for the WebRTC .so
│   └── FriendFinderStreamModule.zip# NDK source for the camera .so
├── Audio/                          # chimes, mic input, RTC voice output
├── Images/ · Materials/ · Meshes/ · GeneratedMeshes/ · Shaders/
├── RawLocationPermission.rawLocationModule  # location permission module
├── package.native                  # package manifest (version)
└── package_dependencies.json       # declared dependencies (see below)
```

## Dependencies

`package_dependencies.json` declares InteractionKit, UIKit, SnapDecorators, Solvers, SupabaseClient, Utilities, Motion and Icons. Leaf and AiPreviewAgent packages are not declared runtime companions. The native `.so` modules run only on a SPECS device, never in the Lens Studio Preview.

## Security notes

- **No credentials ship with this package.** The Supabase project asset was
  deliberately removed; every consumer supplies their own via
  `SnapCloudRequirements`. The iOS app's `StreamConfig.swift` likewise ships
  with an empty `anonKey` — fill in your own project URL + anon key there.
- The Decart-style pattern applies: keep keys in Inspector inputs, env vars,
  or your own config — never hardcode them in scripts committed to git.

## Known limitations

- **No TURN server** — WebRTC connects on the same Wi-Fi / LAN only. Add
  approved TURN credentials in `WebRTCSession.ts` (lens) and
  `WebRTCCallManager.swift` (phone) for cross-network calls.
- **WebRTC media is device-only** — the preview always shows the synthetic
  test pattern.
- **Watch Your Back audio is one-way** (phone → SPECS) to avoid a same-room
  echo loop; mute from the phone anytime.
- **Snapchat id-token auth is device-only** — enable the Anonymous provider
  on your Snap Cloud project for Lens Studio preview testing.

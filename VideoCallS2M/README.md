<p align="center">
  <img src="Assets/AssetImage/VideoCallS2M.png" width="250px" alt="VideoCallS2M"/>
</p>

<h1 align="center">Video Call S2M</h1>

<p align="center">
  Find a friend in a crowd, watch your own back, or video-call a friend —
  all from your SPECS, with an iPhone companion doing the phone-side work.
</p>

---

Friend Finder is a SPECS Lens plus an iPhone companion app. The
wearer picks a mode from an in-lens menu; the phone(s) supply GPS, precise UWB
ranging, and camera/mic. Real-time **media** rides peer-to-peer **WebRTC**;
durable **data** (position history, checkpoints) lives on **Snap Cloud**.


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
bash VideoCallS2MStreamModule/build.sh "$SPECSNDK_ROOT"
bash VideoCallS2MWebRTCModule/build.sh "$SPECSNDK_ROOT"
```

The scripts copy the resulting libraries into `Assets/VideoCallS2M.lspkg/Modules/`.
They accept the SDK root as the first argument or through `SPECSNDK_ROOT`;
no local SDK directory is assumed. Reopen or refresh Lens Studio after a
rebuild, export to your SPECS device, and test the native behavior there.

## Modes

| Mode | What you see | Who's involved |
|---|---|---|
| **Find Friend** | A 3D arrow + world marker + minimap guiding you to your friend | Your phone + friend's phone (GPS / UWB) |
| **Watch Your Back** | Your **own** phone's rear camera on a floating panel, with one-way audio (hear the phone's surroundings) — flip camera, mute, and quit from the phone | Just your phone |
| **Call Friend** | Your friend's phone camera on a panel + two-way voice; they see your POV | Friend's phone |

`Watch Your Back` and `Call Friend` are mutually exclusive; `Find Friend`
combines with either.

## How it fits together

```
                       ┌────────────────────────────┐
                       │   Snap Cloud (Supabase)     │
                       │  DB mailbox · positions ·   │
                       │  checkpoints / visits       │
                       └──────▲───────────────▲──────┘
                              │ REST/poll     │ REST/poll
        ┌──────────────┐  BLE │  ┌────────────┴──┐   ┌──────────────────┐
        │  SPECS Lens  │◄────►│  │  Your iPhone  │   │ Friend's iPhone  │
        │ (TypeScript  │ Mobile Kit │  "phoneA"  │◄─►│     "phoneB"     │
        │  + C++ .so)  │      │  └───────────────┘ MP+UWB └─────────────┘
        └──────▲───────┘                                        │
               └────────── WebRTC media (peer-to-peer RTP) ─────┘
```

| Transport | Connects | Carries |
|---|---|---|
| **SPECS Mobile Kit** (BLE) | SPECS ↔ phoneA | Location, mode control, flip/quit commands |
| **MultipeerConnectivity** | phoneA ↔ phoneB | Friend location, UWB tokens |
| **NearbyInteraction** (UWB) | phoneA ↔ phoneB | Precise distance (~±10 cm) |
| **Snap Cloud** (PostgREST) | everyone | WebRTC signaling mailbox, position history, checkpoints |
| **WebRTC** (RTP/SRTP, P2P) | SPECS ↔ phone | H.264 video + Opus voice — the live media |

The media is **WebRTC only** — chosen once at startup by environment, never a
runtime fallback. In the Lens Studio preview (where the native `.so` can't
load) the panel shows a synthetic test pattern instead.

## Repository layout

```
├── Assets/
│   ├── AssetImage/            # package icon (svg + png) — stays at Assets root
│   ├── Render/                # camera render target — stays at Assets root
│   └── VideoCallS2M.lspkg/    # all package content lives under one folder (unpacked package)
│       ├── Scripts/           # all Lens TypeScript (see below)
│       ├── NativeModules/     # built .so modules the Lens loads on device
│       ├── Materials/ · Meshes/ · GeneratedMeshes/ · GeneratedSFX/ · Icons/
│       └── Scene.scene
├── VideoCallS2MWebRTCModule/  # C++ (NDK): WebRTC engine bridge → libVideoCallS2MWebRTCModule.so
├── VideoCallS2MStreamModule/  # C++ (NDK): camera capture → libVideoCallS2MStreamModule.so
├── iOS/VideoCallS2M/          # SwiftUI companion app (both phones run it)
├── supabase/                  # Snap Cloud schema (locations, checkpoints, rtc_signals)
└── WEBRTC-CALL.md             # deep dive on the WebRTC path + build + test plan
```

Key Lens scripts (`Assets/VideoCallS2M.lspkg/Scripts/`):

- `VideoCallS2MManager.ts` — the orchestrator; spawns everything under a single
  `VideoCallS2M` scene node (prefab-ready).
- `VideoCallS2MTypes.ts` — shared modes, roles, wire formats.
- `PovVideoSource.ts` — the editor-vs-device media gate (synthetic ↔ WebRTC).
- `FriendPositionEstimator.ts` — most-probable-position when the link drops.
- `CloudPathLogger.ts` / `CloudCheckpoints.ts` — Snap Cloud position log + checkpoints.
- `CallStreamer.ts` / `VideoCallS2MWebRTCSession.ts` — the WebRTC call path.
- `RtcVoicePlayer.ts` — inbound voice playback (Watch Your Back audio).

## Setup & build

1. **Snap Cloud schema** — apply the migrations once:
   `supabase db push` (project `kjxmfkpcafpeuzrwcrjo`).
2. **Lens** — open the `.esproj` in Lens Studio 5.25+ (SPECS target) and
   press play. Preview runs with simulated GPS + the synthetic media source; no
   phone/device needed.
3. **iOS** — `cd iOS && xcodegen generate`, open `VideoCallS2M.xcodeproj`, build
   to two iPhones. See `iOS/README.md`.
4. **Native modules** — prebuilt binaries are included. To change or rebuild
   them, follow [Native development (SpecsNDK)](#native-development-specsndk).

## Packaging

This directory follows the SPECS package layout — the package image lives in
`Assets/AssetImage/` and `ci_export.json` holds the store description. Export
the `.lspkg` yourself from Lens Studio when you're ready (this repo intentionally
does not commit one).

## Known limitations

- **No TURN server** — WebRTC connects on the **same Wi-Fi / LAN** only. Drop
  approved TURN credentials into `VideoCallS2MWebRTCSession.ts` /
  `WebRTCCallManager.swift` for cross-network.
- **WebRTC media is device-only** — it can't run in the Lens Studio preview.
- **Watch Your Back audio is one-way** (phone → SPECS) to avoid a same-room
  echo loop; mute it from the phone anytime.

## Deep dives

- [`WEBRTC-CALL.md`](WEBRTC-CALL.md) — the WebRTC call path, build, and on-device test plan.
- [`VideoCallS2MStreamModule/README.md`](VideoCallS2MStreamModule/README.md) — native module build.
- [`iOS/README.md`](iOS/README.md) — companion app build.

---

*Built with 👽 by the SPECS team*

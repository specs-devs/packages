<p align="center">
  <img src="Assets/AssetImage/VideoCallS2S.png" width="250px" alt="VideoCallS2S"/>
</p>

<h1 align="center">Video Call S2S</h1>

<p align="center">
  A SPECS-to-SPECS video call: show your code, call a friend, see and hear
  each other — peer-to-peer WebRTC, with Snap Cloud only for the handshake.
</p>

---

Video Call S2S is a SPECS Lens for two wearers. Each Lens shows a 4-digit
pairing code on its home screen. Type a friend's code and tap **CALL FRIEND**;
they see an incoming-call dialog and **ACCEPT**. One peer-to-peer **WebRTC**
connection then carries both cameras (H.264) and both voices (Opus). **Snap
Cloud** carries only the small stuff: the ring / accept / decline handshake
and the SDP/ICE signaling. No phone, no companion app.

## What you see

| Screen | What it does |
|---|---|
| **Home** | Your pairing code, a field for a friend's code, **CALL FRIEND**, and a status line (Snap Cloud readiness, call outcomes). |
| **Incoming call** | "INCOMING CALL · from 4821" with **ACCEPT** / **DENY**. Unanswered calls time out as missed. |
| **Call panel** | Your friend's camera (aspect-fit, letterboxed), a live caption (link · mic · speaker · frames), **HANG UP**, and a **VIDEO** quality cycler (1K / 2K / MAX). Follows your head. |

In the Lens Studio preview the native WebRTC module can't load, so the call
panel shows a synthetic test pattern instead — the UI stays iterable without a
device.

## How it fits together

```
        SPECS A (caller)                                 SPECS B (callee)
   ┌──────────────────────┐                         ┌──────────────────────┐
   │ Home → CALL FRIEND   │  ring/accept/decline/   │ Incoming → ACCEPT    │
   │ RtcMailbox ──────────┼── busy/bye + SDP/ICE ───┼────────── RtcMailbox │
   │ WebRTCSession        │  rows in Snap Cloud     │        WebRTCSession │
   │  (offerer)           │  `rtc_signals`          │           (answerer) │
   │ native .so ══════════╪═ one P2P PeerConnection ╪═════════ native .so  │
   │  camera + mic  ⇄     │  video + audio sendrecv │     ⇄ camera + mic   │
   └──────────────────────┘                         └──────────────────────┘
```

| Layer | Where | Carries |
|---|---|---|
| **WebRTC** (RTP/SRTP, P2P) | `libVideoCallS2SWebRTCModule.so` | H.264 video + Opus voice, both directions, one connection |
| **Snap Cloud** (PostgREST) | `rtc_signals` table | Pairing handshake, SDP/ICE, best-effort diagnostics |
| **UI** | UIKit | Home screen, dialog, call panel |

## Repository layout

```
├── Assets/
│   ├── AssetImage/            # package icon (svg + png)
│   ├── Render/                # camera render target
│   └── VideoCallS2S.lspkg/    # the package (unpacked)
│       ├── Scripts/App/       # VideoCallS2SManager, HomeUI, IncomingCallUI, CallPanelUI, Types
│       ├── Scripts/WebRTC/    # WebRTCController, WebRTCSession, CallStreamer, native bridge
│       ├── Scripts/SnapCloud/ # SupabaseRequirements, SnapCloudModule, RtcMailbox
│       ├── Modules/           # libVideoCallS2SWebRTCModule.so (prebuilt, device only)
│       ├── ExtractAtProjectRoot/  # the native module's source ZIP
│       ├── Audio/ · Materials/ · Images/ · Shaders/
│       └── VideoCallS2S__PLACE_IN_SCENE.prefab
├── VideoCallS2SWebRTCModule/  # C++ (SpecsNDK): WebRTC engine + camera + mic + speaker
├── supabase/                  # Snap Cloud schema (rtc_signals)
└── WEBRTC-CALL.md             # deep dive: roles, native changes, on-device test plan
```

Key Lens scripts (`Assets/VideoCallS2S.lspkg/Scripts/`):

- `App/VideoCallS2SManager.ts` — the orchestrator: idle → calling / ringing → in-call.
- `App/HomeUI.ts`, `App/IncomingCallUI.ts`, `App/CallPanelUI.ts` — the three screens.
- `App/Types.ts` — roles, mailbox kinds, pairing-code helpers.
- `SnapCloud/RtcMailbox.ts` — handshake + signaling over the Snap Cloud DB.
- `WebRTC/WebRTCSession.ts` — caller / callee driving the native duplex session.
- `WebRTC/CallStreamer.ts` — native-first mic + speaker lifecycle, friend video → texture.

## Setup

1. **Snap Cloud** — open the project in Lens Studio, `Window > Supabase > Import
   Credentials`, and assign the resulting `SupabaseProject` asset on the
   `▸ SnapCloudRequirements` object of the prefab (shipped empty; until it is set a red
   "Credentials needed" panel shows before the guide). The schema
   (`supabase/migrations/`, one `rtc_signals` table) is applied for you: the
   bundled **VideoCallS2S Snap Cloud Setup** editor plugin (`Plugins/`) probes the
   assigned project when it is opened and creates the table through the Snap
   Cloud management API with your Lens Studio sign-in (watch the Logger for
   `[VideoCallS2S SnapCloud]`). Without the plugin, run `supabase db push` once.
   On the Glasses a missing table shows *Snap Cloud schema missing (rtc_signals)*
   on the home screen instead of a call that never rings. Enable anonymous
   sign-in in the Snap Cloud dashboard if you want the preview to reach the mailbox.
2. **Devices** — the Lens uses the microphone/camera *and* the internet, which
   SnapOS only grants through a Transparent Permissions consent prompt. On a dev
   unit that pipeline is off by default and the install is rolled back
   (`PkgManagerError: Failed to set up permissions`). Enable it once per pair:
   `bash scripts/specs_enable_transparent_permissions.sh` with the glasses on USB,
   then tap **Allow** on the glasses when the Lens asks for microphone + internet.
3. **Lens** — send the Lens to **two** SPECS on the **same Wi-Fi or hotspot**
   (STUN only, no TURN).
4. **Call** — read the code on one pair, type it on the other, CALL FRIEND, ACCEPT.

## Native development (SpecsNDK)

**Download and install SpecsNDK before building or modifying this package's
native C++ module.** The included prebuilt `.so` can be used without installing
the NDK. Native execution must be tested on a compatible SPECS device; the
device library does not run in the Lens Studio preview.

### Download and configure SpecsNDK

**Download SpecsNDK from https://github.com/specs-devs/ndk.**
SpecsNDK is a separate download and is not included in this package or Lens Studio.

The module is built with **SpecsNDK 1.1 (1.1.0)**. Extract the distribution
into a directory you choose and point the build at it:

```bash
export SPECSNDK_ROOT="/path/to/extracted/SpecsNDK"

test -f "$SPECSNDK_ROOT/SpecsNDK-Toolchain-Clang.cmake"
test -f "$SPECSNDK_ROOT/sysroots/armv8a-snap-linux/usr/include/snap/corejs_abi/abi.h"
```

Both checks must succeed before building. Install the host prerequisites the
SDK distribution lists (CMake ≥ 3.25 and a Bash environment).

### Get the source

From an Asset Library import, extract `ExtractAtProjectRoot/VideoCallS2SWebRTCModule.zip`
into your Lens Studio project root (the directory containing `Assets/`). If you
cloned this project, the module folder is already at its root.

### Permissions: `INTERNET` is mandatory

SnapOS enforces the `INTERNET` permission at the socket layer: a Lens whose
manifest lacks it gets `EACCES` from `socket(AF_INET, SOCK_DGRAM)`, so ICE never
produces a candidate and the call never connects (the Lens logs
`UDP egress probe -> -1013 (BLOCKED …)` at start). Lens Studio takes a native
library's permissions from its `.snap.permissions` ELF section and writes them to
`libVideoCallS2SWebRTCModule.so.meta` (`Permissions:`) on import, and it
re-generates that list every time the `.so` changes — a hand-edited meta does not
survive a rebuild. The NDK's automatic embed only records annotated Specs APIs,
never raw sockets, so `build.sh` runs `embed_permissions.py` after linking to put
`INTERNET` in the section. Check before sending to a device:

```bash
"$SPECSNDK_ROOT"/sysroots/x86_64-specsndk-*/usr/bin/llvm-readelf -p .snap.permissions \
  Assets/VideoCallS2S.lspkg/Modules/libVideoCallS2SWebRTCModule.so
grep -A2 "Permissions:" Assets/VideoCallS2S.lspkg/Modules/libVideoCallS2SWebRTCModule.so.meta
```

### WebRTC build dependencies

The module needs matching, device-targeted **Opus and the patched libdatachannel**
headers and static libraries. They are separate from SpecsNDK and not included
in the source ZIP. Obtain the dependency bundle or build instructions from the
SPECS team; an arbitrary system libdatachannel is not a substitute.

```bash
export SPECS_WEBRTC_THIRD_PARTY="/path/to/matching/third_party"
```

### Build and test

```bash
bash VideoCallS2SWebRTCModule/build.sh "$SPECSNDK_ROOT"
```

The script copies the library into `Assets/VideoCallS2S.lspkg/Modules/`.
Refresh Lens Studio, send the Lens to both SPECS, and test on the devices. The
Lens checks the module generation (`ping() >= 3`) and refuses older builds with
a caption on the call panel.

## Packaging

This directory follows the SPECS package layout — the package image lives in
`Assets/AssetImage/` and `ci_export.json` holds the store description. Export
the `.lspkg` from Lens Studio when you're ready (this repo intentionally does
not commit one).

## Known limitations

- **No TURN server** — WebRTC connects on the **same Wi-Fi / LAN** only. Drop
  approved TURN credentials into `WebRTCSession.ts` for cross-network calls.
- **Media is device-only** — it can't run in the Lens Studio preview.
- **Pairing codes are unauthenticated** — anyone who knows a code can ring it;
  the `rtc_signals` policy is a prototype policy. Tighten before real use.
- **One call at a time** — a ring while busy is answered with `busy`.
- **The SPECS ↔ SPECS native changes are compiled but not yet exercised on
  hardware** — follow the test plan in `WEBRTC-CALL.md` first.

## Deep dives

- [`WEBRTC-CALL.md`](WEBRTC-CALL.md) — roles, the native engine changes, build, and the on-device test plan.
- [`VideoCallS2SWebRTCModule/README.md`](VideoCallS2SWebRTCModule/README.md) — native module build.

---

*Built with 👽 by the SPECS team*

<p align="center">
  <img src="Assets/AssetImage/RemoteAssistance.png" width="250px" alt="RemoteAssistance"/>
</p>

<h1 align="center">Remote Assistance</h1>

<p align="center">
  Call a helper from your SPECS: they see your POV in a web browser,
  talk you through the task — and <b>draw guidance that lands as 3D lines
  in your world</b>.
</p>

---

Remote Assistance is a SPECS Lens plus a **localhost web portal**
for the helper (`web/`). The wearer starts a call from an in-lens menu and
reads out the session code; the helper enters it in the portal. Real-time
**media** rides peer-to-peer **WebRTC**; call **signaling and drawing
strokes** ride the **Snap Cloud** DB mailbox. No phone app, no phone link.

Derived from [Friend Finder](../FriendFinder) — the geolocation / navigation /
find-your-friend features and the phone control link were removed; the
SPECS-side WebRTC call stack stays.


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
bash RemoteAssistanceStreamModule/build.sh "$SPECSNDK_ROOT"
bash RemoteAssistanceWebRTCModule/build.sh "$SPECSNDK_ROOT"
```

The scripts copy the resulting libraries into `Assets/RemoteAssistance.lspkg/Modules/`.
They accept the SDK root as the first argument or through `SPECSNDK_ROOT`;
no local SDK directory is assumed. Reopen or refresh Lens Studio after a
rebuild, export to your SPECS device, and test the native behavior there.

## The call

| Who | What they get |
|---|---|
| **SPECS wearer** | Starts the call from the menu; sees the helper's webcam (optional) on a panel, two-way voice, and the helper's drawings as **world-anchored 3D lines** in front of them |
| **Helper (web browser)** | Sees the wearer's POV live, talks both ways, **draws on the video**, can send their webcam back |

## How it fits together

```
                  ┌─────────────────────────────┐
                  │    Snap Cloud (Supabase)    │
                  │  rtc_signals: SDP/ICE rows  │
                  │  + "draw" stroke rows       │
                  └──────▲───────────────▲──────┘
                         │ REST/poll     │ REST/poll
   ┌──────────────┐      │               │      ┌───────────────────┐
   │  SPECS Lens  │──────┘               └──────│  Helper's browser │
   │ (TypeScript  │         "glasses"             │  web/ portal      │
   │  + C++ .so)  │                             │  ("phoneB")       │
   └──────▲───────┘                             └─────────▲─────────┘
          └────────── WebRTC media (peer-to-peer RTP) ────┘
```

| Transport | Connects | Carries |
|---|---|---|
| **Snap Cloud** (PostgREST) | both call peers | WebRTC signaling mailbox + **drawing strokes** + hangup |
| **WebRTC** (RTP/SRTP, P2P) | SPECS ↔ helper's browser | H.264 video + Opus voice — the live media |

Pairing is the **session code** on the SPECS start menu. The portal keeps the
`phoneB` sender id from the phone-app era, so the wire protocol is unchanged.

The drawing pipeline (browser stroke → Snap Cloud → 3D lines) is specified in
[`DRAWING.md`](DRAWING.md). In the Lens Studio preview (no helper, no native
`.so`), starting a call streams a **demo drawing** through the real pipeline
so it stays iterable in-editor.

## Repository layout

```
├── Assets/
│   ├── AssetImage/            # package icon (svg + png) — stays at Assets root
│   ├── Render/                # camera render target — stays at Assets root
│   └── RemoteAssistance.lspkg/ # all package content lives under one folder (unpacked package)
│       ├── Scripts/
│       │   ├── App/           # RemoteAssistanceManager, ModeMenuUI, Types
│       │   ├── Drawing/       # AnnotationRenderer + AnnotationTypes (3D stroke rendering)
│       │   ├── WebRTC/        # call media path (streamer, session, panel, native bridges)
│       │   └── SnapCloud/     # RtcMailbox (signaling + drawing rows), SnapCloudModule, SupabaseRequirements (deprecated)
│       ├── Modules/           # built .so native modules the Lens loads on device
│       ├── ExtractAtProjectRoot/  # NDK module source zips (extract to repo root to rebuild)
│       ├── Materials/ · Audio/ · Images/ · Shaders/
│       └── Scene.scene
├── web/                       # the helper portal — static page, ./serve.sh → localhost:8000
├── RemoteAssistanceWebRTCModule/  # C++ (NDK): WebRTC engine bridge → libRemoteAssistanceWebRTCModule.so
├── RemoteAssistanceStreamModule/  # C++ (NDK): camera capture → libRemoteAssistanceStreamModule.so
├── supabase/                  # Snap Cloud schema (rtc_signals is the one the call uses)
├── DRAWING.md                 # drawing-channel protocol + helper-side guide
└── WEBRTC-CALL.md             # deep dive on the WebRTC path + build + test plan
```

Key Lens scripts (`Assets/RemoteAssistance.lspkg/Scripts/`):

- `App/RemoteAssistanceManager.ts` — the orchestrator: call lifecycle,
  quality control, drawing-channel wiring.
- `Drawing/AnnotationRenderer.ts` — helper strokes → world-anchored 3D ribbon
  meshes (pose-frozen unprojection; see DRAWING.md).
- `WebRTC/CallStreamer.ts` / `WebRTC/WebRTCSession.ts` — the WebRTC call path.
- `SnapCloud/RtcMailbox.ts` — SDP/ICE + stroke rows over the Snap Cloud DB.

## Setup & build

1. **Snap Cloud** — the Lens needs a SupabaseProject asset: Window > Supabase >
   Import Credentials, then assign it on the prefab's `SnapCloudRequirements`
   object (a red "Credentials needed" panel shows until you do). Apply the schema once: `supabase db push`.
2. **Lens** — open the `.esproj` in Lens Studio 5.25+ (SPECS target) and
   press play. Preview runs demo drawing strokes; no helper/device needed.
3. **Helper portal** — `cd web && ./serve.sh` on the helper's machine, open
   `http://localhost:8000`, paste the Snap Cloud URL + anon key (kept in the
   browser's localStorage — nothing is hardcoded in the repo) and the session
   code from the SPECS menu. See [`web/README.md`](web/README.md).
4. **Native modules** — prebuilt binaries are included. To change or rebuild
   them, follow [Native development (SpecsNDK)](#native-development-specsndk).

## Known limitations

- **No TURN server** — WebRTC connects on the **same Wi-Fi / LAN** (or across
  home NATs via STUN) only. For production, TURN must be hosted on approved
  Snap infrastructure.
- **WebRTC media is device-only** — it can't run in the Lens Studio preview,
  so the full SPECS ↔ browser call needs the Lens on a device.
- **Stroke anchoring is pose-frozen** — strokes land where the wearer was
  looking `poseLagMs` ago; if the wearer pans quickly while the helper draws,
  tune `poseLagMs` / `anchorDepthCm` on the `Annotations3D` object.

## Deep dives

- [`DRAWING.md`](DRAWING.md) — the drawing channel: wire format, unprojection, helper-side guide.
- [`WEBRTC-CALL.md`](WEBRTC-CALL.md) — the WebRTC call path, build, and on-device test plan.
- [`web/README.md`](web/README.md) — the helper portal.
- [`RemoteAssistanceStreamModule/README.md`](RemoteAssistanceStreamModule/README.md) — native module build.

---

*Built with 👽 by the SPECS team*

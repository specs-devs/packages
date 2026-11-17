<p align="center">
  <img src="Assets/AssetImage/DecartAI.png" width="250px" alt="DecartAI"/>
</p>

# Decart AI

A SPECS Lens that pipes the **live camera feed through Decart's
generative video models** and shows the transformed "distorted reality" on a
floating screen in front of you. Type a prompt — *"turn the world into a vivid
watercolor painting"*, *"zombie apocalypse"* — and the world morphs live.

https://docs.platform.decart.ai

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

The Decart module links against the included
`Assets/DecartAI.lspkg/NativeModules/libSpecsWebRTC.so`. Rebuilding that engine
requires the compatible duplex-capable engine source and dependencies from the
SPECS team. If replacing it, set `SPECS_WEBRTC_SO` to the rebuilt library's path.

### Build and test

```bash
bash DecartWebRTCModule/build.sh "$SPECSNDK_ROOT"
```

The scripts copy the resulting libraries into `Assets/DecartAI.lspkg/NativeModules/`.
They accept the SDK root as the first argument or through `SPECSNDK_ROOT`;
no local SDK directory is assumed. Reopen or refresh Lens Studio after a
rebuild, export to your SPECS device, and test the native behavior there.

## The switch: editor (Mac) vs device (NDK)

The `target` dropdown on the `DecartRestyle` object is the top-level switch:

| `target` | Runs | When |
|---|---|---|
| `auto` (default) | editor→Mac path, device→native WebRTC | picks by `isEditor()` |
| `editor` | the Mac path below (`mode` = bridge / http) | forcing editor behavior |
| `device` | **native on-device WebRTC** via `DecartWebRTCModule` (NDK) | on SPECS |

The native path (`libDecartWebRTCModule.so`, built from `DecartWebRTCModule/`)
resolves **only on a SPECS device** — never in the editor — so `auto` keeps the
editor on the working Mac path and lets the glasses run WebRTC directly. The full
pipeline is implemented: camera → HW H.265 encode → WebRTC, and Decart's return
track → HW decode → display, over a **duplex** `libSpecsWebRTC` session (see the
`video_duplex` support in the compatible engine supplied with this package). It compiles, links, and loads; the
round-trip still needs on-device validation against live Decart (SDP shape,
decoder color-format, ICE) — details in `DecartWebRTCModule/README.md`. The two
Mac-path modes below select how the **editor / Mac** leg talks to Decart.

## The two Mac-path modes

| | **Bridge mode** (default) | **HTTP mode** (fallback) |
|---|---|---|
| Decart model | **Lucy 2.5 Realtime** (1280×720 @ 30 fps) | `lucy-image-2` (synchronous image edit) |
| Transport | WebSocket → Mac bridge → **WebRTC/LiveKit** | direct `fetch` POST from the Lens |
| Latency | **sub-second**, continuous ~10 fps video | ~15–18 s per frame (slideshow) |
| Needs | `DecartBridge/bridge.py` running on your Mac | nothing (Lens-only) |
| Why | The Lens runtime has **no WebRTC stack**, and Decart's realtime models are WebRTC-only — so a tiny companion process does the WebRTC leg | zero-infra demo of the same idea |

Switch the Mac-path transport on the `DecartRestyle` object → `mode` dropdown
(only consulted when `target` resolves to the editor/Mac path).

## Architecture (bridge mode)

```
┌─────────────── Lens (editor preview or SPECS device) ───────────────┐
│  CameraModule (Right_Color on device)                               │
│      └─ JPEG encode (Base64.encodeTextureAsync) @ ~10 fps           │
│           └─ WebSocket  {"type":"frame","data":"<b64 jpeg>"}  ──────┼──┐
│  Display quad ◀─ Base64.decodeTextureAsync ◀─ {"type":"frame"} ◀────┼─┐│
│  Prompt field ─▶ {"type":"prompt","prompt":"..."}  ─────────────────┼─┼┤
└──────────────────────────────────────────────────────────────────────┘ ││
                                                                         ▼│
                                   DecartBridge/bridge.py (Mac, port 8765)│
                                     │  decodes JPEG → LiveKit VideoSource│
                                     │  prompt → realtime.set(...)        │
                                     ▼                                    │
                          Decart Lucy 2.5 Realtime (WebRTC / LiveKit)     │
                                     │  transformed 720p30 video track    │
                                     └─ JPEG (640w, q70) → WebSocket ─────┘
```

The bridge keeps **one Decart session** alive across Lens restarts, applies
prompt changes mid-stream (`realtime.set`), and always forwards only the
**newest** frame in each direction (stale frames are dropped, so latency never
accumulates).

In HTTP mode the Lens instead builds a `multipart/form-data` body by hand
(boundary + JPEG bytes as one `Uint8Array`) and POSTs it to
`https://api.decart.ai/v1/generate/lucy-image-2` with the `x-api-key` header;
the response body is the transformed PNG.

## Scene structure

```
Camera Object              ← Perspective + DeviceTracking (World)
└── DecartDisplayQuad      ← 64×36 cm quad, unlit; HEAD-LOCKED (always centered)
DecartRig                  ← LazyTether.ts (soft-follow, NOT head-locked)
├── DecartStatusText       ← status line: fps, errors, state
└── DecartControls         ← DecartControlsUI.ts (UIKit panel, bottom bar)
    ├── prompt TextInputField  → setPrompt() live, no Lens restart
    └── Start/Stop Button      → startLoop()/stopLoop()
DecartRestyle              ← DecartRealtimeRestyle.ts (the engine)
```

**Head-locked image + lazy-tethered controls.** The transformed video quad is
parented to the camera, so it stays dead-center in your view — clean and stable
for recording. The controls and status readout live on `DecartRig`, which is
*not* parented to the camera: `LazyTether.ts` keeps it ~80 cm in front of you
but only re-positions once you look more than ~12° away (or walk ~30 cm), then
eases back and settles — so the chrome drifts out of the way instead of being
glued to your face. Tune on `DecartRig`: `distanceCm`, `deadzoneDegrees`,
`smoothing`.

## Files

| File | Role |
|---|---|
| `Assets/Scripts/DecartRealtimeRestyle.ts` | The engine: camera capture, both Decart transports, status line, public `startLoop/stopLoop/setPrompt` API |
| `Assets/Scripts/DecartControlsUI.ts` | UIKit control bar (prompt field + Start/Stop) |
| `Assets/Scripts/LazyTether.ts` | Soft-follow rig behavior |
| `DecartBridge/bridge.py` | Mac companion: WebSocket ⟷ Decart realtime (LiveKit/WebRTC) |
| `DecartBridge/requirements.txt` | `decart[realtime]`, `websockets`, `Pillow` |

## Setup & run

### 1. Start the bridge (once per session)

```bash
cd DecartBridge
python3 -m venv .venv && source .venv/bin/activate   # first time only
pip install -r requirements.txt                       # first time only
python bridge.py                                      # listens on ws://0.0.0.0:8765
```

Useful flags: `--model lucy-2.5` (default, falls back to `lucy-2.1`),
`--out-width 640` (frame size sent back to the Lens), `--port 8765`.
The API key comes from `DECART_API_KEY` env var, `--api-key`, or the default
test key baked into the script. The script auto-fixes the common macOS Python
`CERTIFICATE_VERIFY_FAILED` issue by pointing TLS at certifi's CA bundle.

### 2. Editor preview

1. Open `DecartTest.esproj` in Lens Studio, press ▶ preview.
2. Click **Start** on the panel. Status: `Connecting to bridge…` →
   `Bridge connected — streaming…` → `[bridge] Decart lucy-2.5 connected` →
   `LIVE ▲10fps ▼9fps "…"`.
3. Type in the prompt field any time — the style morphs mid-stream.

### 3. SPECS device

1. Find your Mac's LAN IP (`ipconfig getifaddr en0`), both on the same Wi-Fi.
2. On `DecartRestyle`, set `bridgeUrl` = `ws://<mac-ip>:8765`.
3. Deploy. Camera + internet use Transparent Permission. The device uses the
   **Right_Color** camera automatically (editor uses the webcam feed).

## Recording Instagram Reels

- **From the editor (easiest):** run the preview full-screen and screen-record
  with **⌘⇧5** (or QuickTime). Reels are 9:16 — either crop in your editor, or
  resize the Preview panel tall and narrow before recording so the quad fills a
  portrait frame.
- **From the device:** use the SPECS capture button for true first-person
  footage — the lazy tether shines here because the frame drifts naturally with
  your head instead of being rigidly locked.
- **Latency looks better on camera when the subject moves slowly.** Pans and
  reveals (walk toward a window, turn slowly) read as "magic mirror"; fast
  whip-pans expose the ~0.5 s delay and 10 fps cadence.
- **Style-morph moments make the best cuts:** start neutral, then submit a new
  prompt on camera and let the world transform mid-shot.
- Prompt ideas: `vivid watercolor painting`, `zombie apocalypse`,
  `1980s anime film`, `made entirely of LEGO bricks`, `underwater atlantis,
  caustic light`, `Van Gogh's Starry Night`, `cyberpunk neon night market`.
- Realtime sessions are **billed per second** on Decart's side (the bridge logs
  `billed realtime seconds: N`) — press **Stop** between takes.

## Known issues & workarounds

- **Fetches can't be aborted** — the Lens API has no `AbortController`, so
  Stop lets the in-flight frame finish naturally.
- **Bridge says `CERTIFICATE_VERIFY_FAILED`:** fixed automatically via certifi;
  if you run with a different Python, `pip install certifi` first.
- **`did not receive a valid HTTP request` in bridge logs:** harmless — that's
  a port scanner / liveness probe hitting the WebSocket port.
- **Nothing on the quad in bridge mode:** is `bridge.py` running? The Lens
  auto-retries every 2 s and the status line names the failure.

## Why not WebRTC directly in the Lens?

Decart's realtime models only accept media over WebRTC (the WebSocket endpoint
`wss://api3.decart.ai/v1/stream` is *signaling only* — SDP/ICE + prompts).
The Lens scripting runtime has WebSocket and `fetch`, but no RTCPeerConnection,
so a native peer is required. The bridge is the smallest such peer. The device-native path uses `libSpecsWebRTC` to send H.265 over WebRTC
from the device. See [Native development (SpecsNDK)](#native-development-specsndk)
for setup and `DecartWebRTCModule/README.md` in the extracted source for
its on-device validation requirements.

---

*Built with 👽 by the SPECS team*

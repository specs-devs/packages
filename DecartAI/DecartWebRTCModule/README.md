# DecartWebRTCModule — on-device (SPECS / NDK) WebRTC transport for Decart

SpecsNDK CoreJs-ABI native module. The **device** leg of the switch in
`Assets/Scripts/DecartRealtimeRestyle.ts` (`target = device` / `auto` on SPECS).
Goal: H.265 straight from the glasses over WebRTC to Decart — no Mac, no bridge,
no double-JPEG hop.


## Download and configure SpecsNDK

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

## Responsibility split

- **TS** (`Assets/Scripts/DecartWebRTCSession.ts`) owns the Decart `/v1/stream`
  signaling WebSocket (Lens `InternetModule`) + the prompt channel.
- **This module** owns the media: a `libSpecsWebRTC` session (manual signaling,
  **duplex**), camera → HW H.265 encode, and the return track → `SpecsMediaCodec`
  HW decode → NV12→RGBA → `getFrameRGBA()`.

Signaling bridge: native offer/ICE → `getSignalingOut()` → TS → WS; Decart
answer/ICE → TS → `setRemoteAnswer()` / `addRemoteCandidate()` → native.

## Exports (`assignNativeFunctions` in `DecartWebRTCModule.cpp`)

`ping`, `startSession(useH265, fps, bitrateKbps, cameraMaxWidth)`, `stopSession`,
`setRemoteAnswer(sdp)`, `addRemoteCandidate(candidate, mid)`, `getSignalingOut()`,
`getState()`, `getFrameRGBA()`. TS mirror: `DecartWebRTCNativeModule.ts`.

## The duplex engine requirement

Stock `libSpecsWebRTC` is **send XOR receive per session** (`specs_webrtc.cpp`:
`video_send = codec set && on_video_frame == nullptr`). A Decart round-trip needs
both on one PeerConnection. The compatible engine supplied with this package adds a `video_duplex` config flag: when set, the session
adds BOTH a sendonly (camera) and a recvonly (return) video m-line
(`setup_video_recv_track`).

## Build order

The WebRTC engine `libSpecsWebRTC.so` is already committed in the package under
`../Assets/DecartAI.lspkg/NativeModules/`, so rebuilding just the module links
against that committed engine directly:

```bash
bash ./build.sh "$SPECSNDK_ROOT"
```

To relink against a freshly built engine (the patched clone with `video_duplex`),
point `SPECS_WEBRTC_SO` at it:

```bash
SPECS_WEBRTC_SO="/path/to/rebuilt/libSpecsWebRTC.so" bash ./build.sh "$SPECSNDK_ROOT"
```

Both `.so`s are aarch64 ELFs landing in `../Assets/DecartAI.lspkg/NativeModules/`.
`build.sh` stages `libSpecsWebRTC.so` next to the module and links against it;
the `$ORIGIN` RUNPATH resolves the sibling engine on device.

## Status: what's implemented vs. needs on-device validation

**Implemented (compiles + links + loads):** the full send path (camera capture →
`swrtc_send_video_raw` HW encode), duplex negotiation (sendonly + recvonly
m-lines), the return-track decode (`SpecsMediaCodec` H.265 → NV12→RGBA →
`getFrameRGBA`), and the TS↔native signaling bridge + Decart WS client.

**Needs on-device + live-Decart iteration** (cannot be verified off-device):
1. **Duplex SDP shape** — whether Decart's `/v1/stream` accepts the sendonly+recvonly
   two-m-line offer, or expects a different structure. Most likely tuning point.
2. **Decoder color-format/stride** — `convert_nv12_to_rgba()` assumes NV12 tight
   stride; the SDK ships no color-format constant, so confirm via `getOutputFormat`
   on device and adjust if padded/I420/tiled.
3. **Decart ICE wire shape** — the `ice-candidate` JSON nesting in
   `DecartWebRTCSession.ts` follows the README; confirm against live Decart.
4. **ICE connectivity** — uses a public STUN server; add TURN if Decart requires it.

Until the round-trip connects, `getFrameRGBA()` returns a live gradient
(device-path-alive signal).

## Permissions

Set `INTERNET` (+ `CAMERA_RAW`) on the `NativeLibraryAsset` for BOTH
`libDecartWebRTCModule.so` and `libSpecsWebRTC.so` — select each in the Lens
Studio Inspector and add them (the native WebRTC sockets + camera need these at
the native-lib level).

## Deploy

1. Build (order above). 2. Set permissions (above). 3. Export an `.spk` (bundles
both `.so`s). 4. Install on the glasses. 5. `DecartRestyle` → `target = auto`
(or `device`), press Start.

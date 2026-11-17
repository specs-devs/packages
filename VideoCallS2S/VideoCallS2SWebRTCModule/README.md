# VideoCallS2SWebRTCModule

Native WebRTC module for Video Call S2S — the whole SPECS ↔ SPECS call runs on
one duplex PeerConnection created by this module (see `../WEBRTC-CALL.md`).
The SpecsWebRTC engine sources are vendored under `SpecsWebRTC/` and the camera
capture (`CameraCapture.cpp`) lives here too, so the folder is self-contained.
The package ships a prebuilt `.so`; SpecsNDK is required only to rebuild it.

## Download and configure SpecsNDK

**Download SpecsNDK from https://github.com/specs-devs/ndk.**
SpecsNDK is a separate download and is not included in this package or Lens Studio.

These native modules are built with **SpecsNDK 1.1 (1.1.0)**. Extract the
distribution into a directory you choose and point the build at it:

```bash
export SPECSNDK_ROOT="/path/to/extracted/SpecsNDK"

test -f "$SPECSNDK_ROOT/SpecsNDK-Toolchain-Clang.cmake"
test -f "$SPECSNDK_ROOT/sysroots/armv8a-snap-linux/usr/include/snap/corejs_abi/abi.h"
```

Both checks must succeed before building. Install the host prerequisites the
SDK distribution lists (CMake ≥ 3.25 and a Bash environment).

## WebRTC build dependencies

The module also needs matching, device-targeted **Opus and the patched
libdatachannel** headers and static libraries. They are not included in the
source ZIP; obtain the dependency bundle or build instructions from the SPECS
team — an arbitrary system libdatachannel is not a substitute (the engine relies
on the patched `rtcChain*` handlers).

Set the directory containing `opus/`, `libdatachannel/`, `build-opus/libopus.a`
and `build-dc/libdatachannel-static.a` (plus its dependent archives):

```bash
export SPECS_WEBRTC_THIRD_PARTY="/path/to/matching/third_party"
```

## Permissions (`INTERNET`)

`build.sh` runs `embed_permissions.py` after the link to write `INTERNET` into the
`.so`'s `.snap.permissions` section. Lens Studio copies that section into the
native asset's `Permissions:` on import; SnapOS denies `socket()` with `EACCES`
to a Lens without it, which kills every ICE candidate. The NDK's automatic embed
covers only annotated Specs APIs, so never drop this step. Verify:

```bash
"$SPECSNDK_ROOT"/sysroots/x86_64-specsndk-*/usr/bin/llvm-readelf -p .snap.permissions build/libVideoCallS2SWebRTCModule.so
```

## Build

From an Asset Library import, extract `ExtractAtProjectRoot/VideoCallS2SWebRTCModule.zip`
beside your project's `Assets/` directory. From this module's directory run:

```bash
bash ./build.sh "$SPECSNDK_ROOT"
```

The script copies `libVideoCallS2SWebRTCModule.so` into
`../Assets/VideoCallS2S.lspkg/Modules/`. Refresh Lens Studio after rebuilding,
send the Lens to both SPECS and test on the devices — the `.so` does not run in
the Lens Studio preview.

## Module generation

`ping()` returns the module generation. The Lens requires **3** (answerer role +
duplex audio) and refuses older builds with a caption on the call panel.

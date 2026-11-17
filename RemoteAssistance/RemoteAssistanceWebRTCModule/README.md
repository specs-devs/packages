# RemoteAssistanceWebRTCModule

Native WebRTC module for RemoteAssistance. The engine sources are included under
`SpecsWebRTC/`; the device-targeted third-party libraries are separate.
The package includes a prebuilt `.so`; SpecsNDK is required to rebuild it.

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

## WebRTC build dependencies

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

## Build

Extract both `RemoteAssistanceWebRTCModule/` and `RemoteAssistanceStreamModule/` beside your project's
`Assets/` directory. From this module's directory, run:

```bash
bash ./build.sh "$SPECSNDK_ROOT"
```

The script copies `libRemoteAssistanceWebRTCModule.so` into
`../Assets/RemoteAssistance.lspkg/Modules/`. It also accepts the SDK location through
the `SPECSNDK_ROOT` environment variable. Refresh Lens Studio after rebuilding,
export the Lens and test on a SPECS device.

# VideoCallS2MStreamModule

Native camera streaming module for VideoCallS2M. Its exports are `ping`,
`startStream`, `stopStream` and `getEncodedFrame`. The included package binary
runs on a SPECS device; rebuilding this C++ source requires SpecsNDK.

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

## Build

Extract this module beside your project's `Assets/` directory. From this
module's directory, run:

```bash
bash ./build.sh "$SPECSNDK_ROOT"
```

The script copies `libVideoCallS2MStreamModule.so` into
`../Assets/VideoCallS2M.lspkg/Modules/`. It also accepts the SDK location through
the `SPECSNDK_ROOT` environment variable.

For a CMake build without the copy step:

```bash
cmake -S . -B build -DSPECSNDK_ROOT="$SPECSNDK_ROOT" -DCMAKE_BUILD_TYPE=Release
cmake --build build
```

Refresh Lens Studio after rebuilding, export the Lens and test on a SPECS device.

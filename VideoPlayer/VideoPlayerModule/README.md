# VideoPlayerModule

Native video playback module for the VideoPlayer package. It wraps the
SpecsNDK **SpecsPlayer** API (`SpecsPlayer.h`, `libspecs_player.so`). Its
exports are `ping`, `open`, `play`, `pause`, `stop`, `seek`, `setLoop`,
`setVolume`, `getState`, `getLastError`, `getDuration`, `getPosition`,
`getMediaInfo`, `pullFrameInto`, `setMaxFrameSize` and `close`. The included
package binary runs on a SPECS device; rebuilding this C++ source requires
SpecsNDK.

## Download and configure SpecsNDK

**Download SpecsNDK from https://github.com/specs-devs/ndk.**
SpecsNDK is a separate download and is not included in this package or Lens Studio.

This module needs **SpecsNDK 1.1 (1.1.0)** or later: SpecsPlayer
(`snap-mediaplayer-ndk`) ships with it. Use the matching distribution for your
host, follow its installation instructions, and extract it into a directory you
choose. Replace the placeholder below with that absolute directory; no
particular username or workspace layout is required.

```bash
export SPECSNDK_ROOT="/path/to/extracted/SpecsNDK"

test -f "$SPECSNDK_ROOT/SpecsNDK-Toolchain-Clang.cmake"
test -f "$SPECSNDK_ROOT/sysroots/armv8a-snap-linux/usr/include/snap/corejs_abi/abi.h"
test -f "$SPECSNDK_ROOT/sysroots/armv8a-snap-linux/usr/include/SpecsPlayer.h"
grep Pkg.Revision "$SPECSNDK_ROOT/source.properties"   # Pkg.Revision=1.1.0
```

All checks must succeed before building. The root should contain the toolchain
file and `sysroots/` directly, rather than another nested SDK directory. Install
the host prerequisites specified by the SDK distribution, including CMake 3.25+
and Bash. Ninja is not needed; the default Unix Makefiles generator works.

## Build

Extract this module beside your project's `Assets/` directory. From this
module's directory, run:

```bash
bash ./build.sh "$SPECSNDK_ROOT"
```

The script builds `build/libVideoPlayerModule.so`, then strips it
(`llvm-strip --strip-unneeded`, which keeps exported symbols and the
permission manifest) into `../Assets/VideoPlayer.lspkg/Modules/`. It also
accepts the SDK location through the `SPECSNDK_ROOT` environment variable.

For a CMake build without the copy step:

```bash
cmake -S . -B build -DSPECSNDK_ROOT="$SPECSNDK_ROOT" -DCMAKE_BUILD_TYPE=Release
cmake --build build
```

## Permissions

The SpecsNDK 1.1.0 toolchain runs `specs-perm-embed` after the link. Because
the module imports `SpecsPlayer_open`, the `.snap.permissions` manifest lists
`INTERNET`. Check it with:

```bash
python3 "$SPECSNDK_ROOT"/sysroots/x86_64-*/usr/share/specsndk/specs-perm-read.py \
  ../Assets/VideoPlayer.lspkg/Modules/libVideoPlayerModule.so
```

## Design notes

- Video output mode `CALLBACK`; frames (RGBA, I420 or NV12) are converted to
  RGBA8, scaled down to fit the max size (default 1280×720, nearest-neighbour,
  aspect kept), flipped vertically for `ProceduralTextureProvider.setPixels`,
  and published to a mutex-guarded double buffer. `pullFrameInto` copies the
  newest one into a persistent JS `ArrayBuffer`.
- Audio output mode `SPEAKER`.
- `open` runs create → set callbacks / output modes → `SpecsPlayer_open` on a
  worker thread. Commands sent while opening are applied when it finishes.
- `close` and module unload join the worker, then call `SpecsPlayer_close`
  (no callbacks after it returns) and `SpecsPlayer_destroy`.

Refresh Lens Studio after rebuilding, export the Lens and test on a SPECS device.

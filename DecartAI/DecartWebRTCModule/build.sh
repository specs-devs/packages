#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BUILD_DIR="${SCRIPT_DIR}/build"
# Output directory for the built .so — the package's own NativeModules folder
# (where libDecartWebRTCModule.so + libSpecsWebRTC.so are committed and where the
# Lens loads them from). Override with OUTPUT_SO_DIR=... to stage elsewhere.
OUTPUT_SO_DIR="${OUTPUT_SO_DIR:-${SCRIPT_DIR}/../Assets/DecartAI.lspkg/NativeModules}"

# Explicit SDK location: positional argument takes precedence over the environment.
SPECSNDK_ROOT_ARG="${1:-${SPECSNDK_ROOT:-}}"
if [[ -z "$SPECSNDK_ROOT_ARG" ]]; then
  echo "ERROR: Download SpecsNDK from https://github.com/specs-devs/ndk." >&2
  echo "Set SPECSNDK_ROOT or pass the extracted SDK root as the first argument. See README.md." >&2
  exit 2
fi
if [[ ! -f "$SPECSNDK_ROOT_ARG/SpecsNDK-Toolchain-Clang.cmake" ||
      ! -f "$SPECSNDK_ROOT_ARG/sysroots/armv8a-snap-linux/usr/include/snap/corejs_abi/abi.h" ]]; then
  echo "ERROR: SDK root must contain SpecsNDK-Toolchain-Clang.cmake and sysroots/ (see README.md)." >&2
  exit 2
fi

# Prebuilt libSpecsWebRTC.so (aarch64) the module links against — the engine CLONE
# with the video_duplex patch. Defaults to the copy already committed in
# OUTPUT_SO_DIR. To relink against a freshly built engine, set
# SPECS_WEBRTC_SO=/path/to/libSpecsWebRTC.so (e.g. a SpecsWebRTC clone's build/).
SPECS_WEBRTC_SO="${SPECS_WEBRTC_SO:-${OUTPUT_SO_DIR}/libSpecsWebRTC.so}"

mkdir -p "${OUTPUT_SO_DIR}"

# Stage the WebRTC engine next to the module so linking (-L) and runtime ($ORIGIN)
# both resolve it. Skip the copy when SPECS_WEBRTC_SO already IS the committed engine.
if [[ -f "${SPECS_WEBRTC_SO}" ]]; then
  if [[ "$(cd "$(dirname "${SPECS_WEBRTC_SO}")" && pwd)/$(basename "${SPECS_WEBRTC_SO}")" != "$(cd "${OUTPUT_SO_DIR}" && pwd)/libSpecsWebRTC.so" ]]; then
    cp "${SPECS_WEBRTC_SO}" "${OUTPUT_SO_DIR}/"
    echo "Staged libSpecsWebRTC.so from ${SPECS_WEBRTC_SO}"
  else
    echo "Using committed libSpecsWebRTC.so in ${OUTPUT_SO_DIR}"
  fi
else
  echo "ERROR: libSpecsWebRTC.so not found at ${SPECS_WEBRTC_SO}" >&2
  echo "       The engine is committed at Assets/DecartAI.lspkg/NativeModules/libSpecsWebRTC.so;" >&2
  echo "       set SPECS_WEBRTC_SO=/path/to/libSpecsWebRTC.so to link a rebuilt engine." >&2
  exit 1
fi

cmake -S "${SCRIPT_DIR}" -B "${BUILD_DIR}" \
  -DSPECSNDK_ROOT="${SPECSNDK_ROOT_ARG}" \
  -DSPECS_WEBRTC_LIB_DIR="${OUTPUT_SO_DIR}" \
  -DCMAKE_BUILD_TYPE=Release
cmake --build "${BUILD_DIR}"

# Strip on copy (keeps .dynsym and the .snap.permissions manifest): roughly 25% smaller .so,

# which keeps Lens SPKs further under the Developer Portal upload limit. build/ keeps the

# unstripped library for debugging.

STRIP_TOOL="$(ls "${SPECSNDK_ROOT_ARG}"/sysroots/x86_64-*/usr/bin/llvm-strip 2>/dev/null | head -1)"

if [[ -n "$STRIP_TOOL" ]]; then

  "$STRIP_TOOL" --strip-unneeded -o "${OUTPUT_SO_DIR}/libDecartWebRTCModule.so" "${BUILD_DIR}/libDecartWebRTCModule.so"

else

  cp "${BUILD_DIR}/libDecartWebRTCModule.so" "${OUTPUT_SO_DIR}/"

fi
echo "Copied libDecartWebRTCModule.so to ${OUTPUT_SO_DIR}"
echo "Built DecartWebRTCModule successfully."

#!/usr/bin/env bash
#
# build.sh — cross-compile libRemoteAssistanceWebRTCModule.so for the Glasses device and
# copy it into Assets/NativeModules. The SpecsWebRTC engine is compiled IN
# (self-contained .so — the device loader can't resolve sibling NEEDED libs).
#
# Prerequisites: SpecsNDK (https://github.com/specs-devs/ndk) and matching WebRTC dependencies.
# See this module's README.md.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BUILD_DIR="${SCRIPT_DIR}/build"
# NOTE: the Lens loads the .so from Assets/RemoteAssistance.lspkg/Modules (see
# WebRTCNativeModule.ts requireAsset) — NOT "NativeModules".
OUTPUT_SO_DIR="${SCRIPT_DIR}/../Assets/RemoteAssistance.lspkg/Modules"

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
# The engine source is vendored in-tree (SpecsWebRTC/): Decart engine (video_duplex,
# codec-based track ID) + XR-AI receive-side audio hardening (jitter buffer, Opus PLC,
# RED unwrap). The prebuilt third-party archives (opus, libdatachannel) are NOT
# committed — build them into SpecsWebRTC/third_party (see README.md), or set
# SPECS_WEBRTC_THIRD_PARTY=/path/to/third_party to point at an existing build.
# NOTE: libdatachannel must be the DECART-PATCHED rev (has rtcChain* depacketizer
# APIs); a stock/newer rev will NOT link against this vendored engine.
SPECS_WEBRTC_THIRD_PARTY="${SPECS_WEBRTC_THIRD_PARTY:-${SCRIPT_DIR}/SpecsWebRTC/third_party}"

cmake -S "${SCRIPT_DIR}" -B "${BUILD_DIR}" \
  -DSPECSNDK_ROOT="${SPECSNDK_ROOT_ARG}" \
  -DSPECS_WEBRTC_THIRD_PARTY="${SPECS_WEBRTC_THIRD_PARTY}" \
  -DCMAKE_BUILD_TYPE=Release
cmake --build "${BUILD_DIR}"

mkdir -p "${OUTPUT_SO_DIR}"
# Strip on copy (keeps .dynsym and the .snap.permissions manifest): roughly 25% smaller .so,
# which keeps Lens SPKs further under the Developer Portal upload limit. build/ keeps the
# unstripped library for debugging.
STRIP_TOOL="$(ls "${SPECSNDK_ROOT_ARG}"/sysroots/x86_64-*/usr/bin/llvm-strip 2>/dev/null | head -1)"
if [[ -n "$STRIP_TOOL" ]]; then
  "$STRIP_TOOL" --strip-unneeded -o "${OUTPUT_SO_DIR}/libRemoteAssistanceWebRTCModule.so" "${BUILD_DIR}/libRemoteAssistanceWebRTCModule.so"
else
  cp "${BUILD_DIR}/libRemoteAssistanceWebRTCModule.so" "${OUTPUT_SO_DIR}/"
fi
echo "Copied libRemoteAssistanceWebRTCModule.so to ${OUTPUT_SO_DIR}"

echo "Built RemoteAssistanceWebRTCModule successfully."

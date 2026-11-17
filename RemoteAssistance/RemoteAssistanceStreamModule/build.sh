#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BUILD_DIR="${SCRIPT_DIR}/build"
# Optional output directory for the built .so.
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

cmake -S "${SCRIPT_DIR}" -B "${BUILD_DIR}" \
  -DSPECSNDK_ROOT="${SPECSNDK_ROOT_ARG}" \
  -DCMAKE_BUILD_TYPE=Release
cmake --build "${BUILD_DIR}"

if [[ -n "${OUTPUT_SO_DIR:-}" ]]; then
  mkdir -p "${OUTPUT_SO_DIR}"
  # Strip on copy (keeps .dynsym and the .snap.permissions manifest): roughly 25% smaller .so,
  # which keeps Lens SPKs further under the Developer Portal upload limit. build/ keeps the
  # unstripped library for debugging.
  STRIP_TOOL="$(ls "${SPECSNDK_ROOT_ARG}"/sysroots/x86_64-*/usr/bin/llvm-strip 2>/dev/null | head -1)"
  if [[ -n "$STRIP_TOOL" ]]; then
    "$STRIP_TOOL" --strip-unneeded -o "${OUTPUT_SO_DIR}/libRemoteAssistanceStreamModule.so" "${BUILD_DIR}/libRemoteAssistanceStreamModule.so"
  else
    cp "${BUILD_DIR}/libRemoteAssistanceStreamModule.so" "${OUTPUT_SO_DIR}/"
  fi
  echo "Copied libRemoteAssistanceStreamModule.so to ${OUTPUT_SO_DIR}"
fi

echo "Built RemoteAssistanceStreamModule successfully."

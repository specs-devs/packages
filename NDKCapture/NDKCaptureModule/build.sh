#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BUILD_DIR="${SCRIPT_DIR}/build"
# Optional output directory for the built .so.
OUTPUT_SO_DIR="${SCRIPT_DIR}/../Assets/NDKCapture.lspkg/Modules"

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
  cp "${BUILD_DIR}/libNDKCaptureModule.so" "${OUTPUT_SO_DIR}/"
  echo "Copied libNDKCaptureModule.so to ${OUTPUT_SO_DIR}"
fi

echo "Built NDKCaptureModule successfully."

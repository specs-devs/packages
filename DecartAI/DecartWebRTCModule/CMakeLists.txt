cmake_minimum_required(VERSION 3.25)
include_guard(GLOBAL)

set(SPECSNDK_ROOT "$ENV{SPECSNDK_ROOT}" CACHE PATH "Path to the extracted SpecsNDK root")
if(SPECSNDK_ROOT STREQUAL "")
  message(FATAL_ERROR
    "Download SpecsNDK from https://github.com/specs-devs/ndk. "
    "Set SPECSNDK_ROOT or pass -DSPECSNDK_ROOT=/path/to/SpecsNDK. See README.md.")
endif()

if(NOT IS_ABSOLUTE "${SPECSNDK_ROOT}")
  get_filename_component(SPECSNDK_ROOT "${CMAKE_CURRENT_SOURCE_DIR}/${SPECSNDK_ROOT}" ABSOLUTE)
endif()

set(SPECSNDK_TOOLCHAIN_FILE "${SPECSNDK_ROOT}/SpecsNDK-Toolchain-Clang.cmake")
set(SPECSNDK_SNAP_INCLUDE "${SPECSNDK_ROOT}/sysroots/armv8a-snap-linux/usr/include/snap")

if(NOT EXISTS "${SPECSNDK_TOOLCHAIN_FILE}")
  message(FATAL_ERROR "Could not find toolchain file at: ${SPECSNDK_TOOLCHAIN_FILE}")
endif()

if(NOT EXISTS "${SPECSNDK_SNAP_INCLUDE}/corejs_abi/abi.h")
  message(FATAL_ERROR "Could not find corejs_abi headers under: ${SPECSNDK_SNAP_INCLUDE}")
endif()

if(NOT CMAKE_TOOLCHAIN_FILE)
  set(CMAKE_TOOLCHAIN_FILE "${SPECSNDK_TOOLCHAIN_FILE}" CACHE FILEPATH "SpecsNDK toolchain file")
endif()

project(DecartWebRTCModule)

if(NOT CMAKE_BUILD_TYPE)
  set(CMAKE_BUILD_TYPE Release CACHE STRING "Build type" FORCE)
endif()

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

# Directory that holds libSpecsWebRTC.so at link + run time — the package's own
# NativeModules folder (where the engine is committed and the Lens loads it from).
# build.sh stages the prebuilt engine here before building.
set(SPECS_WEBRTC_LIB_DIR "${CMAKE_CURRENT_SOURCE_DIR}/../Assets/DecartAI.lspkg/NativeModules"
    CACHE PATH "Directory containing libSpecsWebRTC.so")

add_library(DecartWebRTCModule SHARED
  DecartWebRTCModule.cpp
  CameraStreamer.cpp
  DecartWebRTCModule.hpp
  HostFunctionWrapper.hpp
  CameraStreamer.hpp
)

target_include_directories(DecartWebRTCModule PRIVATE
  "${SPECSNDK_SNAP_INCLUDE}"                                   # corejs_abi/abi.h
  "${SPECSNDK_ROOT}/sysroots/armv8a-snap-linux/usr/include"    # SpecsMediaCodec.h, SpecsCamera*.h
  "${CMAKE_CURRENT_SOURCE_DIR}"                                # specs_webrtc.h (copied in)
)

target_link_directories(DecartWebRTCModule PRIVATE "${SPECS_WEBRTC_LIB_DIR}")

target_link_libraries(DecartWebRTCModule PRIVATE
  SpecsWebRTC     # swrtc_* C ABI: ICE/DTLS-SRTP/RTP + HW H.264/H.265 (libSpecsWebRTC.so)
  specs_media     # SpecsMediaCodec HW encode/decode (libspecs_media.so — device system lib)
  specs_camera    # SpecsCamera native capture (libspecs_camera.so — device system lib)
  pthread         # std::mutex / worker-thread callbacks
)

# Resolve the sibling libSpecsWebRTC.so from the module's own directory at load time
# (both live in Assets/NativeModules on device). libSpecsWebRTC's transitive deps
# (specs_media, ssl, ...) are device system libs resolved at runtime.
set_target_properties(DecartWebRTCModule PROPERTIES
  BUILD_RPATH "$ORIGIN"
  INSTALL_RPATH "$ORIGIN")
target_link_options(DecartWebRTCModule PRIVATE "-Wl,--allow-shlib-undefined")

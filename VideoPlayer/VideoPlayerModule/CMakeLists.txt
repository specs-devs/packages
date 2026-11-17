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
set(SPECSNDK_SYSROOT_INCLUDE "${SPECSNDK_ROOT}/sysroots/armv8a-snap-linux/usr/include")
set(SPECSNDK_SYSROOT_LIB "${SPECSNDK_ROOT}/sysroots/armv8a-snap-linux/usr/lib")

if(NOT EXISTS "${SPECSNDK_TOOLCHAIN_FILE}")
  message(FATAL_ERROR "Could not find toolchain file at: ${SPECSNDK_TOOLCHAIN_FILE}")
endif()

if(NOT EXISTS "${SPECSNDK_SNAP_INCLUDE}/corejs_abi/abi.h")
  message(FATAL_ERROR "Could not find corejs_abi headers under: ${SPECSNDK_SNAP_INCLUDE}")
endif()

if(NOT EXISTS "${SPECSNDK_SYSROOT_INCLUDE}/SpecsPlayer.h")
  message(FATAL_ERROR
    "Could not find SpecsPlayer.h under: ${SPECSNDK_SYSROOT_INCLUDE}. "
    "VideoPlayerModule needs SpecsNDK 1.1.0 or later (snap-mediaplayer-ndk).")
endif()

if(NOT CMAKE_TOOLCHAIN_FILE)
  set(CMAKE_TOOLCHAIN_FILE "${SPECSNDK_TOOLCHAIN_FILE}" CACHE FILEPATH "SpecsNDK toolchain file")
endif()

project(VideoPlayerModule)

if(NOT CMAKE_BUILD_TYPE)
  set(CMAKE_BUILD_TYPE Release CACHE STRING "Build type" FORCE)
endif()

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

add_library(VideoPlayerModule SHARED
  VideoPlayerModule.cpp
  VideoPlayerModule.hpp
  HostFunctionWrapper.hpp
)

target_include_directories(VideoPlayerModule PRIVATE
  "${SPECSNDK_SNAP_INCLUDE}"     # corejs_abi/abi.h
  "${SPECSNDK_SYSROOT_INCLUDE}"  # SpecsPlayer.h
)

# SpecsPlayer (media playback) lives in libspecs_player.so, a device system library.
find_library(SPECS_PLAYER_LIB NAMES specs_player PATHS "${SPECSNDK_SYSROOT_LIB}" NO_DEFAULT_PATH)
if(NOT SPECS_PLAYER_LIB)
  message(FATAL_ERROR "Could not find libspecs_player in: ${SPECSNDK_SYSROOT_LIB}")
endif()

target_link_libraries(VideoPlayerModule PRIVATE
  "${SPECS_PLAYER_LIB}"  # SpecsPlayer_* (imports SpecsPlayer_open -> INTERNET permission)
  pthread                # open worker thread + callback synchronisation
)

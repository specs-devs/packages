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

project(NDKCaptureModule)

if(NOT CMAKE_BUILD_TYPE)
  set(CMAKE_BUILD_TYPE Release CACHE STRING "Build type" FORCE)
endif()

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

add_library(NDKCaptureModule SHARED
  NDKCaptureModule.cpp
  NDKCaptureModule.hpp
  CameraCapture.cpp
  CameraCapture.hpp
  JpegEncoder.hpp
  HostFunctionWrapper.hpp
)

set(SPECSNDK_SYSROOT_INCLUDE "${SPECSNDK_ROOT}/sysroots/armv8a-snap-linux/usr/include")
set(SPECSNDK_SYSROOT_LIB "${SPECSNDK_ROOT}/sysroots/armv8a-snap-linux/usr/lib")

target_include_directories(NDKCaptureModule PRIVATE
  "${SPECSNDK_SNAP_INCLUDE}"
  "${SPECSNDK_SYSROOT_INCLUDE}"  # SpecsRecorder.h / SpecsCapture.h / SpecsCameraManager.h
)

# NDK 1.1.0 is required: SpecsRecorder_CreateParams_t (AR video / audio stream types) and the
# renamed SpecsCapture modes only exist from 1.1.0 on.
if(NOT EXISTS "${SPECSNDK_SYSROOT_INCLUDE}/SpecsNDKVersion.h")
  message(FATAL_ERROR "NDKCapture needs SpecsNDK 1.1.0 or newer (SpecsNDKVersion.h not found).")
endif()

# SpecsRecorder + SpecsCapture live in libspecs_media.so; SpecsCameraManager in libspecs_camera.so.
find_library(SPECS_MEDIA_LIB NAMES specs_media PATHS "${SPECSNDK_SYSROOT_LIB}" NO_DEFAULT_PATH)
find_library(SPECS_CAMERA_LIB NAMES specs_camera PATHS "${SPECSNDK_SYSROOT_LIB}" NO_DEFAULT_PATH)
if(NOT SPECS_MEDIA_LIB OR NOT SPECS_CAMERA_LIB)
  message(FATAL_ERROR "Could not find libspecs_media / libspecs_camera in: ${SPECSNDK_SYSROOT_LIB}")
endif()

target_link_libraries(NDKCaptureModule PRIVATE
  "${SPECS_MEDIA_LIB}"   # SpecsRecorder (camera / AR / mic layers) + SpecsCapture (composite MP4)
  "${SPECS_CAMERA_LIB}"  # SpecsCameraManager (JPEG preview proxy)
  pthread                # proxy encoder thread
)

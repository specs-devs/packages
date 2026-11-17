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

project(VideoCallS2SWebRTCModule)

if(NOT CMAKE_BUILD_TYPE)
  set(CMAKE_BUILD_TYPE Release CACHE STRING "Build type" FORCE)
endif()

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

# --- WebRTC engine: compiled IN, not linked as a shared dependency. ---
# The Lens deploys each native-library asset to its own path on device, so a
# NEEDED sibling (libSpecsWebRTC.so + $ORIGIN rpath) does NOT resolve there
# (observed on device: "libSpecsWebRTC.so: cannot open shared object file").
# Instead the engine sources + static third-party archives are embedded, making
# libVideoCallS2SWebRTCModule.so fully self-contained.
#
# The engine source is VENDORED in-tree (SpecsWebRTC/): the Decart engine
# (video_duplex + codec-based track ID) plus the XR-AI rev's receive-side audio
# hardening (reordering jitter buffer, Opus PLC, RED unwrap, rx stats). Only the
# prebuilt third-party archives still come from the external Decart checkout.
set(SPECS_WEBRTC_DIR "${CMAKE_CURRENT_SOURCE_DIR}/SpecsWebRTC")
set(SPECS_WEBRTC_THIRD_PARTY
    "${CMAKE_CURRENT_SOURCE_DIR}/SpecsWebRTC/third_party"
    CACHE PATH "Prebuilt libdatachannel/opus archives + headers (Decart checkout)")
set(DC_DIR "${SPECS_WEBRTC_THIRD_PARTY}/libdatachannel")
set(OPUS_DIR "${SPECS_WEBRTC_THIRD_PARTY}/opus")
set(DC_BUILD "${SPECS_WEBRTC_THIRD_PARTY}/build-dc")
set(OPUS_BUILD "${SPECS_WEBRTC_THIRD_PARTY}/build-opus")

if(NOT EXISTS "${DC_BUILD}/libdatachannel-static.a" OR NOT EXISTS "${OPUS_BUILD}/libopus.a")
  message(FATAL_ERROR
    "SpecsWebRTC third-party archives not found under ${SPECS_WEBRTC_THIRD_PARTY}.\n"
    "Obtain the matching dependencies from the SPECS team and set SPECS_WEBRTC_THIRD_PARTY (see README.md).")
endif()

add_library(VideoCallS2SWebRTCModule SHARED
  VideoCallS2SWebRTCModule.cpp
  VideoCallS2SWebRTCModule.hpp
  HostFunctionWrapper.hpp
  SpeakerPlayback.cpp
  SpeakerPlayback.hpp
  MicCapture.cpp
  MicCapture.hpp
  AudioFocusSession.cpp
  AudioFocusSession.hpp
  CameraCapture.cpp
  CameraCapture.hpp
  "${SPECS_WEBRTC_DIR}/src/specs_webrtc.cpp"
  "${SPECS_WEBRTC_DIR}/src/hw_video_encoder.cpp"
)

set(SPECSNDK_SYSROOT_INCLUDE "${SPECSNDK_ROOT}/sysroots/armv8a-snap-linux/usr/include")
set(SPECSNDK_SYSROOT_LIB "${SPECSNDK_ROOT}/sysroots/armv8a-snap-linux/usr/lib")

target_include_directories(VideoCallS2SWebRTCModule PRIVATE
  "${SPECSNDK_SNAP_INCLUDE}"
  "${SPECSNDK_SYSROOT_INCLUDE}"       # SpecsCameraManager.h / SpecsMediaCodec.h
  "${SPECS_WEBRTC_DIR}/include"       # specs_webrtc.h (C ABI)
  "${DC_DIR}/include"                 # rtc/rtc.h (engine-internal)
  "${OPUS_DIR}/include"               # opus.h (engine-internal)
)

# Engine build flags (mirrors SpecsWebRTC/CMakeLists.txt device target).
target_compile_definitions(VideoCallS2SWebRTCModule PRIVATE RTC_STATIC SWRTC_HW_ENCODER=1)
# Keep third-party symbols out of the module's export table; CoreJsOnLoad/Unload
# carry explicit default-visibility attributes.
target_compile_options(VideoCallS2SWebRTCModule PRIVATE -fvisibility=hidden -fvisibility-inlines-hidden)

find_library(SPECS_CAMERA_LIB NAMES specs_camera PATHS "${SPECSNDK_SYSROOT_LIB}" NO_DEFAULT_PATH)
if(NOT SPECS_CAMERA_LIB)
  message(FATAL_ERROR "Could not find libspecs_camera in: ${SPECSNDK_SYSROOT_LIB}")
endif()
find_library(SPECS_MEDIA_LIB NAMES specs_media PATHS "${SPECSNDK_SYSROOT_LIB}" NO_DEFAULT_PATH)
if(NOT SPECS_MEDIA_LIB)
  message(FATAL_ERROR "Could not find libspecs_media in: ${SPECSNDK_SYSROOT_LIB}")
endif()

# SpecsAudioPlayback (native speaker output for friend voice) — see SpeakerPlayback.cpp.
find_library(SPECS_AUDIO_PLAYBACK_LIB NAMES specs_audio_playback PATHS "${SPECSNDK_SYSROOT_LIB}" NO_DEFAULT_PATH)
if(NOT SPECS_AUDIO_PLAYBACK_LIB)
  message(FATAL_ERROR "Could not find libspecs_audio_playback in: ${SPECSNDK_SYSROOT_LIB}")
endif()

# SpecsAudioRecord (native echo-cancelled mic capture) — see MicCapture.cpp.
find_library(SPECS_AUDIO_RECORD_LIB NAMES specs_audio_record PATHS "${SPECSNDK_SYSROOT_LIB}" NO_DEFAULT_PATH)
if(NOT SPECS_AUDIO_RECORD_LIB)
  message(FATAL_ERROR "Could not find libspecs_audio_record in: ${SPECSNDK_SYSROOT_LIB}")
endif()

# SpecsForegroundAudio (AUDIO_IN_OUT focus session) — see AudioFocusSession.cpp.
find_library(SPECS_FOREGROUND_AUDIO_LIB NAMES specs_foreground_audio PATHS "${SPECSNDK_SYSROOT_LIB}" NO_DEFAULT_PATH)
if(NOT SPECS_FOREGROUND_AUDIO_LIB)
  message(FATAL_ERROR "Could not find libspecs_foreground_audio in: ${SPECSNDK_SYSROOT_LIB}")
endif()

target_link_libraries(VideoCallS2SWebRTCModule PRIVATE
  "${DC_BUILD}/libdatachannel-static.a"
  "${DC_BUILD}/deps/libjuice/libjuice-static.a"
  "${DC_BUILD}/deps/libsrtp/libsrtp2.a"
  "${DC_BUILD}/deps/usrsctp/usrsctplib/libusrsctp.a"
  "${OPUS_BUILD}/libopus.a"
  "${SPECS_MEDIA_LIB}"   # SpecsMediaCodec hardware H.264 encode
  "${SPECS_CAMERA_LIB}"  # SpecsCameraManager continuous capture
  "${SPECS_AUDIO_PLAYBACK_LIB}"  # SpecsAudioPlayback (native friend-voice speaker)
  "${SPECS_AUDIO_RECORD_LIB}"    # SpecsAudioRecord (native echo-cancelled mic)
  "${SPECS_FOREGROUND_AUDIO_LIB}" # SpecsForegroundAudio (AUDIO_IN_OUT focus)
  ssl crypto pthread dl  # DTLS-SRTP via sysroot OpenSSL 3
)

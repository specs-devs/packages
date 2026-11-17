# NDKCaptureModule

Native module for NDK Capture (`libNDKCaptureModule.so`, aarch64), built with **SpecsNDK 1.1.0**
(get it from https://github.com/specs-devs/ndk).

- `NDKCaptureModule.cpp` — the CoreJS exports: one `SpecsRecorder` session per layer (`camera` =
  VIDEO, `ar` = AR_VIDEO, `mic` = AUDIO), packet streaming and NKC1 track files, the JPEG camera
  proxy, the `SpecsCapture` composite MP4, `stats()`
- `CameraCapture.cpp/.hpp` — continuous SpecsCamera stream for the proxy
- `JpegEncoder.hpp` — baseline JPEG encoder for YUV 4:2:0 (header-only)
- `HostFunctionWrapper.hpp` — CoreJS host-function adapter

Build (macOS, Windows or Linux SDK host):

```bash
./build.sh /path/to/SpecsNDK-1.1.0      # or SPECSNDK_ROOT=/path/to/SpecsNDK-1.1.0 ./build.sh
```

The `.so` is copied into `../Assets/NDKCapture.lspkg/Modules/`. `specs-perm-embed` (run by the
SDK toolchain) embeds `.snap.permissions`: `CAMERA_RAW`, `MICROPHONE_RAW`, `GPS_RAW`. CMake stops
if the SDK is older than 1.1.0. Exports and formats: `NDKCapture.lspkg/Docs/native-module.md`.

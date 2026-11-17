# NDK Capture — native module

`Modules/libNDKCaptureModule.so` (aarch64) is built from `NDKCaptureModule/` with the **SpecsNDK
1.1.0** toolchain. `specs-perm-embed` writes its `.snap.permissions`: `CAMERA_RAW`,
`MICROPHONE_RAW`, `GPS_RAW` (the set `SpecsCapture` requires in 1.1.0). It links
`libspecs_media.so.1` (SpecsRecorder, SpecsCapture) and `libspecs_camera.so.1` (the proxy).

## Exports (`Scripts/NDKCaptureNativeModule.ts`)

| Export | Does |
|---|---|
| `ping()`, `version()`, `clockNs()` | health, version string, packet clock |
| `configureLayer(layer, fps, bitrate, keyFrameInterval, rateControl, extra)` | settings for the next start; `extra` = AR eye or mic sample rate |
| `startLayer(layer)` / `stopLayer(layer)` | create / destroy the layer's SpecsRecorder session |
| `streamLayer(layer, on)` / `pollLayer(layer, maxBytes)` | queue encoded packets (4 MB cap, oldest dropped) and take them as base64 NKC1 |
| `recordLayer(layer, path, headerJson)` | write the layer to an NKC1 track file; `path ""` closes it |
| `layerAction(layer, action, value)` | `0` key frame, `1` target bitrate |
| `stats()` | JSON: per-layer running / frames / key frames / bytes / dropped / errors, proxy, composite |
| `startProxy(maxWidth, quality, fps)` / `stopProxy()` / `proxyFrame()` | JPEG camera proxy |
| `startComposite(path, withAr, blend, alpha, width, height, bitrate, durationSec)` / `stopComposite()` | SpecsCapture MP4 |

## SpecsNDK 1.1.0 APIs used

- `SpecsRecorder_create(&rec, &SpecsRecorder_CreateParams_t{streamType, videoCodec, audioCodec,
  arCameraPosition}, cb, ctx)` (1.1.0 signature; the macro maps to `SpecsRecorder_createWithParams`)
- `SpecsRecorder_Config_t` `video` / `ar` / `audio` members, `configSet`, `streamStart`, `streamStop`,
  `SpecsRecorder_action` (`REQUEST_KEY_FRAME`, `TARGET_BITRATE`)
- `SpecsCapture_create` / `_start` / `_stop` / `_destroy` with `SPECSCAPTURE_MODE_VIDEO_WITH_AR_AND_AUDIO`
  (1.1.0 name) or `_VIDEO_AND_AUDIO`, `arBlendMode`, `arAlpha`, an `O_RDWR` output fd
- `SpecsCamera` continuous stream for the proxy (stream notifications use the 1.1.0 values)

Rate control: with a layer bitrate of 0 the component keeps `SPECSMEDIA_RATE_CONTROL_DISABLE`
(constant QP, the 1.1.0 default, where bitrate is ignored); any bitrate above 0 selects CBR (`1`).

## Building

```bash
NDKCaptureModule/build.sh /path/to/SpecsNDK-1.1.0   # or SPECSNDK_ROOT=... build.sh
```

CMake 3.25+ and the SDK's toolchain file; on macOS the SDK's x86_64 clang runs under Rosetta.
CMake refuses SDKs without `SpecsNDKVersion.h` (older than 1.1.0).

## Not validated off-device

Everything native runs only on Specs. Built and link-checked here; on-device behaviour (the camera
being shared by `SpecsRecorder VIDEO` and the proxy's `SpecsCamera` stream, the AR eye default,
the AAC frame format, writable device folders) is listed in [API status](api-status.md).

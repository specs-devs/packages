# NDK Capture — API status (4.0.0)

## Current

- `NDKCapture` component inputs and methods ([components](components.md))
- `LayerId`, `LayerSettings`, `Marker`, `SessionManifest`, `sanitizeSettings` (`NDKCaptureProtocol`)
- The `ndkcapture/1` manifest, chunk files, NKC1 packets and `ndkcapture-edits/1` ([format](format.md))
- Plugin API and Lens messages ([format](format.md))
- Native exports ([native module](native-module.md))

## Internal

- `StudioLink` internals, the Studio's `window.ndkcapture` test hook, `tools/make-sample.py`

## Device validation status

| Area | Status |
|---|---|
| Lens Studio Preview: stream, live edits, record, edit, export | Tested (Lens Studio 5.25.0.26100705) |
| Studio editor (sample recording, headless Chrome) | Tested |
| Native module build + permissions + link | Tested (SpecsNDK 1.1.0, macOS) |
| SpecsRecorder camera / AR / mic sessions on Specs | Not yet validated on device |
| Camera proxy alongside SpecsRecorder VIDEO | Not yet validated (the camera may refuse a second client; the proxy then reports unavailable) |
| SpecsCapture composite MP4 and Device Folder writes | Not yet validated on device |

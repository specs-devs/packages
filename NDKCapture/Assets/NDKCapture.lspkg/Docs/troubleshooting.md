# NDK Capture — troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Logger: `Lens Studio blocks ws:// URLs unless Experimental APIs are enabled` | Experimental APIs off | Project Settings → Experimental APIs |
| Status `Studio not connected` | Plugin not running, wrong URL, or (Specs) LAN mode off | Window → NDKCapture → Restart Server; check Studio Url; Accept Specs on my network |
| Studio page says *not unpacked yet* | `NDKCaptureStudio/` missing at the project root | Unzip `ExtractAtProjectRoot/NDKCaptureStudio.zip` next to `Assets/` |
| AR layer missing in Live | **AR Texture** not assigned | Assign the main camera's render target |
| UI/AR layer covers everything in black | Blend `normal` on a JPEG proxy (no alpha) | Use `screen` or `add` |
| `Couldn't start the camera layer (-…)` on Specs | SpecsRecorder refused (permissions, camera busy) | Make sure no other component requests the camera; check `stats().layers.camera.error` |
| `Camera proxy unavailable` | The camera already has a client | Expected when SpecsRecorder holds the camera; the native camera track still records |
| A new fps / key-frame interval has no effect | Applied on the next layer start | Switch the layer off and on (Studio On), or restart the stream |
| Recording missing after a crash | Chunks flush every 2 s | The folder still opens; `manifest.interrupted` is true |

# NDK Capture — cheat sheet

- One `NDKCapture` per Lens. It owns the camera on Specs (native layers + the JPEG proxy): don't
  also request the camera with `CameraModule` in the same Lens, a second camera client evicts the first.
- Layers are `camera`, `ar`, `ui`, `mic`. Only `camera`, `ar` and `mic` are native (SpecsRecorder);
  `ui` is proxy-only. The editor has no `mic` and no native packets.
- Proxies are JPEG (no alpha). AR and UI default to blend `screen` (black is transparent, like the
  Specs display); keep them on `screen` or `add` unless the layer is opaque.
- `setLayer(layer, patch)` is the one way to change a layer. It reaches the native encoder
  (bitrate live, fps / key-frame interval on the next layer start) and is logged into the recording.
- Recordings are written by the Studio plugin. With no Studio connected, nothing is saved unless
  **Device Folder** is set on Specs.
- Local `ws://` needs **Project Settings → Experimental APIs**. On Specs, turn on **Accept Specs on
  my network** in the plugin panel and point **Studio Url** at your computer's LAN address.
- After changing the C++, rebuild with SpecsNDK **1.1.0** (`NDKCaptureModule/build.sh`); 1.0.0
  headers don't have the AR / audio stream types.
- Edits live in `edits.json`; never edit the recorded chunks.

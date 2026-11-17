<p align="center">
  <img src="./Assets/AssetImage/NDKCapture.png" width="250px" alt="NDK Capture"/>
</p>

# NDK Capture

Streaming and capture in one asset, built on **SpecsNDK 1.1.0**. A Lens streams its layers live and
records them as separate tracks, so you can change the composite while streaming and again later:

- **Layers.** `camera` (natural camera video), `ar` (the rendered AR overlay), `ui` (an optional
  extra render target) and `mic` (audio). On Specs, camera, AR and mic are three independent
  `SpecsRecorder` sessions in the native module (H.265 / AAC; the AR and audio stream types are new
  in NDK 1.1.0). Every visual layer also has a low-rate JPEG proxy for previews and editing.
- **Stream.** The layers go live to the **NDK Capture Studio** (served by the package's Lens Studio
  plugin at `http://127.0.0.1:47792`), which composites them. Each layer has its own controls:
  on/off, opacity, blend, order, position, scale, rotation, proxy rate and, on Specs, encoder fps,
  bitrate and key-frame interval. Changes are applied to the running Lens immediately and logged.
- **Record.** The same layers are recorded as separate tracks, plus a light manifest
  (`ndkcapture/1`: initial settings, every live change, markers). On Specs the module can also write
  the native tracks to the device and a finished `SpecsCapture` MP4 (camera + AR composited + audio).
- **Edit later.** Open the recording in the Studio: scrub, trim, cut, override any layer setting,
  add markers and a title, and export WebM. Edits are saved in `edits.json`; the recorded tracks
  never change. A Node tool extracts the full-quality native tracks for ffmpeg.

Cross-platform: the plugin only uses Lens Studio APIs, the Studio is a static web app, and the
native module builds with the SpecsNDK on macOS, Windows or Linux. Nothing is hosted outside your
computer.

## Features

- One prefab (`NDKCapture__PLACE_IN_SCENE`): the `NDKCapture` component and a status Text
- Native module `libNDKCaptureModule.so` (source in `NDKCaptureModule/`): per-layer
  `SpecsRecorder` sessions, live packet streaming, NKC1 track files, a JPEG camera proxy and the
  `SpecsCapture` composite MP4; built with the SpecsNDK 1.1.0 toolchain (`.snap.permissions`:
  `CAMERA_RAW`, `MICROPHONE_RAW`, `GPS_RAW`)
- Editor backend: in Lens Studio the camera layer comes from the camera texture and the AR/UI
  layers from render targets, so the whole stream → record → edit loop works in Preview
- Lens Studio plugin (**Window → NDKCapture**): serves the Studio, receives the Lens over
  `ws://127.0.0.1:47793`, saves recordings to `NDKCaptureRecordings/`, and has Record / Mark /
  Stop & Save buttons; optional LAN mode so a Spectacles on your Wi-Fi can connect
- Studio: live composite with per-layer controls sent to the Lens, recording library, timeline
  with markers, trim and cuts, per-layer overrides, title, WebM export, and offline opening of a
  recording folder

## Setup

If you cloned this project, `NDKCaptureStudio/` and `NDKCaptureModule/` are already at its root;
the ZIPs in `ExtractAtProjectRoot/` are the same sources for Asset Library installs.

1. **Studio:** unzip `NDKCapture.lspkg/ExtractAtProjectRoot/NDKCaptureStudio.zip` at the project
   root, next to `Assets/`. The plugin serves it from there.
2. **In Lens Studio:** enable **Project Settings → Experimental APIs** (needed for the plugin's
   `ws://` socket), drag `NDKCapture__PLACE_IN_SCENE` into the scene, assign the main camera's
   render target to **AR Texture**, press Play, then **Window → NDKCapture → Open Studio**.
3. **On Specs:** in **Window → NDKCapture** press **Accept Specs on my network**, set the
   component's **Studio Url** to `ws://<your computer's LAN address>:47793`, and push the Lens.
   The prebuilt module ships in the package; rebuild it with SpecsNDK 1.1.0 (get it from https://github.com/specs-devs/ndk) after changing the
   C++ (see [native module](Assets/NDKCapture.lspkg/Docs/native-module.md)).

Full steps: [setup](Assets/NDKCapture.lspkg/Docs/setup.md), [Studio](Assets/NDKCapture.lspkg/Docs/studio.md).

## Testing

- Studio model: `cd NDKCaptureStudio && npm test` (Node 18+).
- Studio editor in a headless browser (sample recording, no Lens Studio needed):
  `cd NDKCaptureStudio && npm i --no-save playwright-core && npm run e2e`.
- Native module: `NDKCaptureModule/build.sh <SpecsNDK 1.1.0 root>`.

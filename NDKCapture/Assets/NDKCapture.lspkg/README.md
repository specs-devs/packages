<p align="center">
  <img src="Docs/media/NDKCapture.png" width="250px" alt="NDK Capture"/>
</p>

# NDK Capture

Streaming and capture in one asset, built on **SpecsNDK 1.1.0**. The Lens streams four layers —
`camera`, `ar`, `ui` and `mic` — to the **NDK Capture Studio**, where each layer is composited and
edited live, and records them as **separate tracks** with a settings timeline and markers so the
composite can be re-edited later.

- **On Specs:** camera, AR and mic are independent `SpecsRecorder` sessions in the bundled native
  module (`Modules/libNDKCaptureModule.so`: H.265 / AAC, per-layer fps, bitrate, key-frame
  interval, live bitrate and key-frame requests). A JPEG camera proxy feeds the live preview. The
  module can also write NKC1 track files and a finished `SpecsCapture` MP4 on the device.
- **In Lens Studio:** the editor backend streams the camera texture and the render targets you
  assign as JPEG proxies, so stream → record → edit works in Preview with no device.

Quick start: unzip `ExtractAtProjectRoot/NDKCaptureStudio.zip` at the project root → enable
*Project Settings → Experimental APIs* → drag `NDKCapture__PLACE_IN_SCENE` into the scene → assign
the main camera's render target to **AR Texture** → press Play → **Window → NDKCapture → Open
Studio**. Full steps: [setup](Docs/setup.md).

## Usage

This section ships with the package and describes the exact installed revision. Read it, then
follow the links into `Docs/` for the topic you need. It is written for both people and coding
agents. Generic Lens scripting and SpecsNDK basics are out of scope here.

### Package identity

- Package descriptor: `NDKCapture.lspkg/package.native`
- Consumer import prefix: `NDKCapture.lspkg/Scripts/`, for example
  `import {NDKCapture} from "NDKCapture.lspkg/Scripts/NDKCapture"`. See [components](Docs/components.md).
- Drop-in prefab: `NDKCapture.lspkg/NDKCapture__PLACE_IN_SCENE.prefab` — the `NDKCapture`
  component and a status Text. Assign **AR Texture** (and **UI Texture** for the optional ui layer).
- Native module: `NDKCapture.lspkg/Modules/libNDKCaptureModule.so` (aarch64, SpecsNDK 1.1.0).
  Source and build script: `NDKCaptureModule/` at the project root (also in
  `ExtractAtProjectRoot/NDKCaptureModule.zip`). See [native module](Docs/native-module.md).
- Editor plugin: **NDKCapture** (project-scoped; it loads with the project). It starts the Studio
  server and adds **Window → NDKCapture**: Open Studio, Recordings Folder, Record, Stop & Save,
  Mark, Restart Server, Accept Specs on my network.
- Companion sources in `ExtractAtProjectRoot/`: `NDKCaptureStudio.zip` (the Studio: static files,
  no build step) and `NDKCaptureModule.zip` (the C++ source). Lens Studio doesn't import them;
  unzip them at the project root.
- Required companion packages: none (`package_dependencies.json` is empty).

### Version and API status

Read [API status](Docs/api-status.md) before reusing older code. It lists the Current and Internal
surfaces of this revision and the formats it reads and writes.

### Applicability

Use NDK Capture when you need the **layers separately**: a stream or recording where the camera,
the AR overlay, a UI layer and the mic can be balanced, re-ordered, moved or switched off while
streaming and again afterwards. For a single finished clip of what the wearer saw, use the Specs
capture (or this package's `SpecsCapture` composite MP4). For a 3D re-render of the scene from any
camera, use Web Capture. For video calls, use the VideoCall packages.

### Package Docs (ship in `Docs/`)

- [cheat sheet](Docs/cheat-sheet.md) — load-bearing rules; read first
- [setup](Docs/setup.md) — unpacking the Studio, Experimental APIs, the plugin, Specs over Wi-Fi
- [components](Docs/components.md) — `NDKCapture` inputs, defaults and methods; `StudioLink`
- [Studio](Docs/studio.md) — Live view, recordings, the editor and the video export
- [format](Docs/format.md) — layers, settings, the `ndkcapture/1` manifest, chunks, NKC1 packets, plugin API
- [native module](Docs/native-module.md) — exports, SpecsNDK 1.1.0 APIs, permissions, building
- [API status](Docs/api-status.md) — Current / Internal for this revision
- [examples](Docs/examples.md) — prefab path and minimal compile-correct snippets
- [troubleshooting](Docs/troubleshooting.md) — symptoms → cause → fix

### Verification

1. Compile the Lens with no TypeScript errors. Import only from `NDKCapture.lspkg/Scripts/`.
2. With the project open, `http://127.0.0.1:47792/api/status` answers `{"ok":true,...}` and
   **Window → NDKCapture** says *Server running*.
3. Press Play: the status Text reads `Streaming` and `Studio connected`; the Studio's Live view
   shows the camera and AR layers. Moving a layer's Opacity slider changes the Lens's settings.
4. Press **Record**, wait, press **Stop & Save**: the recording appears in the Studio's library,
   opens in the editor and exports a WebM.
5. Check the Logger for `[NDKCapture]` lines.

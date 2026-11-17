<p align="center">
  <img src="Docs/media/DecartAI.png" width="250px" alt="DecartAI"/>
</p>

# Decart AI

DecartAI transforms camera frames with a Decart prompt and displays the result.
It provides an editor/Mac bridge, an HTTP image fallback, and a device-native
WebRTC integration. Drop `DecartAI__PLACE_IN_SCENE.prefab` in the scene, dismiss
the guide, then press Start on the in-Lens control panel.

https://docs.platform.decart.ai

## Usage

This section ships with the package and describes the exact installed revision.
Generic Lens scripting, scene construction and Specs spatial design are out of scope here; this index covers DecartAI's own source, wiring and limitations.

### Package identity

- Descriptor: `DecartAI.lspkg/package.native` (`DecartAI`). Its existing ReadMe reference is retained.
- Consumer import prefix: `DecartAI.lspkg/Scripts/`.
- Prefab: `DecartAI.lspkg/DecartAI__PLACE_IN_SCENE.prefab`.
- The `__PLACE_IN_SCENE` prefab is self-contained: besides the Decart demo (`DecartDemo`: engine, requirements,
  head-locked display, LazyTether rig with status and controls) it includes the onboarding `Guide` and the
  `ExampleCarousel`, so dropping it into an empty Specs scene gives the full demo. Their demo-only scripts ship in
  `DecartAI.lspkg/Example/` (`ExampleCarousel/`, `GuideDismissPanel/`, `HeadLockedDisplay/`). Delete `Guide` and
  `ExampleCarousel` from your instance when you build your own Lens ([components](Docs/components.md#demo-scaffolding-example)).
- Declared companion packages (`package_dependencies.json`): SnapDecorators, InteractionKit,
  UIKit, Utilities, Motion and Icons. The scripts import only UIKit (`DecartControlsUI` and the
  demo scaffolding) and InteractionKit (the demo scaffolding, including `HeadLockedDisplay`).
- Other shipped assets: `NativeModules/libDecartWebRTCModule.so` plus its engine `libSpecsWebRTC.so`,
  the nested `Prefabs/FlippedImage.lspkg` (used only by the `DecartWebRTCController` smoke test), the
  display material `Materials/Image 2.mat` (on `Shaders/flat.graphShader`, texture `Images/Image.png`),
  an unreferenced `Materials/Image.mat`, and the native/bridge source archives in `ExtractAtProjectRoot/`.

### Version and API status

Read [API status](Docs/api-status.md) before using native configuration fields.
[Components](Docs/components.md) is the source-derived API reference; no separate
package declaration file is assigned here. Several native Inspector values are
retained but overridden by code constants in this revision.

### Applicability

Use this package for Decart camera restyling and its prompt/display controls.
For unrelated AI services, select the relevant remote-service package instead.
`target=auto` chooses editor bridge/HTTP in Preview and native WebRTC on device.
The included prefab carries its own display; its only external reference is the rig's
`cameraObject` (the scene's `Camera Object`), which you audit when your camera differs.

### Package Docs (ship in Docs/)

- [Cheat sheet](Docs/cheat-sheet.md): read first for wiring and effective settings.
- [API status](Docs/api-status.md): read for current, experimental and inactive APIs.
- [Components](Docs/components.md): read for every public component, input and helper.
- [Setup and lifecycle](Docs/setup.md): read before configuring a transport or credentials.
- [Examples](Docs/examples.md): read for compile-checked usage without automatic network start.
- [Troubleshooting](Docs/troubleshooting.md): read for source-proven limitations and QA gaps.
- [Original tutorial](Docs/tutorial.md): preserved human tutorial and native-build instructions;
  its latency/pipeline claims are historical; the current source docs take precedence.

### Native development (SpecsNDK)

Prebuilt device libraries ship in `NativeModules/`. They run only on a SPECS device; in the
Lens Studio Preview `target=auto` uses the editor bridge or HTTP instead. Rebuilding requires SpecsNDK
1.1.0 and the source archives in `ExtractAtProjectRoot/`; the original build
instructions are preserved in [the tutorial](Docs/tutorial.md#native-development-specsndk).
Native execution and actual Decart round trips remain device validation tasks.

### Verification

1. Compile with the installed Lens Studio declarations and companion packages.
2. Audit `targetImage` (the prefab's `DecartDisplayQuad`), `decartScript`, `cameraObject`, the cloned display material,
   both native libraries and their permissions in a fresh prefab instance.
3. Keep `autoStart=false`; verify prompt presets, Hide/Menu and Start/Stop without a
   backend. Start with no bridge running must log `startLoop() target=auto native=false
   mode=bridge` and show "Bridge closed — retrying in 2s" (not an API-key error).
4. With a separately configured transport, verify Start → frames → prompt update →
   Stop. Confirm Stop finishes an in-flight HTTP request before resetting Preview.
5. On device verify native load, SDP/ICE, decoded aspect/orientation and camera
   lifecycle; a standalone gradient is not evidence of a Decart return stream.

## Built with 👽 by the SPECS team

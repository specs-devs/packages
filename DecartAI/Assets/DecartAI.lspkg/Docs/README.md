# Decart AI

## What it is
A package that restyles the Specs camera feed with a Decart AI prompt ("reality distortion") and shows the
transformed frames on a head-locked display. It bundles three transports: a WebSocket bridge to a companion script on
your Mac, a slower HTTP image fallback that needs no companion, and a device-native WebRTC path built on prebuilt
SpecsNDK libraries. It is for developers who want to experiment with real-time generative video restyling in a Lens.

## What it does
1. Drop the prefab in, dismiss the guide, and press **Start** on the in-Lens control panel (`autoStart` is off).
2. `DecartRealtimeRestyle` captures camera frames and picks a transport from `target` (`auto` / `editor` / `device`)
   and `mode` (`bridge` / `http`); `auto` uses the bridge or HTTP in the Preview and native WebRTC on device.
   - **bridge:** frames go as JPEG over a WebSocket (default `ws://localhost:8765`) to `DecartBridge/bridge.py`, which
     talks to Decart's realtime model and streams frames back.
   - **http:** each frame is posted to Decart's image-edit endpoint and the returned image replaces the display
     (seconds per frame, a slideshow rather than video).
   - **device:** `DecartWebRTCSession` runs Decart signaling over the InternetModule WebSocket while the native module
     encodes the camera and decodes the return stream.
3. `DecartControlsUI` lets you change the prompt (free text or presets), start/stop the loop, tune display zoom and
   offsets with sliders, and hide the menu, all without resetting the Lens.
4. `LazyTether` keeps the control rig in front of you with yaw-only soft follow; `HeadLockedDisplay` keeps the output
   quad locked to the camera.

## Highlights
- One engine component, three transports, chosen automatically per platform.
- Runtime prompt and display controls, so you avoid Inspector edits that reset the Preview.
- `DecartRequirements` centralizes the API-key lookup and logs (or optionally shows) a reminder until a real key is set.
- Prebuilt native WebRTC libraries ship in `NativeModules/`, and their sources ship as archives in
  `ExtractAtProjectRoot/` for rebuilding with SpecsNDK.
- `DecartWebRTCController` is an optional standalone smoke test for the native module, separate from the main engine.
- Several native Inspector fields (endpoint, model, codec, bitrate, downlink) are overridden by code constants; see
  [api-status.md](api-status.md).

## Core scripts
| Script | What it does |
|---|---|
| `Scripts/DecartRealtimeRestyle.ts` | Main engine: camera capture, transport selection, prompt, start/stop and display tuning. |
| `Scripts/DecartControlsUI.ts` | UI Kit control panel: prompt field, presets, Start/Stop, display sliders, Menu/Hide. |
| `Scripts/DecartRequirements.ts` | Shared API-key gate with placeholder detection and setup reminder. |
| `Scripts/DecartWebRTCSession.ts` | Decart signaling WebSocket bridged to the native WebRTC module on device. |
| `Scripts/DecartWebRTCNativeModule.ts` | Types and loader for `libDecartWebRTCModule.so`. |
| `Scripts/DecartWebRTCController.ts` | Optional on-device smoke test for the native module alone. |
| `Scripts/LazyTether.ts` | Yaw-only soft-follow rig with angle and distance deadzones. |
| `Example/HeadLockedDisplay/HeadLockedDisplay.ts` | Copies the camera pose each frame so the display stays head-locked. |

## Extra info
- **Requires:** SnapDecorators, InteractionKit, UIKit, Utilities, Motion, Icons. Needs your own Decart API key
  (https://platform.decart.ai); the package ships only placeholders. Bridge mode needs `DecartBridge/bridge.py`
  running on your Mac with `DECART_API_KEY` set; HTTP and native use the engine `apiKey` or `DecartRequirements`.
  The native path runs only on a Specs device and needs Internet and camera permissions; it does not run in the
  Preview. Stop an HTTP loop before resetting the Preview, since an in-flight request cannot be aborted.
- **Get started:** `DecartAI__PLACE_IN_SCENE.prefab`; check the rig's `cameraObject` points at your scene camera.
  Delete `Guide` and `ExampleCarousel` for your own Lens.
- **More docs:**
  - [cheat-sheet.md](cheat-sheet.md) – wiring and effective settings, read first
  - [setup.md](setup.md) – prefab wiring, credentials and lifecycle
  - [components.md](components.md) – every public component, input and helper
  - [api-status.md](api-status.md) – current, experimental and compatibility-only APIs
  - [examples.md](examples.md) – small integrations that do not auto-start a session
  - [troubleshooting.md](troubleshooting.md) – known limitations and QA gaps
  - [tutorial.md](tutorial.md) – original tutorial and native build instructions

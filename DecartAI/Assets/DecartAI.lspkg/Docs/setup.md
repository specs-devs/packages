# DecartAI setup and lifecycle

[← Agent usage index](../README.md)

## Use when

Read before configuring credentials, display wiring or a native transport.

## Prefab wiring

`DecartAI__PLACE_IN_SCENE.prefab` holds, in order, `Guide`, `ExampleCarousel` ([demo scaffolding](components.md#demo-scaffolding-example)) and `DecartDemo`: the head-locked display (`DecartDisplay` → `DecartDisplayQuad`), requirements, engine and the LazyTether rig with controls and one status Text (engine status under the rig). The prefab has no floating API-key reminder Text: DecartRequirements logs the missing-key reminder to the console, and you can wire its optional `text` input to a Text inside your own UI panel if you want it shown in the Lens. The engine's targetImage is the prefab's own `DecartDisplayQuad` Image. The rig's cameraObject is the only external reference: it points at the scene's `Camera Object` (the Specs template camera id); rewire it to your world camera if yours differs. The UI decartScript must reference the engine ScriptComponent. The optional statusText reference is internal. Recheck bindings after instantiation; don't assume the descriptor's null Instantiable reference installs or wires the prefab automatically.

The authored rig is at z=-80 cm, status text y=16.5/z=-26.5 (scale 1.375) under the rig, controls y=-42/z=12. LazyTether repositions the rig at Start. The main display sits at local z=-110 cm (scale 88×49.5, same angular size as the old 64×36 at 80 cm) under `DecartDisplay`, whose `Example/HeadLockedDisplay` script copies the world camera pose every frame, so it stays head-locked as if it were a camera child. The prefab stores displayZoom 1.6 and offsets 0/0/0 (the script defaults are 2.09/11/7/0.15). The control panel sits about 30° below eye level and is tilted toward the user, so users look down to it; the engine status line sits about 9° above eye level.

`target` and `mode` are ComboBox inputs declared `ComboBoxItem(label, value)`; the saved value is the short key the engine compares (`auto`/`editor`/`device`, `bridge`/`http`). Scenes saved before this fix stored the label text; `onAwake` maps it back (see [API status](api-status.md#migrations)). An unrecognized target follows auto resolution; an unrecognized mode falls through to HTTP.

## Credentials

Obtain your own Decart credential from https://platform.decart.ai. The package ships placeholders, not a working credential. HTTP and device-native paths resolve the engine input key first, otherwise DecartRequirements.apiKey. Only HTTP initialization explicitly refuses a missing key; native session construction can receive an empty key. Validate configuration before Start. Until a key is set, `[DecartRequirements] Decart API key not set!` is logged at Start (paste the key on the DecartRequirements script or the DecartRestyle object's apiKey; bridge mode reads DECART_API_KEY in bridge.py).

The bridge's key is separate: set `DECART_API_KEY` in its environment or use its `--api-key` flag; shipped `DEFAULT_API_KEY` is empty. Do not copy credentials into documentation or reusable package source. The session implementation sends its configured key in the signaling URL and has no token-minting backend.

## Lifecycle

1. Engine Awake migrates old default prompts, binds retry/reconnect/Update/Start/Destroy events. Runtime controls build on Awake and initialize slider values after Start+0.2s.
2. Engine Start requires targetImage, clones its material, captures authored scale/position, and applies display tuning.
3. Native target loads device libraries, then waits for Start by default. Library-load failure returns null without invoking the engine's callback; loading text may persist. Mac target initializes CameraModule on Start, selecting Default_Color in editor and Right_Color on device.
4. First camera frame marks readiness. `autoStart=false` waits for startLoop. HTTP autoStart alone honors the 40-second editor warmup; manual Start uses startDelaySeconds.
5. Main native path uses fixed endpoint/model/H.264/4000 kbps, pump() for signaling and pullFrameInto for RGBA uploads. Library ready plus running flag starts the native session.
6. Stop closes bridge/native session. HTTP request cannot be aborted and finishes naturally, possibly updating the display. Destroy closes sessions and removes camera frame subscription; pending HTTP/decode callbacks are not cancelled. Stop and finish work before Preview reset.

## Transport setup

| Path | Required configuration | Effective behavior |
|---|---|---|
| Editor bridge | `target=editor` or auto in editor, `mode=bridge`, configured running Mac companion, bridgeUrl | JPEG camera frames at bridgeSendFps; newest pending returned frame retained |
| Editor HTTP | `target=editor` or auto in editor, `mode=http`, valid own key | Multipart POST lucy-image-2; output PNG, sequential frame loop, 1.5s error retry |
| Native device | auto/device on compatible Specs, own key, sibling native libraries | Native camera/WebRTC media plus TS WebSocket signaling; nativeFps/nativeMaxWidth remain effective |

Bridge source ships in `ExtractAtProjectRoot/DecartBridge.zip`; extract at project root when needed. Its default model is lucy-2.5 with fallback lucy-2.1, port 8765, newest-only queue.

## Native assets

Both native assets currently serialize an **empty Permissions list**, and neither `.so` embeds a `.snap.permissions` section. The bundled native build README calls for INTERNET and CAMERA_RAW on both NativeLibraryAssets; without INTERNET a native `socket()` fails with EACCES on device. Grant them before device tests (Lens Studio can strip hand-edited `.so.meta` permissions on re-import, so check the meta after every import). Device-only .so loading does not work in Preview.

`ExtractAtProjectRoot/DecartWebRTCModule.zip` ships source/build scripts; the original [native build tutorial](tutorial.md#native-development-specsndk) is retained. Use its matching SpecsNDK distribution. Media/SDP/ICE/decoder assumptions require device evidence even when TypeScript compiles.

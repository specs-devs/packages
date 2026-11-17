# DecartAI troubleshooting

[← Agent usage index](../README.md)

## Use when

Read when source behavior differs from Inspector configuration or a demo stalls.

## Source-proven behavior

| Symptom | Cause / next check |
|---|---|
| Forced native target fails in Preview | Device libraries cannot execute there; use editor/auto. Failed load returns null without the engine callback, so Loading may persist. |
| Changing native endpoint/model/codec/bitrate inputs has no effect | Main engine forces clean endpoint, lucy-restyle-2, H.264 and 4000 kbps. No effective nativeDownlinkKbps cap exists. |
| `Decart API key not set!` log (or a wired reminder Text) remains, or native auth fails | Local predicate only checks nonempty/non-placeholder. Bridge key is separate; native path may send empty resolved key without HTTP-style early validation. |
| Start label says Stop but no transformed frames | UI and isRunning reflect requested state. Native session result is only logged; socket close has no reconnect. Check library readiness, key, permissions and SDP/ICE. |
| Stop still changes the image once | HTTP request already in flight finishes; no abort/callback cancellation. Use runtime Stop and wait for completion before Preview reset. |
| Output aspect looks stretched outside native path | Native uploads update decoded aspect; bridge/HTTP leave initial 16:9. Existing source has no equivalent aspect update there. |
| Clearing prompt does nothing | setPrompt ignores empty strings; presets and nonempty custom text still update. |
| Native prompt enhancement ignores enhancePrompt=false | DecartWebRTCSession sends enhance_prompt:true unconditionally; HTTP/bridge respect their own flags. |
| Whole display fills/crops view | The prefab stores displayZoom 1.6 (script default 2.09) on purpose to overscan; offsets are added to the authored quad position. Use the display setters/sliders. |
| Start in the editor says "apiKey missing" although `mode` shows bridge | Scene saved before the ComboBox fix with a `mode` that is neither old label text nor `bridge`. Re-select the mode in the Inspector; the startLoop log line prints the effective `target`/`mode`. |
| Engine status line not visible in the Preview | It sits about 9° above eye level; the Preview's default head pose is pitched down 12°, so it is just above the frame. Level the Preview camera; on device it is visible when looking straight ahead. |
| Controls panel cut off at the bottom | Authored about 30° below eye level so it does not cover the feed; look down to it. Hide folds it to a Menu button. |
| Agent pinch on Hide/Menu reports "obstructed by InteractionPlaneColliderRoot" | A UIKit Frame plane in front (e.g. a project carousel) catches the named-target ray; pinch by world position instead. |
| Standalone gradient visible | Native smoke-test getFrameRGBA fallback; main engine pullFrameInto needs a new decoded frame. A gradient is not remote success. |
| Tutorial latency/pipeline claims | The preserved tutorial's latency and working-pipeline assertions were not re-tested. Use current README/API/setup for actual wiring. |

## Prefab and package findings

The rig's cameraObject is the only reference outside the prefab tree: it resolves to the scene's `Camera Object` (Specs template camera id); rewire it if your camera differs. targetImage points at the prefab's own `DecartDisplayQuad`.

Both `.so.meta` Permissions lists are empty even though native build docs call for INTERNET and CAMERA_RAW. Without INTERNET a native socket fails with EACCES on device. The descriptor has no setup script and null Instantiable reference; there is no automated wiring guarantee.

## Historical crash report

Original source/tutorial record an in-flight HTTP/reset crash on an earlier Lens Studio build. It has not been reproduced since. Current source uses autoStart=false and an HTTP autoStart warmup; manual Start does not use editorWarmupSeconds. Stop has no network abort, so wait for status completion rather than assuming an arbitrary timer proves safety.

## Verified in the Lens Studio Preview

Presets fill the prompt field and call `setPrompt`; Start in bridge mode without a bridge shows "Bridge closed — retrying in 2s (is bridge.py running?)" and retries every 2 s; Stop shows "Stopped"; Hide folds the panel to a Menu button. Not verifiable in the Preview: real Decart frames (bridge, HTTP with a key) and the on-device native path.

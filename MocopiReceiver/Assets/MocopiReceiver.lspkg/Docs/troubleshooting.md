# MocopiReceiver troubleshooting

[← Agent usage index](../README.md)

## Use when

Diagnose connection, placement or avatar symptoms. Rows come from the source and from the 2026-10-01 Preview QA pass.

| Symptom | Cause | Action |
|---|---|---|
| Invalid WebSocket URL | Avatar prefab serializes `something like - wss://...` | Supply your actual URL; source default does not override prefab serialization. |
| No typed controller after setup | Casting `createComponent("Component.ScriptComponent")` does not create a Mocopi class | Use the wired prefab, or `createComponent(MocopiWebSocketClient.getTypeName())` with explicit lifecycle wiring (Main wires callbacks only in its own `onAwake`). |
| Frames arrive but avatar stays static | Missing/early skeleton, no placed prefab, no mapped bones or smoothing=1 | Place first; request fresh skeleton with `sendMessage({type:"request_skeleton"})`; inspect avatar stats and use finite factor below 1. |
| Manual mappings disappear | initializeAvatar rebuilds/clears automatic map | Apply manual overrides after successful initialization. |
| Reset pose is wrong | Identity rotation is not rig bind pose | Treat resetPose as identity reset and implement captured rest-pose handling in a consumer if needed. |
| Reset placement references old controller | Placement retains autodetected Main across destroyed prefab | Inspect reset path in later runtime QA; source unchanged here. |
| Disconnect reconnects again | onclose schedules reconnection | Known source behavior; verify teardown and manual disconnect on real stream before relying on it. |
| FPS remains high without frames | Sliding sample retains timestamps | Compare framesReceived/lastFrameTime freshness, not averageFPS alone. |
| Consumer callback loses motion routing | Assigned single slot replaced Main handler | Wrap existing callback after Awake, as shown in Examples. |
| objectVisuals exception | Required at runtime despite allowUndefined | Wire a valid SceneObject before Start. |
| Rotations/positions mirrored | Built-in handedness conversion and local updates | Verify rig coordinate conventions; use documented flag/scale deliberately. |
| "Look Down to Place" ring never fills in the Lens Studio Preview | SurfacePlacement places through WorldQuery hitTest; the Lens Studio Preview returns no hits | Verify placement on device. To check the avatar in Preview, drop `MocopiBasicAvatar.prefab` in front of the camera with `autoConnect` off (no socket is opened). |
| Floor ring text shows raw `<b>Find</b>` tags | Older SurfacePlacement build in the project | Update SurfacePlacement to the build whose head-pose hints are plain text. |
| `[MocopiAvatarController] ERROR: PrefabPlacement must be assigned!` on every placement | Older MocopiReceiver revision: Avatar Awake runs inside `instantiate()`, before PrefabPlacement assigns itself | Harmless; this revision logs an info line instead. Only `initializeAvatar` failing with `PrefabPlacement not assigned!` is a real wiring error. |
| No stream while offline | Real sensor/relay required | Capture offline placement/UI evidence honestly; leave data/animation checks pending. |

Still device-only: placement/Reset, relay message handling, stream motion at two timestamps and device networking. Do not infer hardware success from a clean compile or Preview render.

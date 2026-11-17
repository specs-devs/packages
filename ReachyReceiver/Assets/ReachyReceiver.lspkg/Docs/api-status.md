# ReachyReceiver API status

[← Agent usage index](../README.md)

## Use when

Check public APIs and source gaps before copying older tutorial fragments.

## Current

| Surface | Status |
|---|---|
| DaemonInterface | Singleton on Start, direct URL setter, request-specific async methods and fire-and-forget setTarget. |
| ReachyMiniController | Public setStateFromUI and Start hook; internal Idle/LookAtTarget state machine. |
| ReachyUIController | Public initialize, sync, mode and three preset methods; dynamically reaches private Mini inputs in source. |
| ReachyUIManager | Input references and Start hook; navigation methods private. |
| UIFrameAnimator | Public async scale show/hide/visibility methods and typed visibility event. Not used by shipped prefabs. |
| ControllerLookAtTarget | Placeholder Start/logging component only. Not used by shipped prefabs. |
| XYZRPYPose, MoveUUID | Exported native bridge data interfaces from DaemonInterface.ts. |

## Deprecated

| Surface | Evidence |
|---|---|
| None explicitly marked | No package-owned deprecation annotations. Historical README claims are not compatibility aliases. |

## Experimental

| Surface | Evidence |
|---|---|
| None explicitly marked | External robot/bridge behavior was not validated. |

## Removed

| Surface | Evidence |
|---|---|
| None inferred | No history comparison. Names such as healthCheck/getConnectionStatus/public sendMessage or animate(position,duration) are not exported by this source. |

## Known source gaps

- Daemon's setBaseUrl ignores its argument; private COMPUTER_IP="192.168.1.100" selects ws://IP:8001/ws. UI's simulationUrl/realRobotUrl/startInSimulationMode are private hardcoded getters, not Inspector inputs; both mode methods call the same bridge route, startup flag=false.
- Connection close schedules fixed 2-second reconnect, with no exponential backoff/maxReconnectAttempts/periodic health polling API. Incoming Blob is skipped even though binaryType=blob. Transport connect/disconnect/sendMessage are private. No OnDestroy cleanup clears socket/singleton.
- Startup singleton/logging order matters. UI initialize can call mode actions before Daemon Start has registered singleton. Calling URL setter before Daemon Start may use an uninitialized logger.
- Fixed 2026-10-01: the prefab wired `enableSimulationSwitch` to the tracking switch and `enableReachySwitch` to the Simulation switch, so "Enable Real Robot" matched nothing and the tracking switch doubled as a mode switch. Now Simulation/Real Robot point at the two switches of `robotModeToggleGroup`. `closeButton` is still null (the visible X is the UIKit Frame's own button).
- Fixed 2026-10-01: the ReachyReference move gizmo (`Prefabs/move_gizmo/scene.gltf`, 6 RenderMeshVisuals) referenced mesh/material ids from an earlier import and rendered nothing. They now point at the gltf's current Object_0–5 meshes and material/material_1/material_2 (same mapping as the original import).
- Idle sets looping=true before successful recorded-move request. If initially disconnected or first request fails, no UUID is set and completion polling returns early, so no automatic retry is established by that path.
- Async robot state transitions/target animations are not protected against stale completions. Rapid toggles can finish old state work after the current state changes. No destructor cleanup is implemented for target/update loops.
- World robot rotation rotates head offset but desired yaw/pitch are computed from world direction, not by inverse-transforming into robot local axes. Tuning/limits are frame-dependent; sending each Update is not guaranteed 60 fps.
- UI input tuning fields are private but current UI source uses any/dynamic property updates. Consumers should not add casts to copy this. Repeated initialize can accumulate slider/event bindings. Slider values map normalized 0–1 without validation; switch callbacks expect numeric 0/1 and require installed UIKit behavior verification.
- Frame reference defaults null but is dereferenced; hidden Start uses zero XYZ while animateHide ends at (defaultX,0,defaultZ). Cancelled visibility work resolves then still restores following/state/emits events, so rapid animation races require checks.

ThemeService preloads already exist in UI files; they were preserved. Static snippets do not establish physical motion or bridge availability.

Preview status (Lens Studio Preview, 2026-10-01): compile clean, no runtime errors; all five panels, slider sync, Expressive preset, exclusive Simulation/Real Robot switches, Look At target spawn/grab/despawn verified. No bridge was running, so no socket, daemon or robot motion was verified.

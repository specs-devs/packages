# ReachyReceiver troubleshooting

[← Agent usage index](../README.md)

## Use when

Bridge, target or panel behavior differs from the source contract. Rows come from the source and from the 2026-10-01 Preview QA pass; none are hardware results.

| Symptom | Cause | Action |
|---|---|---|
| URL does not match mode label | setBaseUrl ignores URL; both modes use same bridge | Configure bridge's daemon target externally; direct setter is setWebSocketUrl after Start. |
| Singleton unavailable at startup | Registered on Daemon Start | Wait for getInstance/isReady rather than inventing an Awake singleton. |
| Socket connects but health fails | isReady only tracks socket flag | Use checkConnection to establish daemon response and request-ID behavior. |
| Blob responses ignored | Only string responses parsed | Configure bridge text JSON responses; code is unchanged. |
| Idle does not retry after offline start | No move UUID; poll returns early | Verify startup connected and deliberately reenter state during QA; do not assume automatic replay. |
| Parameters have no effect in Idle | Idle uses recorded move, LookAt sends tuned target pose | Switch explicitly to LookAtTarget and verify target/connection. |
| Tracking toggles robot selection too / Enable Real Robot does nothing | Pre-2026-10-01 prefab wired `enableSimulationSwitch` to the tracking switch | Fixed in the prefab; re-instantiate old scene instances (they keep their own copy of the references). |
| No target after turning on Look At | Target spawns ≈40 cm above the panel centre, above the default view | Look up; or move `ReferenceInstantiationPositionForGrabThisReachyWillFollow` in your scene. |
| White plate but no axes on ReachyReference | Pre-2026-10-01 prefab pointed the move gizmo at dangling mesh/material ids (gltf re-imported in an earlier Lens Studio update) | Fixed in the prefab; re-instantiate old scene instances. |
| Gizmo/plate covers other UI | ReachyReference sits 60 cm in front, 20 cm below the head pose | It is the robot anchor: grab it and move it onto the real robot. |
| "Failed to download the dependency Icons … 2C2Px5zRD3OJOQzl0gpL9R" warning | `package_dependencies.json` Icons entry has a zero exportId/id | Harmless when Icons is already installed; don't reinstall from the Asset Library. |
| Target appears wrong when robot anchor rotated | World-direction yaw calculation | Check robot coordinate convention before changing anchor transforms. |
| Rapid toggles create inconsistent target state | Async transitions have no cancellation-state guard | Exercise sequential transitions and test rapid toggles separately in live QA. |
| Frame helper throws | Frame input defaults null and is dereferenced | Wire real UIKit Frame before animation calls. |
| Old visibility event follows cancellation | Cancel resolves promise then still commits state/event | Validate settled visual result, not event alone. |
| Home/X button missing | Prefab closeButton null | Five panelNavButtons still route home; inspect intended close control in later QA. |
| No robot proof offline | Bridge/daemon/hardware external | Capture UI/target-only results and leave movement/network checks pending. |

Original bridge/simulator setup lives in [Guide](guide.md). No external server, simulated daemon or robot command was run by this documentation pass. Full compile/UI/target animation and deliberate bridge/device QA remain pending.

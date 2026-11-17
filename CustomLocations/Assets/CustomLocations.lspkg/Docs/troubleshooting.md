# CustomLocations troubleshooting

[← Agent usage index](../README.md)

## Use when

Tracking, content or the debug panel behaves unexpectedly. Causes come from the source and from the Preview QA pass of the demo project (2026-10-01).

| Symptom | Source cause | Action |
|---|---|---|
| “No LocatedAtComponent” error | Activator is not beside a native Located At component | Move it to the exact scan child; a parent/group component is not enough. |
| Editor content activates but localize never runs | Simulation changes getter only | Initialize listeners through lifecycle. Use actual native onFound to verify localize. |
| Looking away leaves content active | Visibility tested only on entry | Expected source behavior. Move beyond outer XZ distance or force deactivate, noting automatic reactivation can follow. |
| Content stays localized after Lost | onLost only logs | Do not treat isLocalized as current tracking validity; subscribe to native loss events in a consumer that needs this behavior. |
| Deactivate all, then a scan comes straight back | Deactivate hands control back to the automatic check; you are within the activation distance and looking at it | Expected. Walk beyond the outer distance (1.5 × activation distance) to keep it off. |
| Activate all did nothing for far scans (older builds) | Before this revision the outer-distance check undid forced activation on the next frame | Update the package; `activateListeners()` now persists until `deactivateListeners()`. |
| Changing multiplier/center has no effect | Cached on Awake | Configure before startup or reinitialize the consuming scene; no cache-refresh API is exposed. |
| Listener error without state rollback | Callback exception caught; active flag set first | Check always-visible Logger error and repair the listener. Implement all interface methods. |
| Scale becomes uniform or frame-rate dependent | X-only target and per-frame animationStep | Use positive uniform initial scale; tune step and verify at two times. |
| Content remains enabled after disappearing | Deactivation only scales to zero | Expected. Add explicit enabled/lifecycle policy in your consumer if needed. |
| Audio missing | No assigned/found AudioComponent | Assign audio with a playable track or colocate AudioLocatedObject with the component. Check logged error. |
| Sound does not keep playing | Default loops=1 | Use intended AudioComponent loop count; -1 loops indefinitely. Verify sound audibly, not from screenshots alone. |
| Newly reloaded scan meshes not hidden | Mesh collection is one-time, immediate-child-only | Rebuild/start after hierarchy changes; keep scan objects immediate group children. |
| Status rows missing/Waiting | Discovery on Awake, event subscriptions on Start | Configure hierarchy before startup. Waiting is not proof of a tracking error. |
| Distance readout differs from activation | Panel uses 3D distance to the activator's center; activator uses XZ distance | Compare like-for-like when tuning (height difference only affects the panel). Older builds measured to the scan origin and showed ≈0.1 m for every scan. |
| Group “ID” text looks like object name | groupLabel reads SceneObject.name | Expected. It is not the native GroupId. |
| Scan switch looks out of sync | Initial switch state uses Editor/device only | Toggle and inspect visuals; do not infer actual hidden state from initial switch. |
| Scan meshes switch turns meshes off but never back on (older builds) | SpectaclesUIKit `Switch.onFinished` passes the explicit-change flag, not the new state | Read `sw.isOn` in the handler (fixed in this revision). |
| No sparkle sound although the scan activates | The AudioComponent's SceneObject is disabled, so `play()` has no effect | Keep the audio SceneObject enabled (autoplay off); AudioLocatedObject starts and stops it. The demo scene's `Audio Track` objects were disabled before 2026-10-01. |
| `[Landmarkers] Error 499/401 loading location summary` in the Lens Studio log | Lens Studio is not logged in to My Lenses, or the request was canceled on reset | Log in to My Lenses to download scan meshes/summaries; the content flow still runs in Preview. |
| Code walking `group.children` at runtime finds nothing | The native group re-parents Located At children under `CustomLocationsParent` at runtime | Collect scan children in `onAwake` / `OnStartEvent` (as the package helpers do) or keep references. |
| Content appears at the user's position or moves with the head | A project-level carousel/anchor re-parented the scan children | Leave Located At objects under the group; set `anchorExamples = false` on QA carousels. |
| Import of `CustomLocations.lspkg/Scripts/GuideDismissPanel/...` fails | The legacy guide helper and `GUIDE_ReadAndDisable.prefab` were removed from the package | Use the demo scaffolding in `CustomLocations.lspkg/Example/GuideDismissPanel/` (it has a hide-until-dismissed list), or your own guide. |

## Validation still needed

Preview checks do not prove tracking: real localization (first `onFound` → `localize()`), loss/reacquisition, placement and scan meshes hidden on device need Specs at the scanned site or your own published group. Audio was checked logically (play/stop calls), not audibly.

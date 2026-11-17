# CustomLocations cheat sheet

[← Agent usage index](../README.md)

## Use when

Read first before wiring a scan's content or changing the sample.

1. Put `ActivateWhenInCameraView` on the same SceneObject as its native `LocatedAtComponent`, under the group; assign its camera and listener components. → [Activation component](components.md#activatewhenincameraview)
2. Implement all three `LocatedObject` methods. `listenerObjects` is typed `LocatedObject[]` but serialized as `Component.ScriptComponent[]`; add components, not their parent SceneObjects. → [Listener contract](components.md#locatedobject)
3. `simulateLocalizedInEditor` makes `isLocalized` true only; it does not fire `localize()`. Actual `onFound` invokes localization once, and `onLost` only logs. → [Lifecycle gaps](api-status.md#known-source-behavior)
4. Activation needs horizontal XZ distance below 1000 cm and a visible 600 cm sphere by default. Deactivation uses distance above 1500 cm; looking away alone does not turn active content off. → [Threshold behavior](components.md#activation-behavior)
5. The center transform and outer distance are cached in `onAwake()`. Configure them before initialization; direct input edits are not a general runtime reconfiguration API. → [Troubleshooting](troubleshooting.md)
6. ScaleIn remembers only original local X scale, starts at zero and animates uniformly per frame. Use a positive uniform source scale. Deactivation scales to zero without disabling content. → [Scale listener](components.md#scaleinlocatedobject)
7. Mesh hiding and panel discovery visit immediate group children once. Keep native Located At objects there and do not expect late/reloaded children to be rediscovered. → [Mesh visibility](components.md#deactivatelocationmeshondevice)
8. `activateListeners()` (panel: Activate all) keeps content on, even far away, until `deactivateListeners()`; Deactivate all hands control back to the automatic check, which re-activates scans you are close to and looking at. Status rows show event state and 3D distance to the content center; they do not prove localization. → [Example panel](components.md#customlocationsexamplespanel)
9. Keep scan transforms intact and replace the example group with your own published group for device checks. The demo prefab `CustomLocations__PLACE_IN_SCENE.prefab` adds a guide and carousel from `Example/`; they are demo scaffolding, not package API. → [Sample layout](examples.md#sample-scene-and-prefabs)

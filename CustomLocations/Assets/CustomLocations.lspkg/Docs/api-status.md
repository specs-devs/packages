# CustomLocations API status

[← Agent usage index](../README.md)

## Use when

Check public surfaces and native/framework dependencies. The package version is in `package.native`.

## Current

| Surface | Source status |
|---|---|
| `LocatedObject` | Interface: `activate()`, `deactivate()`, `localize()`. |
| `ActivateWhenInCameraView` | Native Located At listener plus proximity/frustum activation; public localization/active getters and force methods. |
| `ScaleInLocatedObject`, `AudioLocatedObject` | Built-in LocatedObject implementations. |
| `DeactivateLocationMeshOnDevice` | Immediate-child scan-visual discovery and visibility control. |
| `Logger` | Tagged logger with enable controls; errors always print. |
| `CustomLocationsExamplesPanel` | Optional UIKit tracking-state/3D-distance panel and scan/force-action controls. |

## Deprecated

| Surface | Source evidence |
|---|---|
| None marked | No package-owned deprecation annotations. Companion API status must be checked separately. |

## Experimental

| Surface | Source evidence |
|---|---|
| None marked | Editor-localization simulation and force buttons are explicit debug aids, not tracking proof. |

## Removed

| Surface | Source evidence |
|---|---|
| `GuideDismissPanel` (`Scripts/GuideDismissPanel/`) and `Examples/Prefabs/GUIDE_ReadAndDisable.prefab` | Removed 2026-10-01: legacy guide helper/prefab. The current demo guide ships as scaffolding in `Example/GuideDismissPanel/` (used by `CustomLocations__PLACE_IN_SCENE.prefab`). |

## Compatibility

Manifest declarations: SpectaclesInteractionKit, SpectaclesUIKit, Motion and Icons. Location helper modules use native `LocatedAtComponent`, `Camera.isSphereVisible()` and `global.deviceInfoSystem.isEditor()`. The panel subscribes to group `onFound` and each scan's `onReady`, `onCanTrack`, `onCannotTrack`, `onFound`, `onLost`, `onError`; it reads `LocatedAtComponent.location`. These are native SDK surfaces, not package exports.

The Lens Studio version the package was saved with is in `package.native`. Original OS/app minima are preserved as historical information in [Guide](guide.md#original-environment-notes). The package compiles clean in its demo project and the status panel was exercised in Preview. Real tracking still needs Specs at the scanned site.

## Known source behavior

- `onFound` sets `didLocalize` once and calls listeners' `localize()`. Editor simulation does neither; it only changes the `isLocalized` getter. `onLost` logs without resetting localization or deactivating content.
- While active, only exceeding the outer horizontal distance deactivates. Camera visibility is checked only before activation. Missing camera causes automatic updates to return immediately.
- Outer threshold and center Transform are cached during `onAwake()`. Changing multiplier/center later does not recompute them. Inputs have no numeric validation.
- Public force methods bypass localization/frustum entry checks. `activateListeners()` persists (outer-distance deactivation is suppressed) until `deactivateListeners()`, which clears the force and returns to the automatic check — so a nearby, visible scan re-activates on the next frame.
- Listener errors are logged individually and do not stop iteration. The active flag changes before callbacks, with no rollback after an exception.
- Scale animation uses a per-frame increment, not elapsed time; it keeps only initial X scale and writes uniform XYZ. Zero/negative target scale and zero animationStep need explicit handling by a consumer. At zero scale the object remains enabled.
- Scan-mesh collection occurs on Start and panel discovery on Awake, using immediate children. No rebuild/discovery method is exported for group changes. The panel's group label is the SceneObject name, not GroupId, and its distance is 3D to the activator's center (the activator uses XZ).
- The mesh switch initial value is based on Editor/device, not collected visual state or `hideInEditor`. It toggles both ways (it reads `Switch.isOn`; SpectaclesUIKit's `onFinished` argument is the explicit-change flag). Late native events before panel subscription can leave rows at Waiting until another event arrives.
- At runtime the native group re-parents its Located At children under a generated `CustomLocationsParent` root, so the group SceneObject reports no children afterwards. The helpers collect children in Awake/Start, before that happens.

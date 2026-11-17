# NavigationKit API status

[← Agent usage index](../README.md)

## Use when

Check this file before choosing a class or copying an older Navigation Kit example. It is
the compatibility index for the package revision that contains it (dependencies:
InteractionKit, UIKit, Motion, Icons).

## Status meanings

- **Current** — recommended public surface for new work.
- **Experimental** — public, works on device only or with caveats listed in troubleshooting.
- **Internal** — shipped in the package but not meant to be imported by Lenses.
- **Removed** — unavailable in this revision.

## Current API

| Capability | Current surface | Import path (prefix `NavigationKit.lspkg/`) |
|---|---|---|
| Place registry, selection, arrival events | `NavigationDataComponent` (`@component`), `NavigationStatus` | `NavigationDataComponent/NavigationDataComponent` |
| Author places in the Inspector | `ManualPlaceList` (`@component`) with `GeoPlaceInput`, `SceneObjectPlaceInput`, `CustomLocationPlaceInput`, `CustomLocationGroupPlaceInput` | `NavigationDataComponent/ManualPlaceList` |
| Direction arrow + distance / name text | `ARNavigation` (`@component`) | `ARNavigationComponent/Scripts/ARNavigation` |
| Place model | `Place` (abstract) | `NavigationDataComponent/Place` |
| GPS place | `GeoLocationPlace` | `NavigationDataComponent/GeoLocationPlace` |
| Scene-anchored place | `SceneObjectPlace` | `NavigationDataComponent/SceneObjectPlace` |
| User pose + geo position (read side) | `UserPosition` (interface), `UserPositionStatus` | `NavigationDataComponent/UserPosition` |
| Place ↔ prompt image binding hook | `IPlaceImageRegister` (interface) | `NavigationDataComponent/IPlaceImageRegister` |
| Geo math | `getPhysicalDistanceBetweenLocations`, `calculateBearing`, `normalizeAngle`, `convertToNumber`, `customGetEuler`, `makeTween`, `lerp`, `mod` | `NavigationDataComponent/NavigationUtils` |
| Drag-and-drop example | `NavigationKit__PLACE_IN_SCENE.prefab` (menu + head-locked arrow) | — |
| Drag-and-drop arrow only | `ARNavigationComponent/ARNavigationPrefab [PUT_IN_SCENE].prefab` (head-locked, world) and `ARNavigationComponent/ARNavigation_Camera [PUT_UNDER_CAMERA].prefab` (HUD compass, parent under the Camera) | — |

Exact inputs, members and events are listed in [components.md](components.md).

## Experimental (device-only or caveats)

| Surface | Why |
|---|---|
| `CustomLocationPlace` (`NavigationDataComponent/CustomLocationPlace`) | Needs a `LocatedAtComponent` with a Custom Location scan; `visited` and `onFound` are disabled in the editor. |
| `OverridableCustomLocationPlace`, `PlacesFromLocationGroup` (`NavigationDataComponent/OverridableCustomLocationPlace`, `.../PlacesFromLocationGroup`) | Custom Location **groups**: positions are approximated from the first localized member; strict hierarchy validation (see troubleshooting). |
| `EditableUserPosition` (`NavigationDataComponent/EditableUserPosition`) | Constructed by `NavigationDataComponent`; use the `UserPosition` interface from Lenses. `setOverridePosition(GeoPosition)` exists for editor testing. `getBearing()` is negated in the editor (marked TODO in source). |
| `ExampleMenu` (`NavigationDataComponent/ExampleMenu`) | Demo-only menu bound to exactly 3 places and UIKit `RectangleButton`s. |

## Internal

| Surface | Note |
|---|---|
| `NavigationUtils` scene and math helpers (`EPSILON`, `forEachSceneObjectInSubHierarchy`, `findScriptComponent`, `getSceneRoot`, `isFunction`, `interpolate`, `quaternionToRoll`, `quaternionToPitch`, `easeOutElastic`, `ILocationJson`) | Exported but not part of the documented surface; used internally or left over. |
| `NavigationUtils` map / ScreenTransform helpers (`MapParameter`, `getOffsetForLocation`, `setScreenTransformRect01`, `makeCircle2DMesh`, `makeLineStrip2DMeshWithJoints`, …) | Leftovers from the Navigation Template's map module; they reference `MapModule` and are not used by this package. |
| `ARNavigationComponent/Material`, `Mesh`, `Shader`, `Models/Textures` | Assets of the arrow and check sign; referenced by the prefabs. |

## Deprecated

No surface is marked deprecated in this revision (no `@deprecated` in the source).

## Removed

| Removed surface | Replacement |
|---|---|
| The `GUIDE_ReadAndDisable` note inside `NavigationKit__PLACE_IN_SCENE.prefab` | Removed (editor-only instructions). The prefab's runtime guide panel uses `Example/GuideDismissPanel/GuideDismissPanel.ts` (demo scaffolding, see [components](components.md#demo-scaffolding-example)). |
| `onButtonPinched` on the example buttons (SIK `PinchButton`) | UIKit `RectangleButton.onTriggerUp` (see `ExampleMenu`). |

This file records only the surface available in this package revision.

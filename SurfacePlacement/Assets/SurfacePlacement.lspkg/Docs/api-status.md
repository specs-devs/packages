# SurfacePlacement API status

[← Agent usage index](../README.md)

## Use when

Check this file before reusing an older Surface Placement example. It describes
the package revision that contains it (version: see `package.native`).

## Status meanings

- **Current** — recommended public surface for new work.
- **Deprecated** — still present; migrate to the named replacement.
- **Experimental** — public, but compatibility is not guaranteed.
- **Removed** — unavailable in this revision.
- **Internal** — resolvable but not supported API.

## Current API

| Capability | Current surface |
|---|---|
| Start / restart placement | `SurfacePlacementController.getInstance().startSurfacePlacement(settings, callback, onCancelled?)` (`Scripts/SurfacePlacementController`) |
| Cancel placement | `SurfacePlacementController.getInstance().stopSurfacePlacement()`; fires the session's `onCancelled` if it had not completed |
| Configuration | `new PlacementSettings(mode?, useWidget?, widgetOffset?, onSliderUpdated?, interaction?)` (`Scripts/PlacementSettings`) |
| Surface type | `PlacementMode.HORIZONTAL`, `PlacementMode.VERTICAL`, `PlacementMode.NEAR_SURFACE` |
| Confirmation (Horizontal / Vertical) | `PlacementInteraction.HEAD_POSE` (default), `PlacementInteraction.PINCH_OR_TAP` |
| Near-surface height widget | `PlacementSettings` `useWidget`, `widgetOffset`, `onSliderUpdated(worldPos)`; backed by the UIKit `Slider` |
| Drop-in example | `Example` component (`SurfacePlacement.lspkg/Example`) + `SurfacePlacement__PLACE_IN_SCENE.prefab`; public `startPlacement()`, `resetPlacement()` |

Exact members, defaults and constants are in [components.md](components.md).

## Behavior changes in this revision

| Change | Migration |
|---|---|
| Horizontal / Vertical confirm by head pose when the fifth `PlacementSettings` argument is omitted | Pass `PlacementInteraction.PINCH_OR_TAP` to keep pinch/tap confirmation |
| Height-adjustment widget uses the UIKit `Slider` (the SIK 2.x Slider and knob were removed from `SurfaceSlider.prefab`) | No consumer change; `onSliderUpdated` still receives a world position |
| `startSurfacePlacement` takes an optional third `onCancelled` callback, fired when an unfinished session is stopped or replaced | Optional; existing two-argument calls are unchanged |
| `VERTICAL` delivers an upright rotation (local +Y up, +Z out of the wall toward the user) instead of local +Y out of the wall | Remove any local rotation you added to compensate |
| The reticle is switched off (visual disabled, interactables off) once placement completes, not only scaled to zero | No consumer change |

The first four constructor arguments, the `PlacementMode` values and the
serialized `Example` inputs are unchanged.

## Deprecated

| Deprecated surface | Current replacement |
|---|---|
| `Scripts/ForceHover` (not used by any prefab; drives UIKit's deprecated `RoundButton`) | Do not use; UIKit `Button` handles its own hover state |

## Experimental

No package API is designated Experimental in this revision. Placement uses the
public World Query hit-test session, not experimental refinement APIs.

## Removed

| Removed surface | Replacement |
|---|---|
| SIK `Slider` inside `SurfaceSlider.prefab` | UIKit `Slider` (internal to the prefab) |

## Internal

Resolvable, but not supported API: `SurfaceDetector`, `Horizontal`, `Vertical`,
`TableTop`, `SingleSurface`, `SurfaceSlider`, `CircleAnimation`, `DotsLine`,
`HandHintsController`, `Decorators/Singleton`, and the `Prefabs/*.prefab` they
sit on. The controller creates, configures and destroys them; reaching into them
(or into `SurfacePlacementController`'s private fields) is unsupported.

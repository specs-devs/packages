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
| Start / restart placement | `SurfacePlacementController.getInstance().startSurfacePlacement(settings, callback)` (`Scripts/SurfacePlacementController`); starting while a placement runs replaces it |
| Cancel placement | `SurfacePlacementController.getInstance().stopSurfacePlacement()`; the callback is not called |
| Configuration | `new PlacementSettings(mode, showDebug = false)` (`Scripts/PlacementSettings`) |
| Surface type | `PlacementMode.GROUND`, `PlacementMode.WALL`, `PlacementMode.TABLETOP` |
| Debug logs and depth-aim markers | `PlacementSettings.showDebug` (the `SHOW_DEBUG` constant in `Example.ts` for the example) |
| Move placed content across its surface | `SurfaceMove` component (`Scripts/SurfaceMove`) on a UIKit Frame; `@input surfaceContent` |
| Drop-in example | `Example` component (`SurfacePlacement.lspkg/Example`) + `SurfacePlacement__PLACE_IN_SCENE.prefab`; public `startPlacement()`, `resetPlacement()` |

Exact members, defaults and constants are in [components.md](components.md).

## Behavior changes in this revision

| Change | Migration |
|---|---|
| Modes renamed: `HORIZONTAL` → `GROUND`, `VERTICAL` → `WALL`, `NEAR_SURFACE` → `TABLETOP`. Numeric values are unchanged (0, 1, 2) | Rename the members in code; serialized values carry over |
| `PlacementSettings` is `(mode, showDebug = false)`; `mode` is required | Pass a `PlacementMode`; drop the widget and interaction arguments |
| Every mode confirms by dwell: Ground and Wall by a steady view, Tabletop by a flat, still palm. Pinch, tap and a paired phone are not used | Remove pinch / tap prompts from your own UI |
| Ground and Wall: 0.5 s of steady aim, then a 1.0 s fill (was 1.5 s) | No consumer change |
| Ground accepts hits 20–350 cm along the gaze (was 20–500 cm) | Aim at spots within 350 cm |
| High-accuracy hit testing refines the pose during the fill whenever the runtime supports it (not in the Lens Studio editor) | No consumer change |
| Tabletop fits a ring round one hand, measures the table height from depth hits around it, and abandons calibration when the hand is not resting on a surface | No consumer change |
| `WALL` delivers local +Y out of the wall toward the user and local −Z up the wall (the previous revision delivered upright: local +Y up, +Z out of the wall) | Pitch wall content −90° about its local X, as `Example` does for its menu |
| `stopSurfacePlacement()` destroys the placement object immediately rather than on the next frame | No consumer change |
| `Example` inputs are `objectVisuals`, `menuObj` and `placementSettingMode` (0 Tabletop, 1 Ground, 2 Wall; same values as before). It stops only its own unfinished placement when disabled | Assign `menuObj`; re-check serialized `Example` components |

## Deprecated

No package API is deprecated in this revision.

## Experimental

No package API is designated Experimental in this revision. Placement uses the
public World Query hit-test session, including its `highAccuracy` option where
the runtime supports it.

## Removed

| Removed surface | Replacement |
|---|---|
| `PlacementMode.HORIZONTAL`, `VERTICAL`, `NEAR_SURFACE` (Horizontal / Vertical / Near Surface naming) | `PlacementMode.GROUND`, `WALL`, `TABLETOP` |
| `PlacementInteraction` (`HEAD_POSE`, `PINCH_OR_TAP`), the fifth `PlacementSettings` argument, `PlacementSettings.interaction`, and pinch / tap / drag confirmation | Dwell confirmation in every mode |
| Height-adjustment widget: `SurfaceSlider` script and prefab; `PlacementSettings` `useWidget`, `widgetOffset`, `onSliderUpdated` arguments and `useAdjustmentWidget`, `adjustmentWidgetOffset`, `onSliderUpdate` properties | None. Tabletop measures the table height; `SurfaceMove` moves content across its surface |
| Hand hints: `HandHintsController` and `HandHints.prefab` | Each mode's own instruction text on the reticle |
| Mobile controller support (paired phone tap and placement) | Tabletop uses a tracked hand; in the editor a click stands in |
| `onCancelled`, the third `startSurfacePlacement` argument | Track your own "placing" flag; see [lifecycle](lifecycle.md) |
| `Logger` and the `Example` inputs `enableLogging`, `enableLoggingLifecycle` | `PlacementSettings.showDebug` (`SHOW_DEBUG` in `Example.ts`) |
| `Example` inputs `placementInteraction` and `autoStart` | `Example` always starts on `OnStartEvent`; call `startPlacement()` / `resetPlacement()` from your own trigger |
| Red panda example content | A cube under each example's `SurfaceContent` |
| `Scripts/ForceHover` and `Scripts/DotsLine` | None |

## Internal

Resolvable, but not supported API: `SurfaceDetector` (and its exports
`RefinePose`, `dwellFillingText`, `dwellCompleteText`), `Horizontal`,
`Vertical`, `TableTop`, `SingleSurface` (and `HORIZONTAL_RAY_DOWN_TILT`),
`CircleAnimation`, `Decorators/Singleton`, and the `Prefabs/*.prefab` they sit
on. The controller creates, configures and destroys them; reaching into them
(or into `SurfacePlacementController`'s private fields) is unsupported.

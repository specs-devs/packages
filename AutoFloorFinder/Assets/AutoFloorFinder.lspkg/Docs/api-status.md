# AutoFloorFinder API status

[← Agent usage index](../README.md)

## Use when

Check the installed API and distinguish supported behavior from experimental options.

Descriptor: `package.native`. Exact source: `Scripts/AutoFloorFinder.ts`.

| Status | Surface | Notes |
|---|---|---|
| Current | `AutoFloorFinder`, seven Inspector inputs | Required camera; optional floor targets, smoothing, plausible distance and logging. |
| Current | `hasFloor`, `getFloorWorldY`, `getSmoothedFloorWorldY`, `getCalibrationState`, `isLocked` | Heights are cm; initialHeight before first commit. |
| Current | `addOnFloorUpdated` / `removeOnFloorUpdated`; `addOnCalibrationStateChanged` / `removeOnCalibrationStateChanged` | Callback arrays; not UIKit/SIK Event properties. |
| Current | `FloorCalibrationState` | Acquiring=0, Tracking=1, Locked=2. |
| Current | Advanced public tuning fields | Set before onAwake for cached/session configuration; not Inspector inputs. |
| Experimental | `FloorHitAcceptanceMode` and classification/filter fields | PositionOnly default; classification session request and hit filtering both off. Classification can automatically fall back when degraded. |
| Internal | Estimator counters, voting, ground candidates, calibration methods | Private implementation, not a consumer API. |
| Deprecated | None declared in this revision | Do not infer deprecated APIs. |
| Removed | None declared in this revision | No claim about historical versions. |
| Not provided | `onFloorUpdated`, `onCalibrationStateChanged`, `onFloorLost`, `getFloorAnchorPose` | The first two are descriptive log/comment labels, not event properties; the latter are roadmap ideas. |

The getter return type for getCalibrationState is FloorCalibrationState. The package estimates height, not floor extent, occupancy, tabletop selection or navigation.

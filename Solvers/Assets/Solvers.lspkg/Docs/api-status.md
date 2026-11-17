# Solvers API status

[← Agent usage index](../README.md)

## Use when

Check this file before choosing a solver or copying an older Solvers example.
It is the compatibility index for the package revision that contains it.

## Status meanings

- **Current**: recommended public surface for new work.
- **Deprecated**: still present; migrate to the named replacement.
- **Experimental**: public, but compatibility is not guaranteed.
- **Removed**: unavailable in this revision.
- **Internal**: resolvable, but not supported API.

## Current

| Capability | Current surface (`Solvers.lspkg/Scripts/TS/…`) |
|---|---|
| Yaw-only face target | `BillboardTS` (`BillboardTS`) |
| Follow with offset | `TetherTS` (`TetherTS`) |
| Lazy follow on look-away | `TetherBetweenAngleRangeTS` (`TetherBetweenAngleRangeTS`) |
| Copy transform | `MatchTransformTS` (`MatchTransformTS`) |
| Scale by distance | `ScaleOverDistanceLinearTS` (`ScaleOverDistanceLinear`) |
| Distance thresholds / ranges | `DistanceEventsTS` + `DistanceRange` (`DistanceEventsTS`) |
| Halfway orientation | `InBetweenRotationUtilityTS` (`InBetweenRotationUtilityTS`) |
| Sharp-turn detection | `SharpTurnTS` (`SharpTurnTS`) |
| Prefab with all examples, guide and carousel | `Solvers__PLACE_IN_SCENE.prefab` |

The JS twins under `Scripts/JS/` are Current for JavaScript projects. They have
the same behavior and Inspector inputs, with the differences listed below.

Full-axis look-at is not part of this package. Use the engine
`LookAtComponent`, as the prefab's `[LookAt]` group does.

## Deprecated

| Deprecated surface | Current replacement |
|---|---|
| Import path `Solvers.lspkg/TS/<File>` (older README) | `Solvers.lspkg/Scripts/TS/<File>` |
| `createComponent("Component.ScriptComponent")` then a cast (older README) | `createComponent(<Class>.getTypeName())` |

## Experimental

No package API is designated Experimental in this revision.

## Removed

No removals are recorded for this revision.

## Internal

| Surface | Note |
|---|---|
| `Scripts/TS/SolversShowcase` | Demo driver for the prefab's carousel, on its `Solvers` child. It finds solvers by component type (plus duck-typed fields for the rest). |
| `Example/ExampleCarousel`, `Example/GuideDismissPanel` | Demo scaffolding used by the prefab (guide and carousel). See [components](components.md#demo-scaffolding-example). |
| `Scripts/GuideDismissPanel/GuideDismissPanel` | Older guide panel used by sample projects. It is unreferenced by the prefab and shares its class name with `Example/GuideDismissPanel` and copies in other packages; use `Example/GuideDismissPanel` and pick the script asset by path. |
| `DistanceEventsCallbacks` (TS/JS) | Sample callback holder that only prints. Replace it with your own component. |
| `DistanceRange.update()` | Called by `DistanceEventsTS`; do not call it yourself. |
| Private TS members (`updateTransform`, `calculateNewTargetPosition`, …) | Not supported. The JS twins expose some of them on `script` (see below), but do not rely on them. |

## TS ↔ JS parity

| Area | TS | JS |
|---|---|---|
| Logging inputs | `enableLogging`, `enableLoggingLifecycle` | absent |
| ScaleOverDistance | file `ScaleOverDistanceLinear.ts`, class `ScaleOverDistanceLinearTS`, no getter | `script.getDistance()`, `script.updateScale()` |
| Tether | no public methods | `script.calculateNewTargetPosition()`, `shouldReposition()`, `getCurrentAngle()`, `getFlatAngle()` |
| TetherBetweenAngleRange | no public methods | `script.evaluateConditions()`, `calculateNewTargetPosition()`, `getCurrentAngle()`, `getHorizontalDistance()`, `getVerticalDistance()` |
| MatchTransform | `MathUtils.quaternionToEuler` (Utilities) | local `quaternionToEuler`; `script.updateTransform()` exposed |
| InBetweenRotation | `getForwardVector` private | `script.getForwardVector()` exposed |
| DistanceEventsCallbacks | silent at start | prints "initialized" on start |

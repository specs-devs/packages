# Utilities API status

[← Agent usage index](../README.md)

## Use when

Read before reusing an older snippet or tutorial: it lists what this installed
revision supports and what changed.

## Current

| Surface | Notes |
|---|---|
| `Logger` (instance) | Plain `time \| tag \| LEVEL \| message` lines. |
| `ValidationUtils`, `SceneObjectUtils`, `ComponentUtils`, `MathUtils` + `GeoCoordinate`, `MeshUtils`, `ScreenTransformUtils`, `TypeConversionUtils` (static) | Signatures in [components](components.md). |
| `AnimationUtils` (static) | Runs on InteractionKit's `animate()`; returns SIK cancel functions / `CancelSet`s. |

## Changed in this revision

| Surface | Before | Now |
|---|---|---|
| `AnimationUtils.makeTween` | Used an undeclared global `script` → `TypeError: Cannot read property 'createEvent' of undefined` on the first call from any TypeScript component. | Same signature and callbacks (per-frame `t`, final `callback(1)`, returned cancel function), driven by SIK `animate()`. |
| `AnimationUtils.animateScale`, `animateVisualFeedback` | Called undeclared globals `animate` / `CancelSet`. | Import them from `InteractionKit.lspkg/Utils/animate`; the returned `CancelSet` has `.cancel()`. |
| `MeshUtils.makeLineStrip2DMeshWithJoints` | Joint circles were indexed 2 vertices short per point: wrong triangles, square corners, broken end caps from the 2nd point on. | Every joint and end is a round cap. |

## Deprecated

None.

## Removed

| Name | Replacement |
|---|---|
| `UtilitiesKit.lspkg/...` import paths and the "UtilitiesKit" name (older docs) | `Utilities.lspkg/Scripts/Utils/...` |

## Known gaps

- `Logger.useColors` / `setColorsEnabled` have no effect.
- `ComponentUtils.safeInitialize(null)` throws (the null check is outside the `try`).
- `ScreenTransformUtils.getScreenTransformPositionsAsArray` samples local (0, 0)
  and (1, 1), i.e. the center and the top-right corner, not the full bounds.
- No helper guards against zero/degenerate input: zero-length line segments,
  parents with zero width/height, or more than 65 535 mesh indices.
- `ScreenTransformUtils` is not exercised by the demo prefab (no ScreenTransform
  UI in a Specs scene); its behavior here is read from the source.

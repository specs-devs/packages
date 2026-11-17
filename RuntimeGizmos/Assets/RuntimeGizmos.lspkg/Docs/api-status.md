# RuntimeGizmos API status

[← Agent usage index](../README.md)

## Use when

Check this file before reusing an older Runtime Gizmos example. It describes
the package revision that contains it.

## Status meanings

- **Current** — recommended public surface for new work.
- **Deprecated** — still present; migrate to the named replacement.
- **Experimental** — public, but compatibility is not guaranteed.
- **Removed** — unavailable in this revision.
- **Internal** — resolvable but not supported API.

## Current API

| Capability | Current surface (prefix `RuntimeGizmos.lspkg/Scripts/`) |
|---|---|
| Line between two objects | `Line`: `startPointObject`, `endPointObject`, `beginColor`, `endColor`, `visualStyle`, `lineStyle`, `isEnabled` |
| Closed shape | `ClosedPolyline`: `points`, `continuousLine`, `refreshLine()`, `setPoints()`, `setColor()`, `getPoints()`, `isEnabled` |
| Circle | `Circle`: `centerObject`, `radius`, `followRotation`, `setRadius()`, `setSegments()`, `setFollowRotation()`, `refreshCircle()`, `color`, `isEnabled` |
| Curve | `Spline`: `controlPoints`, `tension`, `interpolationPoints`, `closedLoop`, `setTension()`, `setControlPoints()`, `addControlPoint()`, `removeControlPoint()`, `refreshSpline()`, `color`, `isEnabled` |
| Spiral | `Spiral`: `centerObject`, amplitudes, `axisLength`, `loops`, `axisDirection`, `spiralType`, matching `set*()` methods, `refreshSpiral()`, `color`, `isEnabled` |
| Styles | `lineStyle` numbers `0` Full / `1` Split / `2` FadedEnd (SIK `VisualStyle`) |
| Build from code | Every gizmo: `rebuild()`, `setLineMaterial(material)`, `setLineWidth(width)`; object inputs are `@allowUndefined`, so `createComponent` works |
| Ready-made scene | `RuntimeGizmos__PLACE_IN_SCENE.prefab` |

`Spline.tension` is honored in this revision (Hermite form; 0.5 matches the
previous Catmull-Rom curve).

## Deprecated

| Deprecated surface (older README) | Current replacement |
|---|---|
| `sceneObject.createComponent("Line")`, then assigning inputs | `createComponent(Line.getTypeName())`, assign the inputs, `setLineMaterial()`, then `rebuild()` ([guide](guide.md)) |
| `line.startObject` / `line.endObject` | `startPointObject` / `endPointObject` |
| `line.color` | `beginColor` / `endColor` |
| `line.lineWidth = …`, `x.lineMaterial = …` from code | `setLineWidth(width)` / `setLineMaterial(material)` |
| `polyline.controlPoints` / `polyline.color` | `points` + `setPoints()` / `setColor()` |
| `circle.segments = …` from code | `setSegments(n)` |

## Experimental

No surface is designated Experimental in this revision.

## Removed

| Removed surface | Replacement |
|---|---|
| `Scripts/GuideDismissPanel/GuideDismissPanel.ts` (old guide copy) | none; it was unused sample scaffolding |

## Internal

The `InteractorLineRenderer` instances, `update()` per-frame hooks,
`createOrUpdateLines`/`createCircle`/`createSpline`/`createSpiral` and point
generators are implementation details.

## Known inert members in this revision

- `Line.lineLength`, `Line.shouldStick`: serialized but never applied.
- `Spiral.totalSegments` / `setTotalSegments(n)`: values below 80 are raised to 80.

# RuntimeGizmos troubleshooting

[← Agent usage index](../README.md)

## Use when

A gizmo doesn't draw, doesn't follow, or throws. Generic scene, rendering and
scripting issues belong to the relevant CLAD skill (`lens-debug`,
`camera-and-rendering`).

## Known issues

| Symptom | Package cause | Package fix |
|---|---|---|
| `ClosedPolylineVisual requires at least 2 points` at start | `ClosedPolyline.points` has exactly 1 entry when `onAwake` runs (an empty list just waits for `setPoints()` / `rebuild()`) | Wire ≥ 2 points in the Inspector |
| A Line draws nothing, no error | `startPointObject`, `endPointObject` or the material is unset when `onAwake` runs (the message goes to `logger.debug`) | Wire them in the Inspector, or set them from code and call `rebuild()` |
| Circle / Spline / Spiral draws nothing, no error | Center or material unassigned, or a Spline with fewer than 2 control points; the message goes to `logger.debug` (hidden) | Wire the reference (or assign it from code and call `rebuild()`); turn on `enableLogging` to see the message |
| A created-by-code gizmo draws nothing | `onAwake` ran inside `createComponent`, before the references were assigned | Assign the references, call `setLineMaterial(mat)` (and `setLineWidth(w)`), then `rebuild()` |
| Line or ClosedPolyline drawn offset or in the wrong place | They use the points' **local** positions, drawn in the gizmo object's local space | Keep the gizmo object and its points siblings under one parent, gizmo at identity |
| ClosedPolyline doesn't follow moved points | It is built once | Call `refreshLine()` or `setPoints()` |
| Changing `lineStyle` at runtime does nothing | It is read only when the line is built | Line: set `visualStyle`. Others: set `lineStyle`, then `refresh*()` |
| `Spline.tension` has no effect | Older revisions hard-coded Catmull-Rom | Fixed in this revision (0 straight … 1 tight) |
| `setTotalSegments(40)` draws the same as 80 | 80 is the minimum for both the inspector value and `setTotalSegments` (lower values are raised to 80) | Use ≥ 80 for a visible change |
| Gizmos look tiny | The prefab authors them about 2 m away with 0.1–0.5 cm lines | Bring the group closer (QA used z −150) or scale up the radii/points |
| Old README snippet doesn't compile (`startObject`, `color` on Line, `createComponent("Line")`) | Pre-revision names | See [api-status](api-status.md) deprecated table |
| Destroying a Line / ClosedPolyline component also destroyed its SceneObject | Older revisions called `sceneObject.destroy()` in `onDestroy` | Fixed in this revision: only the gizmo's own line objects are removed |

## Verification

After a fix, preview and move each target: Line/Circle/Spline/Spiral follow,
and ClosedPolyline follows after a refresh. The logs show no gizmo errors.

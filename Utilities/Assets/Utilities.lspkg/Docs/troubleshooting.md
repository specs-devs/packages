# Utilities troubleshooting

[← Agent usage index](../README.md)

## Use when

Read when a helper behaves differently from its name, or a script that imports
Utilities fails. Entries marked (QA) were reproduced in the Lens Studio
Preview while preparing this revision.

| Symptom | Cause | Fix |
|---|---|---|
| `Cannot find module 'UtilitiesKit.lspkg/...'` | Old package name in the import. | Import from `Utilities.lspkg/Scripts/Utils/<Class>`. |
| `TypeError: Cannot read property 'createEvent' of undefined` at `makeTween` (QA) | Utilities older than this revision: `makeTween` used a global `script` that TypeScript modules don't have. `animateScale` / `animateVisualFeedback` failed the same way on `animate` / `CancelSet`. | Update the package; this revision runs them on SIK `animate()`. |
| Line strip has square corners, missing or spiky joints, broken end caps (QA) | Utilities older than this revision indexed each joint circle 2 vertices short. | Update the package. |
| `Cannot find module 'InteractionKit.lspkg/Utils/animate'` | InteractionKit is missing from the project. It is declared in Utilities' `package_dependencies.json` and comes in with the package, so this usually means it was removed or `Utilities.lspkg` was copied in by hand. | Re-add InteractionKit from the Asset Library (or keep `InteractionKit.lspkg` in the project's `Packages/`), so `InteractionKit.lspkg/Utils/animate` resolves. |
| `findComponentInHierarchy(root, "MyComponent")` returns null (QA) | A TS component's type name is an opaque id (`Component.<id>`), not the class name. | Pass `String(MyComponent.getTypeName())`. |
| `Argument of type 'TypeName<…>' is not assignable to parameter of type 'string'` (QA) | `getTypeName()` returns a `TypeName`, the helpers take a `string`. | Wrap it: `String(MyComponent.getTypeName())`. |
| `getRootCamera()` throws "Camera not found in scene" | Only scene root objects are searched; the camera is a child, or the scene has none. | Keep the Camera object at the scene root, or find it yourself. |
| A component on a child isn't found | `findRootWithComponent` checks root objects only; `findInParents` walks up, not down; `findComponentInHierarchy` checks ScriptComponents only. | Pick the helper by direction, or use `forEachSceneObjectInSubHierarchy`. |
| No log lines at all (QA) | The Logger was created with `debugEnabled = false`, or `setDebugEnabled(false)` was called: that silences every level. | Keep one enabled Logger for warnings/errors. |
| Logger colors never change | `useColors` is stored but unused. | None needed; output is plain text. |
| `animateVisualFeedback` resets the object's size | It animates scale 0 ↔ 1, not opacity. | Use `animateScale` with your own start/end scale, or animate the material alpha yourself. |
| Animation keeps running after the object is disabled | SIK `animate()` is not tied to components. | Keep the cancel function / `CancelSet` and cancel in `OnDisableEvent` / `OnDestroyEvent`. |
| Generated mesh is invisible or black | Meshes have positions only (no normals/UVs) and face +Z. | Use an unlit material and look at the XY plane from +Z (or make the material two-sided). |
| Recoloring one generated mesh recolors all of them | `addRenderMeshVisual` uses the material you pass. | `material.clone()` per object before setting `mainPass.baseColor`. |
| `safeParseNumber("12abc")` returns 12 | `parseFloat` accepts a numeric prefix. | Validate the whole string yourself if strict input matters. |
| `safeParseInt("-1.5")` returns −2 | It uses `Math.floor`. | Use `Math.trunc(safeParseNumber(...))` for truncation. |
| `toBoolean(" true ")` is false | No trimming. | `toBoolean(value.trim())`. |
| `safeInitialize(null)` throws | The null check is outside the `try`. | Check the reference first (`ValidationUtils.isNotNull`). |
| Bounds-change check misses a resize | `getScreenTransformPositionsAsArray` samples the center and the top-right corner only, compared as strings. | Compare `getScreenTransformWorldWidth` / `Height` as well. |

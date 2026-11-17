# Utilities components

[← Agent usage index](../README.md)

## Use when

Read for the exact import path, signature, defaults and behavior of a helper.
The library has no `@component` scripts, `@input`s or events: it is nine
classes (plus the `GeoCoordinate` type) under `Scripts/Utils/`. Every method is
`static` except on `Logger`. The demo prefab's components live in `Example/`
(see [Demo scaffolding](#demo-scaffolding-example)).

| Class | Import |
|---|---|
| `Logger` | `Utilities.lspkg/Scripts/Utils/Logger` |
| `ValidationUtils` | `Utilities.lspkg/Scripts/Utils/ValidationUtils` |
| `SceneObjectUtils` | `Utilities.lspkg/Scripts/Utils/SceneObjectUtils` |
| `ComponentUtils` | `Utilities.lspkg/Scripts/Utils/ComponentUtils` |
| `MathUtils`, `GeoCoordinate` | `Utilities.lspkg/Scripts/Utils/MathUtils` |
| `AnimationUtils` | `Utilities.lspkg/Scripts/Utils/AnimationUtils` |
| `MeshUtils` | `Utilities.lspkg/Scripts/Utils/MeshUtils` |
| `ScreenTransformUtils` | `Utilities.lspkg/Scripts/Utils/ScreenTransformUtils` |
| `TypeConversionUtils` | `Utilities.lspkg/Scripts/Utils/TypeConversionUtils` |

## Logger

`new Logger(tag: string, debugEnabled: boolean = true, useColors: boolean = true)`

Each call prints one line with `print()`: `HH:MM:SS | <tag> | <LEVEL> | <message>`
(UTC time from `new Date().toISOString()`).

| Member | Behavior |
|---|---|
| `info(m)`, `debug(m)`, `warn(m)`, `error(m)`, `success(m)` | Print with level `INFO` / `DEBUG` / `WARN` / `ERROR` / `SUCCESS`. All are skipped while `debugEnabled` is false. |
| `separator(char = "-", length = 80)` | Prints `char` repeated `length` times. |
| `header(m)` | `=` separator, `\| M` (upper-cased), `=` separator. |
| `setDebugEnabled(enabled)` | Turns every level on or off. |
| `setColorsEnabled(enabled)` | Stored only; output is never colored. |

## ValidationUtils

| Method | Behavior |
|---|---|
| `assertNotNull<T>(value, message): T` | Returns `value`; throws `Error(message)` if null/undefined. |
| `assert(condition, message): void` | Throws `Error(message)` if `condition` is false. |
| `ifNotNull<T, R>(value: T \| null, cb): R \| null` | Runs `cb(value)` unless null/undefined, else returns `null`. |
| `ifExists<T extends object, R>(ref, cb): R \| undefined` | Same for object refs; returns `undefined` when absent. |
| `validateInputs(inputs: {[key: string]: any}, requiredKeys: string[]): void` | Throws `Error("Required input '<key>' is missing or null")` for the first key that is absent (`in` check) or null/undefined. |
| `isNull(value)`, `isNotNull(value)` | `value === null \|\| value === undefined` and its negation (plain booleans, not type guards). |

## SceneObjectUtils

| Method | Behavior |
|---|---|
| `forEachSceneObjectInSubHierarchy(so, fn, includeSelf = true)` | Calls `fn` on `so` (if `includeSelf`) and every descendant, depth first, once each. |
| `findScriptComponent(so, propertyName): ScriptComponent \| null` | First ScriptComponent on `so` whose `propertyName` value is truthy (`0`, `false`, `""` don't count). |
| `getSceneRoot(so): SceneObject` | Top-most ancestor (or `so` itself). |
| `findComponentInHierarchy<T>(root, typeName): T \| null` | Depth-first search of `root` and its descendants for a ScriptComponent whose `getTypeName()` equals `typeName`. For a TS component pass `String(MyComponent.getTypeName())`. Only ScriptComponents are inspected. |
| `getOrCreateComponent<T>(so, componentTypeName): T` | `getComponent`, else `createComponent`. |
| `findSceneObjectByNameVariations(root, targetName, customVariations?)` | Depth-first, case-insensitive. Matches an object whose name equals `targetName` or equals / ends with one of the variations: `targetName` without `_`, with `_` → space, `mixamorig:`, `_jnt`, `_bone`, `human_low:_`, `human_high:_`, `human:_`, `_`, `:_`, `:` forms, plus `customVariations`. |

## ComponentUtils

| Method | Behavior |
|---|---|
| `findInParents<T>(so, componentTypeName): T \| null` | `getComponent` on `so`, then each parent up to the root. |
| `safeInitialize(component): boolean` | Calls `component.initialize()` if it is a function; `true` on success, `false` if it throws or is missing. `component` must not be null. |
| `findRootWithComponent(componentTypeName): SceneObject \| null` | First scene ROOT object with that component (children are not searched). |
| `getRootCamera(): SceneObject` | `findRootWithComponent("Component.Camera")`; throws `Error("Camera not found in scene. …")` when no root has a Camera. |
| `getAllComponents<T>(so, componentTypeName): T[]` | `so.getComponents(...)` copied into an array. |

## MathUtils

`interface GeoCoordinate { longitude: number; latitude: number; altitude: number }`
(degrees; `altitude` is not used by any method).

| Member | Behavior |
|---|---|
| `EPSILON = 0.000001`, `DegToRad = Math.PI / 180` | Constants. |
| `lerp(start, end, scalar)` | `start + (end - start) * scalar`, not clamped. |
| `mod(n, m)` | Always non-negative for positive `m` (`mod(-1, 4)` = 3). |
| `normalizeAngle(angle)` | Radians wrapped to [−π, π]. |
| `quaternionToRoll(q)`, `quaternionToPitch(q)` | Radians. |
| `quaternionToEuler(q): vec3` | `(pitch, yaw, roll)` in radians, each wrapped to [0, 2π); handles the poles. |
| `interpolateRotation(start, end, peakVelocity)` | `quat.slerp(start, end, peakVelocity * getDeltaTime())` - call once per frame. |
| `easeOutElastic(x)` | Elastic ease-out for `x` in [0, 1] (overshoots above 1). |
| `setVec2(v, source)` | Copies `x`, `y` into `v`. |
| `haversineDistance(a, b)` | Great-circle distance in meters (Earth radius 6 371 km). |
| `calculateBearing(start, end)` | Initial bearing in radians, −π…π (0 = north, clockwise). |

## AnimationUtils

Driven by `animate()` from `SpectaclesInteractionKit.lspkg/Utils/animate`
(see [animation](animation.md)).

| Method | Behavior |
|---|---|
| `makeTween(callback: (t) => void, duration): () => void` | Calls `callback` every frame with linear `t` from 0 to 1 over `duration` seconds, last call `callback(1)`. Returns a cancel function (no further callbacks). `duration <= 0` calls `callback(1)` at once. |
| `pingPong(min, max, t)` | `min + sin(t·π)·(max − min)`: `min` at t = 0 and 1, `max` at t = 0.5. |
| `animateScale(so, startScale, endScale, duration, easing = "ease-out-cubic", onComplete?)` | Tweens the local scale; `easing` is a SIK easing name. Returns a SIK `CancelSet`. |
| `animateVisualFeedback(so, fadeIn, duration = 0.5, onComplete?)` | Scale 0 → 1 (`fadeIn`, ease-out-cubic) or 1 → 0 (ease-in-cubic). Returns a SIK `CancelSet`. |
| `getEasingId(name)`, `getEasingName(id)`, `getAllEasings()` | Display-name ↔ id map ("Cubic Out" = 8, …, 34 entries). Unknown → 0 / `"None"`. |

## MeshUtils

Meshes have a single `position` attribute (3 floats), `MeshTopology.Triangles`,
`MeshIndexType.UInt16`, in the XY plane with front faces toward +Z.

| Method | Behavior |
|---|---|
| `makeCircle2DMesh(position, radius): RenderMesh` | Filled 16-segment circle. |
| `makeCircle2DIndicesVerticesPair(position, radius, segments, indicesOffset): number[][]` | `[indices, flatXYZ]`; emits `segments + 2` vertices (center + closed ring). |
| `makeLineStrip2DMeshWithJoints(positions: vec3[], thickness): RenderMesh` | One quad per segment plus a round cap (radius `thickness / 2`) at every point. |
| `makeLine2DIndicesVerticesPair(start, end, thickness, indicesOffset): number[][]` | One quad (4 vertices, 6 indices); `start` and `end` must differ. |
| `addRenderMeshVisual(so, mesh, material, renderOrder): RenderMeshVisual` | Creates a new RenderMeshVisual with that mesh, material (not cloned) and render order. |

## ScreenTransformUtils

| Method | Behavior |
|---|---|
| `getScreenTransformPositionsAsArray(st): vec3[]` | World points of local (0, 0) and (1, 1) - the center and the top-right corner. |
| `wasClicked(st, screenPoint)` | Enabled in hierarchy and `containsScreenPoint(screenPoint)`. |
| `getScreenTransformWorldWidth(st)`, `getScreenTransformWorldHeight(st)` | World distance between the local corners (−1…1). |
| `getWorldWidthToRelativeToParentWidth(parent, w)`, `getWorldHeightToRelativeToParentHeight(parent, h)` | `w / parentWorldWidth`, `h / parentWorldHeight` (no zero guard). |
| `setScreenTransformRect01(st, x, y, width, height)` | Sets anchors from 0…1 values; `x`, `y` = top-left from the left/top edge. |
| `compareScreenTransformsPositionsArray(a, b)` | Exact `toString()` comparison. |

## TypeConversionUtils

| Method | Behavior |
|---|---|
| `convertToNumber(s)` | Replaces the first `,` with `.`, then `parseFloat`; throws `Error("Invalid number format: …")` on `NaN`. |
| `safeParseNumber(str, defaultValue = 0)` | `convertToNumber`, or `defaultValue` when it throws. |
| `safeParseInt(str, defaultValue = 0)` | `Math.floor(convertToNumber(str))`, or `defaultValue`. |
| `toBoolean(value)` | Booleans as-is; strings `"true"`, `"1"`, `"yes"` (any case, no trim) → true; numbers ≠ 0 → true; otherwise `Boolean(value)`. |
| `toString(value, defaultValue = "")` | `defaultValue` for null/undefined, else `String(value)`. |

## Demo scaffolding (`Example/`)

`Utilities__PLACE_IN_SCENE.prefab` carries its own demo UI, shipped in
`Utilities.lspkg/Example/`. These are demo scripts, not library API: reuse them
for a demo, not as a Lens pattern. Both need SIK and UIKit in the scene.

### ExampleCarousel

`Example/ExampleCarousel/ExampleCarousel.ts`, on the prefab's `ExampleCarousel`
child. A UIKit panel with the example name, a description, Previous / Next and
a minimize button. It shows one example at a time and moves the examples in
front of the user's head pose.

| Input | Type | Default | Meaning |
|---|---|---|---|
| `examples` | `SceneObject[]` | `[]` | example roots, one enabled at a time; the prefab lists `MathAndConversion`, `MeshShapes`, `Animation`, `SceneAndComponents` |
| `exampleInfo` | `string[]` | `[]` | description per example |
| `steps` | `SceneObject[]` | `[]` | optional sub-examples stepped through one at a time; empty on the prefab |
| `stepInfo` | `string[]` | `[]` | description per entry of `steps`; empty entries fall back to the example's info; empty on the prefab |
| `startIndex` | `number` | `0` | example shown first |
| `previousLabel` / `nextLabel` | `string` | `"Previous"` / `"Next"` | button labels |
| `examplesPushBack` | `number` | `20` | extra distance (cm) of the examples behind the panel |
| `anchorExamples` | `boolean` | `true` | move the examples to the head pose at start |
| `startMinimized` | `boolean` | `false` | start collapsed to the title bar |
| `extraPanelDrop` | `number` | `0` | extra drop (cm) of the panel |

### GuideDismissPanel

`Example/GuideDismissPanel/GuideDismissPanel.ts`, on the prefab's `Guide`
child (next to a UIKit `Frame`, with a `GuideText` and an `OkButton` child).
It shows the guide in front of the user and closes it on "Ok, I understood".

| Input | Type | Default | Meaning |
|---|---|---|---|
| `buttonLabel` | `string` | `"Ok, I understood"` | button label when the panel is built at runtime |
| `hideUntilDismissed` | `SceneObject[]` | `[]` | objects hidden while the guide shows; the prefab lists `ExampleCarousel` and the four examples, never the prefab root |

### Demo scripts

`Example/UtilitiesDemo/` holds one script per example (`MathConversionDemo`,
`MeshShapesDemo`, `AnimationDemo`, `SceneComponentsDemo`) plus the shared
`DemoText` helpers. `MeshShapesDemo` and `AnimationDemo` take the demo
material `Example/Materials/UtilitiesDemoUnlit.mat`. See
[examples](examples.md#demo-project).

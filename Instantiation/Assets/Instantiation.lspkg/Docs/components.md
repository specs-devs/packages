# Instantiation components

[← Agent usage index](../README.md)

## Use when

You need the exact class, import path, input names, defaults or placement math
of a layout. All facts come from `Scripts/TS/*.ts` and `Scripts/JS/*.js` in
this revision.

## Paths

| Layout | TS class / import (`Instantiation.lspkg/Scripts/TS/…`) | JS twin (`Instantiation.lspkg/Scripts/JS/…`) |
|---|---|---|
| Random in circle (center-weighted) | `CircleAreaInstantiatorTS` | `CircleAreaInstantiatorJS.js` |
| Even ring | `CirclePerimeterInstantiatorTS` | `CirclePerimeterInstantiatorJS.js` |
| Arc / partial ring | `CirclePerimeterInstantiatorWithFixedArcLengthTS` | `CirclePerimeterInstantiatorWithFixedArcLengthJS.js` |
| Polygon edges | `CircleSlicingInstantiatorTS` | `CircleSlicingInstantiatorJS.js` |
| N along a line | `InstantiateAlongLineTS` | `InstantiateAlongLineJS.js` |
| Every d along a line | `InstantiateAlongLineWithFixedDistanceTS` | `InstantiateAlongLineWithFixedDistanceJS.js` |
| 2D grid | `InstantiateOn2DGridsTS` | `InstantiateOn2DGridsJS.js` |
| 3D grid | `InstantiateOn3DGridsTS` | `InstantiateOn3DGridsJS.js` |
| Random inside box | `RandomPointsInsideBoxTS` | `RandomPointsInsideBoxJS.js` |
| Random inside sphere | `RandomPointsInsideSphereTS` | `RandomPointsInsideSphereJS.js` |
| Random on box surface | `RandomPointsOnBoxSurfaceTS` | `RandomPointsOnBoxSurfaceJS.js` |
| Random on sphere surface | `RandomPointsOnSphereSurfaceTS` | `RandomPointsOnSphereSurfaceJS.js` |
| Uniform random in circle | `SimpleCircleAreaInstantiatorTS` | `SimpleCircleAreaInstantiatorJS.js` |
| Random in square | `SquareAreaInstantiatorTS` | `SquareAreaInstantiatorJS.js` |
| Inside / on a target's box or sphere | `SimpleColliderInstantiatorTS` | `SimpleColliderInstantiatorJS.js` |

TS: `import {InstantiateOn3DGridsTS} from "Instantiation.lspkg/Scripts/TS/InstantiateOn3DGridsTS"` (named export, class
name = file name). JS: add the `.js` asset as a Script component in the
Inspector. Its inputs appear as properties on that ScriptComponent.

## Shared behavior (all 15, TS and JS)

- **When**: `onAwake` binds an `OnStartEvent`. The layout is spawned **once, at
  start**. Inputs are read at that moment, not in `onAwake`.
- **Where**: each copy is `prefab.instantiate(<this script's SceneObject>)`,
  so all copies become children of the instantiator object. Each copy's
  world position is then set from the layout.
- **Frame**: offsets are computed along world axes from the center's world
  position. For the 12 center-based layouts, they are then rotated by the
  center's **world rotation** (`origin + rot × (p − origin)`), so the layout
  follows the center's orientation. The center's **scale is ignored**: sizes are
  world cm. Line layouts follow their endpoints. `SimpleColliderInstantiator`
  uses the target's rotation and scale.
- **Missing references**: a missing center/prefab makes the layout skip silently
  (TS logs it with `enableLogging`; JS uses `print`).
- **TS only**: `enableLogging`, `enableLoggingLifecycle` (both `false`). The
  JS twins have no logging inputs.
- **Public TS methods**: `onStart()` plus the layout method named below. Calling
  them yourself spawns **another** full layout.

Counts are `number` inputs (JS: `float`). Fractional values are truncated by
the loops.

## Circle family (layout in the center's local XY plane)

| Class | Inputs (default) | Placement |
|---|---|---|
| `CircleAreaInstantiatorTS` | `center`, `prefab`, `numberOfPrefabs` (10), `radius` (5.0) | Random angle, distance `random × radius`. Denser toward the center. Method: `instantiatePrefabs()` |
| `SimpleCircleAreaInstantiatorTS` | `center`, `prefab`, `numberOfPrefabs` (10), `radius` (5.0) | Uniform over the disc (rejection sampling). `instantiatePrefabs()` |
| `CirclePerimeterInstantiatorTS` | `center`, `prefab`, `numberOfPrefabs` (10), `radius` (5.0), `spawnInterval` (0.12 s), `popDuration` (0.3 s), `loop` (true), `holdTime` (1.5 s) | `numberOfPrefabs` evenly spaced on the ring, the first at +X, spawned one every `spawnInterval` with a scale pop-in; with `loop` the full ring is held for `holdTime`, cleared and spawned again. `spawnInterval` 0 + `loop` off = the old all-at-once layout. `instantiatePrefabs()` spawns the whole ring at once. It also has an empty `onDrawGizmos()` |
| `CirclePerimeterInstantiatorWithFixedArcLengthTS` | `center`, `prefab`, `radius` (5.0), `numberOfPrefabs` (10), `arcLength` (2.0, **unused**), `startAngle` (0°), `arcAngleSpan` (360°) | `n` copies from `startAngle` over `arcAngleSpan`, both ends included (step = span / (n − 1)). A full circle (`arcAngleSpan` ≥ 360°) leaves the end out (step = span / n), so no copy lands on the first. `instantiatePrefabs()` |
| `CircleSlicingInstantiatorTS` | `prefab`, `center`, `xSlices` (8), `yElementsPerSlice` (5), `radius` (5.0) | `xSlices` polygon edges between ring points, `yElementsPerSlice` per edge, starting at the edge's first corner; the end corner belongs to the next edge, so no copy is doubled (1 = one copy per corner). `instantiateElementsInSlices()` |
| `SquareAreaInstantiatorTS` | `center`, `prefab`, `numberOfPrefabs` (10), `size` (5.0 = **half**-width) | Uniform in the square `±size`. `instantiatePrefabs()` |

## Lines

| Class | Inputs (default) | Placement |
|---|---|---|
| `InstantiateAlongLineTS` | `prefab`, `startPoint`, `endPoint`, `numberOfObjects` (10) | `n` copies from start to end, both ends included. `n = 1` or coincident endpoints put the copies at the start point. `instantiateObjectsAlongLine()` |
| `InstantiateAlongLineWithFixedDistanceTS` | `prefab`, `startPoint`, `endPoint`, `fixedDistance` (1.0) | A copy every `fixedDistance` from start, `floor(len / d) + 1` copies. The end is included only when the length is a multiple of `d`. `instantiateObjectsAlongLine()` |

The endpoints are read once, at start. The copies don't follow later endpoint
moves.

## Grids

| Class | Inputs (default) | Placement |
|---|---|---|
| `InstantiateOn2DGridsTS` | `prefab`, `gridCenter`, `gridWidth` (5), `gridHeight` (5), `spacingX` (1.5), `spacingY` (1.5), `zPosition` (0.0) | A centered `gridWidth × gridHeight` grid in the center's local **X–Y** plane (vertical, facing +Z), offset `zPosition` along Z. `instantiateGrid()` |
| `InstantiateOn3DGridsTS` | `prefab`, `gridCenter`, `gridWidth`/`gridHeight`/`gridDepth` (5/5/5), `spacingX`/`spacingY`/`spacingZ` (1.5 each) | A centered W × H × D lattice. `instantiateGrid()` |

## Box and sphere volumes

| Class | Inputs (default) | Placement |
|---|---|---|
| `RandomPointsInsideBoxTS` | `boxObject`, `prefab`, `numberOfPoints` (10), `sizeX`/`sizeY`/`sizeZ` (1.0, full size) | Uniform inside the box. `generateRandomPointsInside()` |
| `RandomPointsOnBoxSurfaceTS` | same inputs | A random face (each face equally likely, whatever its area), then a uniform point on it. `generateRandomPointsOnSurface()` |
| `RandomPointsInsideSphereTS` | `sphere`, `prefab`, `numberOfPoints` (10), `radius` (1.0) | Uniform inside the ball (rejection sampling). `generateRandomPointsInside()` |
| `RandomPointsOnSphereSurfaceTS` | same inputs | A random point on the sphere surface: a cube sample, normalized. Not perfectly uniform; slightly denser toward the cube-corner directions. `generateRandomPointsOnSurface()` |

`boxObject` / `sphere` only supply the center (and, for orientation, the
rotation). Their scale and meshes are ignored.

## `SimpleColliderInstantiatorTS`

| Input | Type | Default | Notes |
|---|---|---|---|
| `prefab` | `ObjectPrefab` | — | |
| `targetObject` | `SceneObject` | — | Defines the volume |
| `numberOfInstances` | `number` | `10` | |
| `instantiateInside` | `boolean` | `true` | `false` = on the surface |
| `prefabScale` | `number` | `1.0` | |
| `randomScaleVariation` | `number` | `0.0` | 0–1. Scale is uniform in `[max(0.1, s·(1−v)), s·(1+v)]` |
| `enableLogging` / `enableLoggingLifecycle` | `boolean` | `false` | TS only |

- The volume is a **unit cube (or radius-0.5 sphere) in the target's local
  space**, mapped through the target's world transform. It fits a unit cube
  mesh such as the prefab's `Box` scaled to 40 cm, and stays correct under
  scaled or rotated parents. The collider's own box size is not read.
- The shape is detected by looking for `Box` / `Sphere` / `Capsule` in the
  target's component type names. Anything else, including a capsule, falls
  back to box sampling. A sphere radius comes from a component `radius`
  property if one is found (in the target's local units), otherwise 0.5 (a unit
  sphere; a non-uniform scale makes it an ellipsoid that matches a scaled sphere mesh).
- When `prefabScale ≠ 1` or a variation is set, each copy's **local scale is
  overwritten** with the uniform value. The prefab root's own scale is not
  multiplied.
- Public methods: `onStart()`, `instantiateInsideCollider()`,
  `instantiateOnColliderSurface()`, `getShapeType()`,
  `getRandomPointInsideCollider()`, `getRandomPointOnColliderSurface()`,
  `randomPointInBox()`, `randomPointOnBoxSurface()`, `randomPointInSphere()`,
  `randomPointOnSphereSurface()` (the point helpers return world positions and
  spawn nothing).

## Prefab: `Instantiation__PLACE_IN_SCENE.prefab`

The prefab root holds `Guide`, `ExampleCarousel` and `Examples` (local
(0, −8, 0)). `Examples` contains 15 groups named `"[<Layout>]"`:
`[CircleAreaInstantiator]` … `[SimpleColliderInstantiator]`. Only
`[InstantiateOn3DGrids]` is enabled in the file; at runtime the carousel shows
one group at a time. Each group holds:

- `<Layout>TS`: the enabled TS component
- `<Layout>JS`: the disabled JS twin, wired the same way
- its references, for example `Center`, the line endpoints, or a `Box` with a
  Physics Collider for the collider layout

`[InstantiateAlongLine]` also draws the line with the bundled demo
`RuntimeGizmos/Line.ts` (class `Line`).

## Demo scaffolding (Example/)

Demo-only scripts shipped in `Instantiation.lspkg/Example/` so the prefab works
on its own. They aren't part of the package API. Remove `Guide` and
`ExampleCarousel` when you build your own Lens; the layout groups work without
them.

| Script | Object | Key inputs (prefab values) |
| --- | --- | --- |
| `Example/GuideDismissPanel/GuideDismissPanel.ts` | `Guide` (UIKit Frame at local (0, 0, −100), `GuideText`, `OkButton`) | `buttonLabel` (`"Ok, I understood"`), `hideUntilDismissed: SceneObject[]` (`ExampleCarousel`, `Examples`): hidden while the guide shows, enabled when it's closed |
| `Example/ExampleCarousel/ExampleCarousel.ts` | `ExampleCarousel` (local (0, −22, −150)) | `examples: SceneObject[]` (the 15 `[<Layout>]` groups in `Examples`), `exampleInfo: string[]` (one line per layout), `steps: SceneObject[]` (empty), `stepInfo: string[]` (empty; what each step shows, in the same order as `steps`), `startIndex` (`0`), `previousLabel` / `nextLabel`, `examplesPushBack` (`100` cm), `anchorExamples` (`true`, the shown layout is moved in front of the user), `startMinimized` (`false`), `extraPanelDrop` (`0` cm) |

The carousel enables one layout group at a time. Each layout spawns its copies
the first time its group is shown.

## Assets

Sample assets used by the demo; none of them is required by the scripts.

| Asset | Use |
| --- | --- |
| `ExamplePrefabInstantiateSphere.prefab`, `ExamplePrefabInstantiateSphere2.prefab` | Sample spawn prefabs (`Meshes/Sphere.mesh`, `Materials/Simple PBR.mat`) |
| `ExamplePrefabInstantiateBox1.prefab`, `ExamplePrefabInstantiateBox2.prefab` | Sample spawn prefabs (`Meshes/Box.mesh`, `Materials/Simple PBR.mat`) |
| `Materials/Simple PBR.mat` | Material of the sample prefabs and of meshes in `Instantiation__PLACE_IN_SCENE.prefab`; uses `Shaders/simple_pbr.graphShader` and `Textures/Base.png` |
| `Materials/SimpleDiffuse.mat` | Uses `Shaders/Simple Diffuse.graphShader`; not referenced by the prefabs |
| `Materials/ImageMaterial.mat` | No shader pass assigned; not referenced by the prefabs |
| `Shaders/image_unlit.graphShader`, `Shaders/simple_pbr 2.graphShader` | Not referenced by the shipped materials |

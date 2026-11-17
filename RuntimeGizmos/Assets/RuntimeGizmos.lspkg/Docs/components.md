# RuntimeGizmos components

[← Agent usage index](../README.md)

## Use when

You need the exact import path, inputs, defaults, public members or update
behavior of a gizmo. All facts come from `Scripts/*.ts` in this package
revision.

## Modules

```typescript
import {Line} from "RuntimeGizmos.lspkg/Scripts/Line";
import {ClosedPolyline} from "RuntimeGizmos.lspkg/Scripts/ClosedPolyline";
import {Circle} from "RuntimeGizmos.lspkg/Scripts/Circle";
import {Spline} from "RuntimeGizmos.lspkg/Scripts/Spline";
import {Spiral} from "RuntimeGizmos.lspkg/Scripts/Spiral";
```

Each is a named export (no default export).

## Shared behavior

- **Inputs are consumed in `onAwake`.** Each gizmo builds its
  `InteractorLineRenderer`(s) in `onAwake` from its Inspector inputs. If its
  references (points/center and material) aren't set yet, it skips the build
  quietly. `lineMaterial` and `lineWidth` are **private** inputs; from
  TypeScript, use `setLineMaterial(material)` and `setLineWidth(width)`.
- **Building from code**: every gizmo has `rebuild()`, which (re)creates its
  lines from the current inputs. The object inputs are `@allowUndefined`, so
  `createComponent(X.getTypeName())` works. Assign the references, call
  `setLineMaterial()`, then `rebuild()`.
- **Moving targets** update the existing line renderers' points in place.
  New renderers are only created by `rebuild()` or a structural change, such as
  a different Spiral segment count.
- **Rendering**: the line objects are created as children of the gizmo's own
  SceneObject. Their points are in that object's local space.
- **`lineStyle`** (`number`, combo): `0` Full, `1` Split, `2` FadedEnd. These are
  SIK `VisualStyle` values; SIK also defines `3` FadedStart, which the combo
  does not offer.
- **Colors** are `vec3` RGB (alpha forced to 1).
- **Logging**: every gizmo has `enableLogging` and `enableLoggingLifecycle`
  (`false`). Setup errors such as a missing center or too few points go
  through `logger.debug`, so they only print when logging is on.
- **Line material**: every gizmo in the prefab uses InteractionKit's
  `InteractionKit.lspkg/Components/Interaction/InteractorLineVisual/InteractorLineMaterial.mat`
  (the material of SIK's interactor line), not a material from this package.

## `Line`

The line runs from `startPointObject` to `endPointObject`. Both are **re-read
every frame**, and the mesh is only redrawn when one of them has moved.

| Input | Type | Default | Notes |
|---|---|---|---|
| `startPointObject` | `SceneObject` (public, required) | — | Uses its **local** position |
| `endPointObject` | `SceneObject` (public, required) | — | Uses its **local** position |
| `lineMaterial` | `Material` (private, required) | — | From code: `setLineMaterial()` |
| `_beginColor` | `vec3` | `(1,1,0)` | Start color |
| `_endColor` | `vec3` | `(1,1,0)` | End color |
| `lineWidth` | `number` (private) | `0.5` | |
| `lineLength` | `number` (private) | `160` | Not applied (dead input) |
| `lineStyle` | `number` | `2` (FadedEnd) | Prefab uses `0` |
| `shouldStick` | `boolean` (private) | `true` | Not read (dead input) |

Public members: `beginColor` / `endColor` (`vec3` get/set, applied
immediately), `visualStyle` (SIK `VisualStyle` get/set), `isEnabled`
(`boolean` get/set; shows/hides the line), `rebuild()`,
`setLineMaterial(material)` and `setLineWidth(width)`.

The endpoints are read with `getLocalPosition()` and drawn in the Line object's
local space. They must share the Line object's parent, and the Line object must
keep an identity transform (the prefab's `LineManager` / `LineStart` /
`LineEnds` siblings under `Line`). `onDestroy` removes the line object it
created and leaves the gizmo's SceneObject alone.

## `ClosedPolyline`

A closed loop through `points`. It is **built once and not tracked**: call
`refreshLine()` after moving points.

| Input | Type | Default | Notes |
|---|---|---|---|
| `points` | `SceneObject[]` (public, ≥ 2, required) | — | Uses their **local** positions; exactly 1 **throws** in `onAwake` (empty waits for `setPoints()` / `rebuild()`) |
| `lineMaterial` | `Material` (private) | — | |
| `_color` | `vec3` | `(1,1,0)` | |
| `lineWidth` | `number` (private) | `0.5` | |
| `lineStyle` | `number` | `0` | |
| `continuousLine` | `boolean` | `true` | `true` = one closed line; `false` = one line per edge |

Public methods: `refreshLine()`, `getPoints(): SceneObject[]`,
`setColor(color: vec3)`, `setPoints(newPoints: SceneObject[])` (≥ 2, then
rebuilds), `rebuild()`, `setLineMaterial(material)`, `setLineWidth(width)`, and
`isEnabled` (get/set; toggles the line objects). The same local-space/sibling
rule as `Line` applies. `onDestroy` removes the line objects it created and
leaves the gizmo's SceneObject alone.

## `Circle`

A ring of `radius` around `centerObject`, in the center's XY plane. Its points
are **updated when the center moves** (or rotates, with `followRotation`).

| Input | Type | Default | Notes |
|---|---|---|---|
| `centerObject` | `SceneObject` (public, required) | — | World position; missing → nothing drawn until assigned + `rebuild()` |
| `radius` | `number` | `1.0` | Prefab: `10` |
| `followRotation` | `boolean` | `true` | Orient the ring by the center's world rotation |
| `lineMaterial` | `Material` (private) | — | |
| `_color` | `vec3` | `(1,1,0)` | |
| `lineWidth` | `number` (private) | `0.5` | |
| `lineStyle` | `number` | `0` | |
| `segments` | `number` (private) | `32` | Prefab: `64` |

Public members: `refreshCircle()`, `rebuild()`, `setLineMaterial(material)`,
`setLineWidth(width)`, `setRadius(r)`, `setFollowRotation(b)`,
`setSegments(n)` (ignored if `n < 3`), `color` (get/set), `isEnabled` (get/set),
and `update()` (the per-frame check; you do not need to call it).

## `Spline`

A Hermite/Catmull-Rom curve through `controlPoints`. Its points are **updated
when any control point moves**.

| Input | Type | Default | Notes |
|---|---|---|---|
| `controlPoints` | `SceneObject[]` (public, ≥ 2, required) | — | World positions; fewer than 2 → nothing drawn until `setControlPoints()` / `rebuild()` |
| `interpolationPoints` | `number` | `10` | Points per segment; prefab: `20` |
| `tension` | `number` | `0.5` | 0.5 = classic Catmull-Rom, 0 = straight segments, 1 = tighter |
| `closedLoop` | `boolean` | `false` | Connect the last point back to the first |
| `lineMaterial` | `Material` (private) | — | |
| `_color` | `vec3` | `(1,1,0)` | |
| `lineWidth` | `number` (private) | `0.5` | |
| `lineStyle` | `number` | `0` | |

Public methods: `refreshSpline()`, `rebuild()`, `setLineMaterial(material)`,
`setLineWidth(width)`, `setInterpolationPoints(n)` (n ≥ 0),
`setTension(t)` (clamped to 0..1), `setClosedLoop(b)`,
`setControlPoints(points)` (≥ 2), `addControlPoint(obj)`,
`removeControlPoint(index)` (keeps ≥ 2), `color` / `isEnabled` (get/set), and
`update()`.

## `Spiral`

A spiral from `centerObject` along one local axis. Its points are **updated when
the center moves/rotates**. It is drawn as several line segments of up to 30 points
each.

| Input | Type | Default | Notes |
|---|---|---|---|
| `centerObject` | `SceneObject` (public, required) | — | Missing → nothing drawn until assigned + `rebuild()` |
| `startRadiusAmplitude` | `number` | `1.0` | Prefab: `5` |
| `endRadiusAmplitude` | `number` | `1.0` | Prefab: `5`. If equal to start (and not Helix), radius grows 5 % along the spiral |
| `axisLength` | `number` | `5.0` | Prefab: `50` (cm along the axis) |
| `loops` | `number` | `3` | |
| `followRotation` | `boolean` | `true` | |
| `axisDirection` | `number` (combo) | `1` | `0` X, `1` Y, `2` Z |
| `lineMaterial` | `Material` (private) | — | |
| `_color` | `vec3` | `(1, 0.5, 0)` | |
| `lineWidth` | `number` (private) | `0.5` | Prefab: `0.1` |
| `lineStyle` | `number` | `0` | |
| `totalSegments` | `number` (private) | `120` | Minimum 80 (lower values are raised to 80); prefab: `150` |
| `spiralType` | `number` (combo) | `0` | `0` Linear, `1` Exponential, `2` Logarithmic, `3` Helix (constant radius); prefab: `1` |

Public methods: `refreshSpiral()`, `rebuild()`, `setLineMaterial(material)`,
`setLineWidth(width)`, `setRadiusAmplitudes(start, end)` (min 0.01),
`setAxisLength(l)` (min 0.01), `setLoops(n)` (> 0),
`setTotalSegments(n)` (n > 0; raised to the same minimum of 80),
`setAxisDirection(0|1|2)`, `setFollowRotation(b)`, `setSpiralType(0..3)`,
`color` / `isEnabled` (get/set), and `update()`.

## Prefab: `RuntimeGizmos__PLACE_IN_SCENE.prefab`

```
RuntimeGizmos__PLACE_IN_SCENE
├── Guide             [Frame, GuideDismissPanel] → GuideText, OkButton
├── ExampleCarousel   [ExampleCarousel]
├── Text              (title "Runtime Gizmos ", disabled)
├── Line              → LineManager [Line], LineStart, LineEnds
├── ClosedPolyline    → ClosedPolylineManager [ClosedPolyline], LineA, LineB, LineC, LineD
├── Circle            → CircleManager [Circle], Sphere (center)
├── Spline            → Spline [Spline], p1 … p5
└── Spiral            → SpiralTS [Spiral], Center
```

The gizmo groups sit at z = −150 cm around the origin (the Guide at −100 cm).
Each gizmo script sits on a sibling of its points.

## Demo scaffolding (`Example/`)

These scripts ship in `RuntimeGizmos.lspkg/Example/` and are wired inside
`RuntimeGizmos__PLACE_IN_SCENE.prefab`. They only present the demo; the gizmo
scripts don't import them.

| Object / script | Class | Key inputs |
|---|---|---|
| `Guide`: `Example/GuideDismissPanel/GuideDismissPanel.ts` | `GuideDismissPanel` | `hideUntilDismissed: SceneObject[]` lists the objects hidden until "Ok, I understood" is pressed (here: `ExampleCarousel`, `Line`, `ClosedPolyline`, `Circle`, `Spline`, `Spiral`). `buttonLabel: string = "Ok, I understood"` is only used when the panel is built at runtime |
| `ExampleCarousel`: `Example/ExampleCarousel/ExampleCarousel.ts` | `ExampleCarousel` | `examples: SceneObject[]` (here the five gizmo groups, in the order above), `exampleInfo: string[]` (one line per example), `steps: SceneObject[]` (empty here), `stepInfo: string[]` (empty here; what each step shows, in the same order as `steps`), `startIndex: number = 0`, `previousLabel` / `nextLabel`, `examplesPushBack: number = 20`, `anchorExamples: boolean = true`, `startMinimized: boolean = false`, `extraPanelDrop: number = 0` |

`hideUntilDismissed` points at the example groups rather than the prefab root,
because hiding the root would also hide the guide and the carousel.

## Assets

`Materials/` (`PBR 2.mat`, `PBR 7.mat`, `Simple PBR.mat`, `SimpleDiffuse.mat`),
`Shaders/` (`simple_pbr.graphShader`, `simple_pbr 2.graphShader`,
`Simple Diffuse.graphShader`, `Simple Diffuse 2.graphShader`) and
`Textures/Base.png` ship with the package but are not referenced by the
prefab or the scripts. A gizmo's look comes from its `lineMaterial` input.

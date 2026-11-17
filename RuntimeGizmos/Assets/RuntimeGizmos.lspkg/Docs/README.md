# Gizmos

## What it is
A package of runtime gizmos that draw debug and visualization lines while the Lens runs: lines, closed polylines,
circles, splines and spirals that follow scene objects. It is for developers who need quick overlays for connections,
boundaries, paths, radii or decorative spirals on Specs. Every gizmo renders with the Interaction Kit (SIK)
`InteractorLineRenderer`; it is not a general mesh or styled-line toolkit.

## What it does
- You add a gizmo script (`Line`, `ClosedPolyline`, `Circle`, `Spline` or `Spiral`) to a SceneObject, wire its point
  or center objects and a line material, and it builds its line renderers as children in `onAwake`.
- **Line** connects two objects and re-reads both endpoints every frame, with begin/end colors.
- **ClosedPolyline** joins N points into a closed shape, continuous or one line per edge; call `refreshLine()` after
  moving the points.
- **Circle** draws a ring of `segments` points around a center object, optionally following its rotation.
- **Spline** draws a curve through control points with `tension`, `interpolationPoints` and an optional closed loop.
- **Spiral** draws linear, exponential, logarithmic or helix growth along X, Y or Z, with start/end radius, axis
  length and loop count.
- Line, Circle, Spline and Spiral update their points in place when their targets move.

## Highlights
- Three visual styles from SIK `VisualStyle`: Full, Split and FadedEnd.
- Every gizmo exposes `rebuild()`, `setLineMaterial()`, `setLineWidth()` and `isEnabled`, so gizmos can be created
  from code with `createComponent` and then rebuilt.
- Runtime setters such as `setRadius()`, `setTension()`, `addControlPoint()` and the Spiral `set*()` methods.
- Missing references skip the build quietly (logged at debug level) instead of throwing.
- The prefab is a gallery of all five gizmos, each in its own group, already wired to the SIK line material.

## Core scripts
| Script | What it does |
|---|---|
| `Scripts/Line.ts` | Line between two objects with gradient colors, redrawn every frame. |
| `Scripts/ClosedPolyline.ts` | Closed shape through N points, continuous or split. |
| `Scripts/Circle.ts` | Ring around a center object with radius, segments and rotation following. |
| `Scripts/Spline.ts` | Smooth curve through control points with tension and closed-loop options. |
| `Scripts/Spiral.ts` | Linear, exponential, logarithmic or helix spiral along a chosen axis. |

## Extra info
- **Requires:** InteractionKit, Utilities, SnapDecorators, UIKit, Motion, Icons. Line and ClosedPolyline use local
  positions (keep the gizmo object and its points as siblings, gizmo at identity); Circle, Spline and Spiral use world
  positions. Sizes are in cm. Works in the Lens Studio Preview and on Specs.
- **Get started:** drag `RuntimeGizmos__PLACE_IN_SCENE.prefab` into the scene and keep the gizmo groups you need.
  Delete the guide panel and example carousel for your own Lens.
- **More docs:**
  - [cheat-sheet.md](cheat-sheet.md) – load-bearing rules, read first
  - [components.md](components.md) – import paths, inputs, defaults, methods and update behaviour
  - [api-status.md](api-status.md) – current, deprecated and internal APIs
  - [examples.md](examples.md) – prefab, Inspector setup and compiling snippets
  - [guide.md](guide.md) – vector field, path preview and boundary debugger recipes
  - [troubleshooting.md](troubleshooting.md) – gizmos that don't draw, don't follow or throw

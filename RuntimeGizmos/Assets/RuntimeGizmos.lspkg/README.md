<p align="center">
  <img src="Docs/media/RuntimeGizmos.png" width="250px" alt="RuntimeGizmos"/>
</p>

# Gizmos

Runtime Gizmos draws debug and visualization geometry while the Lens runs:
lines, closed polylines, circles, splines and spirals that follow scene objects.
Every gizmo renders with SIK's `InteractorLineRenderer`.

## Features

- **Line**: a straight line between two objects, redrawn every frame
- **Closed Polyline**: a closed shape through N points, drawn continuous or split
- **Circle**: a ring around a center object, with optional rotation following
- **Spline**: a smooth curve through control points, with tension and closed-loop options
- **Spiral**: linear, exponential, logarithmic or helix growth along the X, Y or Z axis
- **Visual Styles**: Full, Split and FadedEnd

## Usage

This section ships with the package and describes the exact installed revision.
Read it, then follow the links into `Docs/` for the topic you need. It is
written for both people and coding agents; generic Lens scripting, scene
construction, and Specs spatial design are out of scope here.

### Package identity

- Package descriptor: `RuntimeGizmos.lspkg/package.native`
- Consumer import prefix: `RuntimeGizmos.lspkg/Scripts/`, for example
  `RuntimeGizmos.lspkg/Scripts/Circle`. See [components](Docs/components.md).
- Prefab entry point: `RuntimeGizmos__PLACE_IN_SCENE.prefab` (a gallery of all
  five gizmos, each in its own group with its points).
- The prefab includes the demo guide panel and example carousel: dragging it
  into an empty Specs scene gives the full demo. Their scripts ship in
  `RuntimeGizmos.lspkg/Example/` (`ExampleCarousel`, `GuideDismissPanel`, see
  [components](Docs/components.md#demo-scaffolding-example)). They only present
  the demo; the gizmo scripts don't import them.
- Required companion packages (`package_dependencies.json`):
  `InteractionKit` (line renderer, color utils, and the line
  material the prefab uses), `Utilities` (Logger) and `SnapDecorators`
  (imported by every script), plus `UIKit`, `Motion` and `Icons`.

### Version and API status

Read [API status](Docs/api-status.md) before reusing an older Runtime Gizmos
example. Older README snippets used property names that do not exist in this
revision. Gizmos created with `createComponent` need `setLineMaterial()` and
`rebuild()` (see [examples](Docs/examples.md)).

### Applicability

Use Runtime Gizmos for debug overlays and simple line art that tracks objects:
connections, boundaries, paths, radii, decorative spirals. It is not a general
mesh or line-drawing toolkit. For thick, styled or animated lines use a mesh /
line package, and for interaction rays use SIK's own visuals.

### Package Docs (ship in `Docs/`)

Lens Studio auto-extracts these files into the project's install Cache on
import, so an agent can read them there. Treat only the members documented
here as supported API; never guess an import path.

- [cheat sheet](Docs/cheat-sheet.md) - load-bearing rules; read first
- [components](Docs/components.md) - the five gizmos: import paths, inputs, defaults, methods, update behavior, plus the `Example/` demo scaffolding
- [API status](Docs/api-status.md) - Current / Deprecated / Experimental / Removed / Internal
- [minimal examples](Docs/examples.md) - prefab path and compiling snippets
- [guide and recipes](Docs/guide.md) - vector field, path preview, boundary debugger, built the supported way
- [troubleshooting](Docs/troubleshooting.md) - package-specific symptoms and fixes

### Verification

1. Compile with no TypeScript errors and no `as any`. Imports come from
   `RuntimeGizmos.lspkg/Scripts/<Gizmo>`.
2. Every gizmo you add has its required references wired in the Inspector
   (points/center and `lineMaterial`) **before** the Lens starts, or call
   `rebuild()` after assigning them. A missing reference silently draws
   nothing (the message goes to `logger.debug`); only a ClosedPolyline with
   exactly 1 point throws.
3. In Preview, move a point/center: Line, Circle, Spline and Spiral follow it.
   ClosedPolyline only follows after `refreshLine()`.
4. The logs show no `Line` / `ClosedPolyline` errors at start.

## Built with 👽 by the SPECS team

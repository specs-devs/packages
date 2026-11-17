# Volumetric Line

## What it is
Volumetric Line is a package that renders smooth 3D tubes through a list of SceneObject control points. It extrudes
a circular cross-section along a spline and rebuilds the mesh at runtime as the points move. It is for Specs
developers who need visual connections, trails or decorative lines that follow authored objects.

## What it does
1. You add `VolumetricLine` to a SceneObject and wire `pathPoints` (at least two distinct SceneObjects) and a
   `material` before its start.
2. On start (bound with SnapDecorators) it creates a `RenderMeshVisual` and builds the tube with MeshBuilder:
   cubic Hermite interpolation between points, parallel-transport ring frames, cylindrical UVs and optional end caps.
3. While `continuousUpdate` is on, it tracks the point positions and rebuilds the mesh, every frame with
   `smoothUpdate` (with `positionSmoothing` to reduce jitter) or throttled by `updateRate` when `smoothUpdate` is off.
4. By default each point's world position is mapped through the line root's inverse world transform, so the root can
   be moved, rotated and scaled and the tube still passes through the points.
5. In `VolumetricLine__PLACE_IN_SCENE.prefab`, `RandomPositionAnimator` drifts four control-point boxes around their
   start positions so the tube animates; the prefab also holds a guide panel and an example carousel.

## Highlights
- Runtime setters for `radius`, `circleSegments`, `interpolationSteps`, `smoothness`, `color`, `zOffset` and the
  position modes; `updateMesh()`, `refreshPath()` and `forceRefresh()` for manual rebuilds.
- `color` writes `baseColor` on the assigned material, so it needs a material that exposes it (the shipped Rainbow
  and PBR materials don't).
- `getPositionDiagnostics()` and offset helpers (`setManualOffset`, `resetOffsetDetection`) for debugging alignment;
  some diagnostics move the actual points.
- Ships a Rainbow and a PBR shader for the tube.
- Meshes use 16-bit indices: keep rings times segments well under the vertex limit (the example already rebuilds
  about 24,000 vertices every frame).

## Core scripts
| Script | What it does |
|---|---|
| `Scripts/VolumetricLine.ts` | Builds and updates the tube mesh along the `pathPoints`, with spline smoothing and position modes. |
| `Scripts/RandomPositionAnimator.ts` | Optional demo helper that drifts objects randomly around their local start positions. |
| `Example/GuideDismissPanel/GuideDismissPanel.ts` | Demo scaffolding: guide panel hidden behind "Ok, I understood". |
| `Example/ExampleCarousel/ExampleCarousel.ts` | Demo scaffolding: carousel panel that presents the example group. |

## Extra info
- **Requires:** SnapDecorators, InteractionKit, Utilities, UIKit, Motion and Icons. Works in the Lens Studio Preview
  and on Specs; measure the per-frame mesh rebuild cost on device. The example is about 1 m tall: scale its root so
  the tube fits the field of view on Specs. Late input assignment has no setup retry, so wire inputs in the Inspector.
- **Get started:** drop `VolumetricLine__PLACE_IN_SCENE.prefab` into a scene with a Camera and Interaction Kit (SIK),
  or add `VolumetricLine` (`VolumetricLine.lspkg/Scripts/VolumetricLine`) to your own object.
- **More docs:**
  - [cheat-sheet.md](cheat-sheet.md) - initialization, material and update rules, read first
  - [components.md](components.md) - inputs and public members of both components
  - [lifecycle.md](lifecycle.md) - coordinate spaces, smoothing and mesh budgets
  - [guide.md](guide.md) - long-form tutorial and background
  - [examples.md](examples.md) - placing the prefab or controlling an authored component
  - [api-status.md](api-status.md) - older tutorial claims compared with the current source
  - [troubleshooting.md](troubleshooting.md) - missing, displaced or frozen geometry

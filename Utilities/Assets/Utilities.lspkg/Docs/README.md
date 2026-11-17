# Utilities

## What it is
A helper library package for Lens scripts on Specs: nine classes for logging, validation, scene and component
searches, math and geography, tweens, 2D mesh generation, ScreenTransform calculations and type conversion. It is
for developers who would otherwise copy the same small helpers between scripts, and other Specs packages import it
too. The library is scripts only (no components); a demo prefab shows every helper group live.

## What it does
- You import a class from `Utilities.lspkg/Scripts/Utils/<Class>` and call it from your own scripts; every class is
  static except `Logger`, which you create with `new Logger(tag)`.
- `Logger` prints `time | tag | LEVEL | message` lines that can all be silenced with `setDebugEnabled(false)`.
- `MeshUtils` builds flat circle and rounded line-strip meshes and adds them as RenderMeshVisuals.
- `AnimationUtils` runs frame tweens and scale animations on the Interaction Kit (SIK) `animate()` and returns
  cancel handles.
- The demo prefab shows a `Guide`, then an `ExampleCarousel` that steps through four examples:
  `MathAndConversion`, `MeshShapes`, `Animation` and `SceneAndComponents`.

## Highlights
- One module per class, so you import only what you use.
- Geo math: `haversineDistance` (meters) and `calculateBearing` on a `GeoCoordinate`, plus lerp, angle
  normalization and quaternion-to-Euler helpers.
- `ValidationUtils.validateInputs` throws a clear error naming the first missing required input.
- Hierarchy walks and lookups (`forEachSceneObjectInSubHierarchy`, `findComponentInHierarchy`, `findInParents`,
  `getRootCamera`).
- Locale-tolerant number parsing (`convertToNumber` accepts a comma decimal) with safe defaults.

## Core scripts
| Script | What it does |
|---|---|
| `Scripts/Utils/Logger.ts` | Tagged, level-based logging that can be switched off per instance. |
| `Scripts/Utils/ValidationUtils.ts` | Null checks, assertions and required-input validation. |
| `Scripts/Utils/SceneObjectUtils.ts` | Hierarchy traversal, root lookup and component search by type name. |
| `Scripts/Utils/ComponentUtils.ts` | Component lookups in parents and scene roots, root camera, safe initialize. |
| `Scripts/Utils/MathUtils.ts` | Lerp, angles, quaternion conversion, easing, Haversine distance and bearing. |
| `Scripts/Utils/AnimationUtils.ts` | Frame tweens, ping-pong, scale and visual-feedback animations, easing-name map. |
| `Scripts/Utils/MeshUtils.ts` | 2D circle and rounded line-strip mesh builders. |
| `Scripts/Utils/ScreenTransformUtils.ts` | ScreenTransform world sizes, hit checks and anchor setup. |
| `Scripts/Utils/TypeConversionUtils.ts` | Number, integer, boolean and string conversion with defaults. |

## Extra info
- **Requires:** InteractionKit, UIKit, Motion and Icons. In the library only `AnimationUtils` imports
  InteractionKit; the `Example/` guide and carousel import InteractionKit and UIKit. Helpers run in the Lens Studio
  Preview and on Specs; `MeshUtils` meshes need an unlit material (no normals or UVs).
- **Get started:** import a helper, e.g. `import {MathUtils} from "Utilities.lspkg/Scripts/Utils/MathUtils"`. To see
  everything running, drop `Utilities__PLACE_IN_SCENE.prefab` into a Specs scene with the Interaction Kit (SIK)
  prefab; its demo scripts live in `Example/UtilitiesDemo/`.
- **More docs:**
  - [cheat-sheet.md](cheat-sheet.md): the rules that most often break a script; read first.
  - [api-status.md](api-status.md): current surface, changes and known gaps.
  - [components.md](components.md): every class with signatures, defaults and behavior.
  - [animation.md](animation.md): tweens, cancellation and the easing-name map.
  - [examples.md](examples.md): compile-correct snippets and the demo prefab's four examples.
  - [tutorial.md](tutorial.md): the long-form guide to all nine classes.
  - [troubleshooting.md](troubleshooting.md): symptoms, causes and fixes.

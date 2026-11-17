# World Query Module

## What it is
A package that shows how to combine World Query Module hit testing with Interaction Kit (SIK) targeting on Specs: point
at a real surface, preview an object there, and pinch to place a copy. It also reads semantic surface classification
(Ground, Wall, Ceiling, Table, …) and names the surface with a color-coded label. It ships matching TypeScript and
JavaScript variants and is for developers learning surface placement or needing classification events.

## What it does
1. On awake the placement component creates a WorldQuery hit-test session (optional filter, classification and refine
   options) and subscribes to the SIK interactors; a short intro hint appears in front of the wearer.
2. Every frame it casts a ray from the first targeting interactor. When it hits a surface, the `targetObject` cursor
   is shown and moved to the hit pose, aligned to the surface normal, with optional smoothing.
3. With classification on, a billboard label at the hit point names the detected surface in its color;
   `detectCategory` limits which categories get a label.
4. Releasing a pinch copies the source object at `indexToSpawn` (from `objectsToSpawn`) with its whole hierarchy and
   leaves it at the cursor pose.
5. The hit test pauses while the ray points at UI (an Interactable), a pinch released on UI never places, and losing
   targeting clears the cached hit so nothing lands at a stale position.

## Highlights
- Surface categories and colors are resolved from the runtime `SurfaceClassification` enum, so unknown values degrade
  gracefully instead of breaking.
- `HitTestClassification` is a standalone detector with a `currentClassification` getter and an
  `onClassificationChanged` event for context-aware logic.
- Optional refined hits are requested defensively and ignored where unsupported.
- TypeScript and JavaScript variants with feature parity.
- The prefab ships four example sources (`Statue`, `House`, `Tree`, `Cloud`) and a world-anchored cursor.

## Core scripts
| Script | What it does |
|---|---|
| `Scripts/WorldQueryHitExampleTS.ts` | TS placement component (`NewScript`): hit test, cursor, label, intro hint and pinch-to-place. |
| `Scripts/HitTestClassificationTS.ts` | TS semantic surface detector with getter and change event. |
| `Scripts/WorldQueryHitExampleJS.js` | JS variant of the placement example. |
| `Scripts/HitTestClassificationJS.js` | JS variant of the classification detector. |
| `Example/GuideDismissPanel/GuideDismissPanel.ts` | Demo guide panel that reveals the example once dismissed. |
| `Example/ExampleCarousel/ExampleCarousel.ts` | Demo carousel that describes the example in the prefab. |

## Extra info
- **Requires:** SnapDecorators, InteractionKit, Utilities, UIKit, Motion, Icons, plus the built-in
  `LensStudio:WorldQueryModule`. Real surface hits need Specs with WorldQuery tracking data; the Lens Studio Preview
  returns no WorldQuery hits. Available categories and refined hits depend on the runtime. `detectCategory` filters
  labels only, not placement.
- **Get started:** drop `WorldQueryHit__PLACE_IN_SCENE.prefab` into a Specs scene with Camera and SIK, dismiss the
  guide, then edit `World Query Example [EDIT ME]` and the `Objects to spawn [EDIT]` sources.
- **More docs:**
  - [cheat-sheet.md](cheat-sheet.md) – names, wiring and placement limits, read first
  - [components.md](components.md) – prefab layout, TS imports and JS inputs
  - [lifecycle.md](lifecycle.md) – sessions, ray selection, freshness, smoothing and copies
  - [examples.md](examples.md) – prefab placement and classification consumers
  - [api-status.md](api-status.md) – exports, TS/JS differences and runtime gaps
  - [troubleshooting.md](troubleshooting.md) – cursor, label and selection issues
  - [guide.md](guide.md) – preserved long-form tutorial

# Instantiation

## What it is
A package of drop-in components that spawn copies of a prefab in a spatial pattern when the Lens starts: circles,
lines, 2D and 3D grids, random points in or on a box or sphere, a square area, or inside a target's box or sphere.
Every layout ships as a TypeScript component and an equivalent JavaScript script. It is for developers who need
static, start-time layouts of many copies of one prefab without writing the placement math.

## What it does
1. Add a layout component (for example `InstantiateOn3DGridsTS`) to a spawner object, set its `prefab` and its center
   object (or line endpoints / target), and tune counts, radii and spacing in centimeters.
2. On `OnStart`, the component spawns the whole layout once; each copy is instantiated as a child of the spawner and
   given its world position.
3. The 12 center-based layouts follow the center object's world rotation; line layouts follow their endpoints. The
   center's scale is ignored, so sizes are absolute.
4. `SimpleColliderInstantiatorTS` fills the target's local unit cube or sphere (mapped through its world transform),
   with optional random scale variation.
5. The place-in-scene prefab shows all 15 layouts, one group at a time, behind an onboarding guide and an example
   carousel.

## Highlights
- 15 layouts: circle area (uniform and center-weighted), even ring, partial arc, polygon slices, line by count, line
  by fixed distance, vertical 2D grid, 3D grid, random inside/on box and sphere, square area, collider fill.
- TS and JS twins with the same inputs; use one twin per layout or the layout spawns twice.
- Copies are plain children of the spawner: clear a layout by destroying those children.
- Calling a spawn method yourself adds a second full layout on top of the automatic start spawn.
- Sizes are world cm; keep layouts about 40-60 cm across at 1-2 m so they fit the Specs view.

## Core scripts
| Script | What it does |
|---|---|
| `Scripts/TS/InstantiateOn3DGridsTS.ts` | Spawns a volumetric 3D grid with per-axis counts and spacing. |
| `Scripts/TS/InstantiateOn2DGridsTS.ts` | Spawns a 2D grid on the center's X-Y plane. |
| `Scripts/TS/CirclePerimeterInstantiatorTS.ts` | Spawns copies evenly spaced on a ring. |
| `Scripts/TS/CirclePerimeterInstantiatorWithFixedArcLengthTS.ts` | Spawns copies along a partial arc (`startAngle`, `arcAngleSpan`). |
| `Scripts/TS/InstantiateAlongLineTS.ts` | Spawns N copies evenly between two points. |
| `Scripts/TS/RandomPointsInsideSphereTS.ts` | Spawns copies at random points inside a sphere volume. |
| `Scripts/TS/RandomPointsOnBoxSurfaceTS.ts` | Spawns copies at random points on a box surface. |
| `Scripts/TS/SimpleColliderInstantiatorTS.ts` | Fills or covers a target's box or sphere, with scale variation. |
| `Scripts/JS/InstantiateOn3DGridsJS.js` | JavaScript twin of the 3D grid layout (same pattern for every layout). |

## Extra info
- **Requires:** InteractionKit, Utilities, SnapDecorators, UIKit, Motion, Icons. Layouts work the same in the Lens
  Studio Preview and on Specs; nothing is pooled, re-laid out or animated at runtime.
- **Get started:** `Instantiation__PLACE_IN_SCENE.prefab` (15 example groups with TS hosts enabled and JS twins
  disabled, plus the guide and carousel). Sample spawn prefabs: `ExamplePrefabInstantiateSphere.prefab`,
  `ExamplePrefabInstantiateSphere2.prefab`, `ExamplePrefabInstantiateBox1.prefab`, `ExamplePrefabInstantiateBox2.prefab`.
  Import TS classes from `Instantiation.lspkg/Scripts/TS/<Name>TS`.
- **More docs:**
  - [cheat-sheet.md](cheat-sheet.md) - load-bearing rules, read first.
  - [components.md](components.md) - all 15 layouts: paths, inputs, defaults and placement math.
  - [examples.md](examples.md) - prefab, Inspector and TypeScript setups.
  - [guide.md](guide.md) - choosing a layout, sizing for Specs and recipes.
  - [api-status.md](api-status.md) - current, deprecated and removed surface.
  - [troubleshooting.md](troubleshooting.md) - spawning nothing, too much or in the wrong place.

# Surface Placement

## What it is
A package that lets the user choose where content goes on Specs: a spot on the floor, a wall, or a table under their
palm. It shows the placement UI (reticle, ring, instruction text), confirms the choice and returns one world pose. It
is for any Lens that needs "put it here" placement without writing its own hit-test flow.

## What it does
1. Call `SurfacePlacementController.getInstance().startSurfacePlacement(settings, (pos, rot) => ...)` with
   `new PlacementSettings(PlacementMode.GROUND)` (or `WALL`, `TABLETOP`). The singleton creates the right placement
   prefab under its own scene-root object; you never add those prefabs by hand.
2. Ground and Wall place by dwell: look at the surface and hold your view steady for about half a second, then the
   ring fills over 1 s and places. Moving your head or losing the surface restarts it. Wall averages the wall normal so
   the facing does not wobble.
3. Tabletop places on a palm: lay a hand flat on a table and hold it flat and still. A ring fits round the hand and
   fills over about 1 s; the table height is measured from depth hits around the hand. In the Lens Studio editor a
   click stands in for the hand.
4. Your callback fires once with a world position (cm) and rotation: upright on floors (facing the user) and tables
   (facing back along the hand), local +Y out of the wall on walls. Starting another placement, or `stopSurfacePlacement()`, ends the
   current one without calling it.
5. `SurfaceMove`, on a UIKit Frame beside the placed content, lets the user drag the content across the surface it
   was placed on.
6. The demo prefab steps through three examples with a carousel: Tabletop, Ground and Wall. Each places a cube, with
   a menu to drag it and a Reset Placement button to place again.

## Highlights
- Dwell placement needs no eye tracking and no hand gesture; it uses the world camera's position and forward
  direction.
- On device, high-accuracy World Query hit testing refines the pose while the ring fills, whenever the runtime
  supports it.
- The Ground and Wall reticle keeps a constant size on screen at any distance.
- One session at a time: starting a new placement stops the previous one.
- `PlacementSettings` takes the mode and an optional `showDebug` flag for logs and depth-aim markers.

## Core scripts
| Script | What it does |
|---|---|
| `Scripts/SurfacePlacementController.ts` | Singleton entry point: `startSurfacePlacement()` / `stopSurfacePlacement()`. |
| `Scripts/PlacementSettings.ts` | `PlacementSettings` and the `PlacementMode` enum (`GROUND`, `WALL`, `TABLETOP`). |
| `Scripts/SurfaceMove.ts` | Component for a UIKit Frame: dragging it moves placed content across its surface. |
| `Example.ts` | Example component on each demo group: hides content, places it, lays out its menu, resets on demand. |
| `Scripts/SurfaceDetector.ts` | Base detector: hit-test sessions, dwell, high-accuracy pass, reticle size, completion. |
| `Scripts/Horizontal.ts` | Ground detection. |
| `Scripts/Vertical.ts` | Wall detection with averaged wall normal. |
| `Scripts/TableTop.ts` | Palm detection and table measuring for Tabletop. |
| `Scripts/SingleSurface.ts` | Gaze ray and reticle easing shared by Ground and Wall. |
| `Scripts/CircleAnimation.ts` | Ring fill, pop and collapse. |

## Extra info
- **Requires:** InteractionKit, UIKit, Utilities, SnapDecorators, Motion and Icons. The scene needs the
  InteractionKit prefab and a world-tracked camera. In the Lens Studio Preview, Ground needs floor geometry and Wall
  needs wall geometry in the Preview environment; check Wall and the palm flow on Specs. Placement returns one pose;
  it does not anchor or persist content. The placement UI is not under your object, so call `stopSurfacePlacement()`
  when your object is disabled.
- **Get started:** `SurfacePlacement__PLACE_IN_SCENE.prefab`, or call `SurfacePlacementController` from your script
  with `new PlacementSettings(PlacementMode.GROUND)`.
- **More docs:**
  - [cheat-sheet.md](cheat-sheet.md) - load-bearing rules; read first
  - [components.md](components.md) - controller, settings, enum, `SurfaceMove`, `Example` and internal prefab scripts
  - [lifecycle.md](lifecycle.md) - start / confirm / callback / stop order
  - [api-status.md](api-status.md) - current, removed and internal members
  - [examples.md](examples.md) - prefab path and compiling snippets
  - [guide.md](guide.md) - placement modes, dwell and palm tracking details, migration
  - [troubleshooting.md](troubleshooting.md) - package-specific symptoms and fixes

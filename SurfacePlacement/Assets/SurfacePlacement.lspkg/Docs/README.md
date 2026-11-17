# Surface Placement

## What it is
A package that lets the user choose where content goes on Specs: a spot on a floor or table, a wall, or a surface
under their palm. It shows the placement UI (reticle, ring, hand hints), confirms the choice and returns one world
pose. It is for any Lens that needs "put it here" placement without writing its own hit-test flow.

## What it does
1. Call `SurfacePlacementController.getInstance().startSurfacePlacement(settings, (pos, rot) => ...)`. The singleton
   creates the right placement prefab under its own scene-root object; you never add those prefabs by hand.
2. Horizontal and Vertical modes default to head-pose confirmation: look at a surface and hold your view steady
   for about half a second, then the ring fills over 1.5 s and confirms. Moving your head or losing the surface
   restarts the timer. Pass `PlacementInteraction.PINCH_OR_TAP` to confirm with a pinch or tap instead.
3. Near Surface mode uses a flat, still palm (or a phone tap) and can show a height slider after placement.
4. Your callback fires once with a world position (cm) and rotation (yaw-only for floors, upright facing out of
   the wall for walls). An optional `onCancelled` fires if the session is stopped or replaced first.
5. The demo prefab steps through four examples with a carousel: Horizontal · Head Pose, Horizontal · Pinch or Tap,
   Vertical · Head Pose and Near Surface · Palms. Each places a red panda, with a Reset button to place again.

## Highlights
- Head-pose placement needs no eye tracking or hand gesture; it uses the world camera's position and forward
  direction.
- One session at a time: starting a new placement stops the previous one.
- Floor and wall rotations face the user: local +Y up and local +Z toward the user.
- Hand and phone hint animations guide the user through each mode.
- `PlacementSettings` configures mode, interaction and the Near Surface height-adjustment widget (a UI Kit `Slider`).

## Core scripts
| Script | What it does |
|---|---|
| `Scripts/SurfacePlacementController.ts` | Singleton entry point: `startSurfacePlacement()` / `stopSurfacePlacement()`. |
| `Scripts/PlacementSettings.ts` | `PlacementSettings` plus the `PlacementMode` and `PlacementInteraction` enums. |
| `Example.ts` | Example component on each demo group: hides content, places it, resets on demand. |
| `Scripts/SurfaceDetector.ts` | Base detector: hit-test session, reticle, head-pose dwell and completion. |
| `Scripts/Horizontal.ts` | Floor and table detection. |
| `Scripts/Vertical.ts` | Wall detection with averaged wall normal. |
| `Scripts/TableTop.ts` | Palm / phone detection for Near Surface mode. |
| `Scripts/SingleSurface.ts` | Reticle interpolation and pinch / tap / drag confirmation. |
| `Scripts/SurfaceSlider.ts` | Height slider shown after Near Surface placement. |

## Extra info
- **Requires:** InteractionKit, UIKit, Utilities, SnapDecorators, Motion and Icons. The scene needs the
  InteractionKit prefab and a world-tracked camera. In the Lens Studio Preview the default room has a floor but no
  walls; check Vertical and Near Surface on Specs. Placement returns one pose; it does not anchor or persist content.
  The placement UI is not under your object, so call `stopSurfacePlacement()` when your object is disabled.
- **Get started:** `SurfacePlacement__PLACE_IN_SCENE.prefab`, or call `SurfacePlacementController` from your script
  with `new PlacementSettings()` (Horizontal + head pose).
- **More docs:**
  - [cheat-sheet.md](cheat-sheet.md) - load-bearing rules; read first
  - [components.md](components.md) - controller, settings, enums, `Example` and internal prefab scripts
  - [lifecycle.md](lifecycle.md) - start / confirm / callback / stop order
  - [api-status.md](api-status.md) - current, deprecated and internal members
  - [examples.md](examples.md) - prefab path and compiling snippets
  - [guide.md](guide.md) - placement modes, head-pose tracking details, pinch / tap migration
  - [troubleshooting.md](troubleshooting.md) - package-specific symptoms and fixes

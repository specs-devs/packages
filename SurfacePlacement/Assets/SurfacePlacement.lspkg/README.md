<p align="center">
  <img src="Docs/media/SurfacePlacement.png" width="250px" alt="SurfacePlacement"/>
</p>

# Surface Placement

Place content on floors, walls and tables. **Ground and Wall place by dwell:** look at the surface and hold your view steady while the ring fills. **Tabletop places on your palm:** lay a hand flat on a table and hold it flat and still while a ring fits round it and fills. A UIKit Frame beside the placed content then lets the user drag it across the surface.

## Try the example

1. Open the SurfacePlacement project, or install the package and add `SurfacePlacement__PLACE_IN_SCENE` to your scene. It brings its own guide and an example carousel.
2. Read the guide and pinch **Ok, I understood**. The carousel then steps through three examples with **Previous / Next**: Tabletop, Ground and Wall. Each places a cube.
3. **Tabletop:** lay a palm flat on a table and hold it flat and still; the ring round your hand fills in about a second. **Ground / Wall:** look at the floor or a wall; after about half a second of steady aim the ring fills over one second. Moving your head (or your hand, in Tabletop) or losing the surface restarts it.
4. Drag the **Test Menu** beside the cube to move the cube across the surface, or pinch its **Reset Placement** button (it calls `resetPlacement()`) to place again.

Ground and Wall use the world camera's position and forward direction; they need no eye tracking and no hand gesture. In the Lens Studio Preview, a click stands in for the hand in Tabletop. The step-by-step guide, placement modes and tracking details are in [the guide](Docs/guide.md).

## Usage

This section ships with the package and describes the exact installed revision.
Read it, then follow the links into `Docs/` for the topic you need. Generic Lens
scripting, scene construction, and Specs spatial design are out of scope here.

### Package identity

- Package descriptor: `SurfacePlacement.lspkg/package.native` (holds the package version)
- Consumer import prefix: `SurfacePlacement.lspkg/Scripts/` for the API
  (`Scripts/SurfacePlacementController`, `Scripts/PlacementSettings`, and the
  `Scripts/SurfaceMove` component); the example component is
  `SurfacePlacement.lspkg/Example` (the file `Example.ts` at the package root, no
  `Scripts/`). See [components](Docs/components.md).
- Prefab entry point: `SurfacePlacement__PLACE_IN_SCENE.prefab`. It is
  self-contained: a UIKit `ThemeManager`, a guide panel (`Guide`), an
  `ExampleCarousel`, and three example groups (`Tabletop`, `Ground`, `Wall`).
  Each group carries an `Example` component with its own mode, a cube under
  `SurfaceContent` and a UIKit Frame `TestMenu` whose **Reset Placement** button
  calls `Example.resetPlacement()` and whose `SurfaceMove` drags the cube. The
  placement UI itself is created from code; you never place
  `Prefabs/*Placement.prefab` by hand.
- Demo scaffolding: `SurfacePlacement.lspkg/Example/` holds the guide and
  carousel scripts (`Example/GuideDismissPanel`, `Example/ExampleCarousel`)
  used only by the prefab. They are not placement API (see
  [components](Docs/components.md)); delete `Guide` / `ExampleCarousel` from
  your copy of the prefab if you only want one example.
- Required companion packages (see `package_dependencies.json`):
  `InteractionKit`, `UIKit`, `Utilities`,
  `SnapDecorators`, `Motion` and `Icons`. The scene needs the
  InteractionKit prefab and a world-tracked camera (InteractionKit's `WorldCameraFinderProvider`
  locates it).

### Version and API status

Read [API status](Docs/api-status.md) before reusing an older Surface
Placement example: the modes are now `GROUND`, `WALL` and `TABLETOP`, every mode
confirms by dwell (no pinch or tap), and the height widget, hand hints, phone
support and the `onCancelled` callback are gone.

### Applicability

Use Surface Placement to let the user choose where content goes: a spot on the
floor (Ground), a wall (Wall), or a table under their palm (Tabletop). It
returns one world pose and stops; it does not anchor or persist content across
sessions, keep content attached to a moving surface, or expose raw hit tests.
`SurfaceMove` lets the user slide placed content across the plane it was placed
on. For your own World Query hit testing, use the World Query Module; for
persistent anchors, use a custom-locations or anchor workflow.

### Package Docs (ship in `Docs/`)

Lens Studio auto-extracts these files into the project's install Cache on
import, so they can be read there. Treat only the members documented here as
supported API; never guess an import path.

- [cheat sheet](Docs/cheat-sheet.md) - load-bearing rules; read first
- [components](Docs/components.md) - `SurfacePlacementController`, `PlacementSettings`, `PlacementMode`, `SurfaceMove`, `Example`; internal prefab scripts
- [lifecycle](Docs/lifecycle.md) - start / confirm / callback / stop order and what stays in the scene
- [API status](Docs/api-status.md) - Current / Deprecated / Experimental / Removed / Internal
- [minimal examples](Docs/examples.md) - prefab path and compiling snippets
- [guide](Docs/guide.md) - placement modes, dwell and palm tracking details, moving placed content, migration
- [troubleshooting](Docs/troubleshooting.md) - package-specific symptoms and fixes

### Verification

1. Compile with no TypeScript errors and no `as any`; imports resolve under
   `SurfacePlacement.lspkg/Scripts/`.
2. Preview with the InteractionKit prefab and a scene that has floor geometry: in Ground
   the ring appears on the floor, fills while the view is still, and your
   callback receives the pose (content appears there).
3. Restart placement (`startSurfacePlacement` again or the example's
   `resetPlacement()`): the previous reticle disappears and a fresh ring starts;
   no errors in the log.
4. Disable the object that started placement: the reticle must disappear too
   (call `stopSurfacePlacement()`; the UI is not under your object).
5. Tabletop in Preview: click in the Preview; the content lands 50 cm ahead of
   the camera and 20 cm below it, facing the camera. Wall needs wall geometry in
   the Preview environment; verify Wall and the palm flow on device.

## Built with 👽 by the SPECS team

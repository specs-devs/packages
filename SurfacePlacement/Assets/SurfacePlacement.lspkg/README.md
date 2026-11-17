<p align="center">
  <img src="Docs/media/SurfacePlacement.png" width="250px" alt="SurfacePlacement"/>
</p>

# Surface Placement

Place content on floors, tables, and walls. **Head-pose placement is the default:** look at a surface and hold your view steady while the ring fills. Pinch/tap confirmation and palm-based near-surface placement remain available.

## Try the example

1. Open the SurfacePlacement project, or install the package and add `SurfacePlacement__PLACE_IN_SCENE` to your scene. It brings its own guide and an example carousel.
2. Read the guide and pinch **Ok, I understood**. The carousel then steps through four examples with **Previous / Next**: Horizontal · Head Pose (default), Horizontal · Pinch or Tap, Vertical · Head Pose (walls) and Near Surface · Palms.
3. Look at a real surface. After about half a second of steady aim, the ring fills over 1.5 seconds and confirms placement. Moving your head or losing the surface restarts the timer.
4. Pinch the example's **Reset** button (it calls `resetPlacement()`) to place again.

Head pose uses the world camera's position and forward direction; it does not require eye tracking or a hand gesture. The step-by-step guide, placement options and tracking details are in [the guide](Docs/guide.md).

## Usage

This section ships with the package and describes the exact installed revision.
Read it, then follow the links into `Docs/` for the topic you need. It is
written for both people and coding agents; generic Lens scripting, scene
construction, and Specs spatial design live in the CLAD skills, not here.

### Package identity

- Package descriptor: `SurfacePlacement.lspkg/package.native` (holds the package version)
- Consumer import prefix: `SurfacePlacement.lspkg/Scripts/` for the API
  (`Scripts/SurfacePlacementController`, `Scripts/PlacementSettings`); the
  example component is `SurfacePlacement.lspkg/Example` (the file `Example.ts` at the package root, no
  `Scripts/`). See [components](Docs/components.md).
- Prefab entry point: `SurfacePlacement__PLACE_IN_SCENE.prefab`. It is
  self-contained: a guide panel (`Guide`), an `ExampleCarousel`, and four
  example groups (Horizontal · Head Pose, Horizontal · Pinch or Tap, Vertical ·
  Head Pose, Near Surface · Palms). Each group carries an `Example` component
  with its own mode, a red panda and a reset button. The placement UI itself is
  created from code; you never place `Prefabs/*Placement.prefab` by hand.
- Demo scaffolding: `SurfacePlacement.lspkg/Example/` holds the guide and
  carousel scripts (`Example/GuideDismissPanel`, `Example/ExampleCarousel`)
  used only by the prefab. They are not placement API (see
  [components](Docs/components.md)); delete `Guide` / `ExampleCarousel` from
  your copy of the prefab if you only want one example.
- Required companion packages (see `package_dependencies.json`):
  `SpectaclesInteractionKit`, `SpectaclesUIKit`, `Utilities`,
  `SnapDecorators`, `Motion` and `Icons`. The scene needs the
  SIK prefab and a world-tracked camera (SIK's `WorldCameraFinderProvider`
  locates it).

### Version and API status

Read [API status](Docs/api-status.md) before reusing an older Surface
Placement example: horizontal and vertical placement now default to head-pose
confirmation, and the height-adjustment widget now uses the UIKit `Slider`.

### Applicability

Use Surface Placement to let the user choose where content goes: a floor or
table spot (Horizontal), a wall (Vertical), or a surface under their palm
(Near Surface). It returns one world pose and stops; it does not anchor or
persist content across sessions, keep content attached to a moving surface, or
expose raw hit tests. For your own World Query hit testing, use the World
Query skill; for persistent anchors, use a custom-locations or anchor workflow.

### Related CLAD skills

- [specs-world-query](https://github.com/lens-studio-devs/ls-extensions/tree/main/plugins/ls-clad/skills/specs-world-query):
  custom hit tests and surface queries when you need more than one placement pose.
- [specs-interaction-recipes](https://github.com/lens-studio-devs/ls-extensions/tree/main/plugins/ls-clad/skills/specs-interaction-recipes):
  pinch, tap and grab interactions with the placed content.
- [lens-api](https://github.com/lens-studio-devs/ls-extensions/tree/main/plugins/ls-clad/skills/lens-api):
  generic component lifecycle and scripting.
- No CLAD? Setup: https://developers.specs.com/docs/clad/setup/setup-ai/ ·
  source: `github.com/lens-studio-devs/ls-extensions`.

### Package Docs (ship in `Docs/`)

Lens Studio auto-extracts these files into the project's install Cache on
import, so an agent can read them there. Treat only the members documented
here as supported API; never guess an import path.

- [cheat sheet](Docs/cheat-sheet.md) - load-bearing rules; read first
- [components](Docs/components.md) - `SurfacePlacementController`, `PlacementSettings`, enums, `Example`; internal prefab scripts
- [lifecycle](Docs/lifecycle.md) - start / confirm / callback / stop order and what stays in the scene
- [API status](Docs/api-status.md) - Current / Deprecated / Experimental / Removed / Internal
- [minimal examples](Docs/examples.md) - prefab path and compiling snippets
- [guide](Docs/guide.md) - placement modes, head-pose tracking details, migration from pinch/tap
- [troubleshooting](Docs/troubleshooting.md) - package-specific symptoms and fixes

### Verification

1. Compile with no TypeScript errors and no `as any`; imports resolve under
   `SurfacePlacement.lspkg/Scripts/`.
2. Preview with the SIK prefab and a scene that has floor geometry: in
   Horizontal + Head Pose the ring appears on the floor, fills while the view
   is still, and your callback receives the pose (content appears there).
3. Restart placement (`startSurfacePlacement` again or the example's
   `resetPlacement()`): the previous reticle disappears and a fresh ring starts;
   no "Object is null" errors in the log.
4. Disable the object that started placement: the reticle must disappear too
   (call `stopSurfacePlacement()`; the UI is not under your object).
5. Vertical needs wall geometry (the default Preview room has none) and Near
   Surface needs a palm-down hand or a tap; verify those on device.

## Built with 👽 by the SPECS team

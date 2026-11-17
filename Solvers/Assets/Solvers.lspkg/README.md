<p align="center">
  <img src="Docs/media/Solvers.png" width="250px" alt="Solvers"/>
</p>

# Solvers 

Solvers is a set of small components that keep an object in a spatial
relationship with a target: face it, follow it, copy its transform, scale with
distance to it, or fire callbacks when it crosses distance thresholds. Each
solver ships as a TypeScript component and a JavaScript twin, and the
`Solvers__PLACE_IN_SCENE` prefab has a working example of every one.

## Features

- **Billboard**: Y-axis-only rotation toward (or away from) a target
- **Tether / Tether Between Angle Range**: follow a target with an offset, and reposition when distance or angle thresholds are crossed
- **Match Transform**: copy a target's position, rotation and scale, with per-axis locks and lerp speeds
- **Scale Over Distance (linear)**: remap the distance to a target into a uniform scale
- **Distance Events**: enter, exit and percent-inside callbacks for distance ranges
- **In-Between Rotation**: orient an object halfway between two targets' forward directions
- **Sharp Turn**: detect a sharp change in an object's movement direction

## Usage

This section ships with the package and describes the exact installed revision.
Read it, then follow the links into `Docs/` for the topic you need. It is
written for both people and coding agents; generic Lens scripting, scene
construction, and Specs spatial design live in the CLAD skills, not here.

### Package identity

- Package descriptor: `Solvers.lspkg/package.native`
- Consumer import prefix: `Solvers.lspkg/Scripts/TS/` for TypeScript. For
  example `Solvers.lspkg/Scripts/TS/TetherTS`. Older snippets use
  `Solvers.lspkg/TS/...`, which does not resolve. The JavaScript twins live in
  `Solvers.lspkg/Scripts/JS/` and are attached as script assets, not imported.
  See [components](Docs/components.md).
- Prefab entry point: `Solvers__PLACE_IN_SCENE.prefab`. It is the full demo:
  dropped into an empty Specs scene (Camera, lighting, SIK) it shows a guide
  panel (`Guide`), then an example carousel (`ExampleCarousel`) that steps
  through the solvers. The examples sit under its `Solvers` child, one group
  per solver (`[Billboard]`, `[Tether-…]`, `[MatchTransform]`, …), each holding
  a TS and a JS copy.
- Demo scaffolding: `Solvers.lspkg/Example/` ships the guide and carousel
  scripts (`ExampleCarousel`, `GuideDismissPanel`) used by the prefab. They are
  demo code, not solver API. See [components](Docs/components.md#demo-scaffolding-example).
- Required companion packages (`package_dependencies.json`): `SnapDecorators`
  and `Utilities` (imported by every TS solver), and
  `SpectaclesInteractionKit` (imported by `SolversShowcase`), and
  `SpectaclesUIKit` (imported by the guide panel and carousel in `Example/`). Also listed:
  `Motion` and `Icons`.

### Version and API status

Read [API status](Docs/api-status.md) before reusing an older Solvers example.
It lists the Current components and the TS/JS differences, and marks the
helper scripts as Internal.

### Applicability

Use Solvers for script-driven follow, face, match and proximity behavior on any
SceneObject. Use the engine `LookAtComponent` for a full 3-axis look-at (the
prefab's `[LookAt]` group shows it). Use SIK for grabbing and manipulation, and
UIKit `Frame` follow for panels that are already UIKit Frames.

### Related CLAD skills

- [lens-api](https://github.com/lens-studio-devs/ls-extensions/tree/main/plugins/ls-clad/skills/lens-api):
  component lifecycle, `createComponent`, update loops.
- [specs-interaction-recipes](https://github.com/lens-studio-devs/ls-extensions/tree/main/plugins/ls-clad/skills/specs-interaction-recipes):
  making the solved object grabbable or interactive.
- [specs-build-ui](https://github.com/lens-studio-devs/ls-extensions/tree/main/plugins/ls-clad/skills/specs-build-ui):
  world-space UI that a solver keeps in view.
- No CLAD? Setup: https://developers.specs.com/docs/clad/setup/setup-ai/ ·
  source: `github.com/lens-studio-devs/ls-extensions`.

### Package Docs (ship in `Docs/`)

Lens Studio auto-extracts these files into the project's install Cache on
import, so an agent can read them there. Treat only the members documented
here as supported API; never guess an import path.

- [cheat sheet](Docs/cheat-sheet.md) - load-bearing rules; read first
- [components](Docs/components.md) - every solver, TS and JS: inputs, defaults, methods, events
- [API status](Docs/api-status.md) - Current / Deprecated / Experimental / Removed / Internal, TS/JS parity
- [minimal examples](Docs/examples.md) - prefab path and compiling snippets
- [guide and recipes](Docs/guide.md) - how each solver works, plus longer combined recipes
- [troubleshooting](Docs/troubleshooting.md) - package-specific symptoms and fixes

### Verification

1. Compile with no TypeScript errors and no `as any`. Imports come from
   `Solvers.lspkg/Scripts/TS/<File>`, and components are created with
   `createComponent(<Class>.getTypeName())`.
2. In Preview, move the target (the camera, or a dragged object) and confirm the
   solved object reacts: it faces the target, follows it, or rescales.
3. For Distance Events, log each enter/exit callback and cross every threshold
   in both directions.
4. Values are in Lens Studio world units (cm). A tether that sits on the camera
   or never moves usually has an offset or threshold that is wrong by a factor
   of 100.

## Built with 👽 by the SPECS team







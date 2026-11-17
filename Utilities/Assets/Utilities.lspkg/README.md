<p align="center">
  <img src="Docs/media/Utilities.png" width="250px" alt="Utilities"/>
</p>

# Utilities

[![TypeScript](https://img.shields.io/badge/TypeScript-Light%20Gray?color=D3D3D3)]()

A helper library for Lens scripts: nine classes for logging, validation, scene
and component searches, math and geography, tweens, 2D mesh generation,
ScreenTransform calculations and type conversion. The library itself is
scripts only (no components); the package also ships a demo prefab that runs
every helper group live. Other Specs packages (for example SurfacePlacement)
import it.

## Usage

This section ships with the package and describes the exact installed revision.
Read it, then follow the links
into `Docs/` for the topic you need. It is written for both people and coding
agents; generic Lens scripting, scene construction, and Specs spatial design
are out of scope here.

### Package identity

- Package descriptor: `Utilities.lspkg/package.native` (`Utilities`). No setup
  script.
- Prefab entry point: `Utilities__PLACE_IN_SCENE.prefab`. It is the full demo:
  dropped into an empty Specs scene (Camera, lighting, SIK) it shows a guide
  panel (`Guide`), then an example carousel (`ExampleCarousel`) that steps
  through the four helper groups (`MathAndConversion`, `MeshShapes`,
  `Animation`, `SceneAndComponents`). You don't need it to use the helpers.
- Demo scaffolding: `Utilities.lspkg/Example/` ships the scripts the prefab
  uses: the guide and carousel (`ExampleCarousel`, `GuideDismissPanel`), the
  four demo scripts (`UtilitiesDemo/`) and the demo material
  (`Materials/UtilitiesDemoUnlit.mat`). They are demo code, not library API.
  See [components](Docs/components.md#demo-scaffolding-example).
- Consumer import prefix: `Utilities.lspkg/Scripts/Utils/` - one module per
  class, e.g. `import {MathUtils} from "Utilities.lspkg/Scripts/Utils/MathUtils"`.
  Older docs call the package `UtilitiesKit` (`UtilitiesKit.lspkg/...`); that
  path does not exist in this revision.
- Declared companion packages (`package_dependencies.json`):
  `InteractionKit`, `UIKit`, `Motion`, `Icons`; they come in
  with the package from the Asset Library. In the library (`Scripts/Utils/`) only
  `AnimationUtils` imports one of them (`InteractionKit.lspkg/Utils/animate`).
  The guide and carousel in `Example/` import `InteractionKit` and
  `UIKit`. `Motion` and `Icons` are not imported.

### Version and API status

Read [API status](Docs/api-status.md) before reusing an older snippet: it lists
the Current surface, what changed in this revision (AnimationUtils now runs,
line-strip joints fixed) and the known gaps.

### Applicability

Use Utilities for small, stateless helpers you would otherwise copy between
scripts: null checks and required-input validation, hierarchy walks and
component lookups, lerp/angle/quaternion/Haversine math, frame tweens, flat
circle and line-strip meshes, ScreenTransform sizes, and locale-tolerant number
parsing. It adds no interaction or UI: hand interaction is
InteractionKit, spatial UI is UIKit, and richer animation
is the Motion package or SIK's `animate`.

### Package Docs (ship in `Docs/`)

Lens Studio installs packages packed but extracts them into the project Cache on
import, so these files can be read there or from the package source.

- [cheat sheet](Docs/cheat-sheet.md) - the rules that most often break a script using this package; read first
- [components](Docs/components.md) - every class with its import path, signatures, defaults and exact behavior
- [API status](Docs/api-status.md) - Current / Changed / Removed surfaces and known gaps for this revision
- [animation](Docs/animation.md) - tweens, cancellation and the easing-name map
- [examples](Docs/examples.md) - compile-correct snippets, plus the demo prefab's four examples
- [troubleshooting](Docs/troubleshooting.md) - package-specific symptoms, causes and fixes from the QA pass
- [tutorial](Docs/tutorial.md) - the original long guide, updated to the current import paths

### Verification

1. Compile with no TypeScript errors; import from `Utilities.lspkg/Scripts/Utils/...`
   and pass engine type names (`"Component.Text"`) or `String(MyComponent.getTypeName())`
   where a type name is asked for.
2. Call `AnimationUtils.makeTween` once and check the callback reaches `1`; a
   `Cannot read property 'createEvent' of undefined` means an older copy of the
   package is installed.
3. Render `MeshUtils.makeLineStrip2DMeshWithJoints` with three or more points:
   every corner and both ends must be round.
4. Create a `Logger` and check its lines read `time | tag | LEVEL | message`;
   after `setDebugEnabled(false)` nothing prints, at any level.
5. Drop `Utilities__PLACE_IN_SCENE.prefab` into a Specs scene, close the guide
   and step through the four carousel examples with no runtime errors in the
   Logger.

## Built with 👽 by the SPECS team <!-- -->

---

[See more packages](https://github.com/specs-devs/packages)

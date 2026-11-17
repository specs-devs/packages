<p align="center">
  <img src="Docs/media/Instantiation.png" width="250px" alt="Instantiation"/>
</p>

# Instantiation 

Instantiation is a set of drop-in components that spawn copies of a prefab in a
spatial pattern when the Lens starts: circles (area, perimeter, arc, slices),
lines, 2D/3D grids, random points in or on a box or sphere, a square area, or
inside a collider's volume. Every layout ships as a **TypeScript** component
and an equivalent **JavaScript** script.

## Features

- **Grid Patterns**: 2D and 3D grids with per-axis counts and spacing
- **Linear Distributions**: N objects between two points, or one every fixed distance
- **Circular Patterns**: random area, even perimeter, partial arc, polygon slices
- **Sphere / Box Distributions**: uniform random points inside or on the surface
- **Collider Fill**: random points inside or on a box/sphere target, with scale variation
- **Rotation-aware**: layouts follow the center object's rotation
- **TS and JS twins**: the same inputs and behavior in both languages

## Usage

This section ships with the package and describes the exact installed revision.
Read it, then follow the links into `Docs/` for the topic you need. It is
written for both people and coding agents; generic Lens scripting, scene
construction, and Specs spatial design live in the CLAD skills, not here.

### Package identity

- Package descriptor: `Instantiation.lspkg/package.native`
- Consumer import prefix (TypeScript): `Instantiation.lspkg/Scripts/TS/`, for
  example `Instantiation.lspkg/Scripts/TS/InstantiateOn3DGridsTS`. Every class
  name ends in `TS`.
- JavaScript twins: `Instantiation.lspkg/Scripts/JS/<Name>JS.js`. These are
  script assets you add as a Script component; they are not importable modules.
  See [components](Docs/components.md).
- Prefab entry point: `Instantiation__PLACE_IN_SCENE.prefab` (15 example groups,
  one per layout; each has a TS host and a disabled JS twin). Sample spawn
  prefabs: `ExamplePrefabInstantiateSphere(2).prefab`,
  `ExamplePrefabInstantiateBox1/2.prefab`.
- The `__PLACE_IN_SCENE` prefab is self-contained. Besides the 15 example groups
  (under `Examples`), it includes the onboarding `Guide` and the
  `ExampleCarousel`, so dropping it into an empty Specs scene gives you the full
  demo. Their demo-only scripts ship in `Instantiation.lspkg/Example/`
  (`ExampleCarousel/`, `GuideDismissPanel/`). Delete `Guide` and
  `ExampleCarousel` from your instance when you build your own Lens
  ([components](Docs/components.md#demo-scaffolding-example)).
- Required companion packages (`package_dependencies.json`): `Utilities`
  (Logger), `SnapDecorators` (imported by the TS scripts), and
  `SpectaclesInteractionKit` (used by the bundled demo `RuntimeGizmos/Line.ts`),
  plus `SpectaclesUIKit`, `Motion` and `Icons`.

### Version and API status

Read [API status](Docs/api-status.md) before reusing an older example. The
previous README used a wrong import path (`Instantiation.lspkg/TS/…`) and
inputs (`rows`, `columns`, `spacing`, `onInstantiated`) that don't exist.

### Applicability

Use Instantiation for static, start-time layouts of many copies of one prefab.
It doesn't pool objects, re-layout at runtime, or animate. For those, write
your own spawner (see the CLAD `lens-api` skill). For physics-driven scattering,
use the physics skill.

### Related CLAD skills

- [lens-api](https://github.com/lens-studio-devs/ls-extensions/tree/main/plugins/ls-clad/skills/lens-api):
  `ObjectPrefab.instantiate`, lifecycle, runtime object creation.
- [physics](https://github.com/lens-studio-devs/ls-extensions/tree/main/plugins/ls-clad/skills/physics):
  when spawned objects need bodies/colliders.
- No CLAD? Setup: https://developers.specs.com/docs/clad/setup/setup-ai/ ·
  source: `github.com/lens-studio-devs/ls-extensions`.

### Package Docs (ship in `Docs/`)

Lens Studio auto-extracts these files into the project's install Cache on
import, so an agent can read them there. Treat only the members documented
here as supported API; never guess an import path.

- [cheat sheet](Docs/cheat-sheet.md) - load-bearing rules; read first
- [components](Docs/components.md) - all 15 layouts: TS import path, JS asset path, inputs, defaults, placement math
- [API status](Docs/api-status.md) - Current / Deprecated / Experimental / Removed / Internal
- [minimal examples](Docs/examples.md) - prefab path, Inspector setup, TS creation, post-processing spawned copies
- [guide and recipes](Docs/guide.md) - choosing a layout, sizing for Specs, burst / city block / ring recipes
- [troubleshooting](Docs/troubleshooting.md) - package-specific symptoms and fixes

### Verification

1. Compile with no TypeScript errors. TS imports use
   `Instantiation.lspkg/Scripts/TS/<Name>TS`.
2. Use only one of a TS/JS pair per layout (the prefab disables the JS
   twins); running both spawns the layout twice.
3. In Preview, count the spawned children under the instantiator object. The
   count must equal the configured number, not double.
4. The layout is centered on its center object and fits the view (sizes are in
   cm).

## Built with 👽 by the SPECS team

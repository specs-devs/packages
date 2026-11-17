<p align="center">
  <img src="Docs/media/AccessComponents.png" width="250px" alt="AccessComponents"/>
</p>

# Access Components 

Access Components is a set of small, log-only reference examples for reaching
components and other scripts from a script: built-in components on an object
or its child, custom components by `requireType()` or `@typename`, and calls
between JavaScript and TypeScript components in every direction. Each example
comes as a TypeScript/JavaScript pair and prints what it finds.

## Features

- **Component on a SceneObject**: `getComponent("Component.RenderMeshVisual")` on an input object
- **Component on a child**: `getChild(0).getComponent(...)` through a parent input
- **Custom component via `requireType()`**: look up a script by its file path at runtime
- **Custom component via `@typename`**: a typed Inspector input for a custom script
- **Cross-language calls**: JS→JS, JS→TS (with and without a TS declaration), TS→JS, TS→TS
- **Callbacks across scripts**: register a callback / emit events on another component

## Usage

This section ships with the package and describes the exact installed revision.
Read it, then follow the links into `Docs/` for the topic you need. It is
written for both people and coding agents; generic Lens scripting, scene
construction, and Specs spatial design live in the CLAD skills, not here.

### Package identity

- Package descriptor: `AccessComponents.lspkg/package.native`
- Consumer import prefix: `AccessComponents.lspkg/<ExampleFolder>/<File>` — every
  script lives in its example's folder, e.g.
  `AccessComponents.lspkg/AccessTSfromTS/AccessTSfromTS_TSComponentA` (not
  `AccessComponents.lspkg/AccessTSfromTS_TSComponentA`). The folder name
  `AccessJSfromTSwithouthDeclaration` is spelled with "withouth". See
  [components](Docs/components.md).
- Prefab entry point: `AccessComponents__PLACE_IN_SCENE.prefab` (13
  example groups; only the first is enabled). The prefab is self-contained:
  it also carries the guide panel ("Ok, I understood"), the example log panel
  and the example carousel (Previous / Next / minimize), so dropping it into a
  Specs scene with a Camera and SIK gives the full demo.
- Demo scaffolding: `AccessComponents.lspkg/Example/` holds the scripts the
  prefab uses for the guide, log panel and carousel (`ExampleCarousel/`,
  `GuideDismissPanel/`, `LogReadout/`). They are not
  part of the examples; see [components](Docs/components.md#demo-scaffolding-example).
- Required companion packages (`package_dependencies.json`): `Utilities`
  and `SnapDecorators` (imported by the TS scripts), plus
  `SpectaclesInteractionKit`, `SpectaclesUIKit`, `Motion` and `Icons` (used by
  the demo scaffolding). The examples themselves need no SIK prefab.

### Version and API status

Read [API status](Docs/api-status.md) before reusing an older Access Components
snippet: earlier READMEs showed helper methods (`hasComponent`,
`getComponentInChildren`, `type.typename`) that do not exist.

### Applicability

Use these examples to see a working, wired pattern for script-to-script and
script-to-component access, or as a starting point to copy. The package adds
no runtime API: there is nothing to call from your own code except the example
classes. The general rules for component lookup, `@input`, `requireType` and
lifecycle belong to the lens-api skill and the engine's `StudioLib.d.ts`.

### Related CLAD skills

- [lens-api](https://github.com/lens-studio-devs/ls-extensions/tree/main/plugins/ls-clad/skills/lens-api):
  component lifecycle, `getComponent`, `@input`, scene queries.
- [lens-debug](https://github.com/lens-studio-devs/ls-extensions/tree/main/plugins/ls-clad/skills/lens-debug):
  null-reference and "handler not firing" bugs.
- No CLAD? Setup: https://developers.specs.com/docs/clad/setup/setup-ai/ ·
  source: `github.com/lens-studio-devs/ls-extensions`.

### Package Docs (ship in `Docs/`)

Lens Studio auto-extracts these files into the project's install Cache on
import, so an agent can read them there. Treat only the members documented
here as supported; never guess an import path.

- [cheat sheet](Docs/cheat-sheet.md) - load-bearing rules; read first
- [components](Docs/components.md) - the 13 examples: scripts, import paths, inputs, members, prefab wiring
- [API status](Docs/api-status.md) - Current / Deprecated / Experimental / Removed / Internal
- [minimal examples](Docs/examples.md) - prefab path and compiling snippets
- [guide](Docs/guide.md) - the access patterns explained, plus the corrected helper and cache recipes from earlier READMEs
- [troubleshooting](Docs/troubleshooting.md) - package-specific symptoms and fixes

### Verification

1. Compile with no TypeScript errors; imports use the folder prefix above.
2. Enable one example group under `AccessComponents__PLACE_IN_SCENE`
   at a time and run Preview. The prefab already wires `enableLogging` (TS)
   and `debug` (TS and JS) on; on a fresh copy of a script, turn them on.
3. Confirm the expected lines in the Logger (see [components](Docs/components.md)),
   with no `Error:` lines except JS→JS's deliberate
   `Error: setText requires a string parameter`.
4. Each example runs once, on its first `OnStartEvent`: re-enabling a group
   prints nothing new.

## Built with 👽 by the SPECS team <!-- --> <!-- --> <!-- --> <!-- -->





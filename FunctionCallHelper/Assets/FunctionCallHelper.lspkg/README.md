<p align="center">
  <img src="Docs/media/FunctionCallHelper.png" width="250px" alt="FunctionCallHelper"/>
</p>

# Function Call Helper 

Function Call Helper builds a scrollable panel of UIKit buttons from a list of
`{script, functionName}` pairs: one button per entry, and pinching a button
calls that function on that script component. It is meant for debug panels,
test harnesses and quick action menus where you don't want to hand-wire a
button per function.

## Features

- **Dynamic Button Generation**: one button instantiated from a prefab per triggerable function
- **Flexible Function Binding**: call any public method on any script component by name
- **ScrollWindow Integration**: scroll dimensions set from the grid container size
- **GridLayout Support**: each button gets a Layout2D `GridItem` and is auto-placed by the grid
- **Automatic Component Discovery**: ScrollWindow and GridLayout found in the parent hierarchy when not assigned
- **Button Size Override**: optionally stamp one size on every button and size the grid to fit
- **Display Names**: a target script can provide `getFunctionName()` for a readable button label

## Usage

This section ships with the package and describes the exact installed revision.
Read it, then follow the links into `Docs/` for the topic you need. It is
written for both people and coding agents; generic Lens scripting, scene
construction, and Specs spatial design are out of scope here.

### Package identity

- Package descriptor: `FunctionCallHelper.lspkg/package.native`
- Consumer import prefix: `FunctionCallHelper.lspkg/` — the module is
  `FunctionCallHelper.lspkg/FunctionCallHelper` (at the package root, no
  `Scripts/` folder). It exports `ButtonClickEvent` and `TriggerableFunction`.
  The nine sample targets are `FunctionCallHelper.lspkg/Examples/TestScript1` …
  `TestScript9`. See [components](Docs/components.md).
- Prefab entry points: `FunctionCallHelper__PLACE_IN_SCENE.prefab` (UIKit
  Frame → ScrollWindow → GridLayout panel wired to nine test scripts) and
  `CapsuleButton.prefab` (the button template it instantiates).
- The `__PLACE_IN_SCENE` prefab is self-contained: besides the button panel
  it includes the onboarding `Guide` and the `ExampleCarousel`, so dropping it
  into an empty Specs scene gives the full demo. Their demo-only scripts ship
  in `FunctionCallHelper.lspkg/Example/` (`ExampleCarousel/`,
  `GuideDismissPanel/`). Delete `Guide` and `ExampleCarousel` from your
  instance when you build your own Lens
  ([components](Docs/components.md#demo-scaffolding-example)).
- Required companion packages (`package_dependencies.json`):
  `UIKit`, `Utilities` and `SnapDecorators` (imported by the
  script), plus `InteractionKit`, `Motion` and `Icons`. The scene
  needs the SIK prefab so the buttons can be pinched.

### Version and API status

Read [API status](Docs/api-status.md) before reusing an older Function Call
Helper example: several patterns from earlier READMEs (re-assigning the list
at runtime, per-call display names, scroll snapping) do not work in this
revision.

### Applicability

Use Function Call Helper when the buttons are a flat list of "call this
method" actions, typically for debugging or testing. For a designed UI (custom
layout, icons, toggles, sliders, per-button styling) build with UIKit
directly. For a single button, wire UIKit `Button.onTriggerUp` yourself.

### Package Docs (ship in `Docs/`)

Lens Studio auto-extracts these files into the project's install Cache on
import, so an agent can read them there. Treat only the members documented
here as supported API; never guess an import path.

- [cheat sheet](Docs/cheat-sheet.md) - load-bearing rules; read first
- [components](Docs/components.md) - `ButtonClickEvent`, `TriggerableFunction`, test scripts, prefab hierarchy
- [API status](Docs/api-status.md) - Current / Deprecated / Experimental / Removed / Internal
- [minimal examples](Docs/examples.md) - prefab path and compiling snippets
- [guide and recipes](Docs/guide.md) - longer patterns (debug panel, multi-script menu, test harness) and configuration tips
- [troubleshooting](Docs/troubleshooting.md) - package-specific symptoms and fixes

### Verification

1. Compile with no TypeScript errors; the import is
   `FunctionCallHelper.lspkg/FunctionCallHelper`.
2. Preview with the SIK prefab in the scene: one button per entry of
   `triggerableFunctions`, each labelled with the target's `getFunctionName()`
   (or the raw `functionName`), not the prefab placeholder "Text".
3. Pinch each button and confirm its function runs (log or visible change);
   no `FunctionTriggerer: Function "…" not found` error.
4. With more buttons than fit, drag the list and confirm the ScrollWindow
   clips and scrolls them, starting at the top.

## Built with 👽 by the SPECS team <!-- --> <!-- --> <!-- --> <!-- -->

---

[See more packages](https://github.com/specs-devs/packages)


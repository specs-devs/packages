<p align="center">
  <img src="Docs/media/InteractionKitExamples.png" width="250px" alt="InteractionKitExamples"/>
</p>

# InteractionKitExamples

InteractionKitExamples is an **example package** for **SpectaclesInteractionKit (SIK)** and **SpectaclesUIKit**. It ships ready-made scenes and prefabs that demonstrate interaction patterns, scroll views, and a small “rocket workshop” flow you can study or drop into a Specs project.

## Features

- **Examples prefab**: main entry point **`InteractionKitExamples__PLACE_IN_SCENE.prefab`**. Drag it into the scene hierarchy to instantiate the sample bundle.
- **Rocket Workshop**: a code-first rocket-builder demo under **`RocketWorkshop/`**. The whole UI (Frame, buttons, slider, switch, scroll list) is built in TypeScript, with no `@input` wiring.
- **UI examples**: UIKit-driven example scripts under **`Scripts/UI/`** (menus, grids, carousel, modal, video player, card deck, chat, sliders, toggles, scroll windows).
- **Interaction examples**: SIK `Interactable` / `InteractableManipulation` patterns under **`Scripts/Interaction/`**.

The layout overview, script highlights and customization notes are in the
[guide](Docs/guide.md).

## Usage

This section ships with the package and describes what it contains.
Read it, then follow the links into `Docs/` for the topic you need. It is
written for both people and coding agents; generic Lens scripting, scene
construction, and Specs spatial design live in the CLAD skills, not here.

### Package identity

- Package descriptor: `InteractionKitExamples.lspkg/package.native`
- Consumer import prefixes: `InteractionKitExamples.lspkg/Scripts/` (UI,
  Interaction, Utils, GuideDismissPanel) and
  `InteractionKitExamples.lspkg/RocketWorkshop/Scripts/` (Rocket Workshop).
  There is no barrel module. See [components](Docs/components.md) for every path.
- Prefab entry point: `InteractionKitExamples__PLACE_IN_SCENE.prefab`. It is the whole
  demo: a `Guide` panel (closed with "Ok, I understood"), an `ExampleCarousel`
  panel (Previous / Next / minimize) and three example groups,
  `[EXAMPLES] Rocket Workshop`, `[EXAMPLES] UI` and `[EXAMPLES] Interaction`.
  The carousel steps through the 15 examples one at a time. Drop the prefab
  into a Specs scene that has a Camera and the SIK prefab; nothing else is needed.
- Demo scaffolding: `InteractionKitExamples.lspkg/Example/` holds the
  `ExampleCarousel` and `GuideDismissPanel` scripts the prefab's guide and
  carousel use. They are not part of the examples you copy; see
  [components](Docs/components.md#demo-scaffolding-example).
- Required companion packages (`package_dependencies.json`):
  `SpectaclesInteractionKit`, `SpectaclesUIKit`, `Utilities` and
  `SnapDecorators` (all imported by the scripts), plus `Motion` and `Icons`
  (UIKit companions). The scene also needs the SIK prefab.

### API status

Read [API status](Docs/api-status.md) before you copy an example. Many
`Scripts/UI/` examples still use UIKit surfaces that UIKit marks Deprecated
(`RectangleButton`, `RoundButton`, `BackPlate`), and several helpers write private
UIKit fields through `as any`. The API status file lists, per script, which
patterns are safe to copy.

### Applicability

Use this package to learn from, or drop in, working SIK + UIKit compositions:
tabbed menus, grids, carousels, a modal, a video player, a card deck, a chat
list, manipulation feedback and pinch / hand-distance driven transforms. It is
not a component library. For production UI use SpectaclesUIKit directly, and
for interaction infrastructure use SIK directly. Both packages' own READMEs are
the API authority. The examples are reference implementations you copy and trim.

### Related CLAD skills

- [specs-build-ui](https://github.com/lens-studio-devs/ls-extensions/tree/main/plugins/ls-clad/skills/specs-build-ui):
  selecting and building with the installed Specs UI package.
- [specs-interaction-recipes](https://github.com/lens-studio-devs/ls-extensions/tree/main/plugins/ls-clad/skills/specs-interaction-recipes):
  hand interactions, manipulation, SIK init order.
- [lens-api](https://github.com/lens-studio-devs/ls-extensions/tree/main/plugins/ls-clad/skills/lens-api):
  generic component lifecycle and scripting.
- No CLAD? Setup: https://developers.specs.com/docs/clad/setup/setup-ai/ ·
  source: `github.com/lens-studio-devs/ls-extensions`.

### Package Docs (ship in `Docs/`)

Lens Studio auto-extracts these files into the project's install Cache on
import, so an agent can read them there. Treat only the members documented
here as supported API; never guess an import path.

- [cheat sheet](Docs/cheat-sheet.md) - load-bearing rules; read first
- [components](Docs/components.md) - every script: import path, inputs, defaults, public methods
- [API status](Docs/api-status.md) - Current / Deprecated / Experimental / Removed / Internal, per script
- [minimal examples](Docs/examples.md) - prefab path and compiling snippets
- [guide](Docs/guide.md) - layout overview, prefab map, Rocket Workshop walkthrough, customization
- [troubleshooting](Docs/troubleshooting.md) - package-specific symptoms and fixes (from the QA pass)
- [RocketWorkshop/README.md](RocketWorkshop/README.md) - the Rocket Workshop's own reading order

### Verification

1. Compile with no TypeScript errors. Code you copy from these examples must not
   add new `as any` private-field writes; use the UIKit public API from UIKit's
   installed docs.
2. Place `InteractionKitExamples__PLACE_IN_SCENE.prefab` (with the SIK prefab), close the
   guide and step through the examples with the carousel. Check in Preview that
   each panel sits in front of the camera, not about 6 m away and not hidden
   behind another panel.
3. Exercise the events the example relies on: button taps, toggle-group
   selection, slider value, switch, grab and release.
4. For `InteractionModesManager`, toggle one mode and confirm the status text
   and cube transform change. In the editor this uses mock hands, on device real
   SIK hands.

## Built with 👽 by the SPECS team

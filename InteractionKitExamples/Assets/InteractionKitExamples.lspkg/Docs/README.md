# Interaction Kit Examples

## What it is
Interaction Kit Examples is an example package for Interaction Kit (SIK) and UI Kit. It ships one prefab with
ready-made, working compositions: a code-first "Rocket Workshop", UI Kit layouts (menus, grids, carousel, modal,
video player, card deck, chat, sliders, toggles, scroll windows) and SIK interaction patterns. It is for Specs
developers who want reference implementations to study, copy and trim; it is not a component library.

## What it does
- You drop `InteractionKitExamples__PLACE_IN_SCENE.prefab` into a scene with a Camera and SIK. It holds a `Guide`
  panel (closed with "Ok, I understood"), an `ExampleCarousel` panel (Previous / Next / minimize) and three groups:
  `[EXAMPLES] Rocket Workshop`, `[EXAMPLES] UI` and `[EXAMPLES] Interaction`.
- The carousel steps through the 15 examples one at a time, enabling a single example so panels don't overlap.
- **Rocket Workshop:** pick nose cone, body tube and fin styles from a scrollable part selector, choose a flight path
  with a toggle group, set the speed with a slider, toggle the platform with a switch and launch the rocket.
- **UI examples:** each builder creates its UI Kit panel in code on start, filled with mock content while `testMode`
  is on (the default).
- **Interaction examples:** hover / grab / release feedback on manipulable objects, scale and rotation driven by
  pinch strength or hand distance (`InteractionModesManager`), and a particle path that is pushed away from a
  reference object (`DistanceField`).

## Highlights
- Rocket Workshop builds its whole UI (Frame, buttons, toggle group, slider, switch, scroll list) in TypeScript with
  no `@input` wiring, using the small `RocketUI` toolkit; rocket parts are swapped from part prefabs.
- Code-first UI builders share inputs for frame appearance, padding, close / follow buttons and a local position
  (`positionZ = -110` by default).
- `InteractionModesManager` simulates hands with mock objects in the editor and reads SIK hand data on Specs.
- Grid examples expose 1-based button accessors and callbacks (`getButton`, `setButtonCallback`, `updateButton*`).
- Every UI Kit-importing example loads `SpectaclesUIKit.lspkg/Scripts/Themes/ThemeService` first to avoid a circular-import
  init crash.

## Core scripts
| Script | What it does |
|---|---|
| `RocketWorkshop/Scripts/RocketWorkshop.ts` | Entry point on the diorama root: finds the 3D art, creates the configurator and builds both panels. |
| `RocketWorkshop/Scripts/RocketUI.ts` | Reusable UI Kit builder helpers (frame, flex rows/columns, buttons, slider, switch, scroll window, labels). |
| `RocketWorkshop/Scripts/LaunchControlPanel.ts` | Launch button, flight-path toggle group, speed slider and platform switch, plus the launch sequence. |
| `RocketWorkshop/Scripts/RocketConfigurator.ts` | Assembles the rocket from interchangeable part prefabs. |
| `Scripts/UI/UIController.ts` | Enables one example of a group at a time with next / previous navigation. |
| `Scripts/UI/ExampleMenuHorizontalLayout.ts` | Tabbed menu panel (Home / Gallery / Settings) built in code. |
| `Scripts/UI/ExampleGridSimple.ts` | Grid of image buttons with 1-based accessors and callbacks. |
| `Scripts/UI/ExampleVideoPlayer.ts` | Video player panel with play / pause / seek, volume and playback rate. |
| `Scripts/Interaction/InteractionModesManager.ts` | Pinch- and hand-distance-driven scale and rotation of a row of cubes. |
| `Scripts/Interaction/ExampleSimpleManipulation.ts` | Writes hover / grab / release events of SIK manipulables to a status text. |

## Extra info
- **Requires:** InteractionKit, UIKit, Utilities and SnapDecorators (imported by the scripts), plus Motion and Icons.
  The scene needs the SIK prefab. Everything runs in the Lens Studio Preview; `InteractionModesManager` uses mock
  hands there and real hands on Specs. Many `Scripts/UI/` examples use UI Kit surfaces marked Deprecated
  (`RectangleButton`, `RoundButton`, `BackPlate`) and write private fields through `as any`: check `api-status.md`
  before copying a pattern.
- **Get started:** `InteractionKitExamples__PLACE_IN_SCENE.prefab`; close the guide and step through the examples
  with the carousel. Start reading the Rocket Workshop at `RocketWorkshop/Scripts/RocketWorkshop.ts`.
- **More docs:**
  - [cheat-sheet.md](cheat-sheet.md) - load-bearing rules, read first
  - [components.md](components.md) - every script: import path, inputs, defaults, public methods
  - [guide.md](guide.md) - layout overview, prefab map, Rocket Workshop walkthrough, customization
  - [examples.md](examples.md) - prefab path and compiling snippets
  - [api-status.md](api-status.md) - current and deprecated surfaces, per script
  - [troubleshooting.md](troubleshooting.md) - symptoms and fixes
  - [../RocketWorkshop/README.md](../RocketWorkshop/README.md) - the Rocket Workshop's own reading order

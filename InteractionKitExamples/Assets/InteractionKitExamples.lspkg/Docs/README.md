# InteractionKit Examples

## What it is
InteractionKit Examples is an example package for InteractionKit and UIKit. It ships one prefab with ready-made,
working compositions: the Interaction Showcase (shown first), UIKit layouts (menus, grids, carousel, modal, card
deck, chat, sliders, toggles, scroll windows) and InteractionKit interaction patterns. It is for Specs
developers who want reference implementations to study, copy and trim; it is not a component library. Requires
Lens Studio 5.25+.

## What it does
- You drop `InteractionKitExamples__PLACE_IN_SCENE.prefab` into a scene with a Camera and the InteractionKit prefab.
  It holds a `Guide` panel (closed with "Ok, I understood"), an `ExampleCarousel` panel (Previous / Next / minimize)
  and three groups: `[EXAMPLES] Showcase`, `[EXAMPLES] UI` and `[EXAMPLES] Interaction`.
- The carousel steps through the 15 examples one at a time, enabling a single example so panels don't overlap. It
  starts on the Interaction Showcase.
- **Interaction Showcase:** a far panel picks one of four showcases with a toggle group and shows that showcase's
  controls:
  - **Direct:** grab the jellyfish with a direct pinch, scale it with two hands, throw it (`ThrowOnRelease`) and
    reset it. Its tentacles are driven by a soft-body chain solver.
  - **Indirect:** aim at any of seven crystals, pinch and drag; the others follow in a line (`CrystalChain`). Tune
    follow speed, spacing and depth pull, and regroup the chain.
  - **Poke:** press the crystal with your index fingertip and it shrinks (`PokeShrink`); tune the shrink amount and
    speed, and limit pokes to the front.
  - **Pinch:** the crystal grows when a hand is in pinching reach (`PinchGrow`) and spins up on every pinch
    (`PinchSpin`).
  - A near panel tints the crystals and the jellyfish with a color slider, with a hold-to-reset button. The **Color panel**
    button in the far panel's header opens it in front of you and closes it again (`NearMenuToggle`).
- **UI examples:** each builder creates its UIKit panel in code on start, filled with mock content while `testMode`
  is on (the default).
- **Interaction examples:** hover / grab / release feedback on manipulable objects, scale and rotation driven by
  pinch strength or hand distance (`InteractionModesManager`), and a particle path that is pushed away from a
  reference object (`DistanceField`).

## Highlights
- The Showcase is authored in the hierarchy: panels, rows, sliders, switches and buttons are UIKit components you
  can see and edit in the Inspector, wired to small scripts with `@input`. Each script subscribes to InteractionKit
  and UIKit events in `OnStartEvent` and does one thing, without private-field writes.
- Code-first UI builders share inputs for frame appearance, padding, close / follow buttons and a local position
  (`positionZ = -110` by default).
- `InteractionModesManager` simulates hands with mock objects in the editor and reads InteractionKit hand data on
  Specs.
- Grid examples expose 1-based button accessors and callbacks (`getButton`, `setButtonCallback`, `updateButton*`).
- Every UIKit-importing example loads `UIKit.lspkg/Scripts/Themes/ThemeService` first to avoid a circular-import
  init crash. The prefab's `ThemeManager` selects the System 3.0 theme.

## Core scripts
| Script | What it does |
|---|---|
| `Showcase/Scripts/ShowcaseSelector.ts` | Shows one showcase and its control section at a time, picked by the far panel's toggle group. |
| `Showcase/Scripts/CrystalChain.ts` | Makes a row of crystals follow whichever one you drag, in a line behind it. |
| `Showcase/Scripts/ThrowOnRelease.ts` | Lets go of a manipulated object with a throw that eases to a stop (no physics). |
| `Showcase/Scripts/PokeShrink.ts` / `PinchGrow.ts` / `PinchSpin.ts` | Poke, hover and pinch feedback on a single `Interactable`. |
| `Showcase/Scripts/NearMenuToggle.ts` | Opens and closes the near panel from the far panel's Color panel button (a UIKit `Button`). |
| `Scripts/UI/UIController.ts` | Enables one example of a group at a time with next / previous navigation. |
| `Scripts/UI/ExampleMenuHorizontalLayout.ts` | Tabbed menu panel (Home / Gallery / Settings) built in code. |
| `Scripts/UI/ExampleGridSimple.ts` | Grid of image buttons with 1-based accessors and callbacks. |
| `Scripts/Interaction/InteractionModesManager.ts` | Pinch- and hand-distance-driven scale and rotation of a row of cubes. |
| `Scripts/Interaction/ExampleSimpleManipulation.ts` | Writes hover / grab / release events of manipulables to a status text. |

## Extra info
- **Requires:** Lens Studio 5.25+; InteractionKit, UIKit, Utilities and SnapDecorators (imported by the scripts), plus
  Motion and Icons. The scene needs the InteractionKit prefab and a Camera with Device Tracking. Everything runs in
  the Lens Studio Preview; `InteractionModesManager` uses mock hands there and real hands on Specs. Many
  `Scripts/UI/` examples use UIKit surfaces marked Deprecated (`RectangleButton`, `RoundButton`, `BackPlate`) and
  write private fields through `as any`: check `api-status.md` before copying a pattern.
- **Get started:** `InteractionKitExamples__PLACE_IN_SCENE.prefab`; close the guide, try the four showcases from the
  Showcase's far panel, then step through the other examples with the carousel. Start reading the Showcase at
  `Showcase/Scripts/ShowcaseSelector.ts`.
- **More docs:**
  - [cheat-sheet.md](cheat-sheet.md) - load-bearing rules, read first
  - [components.md](components.md) - every script: import path, inputs, defaults, public methods
  - [guide.md](guide.md) - layout overview, prefab map, Interaction Showcase walkthrough, customization
  - [examples.md](examples.md) - prefab path and compiling snippets
  - [api-status.md](api-status.md) - current and deprecated surfaces, per script
  - [troubleshooting.md](troubleshooting.md) - symptoms and fixes

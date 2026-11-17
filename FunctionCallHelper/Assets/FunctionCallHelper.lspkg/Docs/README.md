# Function Call Helper

## What it is
Function Call Helper is a package that builds a scrollable panel of UI Kit buttons from a list of
`{script, functionName}` pairs: one button per entry, and pinching a button calls that function on that script
component. It is meant for debug panels, test harnesses and quick action menus where you don't want to hand-wire
a button per function.

## What it does
1. You add the `ButtonClickEvent` component (file `FunctionCallHelper.ts`) and fill `triggerableFunctions`,
   `buttonPrefab` and `parentObject` (the GridLayout node inside a ScrollWindow).
2. On start it finds the ScrollWindow and GridLayout from `parentObject` upward when they are not assigned, and
   waits for the ScrollWindow to initialize.
3. For each entry it instantiates `buttonPrefab` under `parentObject`, adds an auto-placed `GridItem`, subscribes the
   button's `onTriggerUp` and sets its label from the target's `getFunctionName(functionName)` or the raw
   `functionName`.
4. Pinching a button calls `script[functionName]("")` on the target `ScriptComponent`.
5. It sets the ScrollWindow's scroll dimensions from the grid size, so a long list clips and scrolls inside the frame.
6. `FunctionCallHelper__PLACE_IN_SCENE.prefab` ships this wired to nine sample scripts (`TestScript1` …
   `TestScript9`) inside a UI Kit Frame, plus a guide panel and an example carousel.

## Highlights
- Call any public method on any script component by name, with no per-button wiring.
- Works with UI Kit `Button`, `CapsuleButton`, `RectangleButton` and `RoundButton`, or any component exposing
  `onTriggerUp`; `CapsuleButton.prefab` is the shipped button template.
- `overrideButtonSize` stamps one `buttonSize` on every button and sizes the grid to fit, with `topPadding` to clear
  the Frame title bar.
- `rebuild()` destroys the generated buttons and builds the current `triggerableFunctions` again.
- Readable labels: a target script can implement `getFunctionName()`; several functions on one script fall back to
  the method name split into words.

## Core scripts
| Script | What it does |
|---|---|
| `FunctionCallHelper.ts` | `ButtonClickEvent` component and the `TriggerableFunction` type: builds, labels and wires the buttons. |
| `Examples/TestScript1.ts` | Sample target: `activateSystem()` prints and updates a `Text`; `getFunctionName()` returns "Activate System". |
| `Examples/TestScript2.ts` | Another sample target with its own function and display name (the set runs to `TestScript9.ts`). |
| `Example/GuideDismissPanel/GuideDismissPanel.ts` | Demo scaffolding: guide panel hidden behind "Ok, I understood". |
| `Example/ExampleCarousel/ExampleCarousel.ts` | Demo scaffolding: carousel panel that presents the demo. |

## Extra info
- **Requires:** UIKit, Utilities and SnapDecorators (imported by the script), plus InteractionKit, Motion and Icons.
  The scene needs Interaction Kit (SIK) so the buttons can be pinched; this works in the Lens Studio Preview and on
  Specs. Buttons are built once on start: re-assigning `triggerableFunctions` later has no effect until `rebuild()`.
- **Get started:** drop `FunctionCallHelper__PLACE_IN_SCENE.prefab` into a scene and point its entries at your own
  scripts, or import `ButtonClickEvent` from `FunctionCallHelper.lspkg/FunctionCallHelper`. Delete `Guide` and
  `ExampleCarousel` from your instance when building your own Lens.
- **More docs:**
  - [cheat-sheet.md](cheat-sheet.md) - load-bearing rules, read first
  - [components.md](components.md) - `ButtonClickEvent`, `TriggerableFunction`, test scripts, prefab hierarchy
  - [guide.md](guide.md) - debug panel, multi-script menu and test harness recipes
  - [examples.md](examples.md) - prefab path and compiling snippets
  - [api-status.md](api-status.md) - current, deprecated and removed patterns
  - [troubleshooting.md](troubleshooting.md) - symptoms and fixes

# InteractionKitExamples guide

[← Agent usage index](../README.md)

## Use when

Read this to find your way around the package: which folder holds what, what
the shipped prefab contains, and how the Interaction Showcase is put together. For
exact members see [components](components.md). For what is safe to copy see
[API status](api-status.md).

## Quick start

1. Use Lens Studio 5.25+. Install **InteractionKit** and **UIKit** at the versions
   declared in `package_dependencies.json` (via the Asset Library or local
   `Packages/`).
2. Add this package to your Specs project from the Asset Library, or import the
   unpacked `.lspkg` folder.
3. Place `InteractionKitExamples__PLACE_IN_SCENE.prefab` in the scene, next to the InteractionKit prefab.
4. Press Play in Preview or on device. Close the guide: the Interaction Showcase
   comes first. Then use the carousel to step through the UI and Interaction
   groups to see list scrolling, manipulation, and Specs UI conventions.

## Layout overview

| Area | Purpose |
|------|--------|
| `InteractionKitExamples__PLACE_IN_SCENE.prefab` | Root prefab users place in the scene |
| `Scripts/UI/` | UIKit example scripts (frames, buttons, sliders, toggles, grids, scroll windows, menus, carousel, modal, deck, chat) |
| `Showcase/` | The Interaction Showcase: `Scripts/` (the showcase scripts), `Jellyfish/` (mesh, material, matcap and the soft-body `physics.ts` used for the tentacles), `Crystal/` (crystal meshes, shader, material, textures) and `Audio/` (grab, pinch and poke sounds) |
| `Scripts/Interaction/` | InteractionKit interaction examples (manipulation, distance field, interaction modes, diamond grid) |
| `Scripts/Utils/` | Shared helper scripts (`TextLimiter`, `TreeStructureUtils`) |
| `Scripts/GuideDismissPanel/` | Guide-on-a-Frame helper (not used by the prefab) |
| `Example/` | Demo scaffolding used by the prefab: `ExampleCarousel` (steps through the examples) and `GuideDismissPanel` (the intro guide) |
| `Fonts/` `Materials/` `Meshes/` `Prefabs/` `Shaders/` `Textures/` | Shared assets used by the `Scripts/UI` and `Scripts/Interaction` examples. `Fonts/` holds the SpecsSans weights the builders load when their font inputs are empty |

## Prefab map

`InteractionKitExamples__PLACE_IN_SCENE` holds the `Guide` panel, the `ExampleCarousel`
panel and three example groups. The guide hides the carousel and the groups until
it is closed; the carousel then enables one example at a time (15 steps across the
three groups), starting with the Showcase. The Showcase is listed in the carousel's
`fixedExamples`, so it stays where it is authored, within arm's reach, instead of
being moved behind the carousel like the other examples. Without the carousel, keep one group enabled at a time.

| Group | Navigator | Children (in `UIController` order) |
|---|---|---|
| `[EXAMPLES] Showcase` | `ShowcaseSelector` + the far panel's toggle group | `Showcases/` (`Showcase_Jellyfish`, `Showcase_Chain`, `Showcase_Poke`, `Showcase_Pinch`), `FarPanelPlacement/FarPanel` (title, the Color panel button, the Direct / Indirect / Poke / Pinch toggle group and one control section per showcase), `NearPanelPlacement/NearPanel` (color slider and hold-to-reset button; off until opened), `NearMenuController` (`NearMenuToggle`), `ShowcaseSelector` |
| `[EXAMPLES] UI` | `UIController` + `Menu` (◀ ▶, title, counter) | `ExampleMenuHorizontalLayout`, `ExampleMenuVerticalLayout`, `ExampleGridWide` and `ExampleGridSquare` (`ExampleGridSimple`, 2×4 and 3×3), `ExampleDynamicGrid` (`ExampleGrid`, draggable + scrollable), `ExampleCarouselLayout`, `ExampleAdaptableTextArea` (`ExampleRoundedRectangle`), `ExampleModalLayout`, `ExampleDeckParent/ExampleDeck`, `ExampleChatParent/ExampleChat` |
| `[EXAMPLES] Interaction` | `UIController` + `Menu` | `Manipulate` (`ExampleSimpleManipulation` + mesh/sphere/box with InteractionKit `Interactable` + `InteractableManipulation`), `DistanceField` (grab the sphere to pilot the spaceship along the curve; the prefab has no in-scene instruction label, so give that hint in your own UI), `InteractiveTransform` (`InteractionModesManager` + hand/pinch mock-ups + Frame with the four mode buttons) |

The scripts that no prefab uses (`ExampleScrollWindowLayout`, `ExampleSlidersLayout`,
`ExampleSwitchToggleGroupLayout`, `ExampleToggleGroupLayout`, `ExampleReactiveLayout`,
`ExampleDynamicLayout`, `UIManager`, `UIKitCustomVisuals*`, `ExampleDiamondGrid`,
`GuideDismissPanel`) are self-contained. Add one to an empty SceneObject to see it.

## Interaction Showcase walkthrough

The Showcase is **authored in the hierarchy**: every panel, row, slider, switch
and button is a UIKit component you can select and edit in the Inspector, and
every script is wired with `@input`. Each script does one thing and subscribes
to InteractionKit / UIKit events in `OnStartEvent`.

| Showcase | Toggle | Objects | Behavior scripts | Controls (far panel) |
|---|---|---|---|---|
| Jellyfish | Direct | `Jellyfish` (`Interactable` in Direct targeting mode + `InteractableManipulation` + `InteractableAudioFeedback`) | `ThrowOnRelease`, `physics` (tentacles) | `JellyfishControls`: size slider, throwable switch, reset button |
| Crystal chain | Indirect | `Crystal_1` … `Crystal_7` (`Interactable` in Indirect targeting mode + `InteractableManipulation`) | `CrystalChain` | `ChainControls`: follow speed and spacing sliders, depth pull switch, regroup button |
| Poke crystal | Poke | `PokeCrystal` (`Interactable` in Poke targeting mode) | `PokeShrink` | `PokeControls`: shrink amount and speed sliders, front-only switch |
| Pinch crystal | Pinch | `PinchCrystal` (`Interactable` in Direct targeting mode) | `PinchGrow`, `PinchSpin` | `PinchControls`: pinch spin slider, idle turn switch |

Read in this order:

| # | File | What it teaches |
|---|------|-----------------|
| 1 | `Showcase/Scripts/ShowcaseSelector.ts` | Switching showcases from a UIKit `ToggleGroup`; lists matched by position |
| 2 | `Showcase/Scripts/PokeShrink.ts`, `PinchGrow.ts`, `PinchSpin.ts` | Reacting to poke, hover and pinch on a single `Interactable`, with InteractionKit's `SpringAnimate1D` |
| 3 | `Showcase/Scripts/CrystalChain.ts`, `ThrowOnRelease.ts` | Building on `InteractableManipulation` events (manipulation start / end) |
| 4 | `Showcase/Scripts/*Controls.ts`, `ColorPanel.ts` | Driving behavior from UIKit `Slider`, `Switch`, `ColorSlider` and `Button` events |
| 5 | `Showcase/Scripts/NearMenuToggle.ts` | Opening and closing a near panel from a UIKit `Button` (`onTriggerUp`) |

Conventions worth copying:

- Subscribe to InteractionKit and UIKit events on `OnStartEvent`, not in
  `onAwake` (InteractionKit and UIKit finish their own setup first).
- The first import in any file that touches UIKit visuals is
  `import "UIKit.lspkg/Scripts/Themes/ThemeService"`.
- Follow sliders through `onKnobMoved` (every frame the knob moves) when the
  change should show while dragging; `onValueChange` only fires on release.
- Hierarchy order matters: `ShowcaseSelector` sits below the far panel, so the
  toggles have started (and know which one is on) when it starts.

Notes:

- `NearMenuToggle` opens and closes the near panel when the **Color panel**
  button (`FarPanel/Content/Header/ColorPanelButton`, a System 3.0 Primary
  capsule `Button`) is tapped. Each open places the panel along your gaze. Its
  optional `camera` input falls back to the scene's world camera.
- `Showcase/Jellyfish/Scripts/physics.ts` is a vendored soft-body chain solver
  (a TypeScript rewrite of a JavaScript physics script) kept as-is. It is the one
  file in the Showcase that is not written as a minimal example.

## Customization

Treat the prefabs as **reference implementations**. For shipping Lenses, strip
unused meshes and audio, trim the assets under `Showcase/`, and replace
placeholder branding with your own art and copy.

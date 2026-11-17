# InteractionKitExamples guide

[← Agent usage index](../README.md)

## Use when

Read this to find your way around the package: which folder holds what, what
the shipped prefab contains, and how the Rocket Workshop is put together. For
exact members see [components](components.md). For what is safe to copy see
[API status](api-status.md).

## Quick start

1. Install **SpectaclesInteractionKit** and **SpectaclesUIKit** at the versions
   declared in `package_dependencies.json` (via the Asset Library or local
   `Packages/`).
2. Add this package to your Specs project from the Asset Library, or import the
   unpacked `.lspkg` folder.
3. Place `InteractionKitExamples__PLACE_IN_SCENE.prefab` in the scene, next to the SIK prefab.
4. Press Play in Preview or on device. Use the UI, Rocket Workshop and Interaction
   groups to see list scrolling, manipulation, and Specs UI conventions.

## Layout overview

| Area | Purpose |
|------|--------|
| `InteractionKitExamples__PLACE_IN_SCENE.prefab` | Root prefab users place in the scene |
| `Scripts/UI/` | UIKit example scripts (frames, buttons, sliders, toggles, grids, scroll windows, menus, carousel, modal, video, deck, chat) |
| `Scripts/Interaction/` | SIK interaction examples (manipulation, distance field, interaction modes, diamond grid) |
| `Scripts/Utils/` | Shared helper scripts (`TextLimiter`, `TreeStructureUtils`) |
| `Scripts/GuideDismissPanel/` | Guide-on-a-Frame helper (not used by the prefab) |
| `Example/` | Demo scaffolding used by the prefab: `ExampleCarousel` (steps through the examples) and `GuideDismissPanel` (the intro guide) |
| `RocketWorkshop/` | Self-contained, code-first rocket-builder demo (has its own [README](../RocketWorkshop/README.md)) |
| `Fonts/` `Materials/` `Meshes/` `Prefabs/` `Shaders/` `Textures/` | Shared assets used by the `Scripts/UI` and `Scripts/Interaction` examples. `Fonts/` holds the SpecsSans weights the builders load when their font inputs are empty |

## Prefab map

`InteractionKitExamples__PLACE_IN_SCENE` holds the `Guide` panel, the `ExampleCarousel`
panel and three example groups. The guide hides the carousel and the groups until
it is closed; the carousel then enables one example at a time (15 steps across the
three groups). Without the carousel, keep one group enabled at a time.

| Group | Navigator | Children (in `UIController` order) |
|---|---|---|
| `[EXAMPLES] UI` | `UIController` + `Menu` (◀ ▶, title, counter) | `ExampleMenuHorizontalLayout`, `ExampleMenuVerticalLayout`, `ExampleGridSimpleTheme` ×2 (`ExampleGridSimple`), `ExampleDynamicGrid` (`ExampleGrid`, draggable + scrollable), `ExampleCarouselLayout`, `ExampleAdaptableTextArea` (`ExampleRoundedRectangle`), `ExampleModalLayout`, `ExampleVideoPlayer`, `ExampleDeckParent/ExampleDeck`, `ExampleChatParent/ExampleChat` |
| `[EXAMPLES] Rocket Workshop` | none | `RocketWorkshop` on the group root; `Objects/` holds `Manipulation Examples` (grabbable planet, satellite and meteor above the rocket), `Rocket Holder`, `Platform` (off until the switch shows it) |
| `[EXAMPLES] Interaction` | `UIController` + `Menu` | `Manipulate` (`ExampleSimpleManipulation` + mesh/sphere/box with SIK `Interactable` + `InteractableManipulation`), `DistanceField` (grab the sphere to pilot the spaceship along the curve; the prefab has no in-scene instruction label, so give that hint in your own UI), `InteractiveTransform` (`InteractionModesManager` + hand/pinch mock-ups + Frame with the four mode buttons) |

The scripts that no prefab uses (`ExampleScrollWindowLayout`, `ExampleSlidersLayout`,
`ExampleSwitchToggleGroupLayout`, `ExampleToggleGroupLayout`, `ExampleReactiveLayout`,
`ExampleDynamicLayout`, `UIManager`, `UIKitCustomVisuals*`, `ExampleDiamondGrid`,
`GuideDismissPanel`) are self-contained. Add one to an empty SceneObject to see it.

## Rocket Workshop walkthrough

The Rocket Workshop builds its UI and interaction **entirely in TypeScript**,
with no `@input` wiring and no UI prefabs. The 3D diorama (rocket model,
materials, VFX, animation clips) is authored art. The only coupling between art
and code is a handful of lookups by name or component type in `RocketWorkshop.ts`.

Read in this order:

| # | File | What it teaches |
|---|------|-----------------|
| 1 | `RocketWorkshop/Scripts/RocketWorkshop.ts` | The entry point on the diorama root: finds the authored objects, creates the configurator, builds both panels |
| 2 | `RocketWorkshop/Scripts/RocketUI.ts` | A small UIKit toolkit (`frame`, `flexColumn/Row`, `button`, `toggleBtn`, `slider`, `switchControl`, `scrollWindow`, `label`, …) |
| 3 | `RocketWorkshop/Scripts/LaunchControlPanel.ts` | Launch button + flight-path toggle group + speed slider + platform switch, plus the launch → takeoff → landing sequence |
| 4 | `RocketWorkshop/Scripts/PartSelectorPanel.ts` | A `ScrollWindow` of part sections, each a `ToggleGroup` of thumbnail rows |
| 5 | `RocketWorkshop/Scripts/RocketConfigurator.ts` | Assembles the rocket from interchangeable part prefabs loaded with `requireAsset` |
| – | `RocketWorkshop/Scripts/ExhaustControls.ts` | Exhaust and smoke VFX/material control on the fins prefabs |

```
RocketWorkshop (entry, on the diorama root)
├── finds authored art:  AnimationPlayer, "Rocket" holder, "Platform", "Rocket_sparks"
├── creates RocketConfigurator ──── assembles rocket from Prefabs/Parts/*.prefab
├── new LaunchControlPanel(...) ─── builds its UI with RocketUI.* (no @input)
└── new PartSelectorPanel(...) ──── builds its UI with RocketUI.* (no @input)
```

Conventions worth copying:

- Build UI on `OnStartEvent`, not in `onAwake` (UIKit/SIK finish their own setup first).
- The first import in any file that touches UIKit visuals is
  `import "SpectaclesUIKit.lspkg/Scripts/Themes/ThemeService"`.
- `requireAsset(...)` paths are static string literals (see the explicit
  `PART_PREFABS` / `THUMBNAILS` tables).
- Register `onToggleSelected` handlers **after** setting the initial selection, so
  they don't fire during the build.
- Panel placement lives in tunable constants at the top of `RocketWorkshop.ts`:
  `PART_SELECTOR_LOCAL_POS (-40, 2, -62)`, `LAUNCH_CONTROLS_LOCAL_POS (42, -3, -62)`.

Not worth copying as-is: the `RocketUI` builders still set some private UIKit
fields (Frame size, Button style/shape/toggleable, `ElementContent`) through
`as any`. Keep the structure and swap those writes for UIKit's public API
([api-status](api-status.md#internal-do-not-copy-into-new-code)).

## Customization

Treat the prefabs as **reference implementations**. For shipping Lenses, strip
unused meshes and VFX, trim the assets under `RocketWorkshop/`, and replace
placeholder branding with your own art and copy.

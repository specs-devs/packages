# SpectaclesInteractionKitExamples

SpectaclesInteractionKitExamples is an **example package** for **SpectaclesInteractionKit (SIK)** and **SpectaclesUIKit**. It ships ready-made scenes and prefabs that demonstrate interaction patterns, scroll views, and a small “rocket workshop” flow you can study or drop into a Specs project.

## Features  

- **SIK Examples prefab**: Main entry point **`SIKExamples__PLACE_IN_SCENE.prefab`** — drag into the scene hierarchy to instantiate the sample bundle
- **Rocket Workshop**: A code-first rocket-builder demo under **`RocketWorkshop/`** — the entire UI (Frame, buttons, slider, switch, scroll list) is built in TypeScript with **SpectaclesUIKit 2.0**, no `@input` wiring. See **`RocketWorkshop/README.md`** to get oriented.
- **UI examples**: UIKit-driven example scripts under **`Scripts/UI/`** showing frames, buttons, sliders, toggles, grids, scroll windows, and layout
- **Interaction examples**: SIK **`Interactable`** / **`InteractableManipulation`** patterns under **`Scripts/Interaction/`**

## Quick Start

1. Ensure **SpectaclesInteractionKit** and **SpectaclesUIKit** are installed at the versions declared in **`package_dependencies.json`** (via Asset Library or local `Packages/`).
2. Open your Specs project and add this package from the Asset Library (or import the unpacked `.lspkg` folder).
3. Instantiate the sample by placing **`SIKExamples__PLACE_IN_SCENE.prefab`** in your scene (or use your package’s setup script if you fork the project layout).
4. Press Play on device or in preview; use the Workshop / UI sections to see list scrolling, manipulation, and platform UI conventions.

## Layout overview

| Area | Purpose |
|------|--------|
| **`SIKExamples__PLACE_IN_SCENE.prefab`** | Root prefab users place in the scene |
| **`Scripts/UI/`** | UIKit 2.0 example scripts (frames, buttons, sliders, toggles, grids, scroll windows) |
| **`Scripts/Interaction/`** | SIK interaction examples (manipulation, diamond grid, interaction modes) |
| **`Scripts/Utils/`** | Shared helper scripts |
| **`RocketWorkshop/`** | Self-contained code-first rocket-builder demo (has its own `README.md`) |
| **`Fonts/` `Materials/` `Meshes/` `Prefabs/` `Shaders/` `Textures/`** | Shared assets used by the `Scripts/UI` + `Scripts/Interaction` examples |

## Script highlights

- **`RocketWorkshop/Scripts/RocketWorkshop.ts`**: code-first entry point — finds the diorama art, then builds both UI panels in TypeScript (no `@input`). Start with `RocketWorkshop/README.md`.
- **`RocketWorkshop/Scripts/RocketUI.ts`**: a reusable SpectaclesUIKit 2.0 helper toolkit (Frame / Button / Slider / Switch / ScrollWindow / Flex layout).
- **`Scripts/UI/`**: per-pattern UIKit examples — sliders, toggle groups, scroll windows, grids, frames, custom visuals.

## Dependencies

This package declares **SpectaclesInteractionKit** and **SpectaclesUIKit** in **`package_dependencies.json`**. Match editor and package versions to avoid compile or runtime mismatches.

## Customization

Treat the prefabs as **reference implementations**. For shipping Lenses, strip unused meshes/VFX, trim assets under **`RocketWorkshop/`**, and replace placeholder branding with your own art and copy.




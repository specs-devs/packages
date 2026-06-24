# SpectaclesInteractionKitExamples

SpectaclesInteractionKitExamples is an **example package** for **SpectaclesInteractionKit (SIK)** and **SpectaclesUIKit**. It ships ready-made scenes and prefabs that demonstrate interaction patterns, scroll views, and a small “rocket workshop” flow you can study or drop into a Spectacles project.

## Features  

- **SIK Examples prefab**: Main entry point **`SIK Examples__PLACE_IN_SCENE.prefab`** — drag into the scene hierarchy to instantiate the sample bundle
- **Rocket Workshop**: Customization-style demo with scroll lists, materials, and VFX-oriented assets under **`RocketWorkshop/`**
- **UI Starter**: UIKit-driven starter scripts (e.g. **`UIStarter/Scripts/`**) showing frames, buttons, and animation helpers alongside SIK utilities
- **Interactable patterns**: Uses SIK **`Interactable`**, **`Slider`**, **`ToggleButton`**, **`InteractableManipulation`**, and related utilities where appropriate

## Quick Start

1. Ensure **SpectaclesInteractionKit** and **SpectaclesUIKit** are installed at the versions declared in **`package_dependencies.json`** (via Asset Library or local `Packages/`).
2. Open your Spectacles project and add this package from the Asset Library (or import the unpacked `.lspkg` folder).
3. Instantiate the sample by placing **`SIK Examples__PLACE_IN_SCENE.prefab`** in your scene (or use your package’s setup script if you fork the project layout).
4. Press Play on device or in preview; use the Workshop / UI sections to see list scrolling, manipulation, and platform UI conventions.

## Layout overview

| Area | Purpose |
|------|--------|
| **`SIK Examples__PLACE_IN_SCENE.prefab`** | Root prefab users place in the scene |
| **`RocketWorkshop/`** | Meshes, materials, prefabs, and scripts for the rocket builder demo |
| **`UIStarter/`** | Lighter UI + SIK composition examples |

## Script highlights

- **`RocketWorkshop/Scripts/`**: `RocketConfigurator`, `RocketLaunchControl`, `RocketScrollViewItem`, and related types — grid/list item behavior with SIK validation and logging
- **`UIStarter/Scripts/UIManager.ts`**: UIKit **`Frame`** / **`RectangleButton`** with SIK **`animate`**
- **`UIStarter/Scripts/UIController.ts`**: **`BaseButton`** patterns for UIKit controls

## Dependencies

This package declares **SpectaclesInteractionKit** and **SpectaclesUIKit** in **`package_dependencies.json`**. Match editor and package versions to avoid compile or runtime mismatches.

## Customization

Treat the prefabs as **reference implementations**. For shipping Lenses, strip unused meshes/VFX, trim assets under **`RocketWorkshop/`**, and replace placeholder branding with your own art and copy.

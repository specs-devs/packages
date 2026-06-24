# Rocket Workshop

A self-contained example that builds a small "rocket builder" experience **entirely in
TypeScript** using **SpectaclesUIKit 2.0** + **SpectaclesInteractionKit 2.0**. It's meant to
be the reference you copy from when you want to build a Specs UI and wire up interactions
in code — no `@input` wiring, no UI prefabs.

## Start here (read in this order)

| # | File | What it teaches |
|---|------|-----------------|
| 1 | **`Scripts/RocketWorkshop.ts`** | The entry point. Attached to the diorama root; finds the authored 3D objects, creates the configurator, and builds both UI panels. Read this first to see the whole flow top-down. |
| 2 | **`Scripts/RocketUI.ts`** | A small, reusable UIKit toolkit (`frame`, `flexColumn/Row`, `button`, `toggleBtn`, `slider`, `switchControl`, `scrollWindow`, `label`, …). These are the building blocks every panel uses. |
| 3 | **`Scripts/LaunchControlPanel.ts`** | A real interactive panel built in code: launch button + flight-path toggle group + speed slider + platform switch, plus the launch → takeoff → landing sequence. |
| 4 | **`Scripts/PartSelectorPanel.ts`** | A scrollable picker: a `ScrollWindow` of part sections, each a `ToggleGroup` of thumbnail rows. |
| 5 | **`Scripts/RocketConfigurator.ts`** | Pure logic: assembles the rocket from interchangeable part prefabs (loaded with `requireAsset`). |
| – | **`Scripts/ExhaustControls.ts`** | VFX/material control for the engine exhaust + smoke. |

## Architecture in one picture

```
RocketWorkshop (entry, on the diorama root)
├── finds authored art:  AnimationPlayer, "Rocket" holder, "Platform", "Rocket_sparks"
├── creates RocketConfigurator ──── assembles rocket from Prefabs/Parts/*.prefab
├── new LaunchControlPanel(...) ─── builds its UI with RocketUI.* (no @input)
└── new PartSelectorPanel(...) ──── builds its UI with RocketUI.* (no @input)
```

The **3D diorama is authored art** (the rocket model, materials, VFX, animation clips); the
**UI and all interaction logic is 100% code**. The only coupling between them is a handful of
lookups by name/component-type in `RocketWorkshop.ts`.

## Conventions worth copying

- **Build UI on `OnStartEvent`**, not in `onAwake` (UIKit/SIK must finish their own setup first).
- The **first import in any file that touches UIKit visuals must be**
  `import "SpectaclesUIKit.lspkg/Scripts/Themes/ThemeService"` — it breaks a circular-import
  init-order crash in the package.
- **`requireAsset(...)` paths must be static string literals** (resolved at compile time). A
  templated path like `` requireAsset(`.../${name}.prefab`) `` compiles but fails at runtime
  with "Cannot find asset". See the explicit `PART_PREFABS` / `THUMBNAILS` tables for the pattern.
- **Panel placement** lives in tunable constants at the top of `RocketWorkshop.ts`.

## Folder layout

```
RocketWorkshop/
├── README.md                ← you are here
├── Scripts/                 ← the 6 TypeScript files above
├── Prefabs/Parts/           ← the 9 swappable rocket part prefabs (Style × Part)
├── Meshes/                  ← rocket + base FBX meshes
├── Materials/Objects/       ← rocket / planet / platform materials
├── Shaders/                 ← graph shaders for the diorama
├── Textures/                ← textures, incl. ScrollViewThumbnails used by the part picker
├── SFX/                     ← launch + landing sound effects
└── VFX/                     ← exhaust, clouds, sparks, radial-heat effects
```

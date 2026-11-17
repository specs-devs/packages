# InteractionKitExamples cheat sheet (load-bearing rules)

[← Agent usage index](../README.md)

## Use when

Read this **first**, and again right before you copy an example into a Lens.
Each rule points to the detail.

## The rules

1. **Two import roots, no barrel.** Scripts live under
   `InteractionKitExamples.lspkg/Scripts/<UI|Interaction|Utils|GuideDismissPanel>/`
   and `InteractionKitExamples.lspkg/RocketWorkshop/Scripts/`. Neither
   `InteractionKitExamples.lspkg/<Name>` nor `.../RocketWorkshop/<Name>`
   resolves. → [components](components.md)
2. **Copy patterns, not deprecated surfaces.** Many `Scripts/UI/` examples use
   UIKit's Deprecated `RectangleButton` / `RoundButton` / `BackPlate` and write
   the private fields that have no public pre-initialize equivalent
   (`_styleSystem3`, `_shapeSystem3`, `_toggleable`, Frame `_innerSize`…)
   through `as any`. Size, render order, ScrollWindow config and toggle-group
   options already use the public setters. In new code use UIKit's Current public API
   (`Button` + `setVariant`, `Frame`, `RoundedRectangle`), as documented in
   UIKit's installed `Docs/`. → [api-status](api-status.md)
3. **Load ThemeService before any UIKit visual.** Every UIKit-importing file here
   except the two `GuideDismissPanel.ts` copies (`Scripts/` and `Example/`) and
   `Example/ExampleCarousel/ExampleCarousel.ts` starts with
   `import "SpectaclesUIKit.lspkg/Scripts/Themes/ThemeService"` to avoid a
   circular-import init crash. Keep it as the **first** import in code
   you derive from them. → [troubleshooting](troubleshooting.md)
4. **Build on `OnStartEvent`, not in `onAwake`.** Every code-first example
   (`RocketWorkshop`, `Example*Layout`, `ExampleGridSimple`, …) creates its UI
   in OnStart, after SIK/UIKit have awoken. Feed data (`items`, `row1Items`,
   `deckCards`, …) in `onAwake` or the Inspector *before* that. → [components](components.md)
5. **`positionX/Y/Z` inputs are local to the host.** The panels are placed with
   `setLocalPosition` relative to the script's SceneObject (default
   `positionZ = -110`). Put the host where you want the panel, under a parent that
   is at the origin or follows the camera. → [troubleshooting](troubleshooting.md)
6. **`requireAsset` paths must be static literals.** Rocket Workshop lists every
   part prefab and thumbnail explicitly. A templated path compiles, then fails at
   runtime with "Cannot find asset". → [guide](guide.md)
7. **Grid button indices are 1-based.** `ExampleGrid` and `ExampleGridSimple`
   `getButton(index)` / `setButtonCallback(index, cb)` / `updateButton*` treat
   index `1` as the first button; `setButtonCallback` *adds* a listener. → [components](components.md)
8. **Test modes are on by default.** `testMode = true` fills grids, carousels,
   menus, decks and chats with mock content and drives `InteractionModesManager`
   with mock hands (editor only). Turn it off or supply your own data before
   OnStart. → [components](components.md)
9. **One example group at a time.** The prefab's `UIController` (`[EXAMPLES] UI`,
   `[EXAMPLES] Interaction`) enables one child at a time. Overlapping panels block
   each other's interaction planes. → [troubleshooting](troubleshooting.md)

## Verify

Compile clean, then in Preview look for the panel in front of the camera (not
about 6 m away), legible text, and taps or grabs that actually fire (check the
example's `print` / log output). → [troubleshooting](troubleshooting.md)

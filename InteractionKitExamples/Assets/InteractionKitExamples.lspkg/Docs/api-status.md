# InteractionKitExamples API status

[← Agent usage index](../README.md)

## Use when

Check this file before copying any script or pattern from this package. It is
the compatibility index for the package that contains it, built against the
InteractionKit and UIKit listed in `package_dependencies.json`.

## Status meanings

- **Current**: recommended to copy for new work.
- **Deprecated**: still present and working, but built on a surface that its
  owning package (UIKit) marks Deprecated. Copy the idea, not the calls.
- **Experimental**: public, but compatibility is not guaranteed.
- **Removed**: unavailable in this revision.
- **Internal**: resolvable, but an implementation detail (private-field writes,
  non-exported types); not supported API.

This package is a set of examples, not a library. Its own public members (the
methods and inputs in [components.md](components.md)) are stable only within this
revision. The API authority for every UIKit/InteractionKit call they make is the
**installed UIKit / InteractionKit `Docs/api-status.md`**, which wins on any conflict.

## Current

| Script / pattern | Why it is safe to copy |
|---|---|
| `Showcase/Scripts/*` (Interaction Showcase): UIKit `Frame`, `FlexLayout`, `ToggleGroup`, `Button`, `Slider`, `Switch`, `ColorSlider`, `ElementContent` authored in the hierarchy and wired with `@input`; scripts subscribe on `OnStartEvent` | Public InteractionKit events (`Interactable` hover / trigger / secondary trigger, `InteractableManipulation` start / end), public UIKit events (`onToggleSelected`, `onKnobMoved`, `onValueChange`, `onTriggerUp`, `onInitialized`) and InteractionKit's `SpringAnimate`; no private-field writes |
| `ExampleSimpleManipulation`: InteractionKit `Interactable` `onHoverEnter` / `onHoverExit` / `onTriggerStart` / `onTriggerEnd` on `InteractableManipulation` hosts | Public InteractionKit events |
| `InteractionModesManager`: `IK.HandInputData` pinch and wrist-distance channels; `testMode` only honoured in the editor | Public InteractionKit hand data (its four mode buttons are `RectangleButton`, see Deprecated) |
| `DistanceField`, `ExampleDiamondGrid` | Prefab instantiation + math only; `DistanceField` uses InteractionKit's `InteractorLineRenderer` for the curve |
| `ExampleCarouselLayout`, `ExampleMenuHorizontalLayout`, `ExampleMenuVerticalLayout`, `ExampleModalLayout`, `ExampleDynamicLayout`: layout shape (Frame + Flex/Grid + ScrollWindow) | The composition is current, but see the Internal row (private-field writes) |
| `ThemeService` side-effect import as the first import | Required workaround in this UIKit revision |
| `UIState` (exported from `Scripts/UI/ExampleDynamicLayout` and `Scripts/UI/UIManager`) with `ExampleDynamicLayout.transitionTo(state)` / `UIManager.setState(state)` | Public enums; each module has its own `UIState`, so import it from the script you drive |

## Deprecated

| Script | Deprecated surface used | Replacement (UIKit) |
|---|---|---|
| `ExampleGrid`, `ExampleGridSimple`, `GridRearrangement`, `ExampleDeck`, `ExampleChat`, `ExampleRoundedRectangle`, `UIManager`, `UIKitCustomVisualsRectangleButton`, `GuideDismissPanel`, `InteractionModesManager` (inputs) | `RectangleButton` | `Button` with `setVariant({shape: "Rectangle", …})` |
| `UIController` (`nextButton` / `previousButton` inputs) | `RoundButton` | `Button` with `shape: "Round"` |
| `ExampleScrollWindowLayout`, `ExampleSlidersLayout`, `ExampleSwitchToggleGroupLayout`, `ExampleToggleGroupLayout`, `ExampleReactiveLayout`, `ExampleModalLayout` (scrim + modal dialog), `ExampleMenuHorizontalLayout` / `ExampleMenuVerticalLayout` (when `useFrame = false`) | `BackPlate` | `Frame` for panels; `RoundedRectangle` for lightweight surfaces |
| `UIManager` | Scene-wired state machine (16 required inputs) | `ExampleDynamicLayout` (same states, built in code) |

`ExampleGrid`'s and `ExampleGridSimple`'s public `getButton()` / `getButtons()` return
`RectangleButton`, so code that consumes them inherits the deprecation.

Known follow-up: these Deprecated surfaces are still used on purpose. Replacing
them changes serialized `@input` types (`UIManager`, `UIController`,
`InteractionModesManager`) or the look of every runtime-built panel, so it isn't
a drop-in fix. Swap them per script, re-checking each example in Preview.

## Experimental

No package surface is designated Experimental in this revision.

## Removed

No surface is recorded as Removed in this revision. Release history for older
versions isn't shipped with the package.

## Internal (do not copy into new code)

| Surface | Where | Do instead |
|---|---|---|
| `(button as any)._styleSystem3`, `._shapeSystem3`, `._toggleable` | most `Scripts/UI/` builders | `setVariant({theme, shape, style})` before `initialize()`, `setIsToggleable(true)` (see UIKit `Docs/components.md`). Kept here: `setVariant` drops shape/style unless a theme override is set, and `setIsToggleable` rewires listeners and logs a warning |
| `(frame as any)._innerSize`, `._padding`, `._appearance`, `._minimumSize`, `._maximumSize`, `._renderOrder`, `._showCloseButton`, `._showFollowButton`, `._following` | `ExampleGrid`, `ExampleGridSimple`, layout examples | Frame's public setters, applied in `onInitialized`. Kept here: before Frame's OnStart those setters touch visuals that don't exist yet |
| `(sw as any).subscribeToEvents(false)`, `(sw as any).collider` | `ExampleGrid` (scrollable mode) | No public equivalent; the grid turns the ScrollWindow's own input off so page buttons get the ray |
| `(tc as any).getMaterial(0)` on `Text` | layout examples | Not a UIKit field: the Lens API `Text` type doesn't declare `getMaterial` |
| `(ec as any)._text`, `._font`, `._textSize`, `._sizeOverride`, … on `ElementContent` | the `content()` helpers in `Scripts/UI/` builders | `addContentToElement` / ElementContent public API per UIKit docs |
| `ButtonContentLayout`, `GridRearrangement`, `TreeStructureUtils`, `CHARACTER_LIMITS` | `Scripts/UI/`, `Scripts/Utils/` | Helper classes used by the grid/chat examples; reusable but untested on their own |
| `Physics` (vendored soft-body solver) | `Showcase/Jellyfish/Scripts/physics.ts` | Kept as-is to drive the jellyfish tentacles; not written as a minimal example. It calls the deprecated `getComponentCount`, which logs a deprecation warning in Preview |

The `@input` lists are partly Inspector-only: `ExampleGrid.autoGenerate` and
`ExampleChat.showScrollbar` are private fields (always `true`), not inputs.

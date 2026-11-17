# HandHints3D API status

[← Agent usage index](../README.md)

## Use when

Check this file before copying an older HandHints3D example or a snippet written against the LSTween-based version. It is the compatibility index for the package revision that contains it.

## Status meanings

- **Current** - recommended public surface for new work.
- **Experimental** - public, but not exercised by the package itself; verify in the Preview.
- **Removed** - unavailable in this revision.
- **Internal** - public in TypeScript, but implementation state; do not rely on it.

## Current API

| Capability | Current surface |
|---|---|
| Show a gesture from the Inspector | prefab `InteractionHintController.autoPlay` + `hintAnimations` (`HintAnimation` entries) |
| Show a gesture from script | `playHintAnimation(handMode, animationName, numberOfLoops, animationSpeed?)` |
| Show several gestures in a row | `playHintAnimationSequence(HandAnimationClipInfo[], numberOfLoops)` |
| Know when a hint is done | `animationEndEvent: DelayedCallbackEvent` (fires once per completed hint or sequence) |
| Name a gesture | `HandAnimationsLibrary.Left / Right / Both.*`, `HandMode` |
| Place a hint | `HandAnimationClipInfo.position` / `HintAnimation.position`, applied to the controller's own SceneObject; parent the prefab to move the whole hint |
| Tweens inside the package | `NativeTween`: `LSTween.shaderFloatPropertyFromTo`, `LSTween.rawTween`, `Tween` chain, `Easing`, `mainGroup.remove` |

Exact modules and members are listed in [components.md](components.md).

## Experimental

| Surface | Note |
|---|---|
| `LSTween.colorTo`, `colorTextTo`, `blendShapeValueTo`, `blendShapeValueFromTo` | The NativeTween header marks the runtime property names they write (material `baseColor`, Text fill color, blend-shape weights) as best-effort; not used by the package |
| `"system_tap_save"` clip | Present in the prefab's `AnimationPlayer`, absent from `HandAnimationsLibrary` and the Inspector combo; playable by raw string |

## Removed

| Removed surface | Replacement |
|---|---|
| `LSTween.lspkg` dependency | `HandHints3D.lspkg/Scripts/NativeTween` (same `LSTween` class name and call surface) |
| `Scripts/GuideDismissPanel/GuideDismissPanel.ts` and the prefab's `GUIDE_ReadAndDisable` note (its stale copy in `HandHints3D__PLACE_IN_SCENE.prefab.meta` is gone too) | Demo scaffolding only: `Example/GuideDismissPanel/GuideDismissPanel.ts` drives the prefab's `Guide`; not package API ([components](components.md#demo-scaffolding-example)) |

## Internal

| Member | Why it is listed |
|---|---|
| `InteractionHintController.handHints`, `animationPlayerClipEndEvent` | Public fields that hold lookup / registration state |
| `InteractionHintController.findSceneObjectByName` | Helper used by the controller's awake |
| `Tween` internals (`_apply`, driver object `NativeTweenDriver`) | Implementation of NativeTween |

## Known gaps of this revision

- There is no stop / cancel API. A new `playHintAnimation` call while a hint runs replaces the clip list but leaves the running clip and its end listener in place.
- Each prepared clip adds another `AnimationEnd` event to its animation asset (`animationAsset.createEvent`), so the end handler can run more than once per clip end after several passes; the tween cancellation in the handler keeps the visible result to one transition.
- `@showIf("loop")` and `@showIf("sequence")` reference inputs that do not exist (both fields still render in the Inspector).
- `HandAnimationsLibrary.*.FingerScrollMirco` keeps its misspelled key; the Inspector label reads "Finger Scroll Micro".
- `package_dependencies.json` declares InteractionKit, UIKit, Motion and Icons. `Scripts/` imports none of them; only the `Example/` demo scaffolding (`GuideDismissPanel.ts`, `ExampleCarousel.ts`) imports InteractionKit and UIKit. Motion and Icons are not imported.

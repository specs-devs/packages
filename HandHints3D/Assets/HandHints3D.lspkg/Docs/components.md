# HandHints3D components

[← Agent usage index](../README.md)

## Use when

Use this as the public import, input and event index once you know which gesture you want to show. Everything below is derived from this revision's `Scripts/InteractionHintController.ts`, `Scripts/NativeTween.ts` and `HandHints3D__PLACE_IN_SCENE.prefab`.

All imports use the prefix `HandHints3D.lspkg/Scripts/`.

| Module after prefix | Exports |
|---|---|
| `InteractionHintController` | `InteractionHintController` (component), `HintAnimation` (typedef), `HandAnimationClipInfo`, `HandMode`, `HandAnimationsLibrary` |
| `NativeTween` | `LSTween`, `Tween`, `Easing`, `EasingFunction`, `mainGroup` |
| `ExampleTS` | `Example` (component) - usage example, not meant to be imported |
| `ExampleJS.js` | JavaScript twin of `ExampleTS` |

## Prefab structure

`HandHints3D__PLACE_IN_SCENE.prefab` is the self-contained demo (root scale 1, no components on the root):

| Object | Role |
|---|---|
| `HandHints3D__PLACE_IN_SCENE` (root) | Container at (0, 0, 0) |
| `Guide` | Onboarding panel (UIKit `Frame` + `GuideDismissPanel`), see [demo scaffolding](#demo-scaffolding-example) |
| `ExampleCarousel` | Steps through the example groups below, see [demo scaffolding](#demo-scaffolding-example) |
| `Finger Tap Near`, `Pinch Near`, `Pinch Far`, `Two Hands Pinch Scale`, `System Tap Settings`, `Gesture Sequence` | Example groups, each with one `HandHint` child |

Every `HandHint` has the same structure:

| Object (under `HandHint`) | Components | Role |
|---|---|---|
| `HandHint` | `InteractionHintController` (autoPlay on, numberOfLoops 999, animationSpeed 1, one or two `hintAnimations` entries at (0, -20, -100)) | The object the controller moves to each clip's `position` |
| `HandHints` | `Skin`, `AnimationPlayer` (Autoplay, 31 gesture clips + `BaseLayer`, all `PlaybackMode: Single`) | Rig root; the controller calls `getComponent("AnimationPlayer")` here |
| `HandHints/LeftHandGeo`, `HandHints/RightHandGeo` | `RenderMeshVisual` with 3 materials in this order: `HandHints_Outline` (`fadeLevel`), `HandHints_Interaction_Glow` (`glowIntensity`), `Occluder`; blendshape `LeftHandScaleShape` | The visible hands; materials are cloned per instance at awake |
| `HandHints/hands_ROOT/wrist_R`, `hands_ROOT/wrist_L` | joint hierarchy | child 0 = right wrist, child 1 = left wrist; under each, child 0 = thumb chain, child 1 = index chain, five levels down to the tip |
| `HandHints/HandHints_Cursor` | `RenderMeshVisual` (`HandHints_Cursor.mat`: `isTriggering`, `circleSquishScale`) at local (0, 20, -65) | Shown only during `pinch_far` |

The example clips: Finger Tap Near = Left `finger_tap_near`; Pinch Near = Right `pinch_near`; Pinch Far = Right `pinch_far`; Two Hands Pinch Scale = Both `two_hands_pinch_scale`; System Tap Settings = Both `system_tap_settings`; Gesture Sequence = Left `palm_grab_y` then Right `palm_grab_x`.

The controller finds every part **by name** (`findSceneObjectByName`) and the finger tips by **child index**, so keep the names and the order.

## Demo scaffolding (Example/)

These demo-only scripts ship in `HandHints3D.lspkg/Example/` so the prefab works on its own. They aren't part of the package API. Remove `Guide` and `ExampleCarousel` from your instance when you build your own Lens; the `HandHint` objects keep working without them.

| File | Used by | Key inputs |
|---|---|---|
| `Example/GuideDismissPanel/GuideDismissPanel.ts` | `Guide` | `buttonLabel` (`"Ok, I understood"`), `hideUntilDismissed: SceneObject[]` (the six example groups and `ExampleCarousel`): hidden while the guide shows, enabled when it's closed. The prefab root isn't listed, so the guide itself stays visible. |
| `Example/ExampleCarousel/ExampleCarousel.ts` | `ExampleCarousel` | `examples: SceneObject[]` (the six example groups, in order), `exampleInfo: string[]` (one description each), `steps: SceneObject[]` (empty), `stepInfo: string[]` (one line per `steps` entry; empty entries fall back to the example's info; empty here), `startIndex` (`0`), `previousLabel` / `nextLabel`, `examplesPushBack` (`20` cm), `anchorExamples` (`true`, the examples are moved in front of the user), `startMinimized` (`false`), `extraPanelDrop` (`0` cm) |

## Example (`Scripts/ExampleTS.ts`, `Scripts/ExampleJS.js`)

Usage example components; not placed in the prefab. Add one to a SceneObject and point it at a `HandHint` controller.

| Input | Type | Default | Meaning |
|---|---|---|---|
| `interactionHintController` | `InteractionHintController` (JS: `Component.ScriptComponent`) | unset | Controller to drive; required |
| `demoOption` | int combo | `0` | `0` Demo Single Animation: Both `system_tap_exit` 2 loops at speed 0.8, then once Left `pinch_move_y` 3 loops. `1` Demo Animation Sequence: Left `palm_grab_y` at (10, 0, 0) then Right `palm_grab_x`, 2 loops |
| `enableLogging`, `enableLoggingLifecycle` | boolean | `false` | Logger output (TS only) |

`ExampleTS` (class `Example`) starts the demo in `onAwake`; `ExampleJS` starts it on `OnStartEvent`. Turn off the controller's `autoPlay` so the two don't compete.

## Assets

- Meshes: `Meshes/LeftHandGeo.mesh`, `Meshes/RightHandGeo.mesh` (the hands), `Meshes/CursorPlaneGeo.mesh` (the `HandHints_Cursor` plane).
- Materials and graphs (`Materials/`, `Materials/Graphs/`): `HandHints_Outline` (`HandHints_Outline.graphShader`, `Textures/Hands_Opacity_Gradient.png`), `HandHints_Interaction_Glow` (`HandHints_Inreraction_Glow.graphShader`, `Textures/Hands_Interaction_Glow_Mask.png`), `Occluder` (`Occluder.graphShader`), `HandHints_Cursor` (`HandHints_Cursor.graphShader`). `HandHints_Outline_Glow_Combined.graphShader` ships but no material uses it.
- Animation: `Animation/*.animationAsset`, one per gesture clip plus `BaseLayer`.

## InteractionHintController

Attach: ships on each `HandHint` object in the prefab; one controller per rig.

### Inputs

| Input | Type | Default | Meaning |
|---|---|---|---|
| `autoPlay` | boolean | `false` on the script, `true` on the prefab's `HandHint` objects | Play `hintAnimations` at awake |
| `animationSpeed` | float, slider 0.5-3 | 1 | `playbackSpeed` of the current clip; the `playHintAnimation` parameter overwrites it |
| `numberOfLoops` | int, slider 1-10 | 1 on the script, 999 on the prefab's `HandHint` objects | Full passes before the hint ends; the API parameter overwrites it; any integer works when set from a script or a scene override |
| `hintAnimations` | `HintAnimation[]` | `[]` | Auto-play list; several entries form a sequence |
| `enableLogging` | boolean | false | Utilities `Logger("InteractionHintController")` output |
| `enableLoggingLifecycle` | boolean | false | Lifecycle log lines |

`numberOfLoops` and `hintAnimations` carry `@showIf("loop")` / `@showIf("sequence")` decorators that reference inputs which do not exist; both fields are still shown in the Inspector.

### `HintAnimation` (typedef, one Inspector entry)

| Field | Type | Default | Meaning |
|---|---|---|---|
| `handType` | int combo | - | 0 Left, 1 Right, 2 Both (= `HandMode`) |
| `oneHandedAnimation_l` | string combo (shown for Left) | `pinch_near` | one of the 20 one-handed clip names |
| `oneHandedAnimation_r` | string combo (shown for Right) | `pinch_near` | one of the 20 one-handed clip names |
| `twoHandedAnimation` | string combo (shown for Both) | `two_hands_pinch_scale` | one of the 10 two-hand / system clip names |
| `position` | vec3 | - | Local position the controller's SceneObject is moved to while this clip plays |

At awake each Left entry disables the right hand mesh and each Right entry disables the left one; the fade-in of the playing clip re-enables the hand it needs.

### Methods

| Member | Signature | Behavior |
|---|---|---|
| `playHintAnimation` | `(handMode: HandMode, animationName: HandAnimationsLibrary, numberOfLoops: number, animationSpeed = 1): void` | Replaces the clip list with one clip at position `vec3.zero()`, sets loops and speed, starts it |
| `playHintAnimationSequence` | `(sequence: HandAnimationClipInfo[], numberOfLoops: number): void` | Replaces the clip list with the sequence (each clip keeps its own `position`) and starts it; 200 ms fade-out / fade-in between clips |
| `findSceneObjectByName` | `(root: SceneObject \| null, name: string): SceneObject \| null` | Depth-first name search; `root = null` searches the whole scene. Public, but a helper |

### Events and public fields

| Member | Type | Behavior |
|---|---|---|
| `animationEndEvent` | `DelayedCallbackEvent` | `reset(0)` is called after the last loop's fade-out, i.e. it fires once per completed hint or sequence. Created in `onAwake`; bind it after the controller has awoken |
| `animationPlayerClipEndEvent` | `EventRegistration` | The current clip's `AnimationPlayer.onEvent` registration (internal state, exposed) |
| `handHints` | `SceneObject` | The resolved `HandHints` child (internal state, exposed) |

### Automatic pinch feedback

Every frame, for the clip currently named in `currentAnimationName`:

- `pinch_near`, `pinch_far`, `pinch_move_x/y/z`, `pinch_rotate_x/y/z`, `pinch_swipe_x/y` (the hand of the current `HandMode`), and `two_hands_pinch_scale`, `two_hands_pinch_rotate_y/z` (both hands): when index tip to thumb tip distance drops below 2 cm the hand's glow material gets `glowIntensity = 1`; above 3 cm it returns to 0.
- `pinch_far` only: the cursor object is enabled; its material gets `isTriggering = 3` while pinching (0 otherwise) and `circleSquishScale = remap(clamp(distance, 1, 12), 1..12 -> 0.5..1)`.

Fades: `HandHints_Outline.fadeLevel` 0 -> 1 on fade-in and 1 -> 0 on fade-out, 200 ms, `Easing.Cubic.In`, one tween per hand.

## `HandAnimationClipInfo`

`new HandAnimationClipInfo(handMode: HandMode, clipName: HandAnimationsLibrary | string, position: vec3 = vec3.zero())`

## `HandMode`

`Left = 0`, `Right = 1`, `Both = 2`.

## Gesture library

`HandAnimationsLibrary` is a `const` object whose values are the `AnimationPlayer` clip names.

| Group | Keys -> clip names |
|---|---|
| `Left` and `Right` (same 20 names) | `PinchNear` pinch_near, `PinchFar` pinch_far, `PinchMoveX/Y/Z` pinch_move_x/y/z, `PinchRotateX/Y/Z` pinch_rotate_x/y/z, `PinchSwipeX/Y` pinch_swipe_x/y, `FingerTapNear` finger_tap_near, `FingerTapSurface` finger_tap_surface, `FingerSwipeX/Y` finger_swipe_x/y, `FingerScrollMirco` finger_scroll_micro (key typo kept for compatibility), `PalmTouchNear` palm_touch_near, `PalmTouchSurface` palm_touch_surface, `PalmSwipeX` palm_swipe_x, `PalmGrabX/Y` palm_grab_x/y |
| `Both` (10 names) | `SystemTapSettings` system_tap_settings, `SystemTapRotateDown/Up` system_tap_rotate_down/up, `SystemTapWatch` system_tap_watch, `SystemTapExit` system_tap_exit, `TwoHandsPinchScale` two_hands_pinch_scale, `TwoHandsPinchRotateY/Z` two_hands_pinch_rotate_y/z, `TwoHandsPalmGrabX/Y` two_hands_palm_grab_x/y |

The prefab's `AnimationPlayer` also holds `system_tap_save`, which has no library key or Inspector item; it can be played with the raw string `"system_tap_save"` and `HandMode.Both`.

## NativeTween

`Scripts/NativeTween.ts` is a self-contained replacement for the former LSTween dependency with the same call surface; the package itself uses only `LSTween.shaderFloatPropertyFromTo`, `LSTween.rawTween`, `Easing.Cubic.In` and `mainGroup.remove`.

- `LSTween` statics (all return a `Tween`, durations in ms): `moveToLocal`, `moveFromToLocal`, `moveToWorld`, `moveFromToWorld`, `scaleToLocal`, `scaleFromToLocal`, `scaleToWorld`, `scaleFromToWorld`, `rotateToLocalInDegrees`, `rotateFromToLocalInDegrees`, `rotateToWorldInDegrees`, `rotateFromToWorldInDegrees`, `shaderFloatPropertyFromTo`, `shaderVec3PropertyFromTo`, `shaderColorPropertyFromTo`, `colorTo`, `colorTextTo`, `blendShapeValueTo`, `blendShapeValueFromTo`, `rawTween`.
- `Tween` chain: `delay(ms)`, `easing(fn)`, `onStart(cb)`, `onComplete(cb)`, `start()`, `stop()`. `onStart` fires on the first update tick after `start()` (so registering it after `start()` works, as with TweenJS); `onComplete` fires when the duration elapses.
- `Easing`: `Linear`, `Quadratic`, `Cubic`, `Quartic`, `Quintic`, `Sinusoidal`, `Exponential`, `Circular`, `Back`, `Elastic`, `Bounce`, each with `In`, `Out`, `InOut` (`Linear.None`).
- `mainGroup.remove(tween)` stops a tween. All tweens are driven by one runtime-created hidden root object `NativeTweenDriver`.

# HandHints3D troubleshooting

[← Agent usage index](../README.md)

## Use when

Use this table for package-specific failures. Generic Lens scripting, scene placement, rendering and TypeScript issues are outside this package's scope. Rows marked *QA 2026-09* were found while making the HandHints3D demo project QA-ready in Lens Studio.

## Known limitations

| Symptom | Package cause | Package fix |
|---|---|---|
| The hint sits at the user's head / "inside the camera" | Script calls use `position = vec3.zero()` and the controller moves its own SceneObject there; with the `HandHint`'s parent at the scene origin that is the start pose | Parent the `HandHint` under an empty object placed where the hint should be (e.g. (0, -20, -100)), or pass a `position` in `HandAnimationClipInfo` / the Inspector entry |
| The hint jumps back every loop after you moved the `HandHint` object | The controller re-applies the clip `position` to its own object on every loop | Move the parent, not the `HandHint` object |
| `Cannot read property 'bind' of undefined` on `animationEndEvent` | The caller runs before the controller (higher in the hierarchy, or binds in its own `onAwake`); the event is created in the controller's `onAwake` | Bind from `OnStartEvent`, or move the caller below the prefab |
| `getChild` / `getComponent` of null at awake | A prefab child was renamed, re-parented or removed; the controller resolves `HandHints`, `LeftHandGeo`, `RightHandGeo`, `hands_ROOT`, `HandHints_Cursor` by name and the finger tips by child index | Re-instantiate the prefab; keep the names and child order |
| A Left + Right sequence (or a Left and a Right Inspector entry) shows no hands at all (*QA 2026-09*) | Each Left entry disables the right mesh and each Right entry the left one at awake; the fade-in re-enables a hand from a tween `onStart` callback that the NativeTween port fired synchronously inside `start()`, before the callback was registered | Fixed in this revision (`NativeTween.Tween` fires `onStart` on the first update tick). On an older copy of the package, update it |
| The second hint never reports completion, or a later `animationEndEvent.bind` throws on null (*QA 2026-09*) | Older revisions set `animationEndEvent = null` after the first completed hint | Fixed in this revision: the event stays alive and fires once per completed hint or sequence |
| A chained follow-up hint repeats forever | Since the event fires per completion, a callback that calls `playHintAnimation` unconditionally re-triggers itself | Guard the callback (flag or step index); see `Scripts/ExampleTS.ts` and [examples](examples.md#tutorial-chaining) |
| Two hints animate at once / hands flicker after a second `playHintAnimation` | There is no stop API; the running clip and its end listener stay active | Wait for `animationEndEvent`, or disable the prefab's SceneObject between hints |
| A hand mesh is `enabled` but nothing is drawn | Visibility is the outline material's `fadeLevel` (0 after a fade-out or before the fade-in tick) | Check `fadeLevel` on `LeftHandGeo` / `RightHandGeo` material 0; wait a frame after enabling the object |
| System tap hints (`system_tap_*`) vanish for part of each loop (*QA 2026-09*) | The animation moves the hand to the temple of the glasses, i.e. toward the head and out of the forward view, before coming back | Expected; place these hints a little lower / further than one-handed hints if the frame looks empty |
| No fingertip glow on palm, finger-tap, swipe or system hints | Glow runs only for `pinch_*` clips and the two-hand pinch clips, gated by tip distance | Expected; use a pinch clip when the glow matters |
| No cursor | The cursor is enabled only while `pinch_far` plays | Expected |
| Wrong hand shown for a two-hand clip | A `Both` clip played with `HandMode.Left` / `Right` hides the other hand | Pass `HandMode.Both` for `HandAnimationsLibrary.Both.*` |
| `numberOfLoops` cannot be set above 10 in the Inspector | Slider widget range 1-10 | Pass the count to `playHintAnimation` / `playHintAnimationSequence`, or set the value as a scene override (any integer is accepted; the prefab's `HandHint` objects use 999) |
| Hint stops after one pass on a controller you added yourself | The script default `numberOfLoops` is 1 (the prefab's `HandHint` objects use 999); after the last loop the hand fades out and the clip is disabled | Expected; raise the count or re-trigger from `animationEndEvent` |
| `"system_tap_save"` is not in the library | The clip exists in the `AnimationPlayer` but has no `HandAnimationsLibrary` key or Inspector item | Play it by raw string with `HandMode.Both`, or add the key in a package update |
| Inspector shows "Number Of Loops" / "Hint Animations" although their `@showIf` names no input | Stale decorators | Harmless; fields are editable |

## Verification

After applying a fix, reproduce it in the Preview: the hand must be visible in front of the camera within the first second, glow on pinch clips, alternate hands on a Left + Right sequence, and `animationEndEvent` must print once per completed hint.

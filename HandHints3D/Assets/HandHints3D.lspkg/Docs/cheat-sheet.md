# HandHints3D cheat sheet (load-bearing invariants)

[← Agent usage index](../README.md)

## Use when

Read this **first**, and re-read it before wiring a hint. It is the short list of rules that most often break a generated hint, each with a pointer to the detail. It is a pointer, not a substitute: read the linked section for the how.

## The rules

1. **Drop the prefab, never rebuild the rig.** `InteractionHintController.onAwake` resolves `HandHints`, `LeftHandGeo`, `RightHandGeo`, `hands_ROOT` and `HandHints_Cursor` by name under its own SceneObject and the finger tips by fixed child indices under `hands_ROOT`. Renaming, reordering or flattening the prefab children throws at awake. → [components](components.md#prefab-structure)
2. **Position through a parent.** On every play and every loop the controller sets *its own* SceneObject's local position to the clip `position` (`vec3.zero()` from script, the Inspector entry's `position` for auto-play). Parent the `HandHint` object under an empty object and move that parent (the prefab's example groups do this); a hint with position zero sits exactly at the parent, i.e. at the user's head when the parent is at the origin. → [examples](examples.md#positioning-the-hint)
3. **Your caller must run after the controller.** `animationEndEvent`, the material clones and the part lookups are created in the controller's `onAwake`. A script higher in the hierarchy that binds `animationEndEvent` in its own `onAwake` reads `undefined`. Bind from `OnStartEvent`, or keep the caller below the prefab. → [troubleshooting](troubleshooting.md)
4. **One hint at a time; there is no stop API.** `playHintAnimation` / `playHintAnimationSequence` replace the clip list but do not stop the running clip or remove its end listener. Wait for `animationEndEvent`, or disable the `HandHint` SceneObject to hide a hint. → [api-status](api-status.md#known-gaps-of-this-revision)
5. **Clip names are the API, and `HandMode` must match the group.** `HandAnimationsLibrary.Left` and `.Right` hold the same 20 one-handed names, `.Both` the 10 system / two-hand names; they are the `AnimationPlayer` clip names. A `Both` clip played with `HandMode.Left` runs with one hand hidden. → [components](components.md#gesture-library)
6. **Loops end the hint.** `numberOfLoops` counts full passes (of the single clip or of the whole sequence); after the last pass the hand fades out, the clip is disabled and `animationEndEvent` fires. Pass a large count to keep a hint looping; the Inspector slider stops at 10 but the field accepts any integer. → [components](components.md#interactionhintcontroller)
7. **Glow and cursor are automatic and clip-gated.** Fingertip glow runs only for `pinch_*` clips and the three two-hand pinch clips (tip distance < 2 cm on, > 3 cm off); the cursor shows only for `pinch_far`. Palm, finger and system hints never glow. → [components](components.md#automatic-pinch-feedback)
8. **A hand can be enabled yet invisible.** Visibility is the outline material's `fadeLevel` (0 = invisible), tweened over 200 ms by NativeTween. When debugging, check `fadeLevel`, not only `enabled`. → [troubleshooting](troubleshooting.md)
9. **Auto-play and script calls share one clip list.** With `autoPlay` on, the Inspector `hintAnimations` play at awake; a later `playHintAnimation` call replaces that list. Use one or the other per controller unless the overlap is intended. → [examples](examples.md)

## Verify (a compile-clean lens can still be broken)

Look at a captured frame for: a hint at the camera (rule 2), a hand that never appears (rule 3 / 8), two hands animating at once from overlapping calls (rule 4). → [troubleshooting](troubleshooting.md)

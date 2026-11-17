# 3D Hints

## What it is
A package you drop into a Specs project to teach hand gestures by showing them: animated 3D hands loop a gesture
(pinch, tap, swipe, rotate, grab or a system tap) in front of the user. It is for onboarding, tutorials and
"do this next" prompts. It only shows gestures; it does not read the user's real hands or fire interaction events.

## What it does
- Each hint is a `HandHint` object: an `InteractionHintController` plus an animated left and right hand rig, an
  outline shader that fades the hand in and out, fingertip glow and a far-pinch cursor.
- With `autoPlay` on, the controller plays its Inspector `hintAnimations` entries at awake; several entries form a
  sequence.
- From script, call `playHintAnimation(handMode, animationName, numberOfLoops, animationSpeed)` or
  `playHintAnimationSequence(clips, numberOfLoops)`; each clip moves the `HandHint` to its `position`.
- After the last loop the hand fades out and `animationEndEvent` fires once per completed hint or sequence.
- The demo prefab shows an onboarding `Guide`, then an `ExampleCarousel` that steps through six examples: Finger Tap
  Near, Pinch Near, Pinch Far, Two Hands Pinch Scale, System Tap Settings and a Gesture Sequence.

## Highlights
- 31 looping gesture clips, named through `HandAnimationsLibrary.Left`, `.Right` (20 one-handed gestures each) and
  `.Both` (two-hand and system gestures), with `HandMode` choosing which hand mesh shows.
- Automatic, clip-gated feedback: fingertip glow while a pinch is closed, and a triggering, squishing cursor only
  during `pinch_far`.
- Sequences alternate clips with a 200 ms fade between steps; loop count and playback speed are set per hint.
- Tweens run on the bundled `NativeTween` (an `LSTween`-compatible surface), so no separate tween package is needed.
- There is no stop API: wait for `animationEndEvent`, or disable the `HandHint` object to hide a hint.

## Core scripts
| Script | What it does |
|---|---|
| `Scripts/InteractionHintController.ts` | The hint component: plays clips and sequences, fades hands, drives glow and cursor, fires `animationEndEvent`. Also exports `HandMode`, `HandAnimationsLibrary` and `HandAnimationClipInfo`. |
| `Scripts/NativeTween.ts` | Lightweight tween engine (`LSTween`, `Tween`, `Easing`) used for the fades. |
| `Scripts/ExampleTS.ts` | Usage example: drives a controller with a single animation or a sequence. |
| `Scripts/ExampleJS.js` | JavaScript version of the same example. |
| `Example/GuideDismissPanel/GuideDismissPanel.ts` | Demo guide panel that hides the examples until "Ok, I understood" is pressed. |
| `Example/ExampleCarousel/ExampleCarousel.ts` | Demo carousel that steps through the six example groups. |

## Extra info
- **Requires:** Utilities and SnapDecorators (used by `Scripts/`), InteractionKit and UIKit (used by the `Example/`
  demo scaffolding), plus Motion and Icons, which are declared but not imported. Hints play in the Lens Studio
  Preview as well as on Specs.
- **Get started:** `HandHints3D__PLACE_IN_SCENE.prefab`. Keep or copy the `HandHint` objects you need and never
  rebuild the rig: the controller finds its parts by name and child index. Position a hint by moving its parent.
  Delete `Guide`, `ExampleCarousel` and unused example groups for your own Lens.
- **More docs:**
  - [cheat-sheet.md](cheat-sheet.md): the rules that most often break a hint; read first.
  - [api-status.md](api-status.md): current, experimental, removed and internal surfaces, and known gaps.
  - [components.md](components.md): prefab structure, controller inputs, methods, events and the gesture library.
  - [examples.md](examples.md): auto-play, script playback, sequences, chaining and positioning.
  - [troubleshooting.md](troubleshooting.md): symptoms and fixes.

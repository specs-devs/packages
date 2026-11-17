# Animation Examples

## What it is
A package of eight focused, self-contained TypeScript examples that show how to drive `AnimationPlayer` at runtime on
Specs. Each example is a prefab with a UI Kit `Frame`, an `AnimationPlayer` and one example script, so you can read the
code straight through and reuse the pattern. It is for developers who want to animate UI Kit content with runtime-built
curves, keyframes, callbacks and animation events instead of (or alongside) authored animation assets.

## What it does
1. Drop `AnimationExamples__PLACE_IN_SCENE.prefab` into a Specs scene with a Camera and Interaction Kit (SIK).
2. `AnimationExamplesManager` spawns the eight example prefabs as disabled children and shows one at a time; its own
   left/right arrow UI (or the shipped demo carousel) steps through them with wrap-around.
3. Each example builds or reads a clip on its `AnimationPlayer` and plays it; a TAP button replays the clip, and
   re-enabling an example schedules a replay.
4. The examples cover:
   - `ScaleSquishExample` - scale squish with a cubic-bezier easing curve (`AnimationCurve.createEasingCurve`).
   - `PushOutZExample` - Z push-out with explicit overshoot keyframes (`AnimationCurve.createKeyFrame`).
   - `OpacityCallbackExample` - fades the whole Frame stack through a per-frame custom property callback.
   - `SubscribeToFinishExample` - a named event planted at the end of the clip acts as a finish callback.
   - `CustomTimestampEventExample` - a named event (default `midpoint`) fires at a chosen timestamp.
   - `FromAnimationAssetExample` - plays an authored `.animationAsset` (`SHAKE`), with a programmatic shake fallback.
   - `ExistingPlayerExample` - plays an entirely Inspector-configured `AnimationPlayer` clip (`LIFT`).
   - `FrameSizingExample` - animates the Frame's `innerSize` instead of a Transform.

## Highlights
- Runtime-built and authored animation share one playback pipeline; examples mix `AnimationPropertyTrack`, easing
  curves, keyframes and `.animationAsset` files.
- `AnimationPlayer` has no built-in finish callback; the examples use named events and `AnimationPlayer.onEvent`.
- UI Kit Frame `opacity` and `innerSize` are written after initialization (setup deferred to `OnStart`).
- Shared helpers (`playFirstClip`, `buildFrameUI`, `flatCurve`, `bindReplay`) keep each example short.
- Manager API for custom UI: `getCount()`, `getCurrentIndex()`, `getCurrentName()`, `next()`, `previous()`, `setActive()`.
- `TweenExamples` is a read-and-uncomment walkthrough of every pattern in one component (all calls commented out).

## Core scripts
| Script | What it does |
|---|---|
| `Scripts/AnimationExamplesManager.ts` | Spawns the example prefabs and cycles through them with a code-built UI Kit arrow UI. |
| `Scripts/Helpers/AnimationHelpers.ts` | Shared helpers: play the first clip, build the Frame UI, flat curves, TAP replay binding. |
| `Scripts/ScaleSquishExample.ts` | Scale squish via a spring-out cubic-bezier easing curve. |
| `Scripts/PushOutZExample.ts` | Z-axis push-out with overshoot keyframes. |
| `Scripts/OpacityCallbackExample.ts` | Fades Frame, Button and Text labels through a custom property callback. |
| `Scripts/CustomTimestampEventExample.ts` | Fires a named event at an arbitrary clip timestamp. |
| `Scripts/FromAnimationAssetExample.ts` | Plays an authored animation asset, with a programmatic fallback. |
| `Scripts/FrameSizingExample.ts` | Animates the Frame's `innerSize` (non-transform animation). |
| `Scripts/TweenExamples.ts` | Single-component walkthrough of all AnimationPlayer patterns. |

## Extra info
- **Requires:** SnapDecorators, UIKit, InteractionKit, Motion, Icons. Position and scale tracks are absolute, so move a
  parent rather than the animated object. Synthetic hand input in the Lens Studio Preview may fail; verify guide,
  navigation and TAP controls manually or on Specs. Logging flags default to off; enable them to see events.
- **Get started:** `AnimationExamples__PLACE_IN_SCENE.prefab` (manager plus demo guide and carousel); individual
  examples live in `Prefabs/`. Remove the `Guide` and `ExampleCarousel` objects to use the manager UI alone.
- **More docs:**
  - [cheat-sheet.md](cheat-sheet.md) - setup and lifecycle rules, read first.
  - [components.md](components.md) - import paths, inputs and manager methods.
  - [examples.md](examples.md) - instantiating the prefab and driving the manager.
  - [api-status.md](api-status.md) - supported surface and verification gaps.
  - [troubleshooting.md](troubleshooting.md) - playback, placement and preview input issues.
  - [guide.md](guide.md) - the longer animation tutorial.

# AnimationExamples guide

[← Agent usage index](../README.md)

## Use when

Read the longer human introduction and animation patterns.

<p align="center">
  <img src="media/AnimationExamples.png" width="250px" alt="AnimationExamples"/>
</p>

The historical README-ref/banner.png was not included in this source revision; the package image above is shipped with this guide.

# Animation Player Tween Examples

[![SnapDecorators](https://img.shields.io/badge/SnapDecorators-Light%20Gray?color=D3D3D3)](#) [![SpectaclesUIKit](https://img.shields.io/badge/SpectaclesUIKit-Light%20Gray?color=D3D3D3)](#) [![TypeScript](https://img.shields.io/badge/TypeScript-Light%20Gray?color=D3D3D3)](#)

A collection of focused TypeScript examples demonstrating how to drive `AnimationPlayer` at runtime on SPECS — runtime-built tween curves, keyframed motion, callback-driven material animation, finish events, custom timestamp events, and pre-authored AnimationAsset playback.

## Overview

`AnimationPlayer` is the runtime primitive for playing animation clips on a SceneObject. This package shows the patterns you'll actually reach for in production: building an animation entirely in code with `AnimationCurve.createEasingCurve()`, composing tracks with `AnimationPropertyTrack`, subscribing to `onEvent`, and reusing an Inspector-configured `AnimationPlayer` from script.

Each example is a single, self-contained `BaseScriptComponent` with `@input` fields you can tweak in the Inspector — no dependencies between examples, so you can enable one group at a time and read the code straight through.

> **NOTE:**
> Animations built in script use the same playback pipeline as pre-authored `.animationAsset` files — the difference is just where the curves come from. Mix and match as needed.

## Design Guidelines

Designing lenses for SPECS requires careful attention to physical comfort and field of view. Refer to the SPECS design guidelines before authoring new motion: https://developers.snap.com/spectacles/design-guidelines

## Prerequisites

- **Lens Studio**: see `package.native` for the version this package was saved with
- **SPECS OS Version**: v7.0+
- **SPECS App iOS**: v1.7+
- **SPECS App Android**: v1.7+

## Getting Started

Clone the repository and open `AnimationExamples.esproj` in Lens Studio.

> **IMPORTANT:**
> This project uses Git Large File Storage (LFS). Make sure `git lfs install` has been run before cloning, otherwise binary assets will appear as text pointers.

## Quick Start

1. Drop the `AnimationExamples__PLACE_IN_SCENE` prefab into a scene. It contains three objects: `Guide` (GuideDismissPanel), `Examples` (the `AnimationExamplesManager` ScriptComponent) and `ExampleCarousel` (ExampleCarousel plus AnimationExamplesCarouselSource).
2. The manager's `animationPrefabs` array is already wired to the eight prefabs in `AnimationExamples.lspkg/Prefabs/`; reassign it only for a custom list.
3. Press Preview and press "Ok, I understood" on the guide. The manager spawns:
   - An `Animations` container with the eight prefab instances (one enabled).
   - A `UI` container with two SpectaclesUIKit arrow buttons, a title `AnimationName`, and a `Pivot`-wrapped `AnimationDescription`. In the shipped prefab `AnimationExamplesCarouselSource` hides this `UI`.
4. Use the carousel's Previous / Next buttons to cycle through the examples. Without the carousel, the manager's left/right arrows do the same; their labels come from the matching entry in the manager's `ENTRIES` array.
5. Tap an example's TAP button to replay its configured clip.
6. Toggle `enableLogging` on the manager (and on each example script) to see per-step and per-cycle logs.

## Key Features

### Runtime tweens with CSS easing presets
Build a scale or position tween entirely in script using `AnimationCurve.createEasingCurve()`. No assets required.

### Keyframe authoring from script
Compose precise motion with `AnimationCurve.createKeyFrame()` for cases where easing presets aren't enough — overshoot, anticipation, multi-phase moves.

### Material-property animation via callbacks
Animate any material property (opacity, color, custom shader uniforms) by registering a callback track instead of binding to a Transform property.

### Finish-event subscription
Hook `player.onEvent` to react when a clip ends — chain animations, swap states, fire game logic.

### Custom timestamp events
Fire arbitrary events at specific timestamps inside a clip — useful for syncing audio, particles, or state changes to motion.

### Pre-authored AnimationAsset playback
Author motion in the Lens Studio timeline (`.animationAsset` files included: `LIFT`, `SHAKE`), then play them from script the same way as runtime-built clips.

### Reusing Inspector-configured AnimationPlayer
Drop an `AnimationPlayer` component on a SceneObject in the Inspector, then play its configured first clip (`player.clips[0]`) from script — production-friendly workflow that keeps motion data out of code.

## Script Highlights

- **TweenExamples.ts** — comprehensive walkthrough hitting every pattern in one file. Read this first.
- **ScaleSquishExample.ts** — minimal "scale between A and B with easing" example.
- **PushOutZExample.ts** — keyframed Z translation with overshoot.
- **OpacityCallbackExample.ts** — UI opacity tween via custom property callback. Sets `Frame.opacity` (cascades to Button children) plus a manual `textFill.color.a` write per Text.
- **SubscribeToFinishExample.ts** — listening for clip completion.
- **CustomTimestampEventExample.ts** — firing events mid-clip.
- **FromAnimationAssetExample.ts** — playing pre-authored `.animationAsset` files.
- **ExistingPlayerExample.ts** — playing the first clip (`player.clips[0]`) of an Inspector-placed `AnimationPlayer`.
- **AnimationExamplesManager.ts** — single place-in-scene manager. Takes one `animationPrefabs: ObjectPrefab[]` input (eight prefabs in the shipped prefab) and, in code, spawns an `Animations` container plus a `UI` container with two SpectaclesUIKit arrow buttons, a title label, and a `Pivot`-wrapped description label. Exposes `next() / previous() / setActive(index)` so a custom UI can drive it without modification. Layout values + entry titles live in the `LAYOUT` object and the `ENTRIES` array at the top of the file.
- **Helpers/AnimationHelpers.ts** — `playFirstClip()`, `flatCurve()`, and `buildFrameUI()` shared utilities. `buildFrameUI` spawns the SpectaclesUIKit Frame contents (Text label + Button with its own Text) at runtime, so each example prefab is just `Frame + AnimationPlayer + ExampleScript` in the editor.

## Component Configuration

Every example component exposes the same two logging flags:

- **enableLogging**: Per-cycle/event logs (animation start, finish, custom event fires).
- **enableLoggingLifecycle**: Lifecycle logs (`onAwake`, `onStart`, `onDestroy`).

Both default to `false` so the Logger panel stays clean unless you opt in.

## Usage Examples

### Build a scale tween at runtime

```typescript
@component
export class ScaleSquishExample extends BaseScriptComponent {
  @input target: SceneObject;
  @input startScale: vec3 = new vec3(1, 1, 1);
  @input endScale: vec3 = new vec3(1.4, 0.6, 1.4);

  onAwake(): void {
    const curveX = AnimationCurve.createEasingCurve(
      this.startScale.x, this.endScale.x, 0.34, 1.56, 0.64, 1
    );
    // ... build curves for Y, Z, compose a vec3 track, attach to a layer,
    // and call playFirstClip() to drive the AnimationPlayer's first clip.
  }
}
```

### Subscribe to clip finish

Excerpt inside an initialized animation component (shown as a fragment, not a standalone script):

```text
asset.createEvent("finished", 1.0);
player.onEvent.add((args) => {
  if (args.eventName === "finished") {
    // chain the next animation here
  }
});
```

### Play a pre-authored AnimationAsset

Inspector declaration and runtime fragment (not a standalone script):

```text
@input clipAsset: AnimationAsset;
// at runtime:
playFirstClip(this.sceneObject, this.clipAsset);
```

## Disclaimer

This package is example/educational content. Curves, durations, and easing presets are intentionally tuned for visual clarity, not production polish. Tune them for your own motion design.

## Support

If you have any questions or need assistance, please file an issue on the repository or reach out in the SPECS developer community.

Built with 👽 by the SPECS team.

---

[See more packages](https://github.com/specs-devs/packages)

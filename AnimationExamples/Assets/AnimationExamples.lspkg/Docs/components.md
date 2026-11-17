# AnimationExamples components

[← Agent usage index](../README.md)

## Use when

Read exact consumer paths, TypeScript defaults, and public methods.

## AnimationExamplesManager

Import: `AnimationExamples.lspkg/Scripts/AnimationExamplesManager`. Class: `AnimationExamplesManager`.

| Input | Type | Source default | Meaning |
| --- | --- | --- | --- |
| `animationPrefabs` | `ObjectPrefab[]` | `required Inspector binding` | The animation example prefabs to spawn and cycle through. |
| `enableLogging` | `boolean` | `false` | Enable general logging (spawn steps, cycle events, label updates, etc.) |
| `enableLoggingLifecycle` | `boolean` | `false` | Enable lifecycle logging (onAwake, onStart, onDestroy, etc.) |


Public methods: `getCount(): number`, `getCurrentIndex(): number`, `getCurrentName(): string`, `next(): void`, `previous(): void`, `setActive(index: number): void`. Next/previous wrap; setActive clamps. Examples are spawned in onAwake; UI callbacks bind in OnStart. No package-defined public events.

## CustomTimestampEventExample

Import: `AnimationExamples.lspkg/Scripts/CustomTimestampEventExample`. Class: `CustomTimestampEventExample`.

| Input | Type | Source default | Meaning |
| --- | --- | --- | --- |
| `target` | `SceneObject` | `undefined; falls back to this object` | SceneObject hosting the driven AnimationPlayer. |
| `startPosition` | `vec3` | `new vec3(0, 0, 0)` | Absolute starting position. |
| `endPosition` | `vec3` | `new vec3(1, 0, 0)` | Absolute ending position. |
| `eventName` | `string` | `"midpoint"` | Named event placed inside the clip. |
| `eventTime` | `number` | `0.5` | Timestamp (seconds) where the event fires. |
| `enableLogging` | `boolean` | `false` | Enable general logging (animation cycles, events, etc.) |
| `enableLoggingLifecycle` | `boolean` | `false` | Enable lifecycle logging (onAwake, onStart, onUpdate, onDestroy, etc.) |


Runnable example setup is in onAwake; no additional package-defined public methods/events. AnimationPlayer.onEvent carries named animation events. TAP replay binds after start; re-enabling schedules replay. `TweenExamples` leaves every tutorial call commented out.

## ExistingPlayerExample

Import: `AnimationExamples.lspkg/Scripts/ExistingPlayerExample`. Class: `ExistingPlayerExample`.

| Input | Type | Source default | Meaning |
| --- | --- | --- | --- |
| `enableLogging` | `boolean` | `false` | Enable general logging (animation cycles, events, etc.) |
| `enableLoggingLifecycle` | `boolean` | `false` | Enable lifecycle logging (onAwake, onStart, onUpdate, onDestroy, etc.) |


Runnable example setup is in onAwake; no additional package-defined public methods/events. AnimationPlayer.onEvent carries named animation events. TAP replay binds after start; re-enabling schedules replay. `TweenExamples` leaves every tutorial call commented out.

## FrameSizingExample

Import: `AnimationExamples.lspkg/Scripts/FrameSizingExample`. Class: `FrameSizingExample`.

| Input | Type | Source default | Meaning |
| --- | --- | --- | --- |
| `baseSize` | `vec2` | `new vec2(7.5, 7.5)` | Resting Frame innerSize in centimeters. |
| `heightExpansion` | `number` | `4` | How much the height grows at its peak (centimeters). |
| `widthExpansion` | `number` | `4` | How much the width grows at its peak (centimeters). |
| `enableLogging` | `boolean` | `false` | Enable general logging (animation cycles, events, etc.) |
| `enableLoggingLifecycle` | `boolean` | `false` | Enable lifecycle logging (onAwake, onStart, onUpdate, onDestroy, etc.) |


Runnable example setup is in onAwake; no additional package-defined public methods/events. AnimationPlayer.onEvent carries named animation events. TAP replay binds after start; re-enabling schedules replay. `TweenExamples` leaves every tutorial call commented out.

## FromAnimationAssetExample

Import: `AnimationExamples.lspkg/Scripts/FromAnimationAssetExample`. Class: `FromAnimationAssetExample`.

| Input | Type | Source default | Meaning |
| --- | --- | --- | --- |
| `target` | `SceneObject` | `undefined; falls back to this object` | SceneObject hosting the driven AnimationPlayer. |
| `shakeAmplitudeX` | `number` | `2` | Horizontal shake amplitude. |
| `shakeAmplitudeY` | `number` | `2` | Vertical shake amplitude. |
| `shakeAmplitudeZ` | `number` | `0` | Depth shake amplitude. |
| `enableLogging` | `boolean` | `false` | Enable general logging (animation cycles, events, etc.) |
| `enableLoggingLifecycle` | `boolean` | `false` | Enable lifecycle logging (onAwake, onStart, onUpdate, onDestroy, etc.) |


Runnable example setup is in onAwake; no additional package-defined public methods/events. AnimationPlayer.onEvent carries named animation events. TAP replay binds after start; re-enabling schedules replay. `TweenExamples` leaves every tutorial call commented out.

## OpacityCallbackExample

Import: `AnimationExamples.lspkg/Scripts/OpacityCallbackExample`. Class: `OpacityCallbackExample`.

| Input | Type | Source default | Meaning |
| --- | --- | --- | --- |
| `startOpacity` | `number` | `0.0` | Initial UI opacity. |
| `endOpacity` | `number` | `1.0` | Final UI opacity. |
| `enableLogging` | `boolean` | `false` | Enable general logging (animation cycles, events, etc.) |
| `enableLoggingLifecycle` | `boolean` | `false` | Enable lifecycle logging (onAwake, onStart, onUpdate, onDestroy, etc.) |


Runnable example setup is in onAwake; no additional package-defined public methods/events. AnimationPlayer.onEvent carries named animation events. TAP replay binds after start; re-enabling schedules replay. `TweenExamples` leaves every tutorial call commented out.

## PushOutZExample

Import: `AnimationExamples.lspkg/Scripts/PushOutZExample`. Class: `PushOutZExample`.

| Input | Type | Source default | Meaning |
| --- | --- | --- | --- |
| `target` | `SceneObject` | `undefined; falls back to this object` | SceneObject hosting the driven AnimationPlayer. |
| `startZ` | `number` | `0` | Start Z (absolute). |
| `overshootZ` | `number` | `1.2` | Overshoot peak Z — how far past the end the push briefly reaches. |
| `endZ` | `number` | `1` | End Z (absolute) — settle position after the overshoot. |
| `duration` | `number` | `0.6` | Total duration (seconds) of the programmatic curve. |
| `enableLogging` | `boolean` | `false` | Enable general logging (animation cycles, events, etc.) |
| `enableLoggingLifecycle` | `boolean` | `false` | Enable lifecycle logging (onAwake, onStart, onUpdate, onDestroy, etc.) |


Runnable example setup is in onAwake; no additional package-defined public methods/events. AnimationPlayer.onEvent carries named animation events. TAP replay binds after start; re-enabling schedules replay. `TweenExamples` leaves every tutorial call commented out.

## ScaleSquishExample

Import: `AnimationExamples.lspkg/Scripts/ScaleSquishExample`. Class: `ScaleSquishExample`.

| Input | Type | Source default | Meaning |
| --- | --- | --- | --- |
| `target` | `SceneObject` | `undefined; falls back to this object` | SceneObject hosting the driven AnimationPlayer. |
| `startScale` | `vec3` | `new vec3(1, 1, 1)` | Absolute starting scale. |
| `endScale` | `vec3` | `new vec3(1.4, 0.6, 1.4)` | Absolute ending scale. |
| `enableLogging` | `boolean` | `false` | Enable general logging (animation cycles, events, etc.) |
| `enableLoggingLifecycle` | `boolean` | `false` | Enable lifecycle logging (onAwake, onStart, onUpdate, onDestroy, etc.) |


Runnable example setup is in onAwake; no additional package-defined public methods/events. AnimationPlayer.onEvent carries named animation events. TAP replay binds after start; re-enabling schedules replay. `TweenExamples` leaves every tutorial call commented out.

## SubscribeToFinishExample

Import: `AnimationExamples.lspkg/Scripts/SubscribeToFinishExample`. Class: `SubscribeToFinishExample`.

| Input | Type | Source default | Meaning |
| --- | --- | --- | --- |
| `target` | `SceneObject` | `undefined; falls back to this object` | SceneObject hosting the driven AnimationPlayer. |
| `startScale` | `vec3` | `new vec3(1, 1, 1)` | Absolute starting scale. |
| `endScale` | `vec3` | `new vec3(1.5, 1.5, 1.5)` | Absolute ending scale. |
| `finishedEventName` | `string` | `"finished"` | Event placed at clip end. |
| `enableLogging` | `boolean` | `false` | Enable general logging (animation cycles, events, etc.) |
| `enableLoggingLifecycle` | `boolean` | `false` | Enable lifecycle logging (onAwake, onStart, onUpdate, onDestroy, etc.) |


Runnable example setup is in onAwake; no additional package-defined public methods/events. AnimationPlayer.onEvent carries named animation events. TAP replay binds after start; re-enabling schedules replay. `TweenExamples` leaves every tutorial call commented out.

## TweenExamples

Import: `AnimationExamples.lspkg/Scripts/TweenExamples`. Class: `TweenExamples`.

| Input | Type | Source default | Meaning |
| --- | --- | --- | --- |
| `animationAsset` | `AnimationAsset` | `undefined; optional` | AnimationAsset created in the GUI; consumed by exampleFromAnimationAsset(). |
| `enableLogging` | `boolean` | `false` | Enable general logging (animation cycles, events, etc.) |
| `enableLoggingLifecycle` | `boolean` | `false` | Enable lifecycle logging (onAwake, onStart, onUpdate, onDestroy, etc.) |


Runnable example setup is in onAwake; no additional package-defined public methods/events. AnimationPlayer.onEvent carries named animation events. TAP replay binds after start; re-enabling schedules replay. `TweenExamples` leaves every tutorial call commented out.

## Helpers

Import: `AnimationExamples.lspkg/Scripts/Helpers/AnimationHelpers`.

- `FrameUI`: titleText, button, buttonText, allTexts.
- `buildFrameUI(parent: SceneObject, options: {title: string; buttonText: string}): FrameUI` creates UI under an existing Frame.
- `playFirstClip(sceneObject: SceneObject, fallbackAsset: AnimationAsset, onEvent?: (args: AnimationPlayerOnEventArgs) => void, logSetup: boolean = false): AnimationPlayer | null` preserves the configured clip options and returns null when the player or first clip is absent.
- `flatCurve(): AnimationCurve` holds zero over t=0..1.
- `bindReplay(script: BaseScriptComponent, ui: FrameUI, target: SceneObject): void` stops/replays the first clip through the TAP button and deferred enable event.

## Dependencies used by the scripts

- `SpectaclesUIKit.lspkg/...`: `Frame`, `Button` and `ThemeService` (manager, OpacityCallbackExample, FrameSizingExample, helpers).
- `SnapDecorators.lspkg/assert`: `assert` in `ExistingPlayerExample` and `TweenExamples`.
- `SpectaclesInteractionKit.lspkg/Providers/CameraProvider/WorldCameraFinderProvider`: only the `Example/` demo scripts.

## Assets

- `AnimationAssets/LIFT.animationAsset`: authored clip bound to the first clip of `Prefabs/ExistingPlayerExample.prefab`.
- `AnimationAssets/SHAKE.animationAsset`: authored clip bound to the first clip of `Prefabs/FromAnimationAssetExample.prefab`.
- `Prefabs/*Example.prefab`: the eight example prefabs (Frame + AnimationPlayer + example script).
- `Materials/Image.mat`, `Materials/PBR.mat`, `Materials/PBR - Opacity.mat`; shaders `Shaders/flat.graphShader`, `Shaders/pbr.graphShader`; mesh `Meshes/Box.mesh`; textures in `Textures/`.

## Demo scaffolding (`Example/`)

These scripts ship in `AnimationExamples.lspkg/Example/` and are wired inside
`AnimationExamples__PLACE_IN_SCENE.prefab` (order: Guide, Examples,
ExampleCarousel). They only present the examples; they are not part of the
animation patterns, and you don't need them in your own Lens.

| Object / script | Class | Key inputs |
|---|---|---|
| `Guide` — `Example/GuideDismissPanel/GuideDismissPanel.ts` | `GuideDismissPanel` | `hideUntilDismissed: SceneObject[]` — hidden until "Ok, I understood" is pressed and enabled again in list order (here: `Examples`, then `ExampleCarousel`); `buttonLabel: string = "Ok, I understood"` (only used when the panel is built at runtime) |
| `ExampleCarousel` — `Example/ExampleCarousel/ExampleCarousel.ts` | `ExampleCarousel` | `examples: SceneObject[]`, `exampleInfo: string[]` (both filled at runtime by `AnimationExamplesCarouselSource`, so empty in the prefab), `steps: SceneObject[]` (empty here: step through `examples`), `stepInfo: string[] = []` (one info line per `steps` entry; empty entries fall back to the example info; empty here), `startIndex: number = 0`, `previousLabel` / `nextLabel`, `examplesPushBack: number = 20` (here 105), `anchorExamples: boolean = true`, `startMinimized: boolean = false`, `extraPanelDrop: number = 0` (here 12) |
| `ExampleCarousel` — `Example/ExampleCarousel/AnimationExamplesCarouselSource.ts` | `AnimationExamplesCarouselSource` | `manager: SceneObject` (the `Examples` object), `exampleNames: string[]` (step order, by spawned prefab root name), `exampleInfo: string[]` (one line per name), `holderOffset: vec3` (here `(0, -33, 0)`). In its `onAwake` it hides the manager's own `UI` and hands the spawned examples to the carousel, each wrapped in a holder object |

Keep `Examples` above `ExampleCarousel` and the Guide above both: the guide
hides its targets in `onAwake`, and the carousel source needs the manager's
`Animations` container, which the manager creates in its own `onAwake`.

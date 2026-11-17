# InteractableHelper components

[← Agent usage index](../README.md)

## Use when

You need exact field names, combo values or defaults. Most configuration
happens in the Inspector; these tables match the serialized names. All facts
come from `InteractableHelper.ts` and `Scripts/*.ts` in this revision.

## Modules

| Symbol | Import path | Kind |
|---|---|---|
| `InteractableHelper`, `EventType` | `InteractableHelper.lspkg/InteractableHelper` | component, enum |
| `EventResponseType` | `InteractableHelper.lspkg/Scripts/EventResponseType` | `@typedef` |
| `TransformAnimation` | `InteractableHelper.lspkg/Scripts/TransformAnimation` | `@typedef` |
| `CustomAnimation` | `InteractableHelper.lspkg/Scripts/CustomAnimation` | `@typedef` |
| `MaterialPropertyAnimation` | `InteractableHelper.lspkg/Scripts/MaterialPropertyAnimation` | `@typedef` |
| `ColorProperyAnimation` (sic) | `InteractableHelper.lspkg/Scripts/ColorProperyAnimation` | `@typedef` |
| `BlendshapeAnimation` | `InteractableHelper.lspkg/Scripts/BlendshapeAnimation` | `@typedef` |
| `AudioComponentControl` | `InteractableHelper.lspkg/Scripts/AudioComponentControl` | `@typedef` |
| `VideoTextureControl` | `InteractableHelper.lspkg/Scripts/VideoTextureControl` | `@typedef` |
| `CallbackAction`, `CallbackTargetObjectAction` | `InteractableHelper.lspkg/Scripts/CallbackAction` | `@typedef` |
| `EasingData` | `InteractableHelper.lspkg/Scripts/EasingData` | `@typedef` |
| `PlayOptions` | `InteractableHelper.lspkg/Scripts/PlayOptions` | `@typedef` (not used by the component) |
| `LSTween`, `Tween`, `Easing`, `mainGroup`, type `EasingFunction` (`(t: number) => number`) | `InteractableHelper.lspkg/Scripts/NativeTween` | internal tween engine |

Example callback scripts: `InteractableHelper.lspkg/Examples/ChangeTextScript`
(`changeText()`) and `InteractableHelper.lspkg/Examples/DoOnStartComplete`
(`onAnimationStart()`, `onAnimationComplete()`; the Move + Rotate example's
rotate animation calls both, so a pinch prints "Animation Started/Completed").

## `InteractableHelper` (component)

### Inputs

| Input | Type | Default | Fires on (SIK `Interactable`) |
|---|---|---|---|
| `onHoverEnter` | `EventResponseType[]` | `[]` | `onHoverEnter` |
| `onHoverExit` | `EventResponseType[]` | `[]` | `onHoverExit` |
| `onPinchDown` | `EventResponseType[]` | `[]` | `onTriggerStart` |
| `onPinchUp_Select` | `EventResponseType[]` | `[]` | `onTriggerEnd` |
| `enableLogging` | `boolean` | `false` | — |
| `enableLoggingLifecycle` | `boolean` | `false` | — |

### Lifecycle

1. `onAwake`: get or create a `ColliderComponent` on the host. For every
   *Iterate Through Children* response, enable child 0 and disable the rest. It
   **throws** if the target has no children.
2. `OnStartEvent` (`initialize()`, via SnapDecorators `@bindStartEvent`): get
   or create the SIK `Interactable` on the host and subscribe the four events.
3. On each event, every response in that list runs in order. A response whose
   `sceneObject` is unset **throws**. Afterwards the per-event iteration counter
   increments (one counter per event list, shared by every Toggle/Iterate
   response in that list).

### Public methods

| Method | Notes |
|---|---|
| `response(item: EventResponseType, eventType: EventType): void` | Runs one response now, as if `eventType` had fired. Use an item from the helper's own arrays |
| `initialize(): void` | The OnStart hook; already bound, so don't call it again (it would double-subscribe) |

### `EventType` (enum)

`HoverEnter = 0`, `HoverExit = 1`, `TriggerDown = 2`, `TriggerUp = 3`.

## `EventResponseType`

| Field | Type | Shown when | Notes |
|---|---|---|---|
| `sceneObject` | `SceneObject` | always | Target of the response (required) |
| `eventResponseType` | `number` | always | See the table below |
| `state` | `number` | type 0 | `0` On, `1` Off |
| `delay` | `number` | type 0 | Seconds, default `0` |
| `animations` | `TransformAnimation[]` | type 3 | All run in parallel |
| `customAnimationData` | `CustomAnimation` | type 4 | |
| `materialProperyData` (sic) | `MaterialPropertyAnimation` | type 5 | |
| `colorProperyData` (sic) | `ColorProperyAnimation` | type 6 | |
| `script` / `functionName` | `ScriptComponent` / `string` | type 7 | |
| `blendShapeData` | `BlendshapeAnimation` | type 8 | |
| `audioControl` | `AudioComponentControl` | type 9 | |
| `videoTextureControl` | `VideoTextureControl` | type 10 | |

| `eventResponseType` | Label | Requires on `sceneObject` | Behavior |
|---|---|---|---|
| 0 | SetState | — | After `delay` s, `enabled = (state == 0)` |
| 1 | Toggle | — | `enabled = !enabled` |
| 2 | Iterate Through Children | ≥ 1 child | Hide the current child, show the next (wraps) |
| 3 | Transform Animation | — | Plays each `TransformAnimation` |
| 4 | Custom Animation | `AnimationPlayer` | Plays the next clip, or a named clip from time 0 |
| 5 | Material Property Animation | `RenderMeshVisual` | Clones the material once, then tweens `mainMaterial.mainPass[propertyName]` |
| 6 | Material Base Color Animation | `MaterialMeshVisual` (mesh/Image) or `Text` | Clones the material, then tweens the base color (or the text color) to `endColor` |
| 7 | Custom Callback | — | Calls `script[functionName]("")`; throws if `script` is unset or the function does not exist |
| 8 | BlendShape Animation | `RenderMeshVisual` with the blendshape | Tweens the blendshape weight |
| 9 | Play Audio Clip | `AudioComponent` | See `AudioComponentControl` |
| 10 | Play Video Texture | `Image` whose `mainPass.baseTex` is a video texture | See `VideoTextureControl` |

## `TransformAnimation`

| Field | Type | Default | Notes |
|---|---|---|---|
| `animationType` | `number` | — | `0` Move Local, `1` Move World, `2` Scale Local, `3` Scale World, `4` Rotate Local, `5` Rotate World |
| `playOption` | `number` | — | `0` Play From Current Value, `1` Play Everytime, `2` Toggle |
| `endVal` | `vec3` | — | playOption 0: target value |
| `startValue`, `endValue` | `vec3` | — | playOption 1: from → to on every trigger |
| `a`, `b` | `vec3` | — | playOption 2: a→b on even, b→a on odd triggers |
| `animationDurationInSeconds` | `number` | `1.0` | |
| `delay` | `number` | `0.0` | Seconds |
| `easingData` | `EasingData` | — | |
| `doOnStart` / `onStartAction` | `boolean` / `CallbackAction` | `false` | |
| `doOnComplete` / `onCompleteAction` | `boolean` / `CallbackAction` | `false` | |

Rotation values are Euler **degrees**. Positions and scales are in the target's
local or world space according to `animationType`.

## `CustomAnimation`

`iterateThroughAllClips: boolean = true` plays the clips in order, one per
trigger. When it is `false`, `animationName: string` plays that clip (and
re-enables it if it was disabled).

## `MaterialPropertyAnimation`

| Field | Type | Notes |
|---|---|---|
| `propertyName` | `string` | Shader parameter **script name**, not its title |
| `valueType` | `number` | `0` Float, `1` Vec3, `2` Vec4 |
| `startFloatValue` / `endFloatValue` | `number` | valueType 0 |
| `startVec3Value` / `endVec3Value` | `vec3` | valueType 1 |
| `startVec4Value` / `endVec4Value` | `vec4` | valueType 2 |
| `animationDurationInSeconds` | `number` (`1.0`) | |
| `delay`, `easingData`, `doOnStart`/`onStartAction`, `doOnComplete`/`onCompleteAction` | | As in `TransformAnimation` |

It always plays start → end; there is no play option. On first use it clones
the target's material (renamed `clonedMaterial`), so other objects that share
the material are not affected. A `propertyName` that is missing on `mainPass`
**throws**.

## `ColorProperyAnimation`

`endColor: vec4 = (1,1,1,1)`, `animationDurationInSeconds = 1.0`, `delay`,
`easingData`, and the on start/complete actions. It tweens from the current
color.

## `BlendshapeAnimation`

| Field | Type | Notes |
|---|---|---|
| `blenshapeName` (sic) | `string` | Must exist on the target's RenderMeshVisual |
| `playOption` | `number` | `0` From Current, `1` Every time, `2` Toggle |
| `endVal` / `startValue`, `endValue` / `a`, `b` | `number` | As for `TransformAnimation` (scalar weights) |
| `animationDurationInSeconds` | `number` (`1.0`) | |
| `delay`, `easingData`, on start/complete actions | | |

## `AudioComponentControl`

`audioControlBehavior: number`: `0` Play Once (after `delay` s), `1` Play / Stop
toggle, `2` Play / Pause / Resume. Every play is a single loop (`play(1)`).

## `VideoTextureControl`

| Field | Type | Default | Notes |
|---|---|---|---|
| `videoTextureControlBehavior` | `number` | — | `0` Play Once, `1` Loop |
| `delay` | `number` | `0` | Seconds (Play Once) |
| `doOnStart` / `onStartAction` | `boolean` / `CallbackAction` | `false` | Runs on the provider's `onPlaybackReady` |
| `doOnComplete` / `onCompleteAction` | `boolean` / `CallbackAction` | `false` | Runs on `onPlaybackDone` |

The response is ignored while the video is already playing. The start/complete
callbacks are subscribed once per response, on its first trigger.

## `CallbackAction` / `CallbackTargetObjectAction`

| Field | Type | Notes |
|---|---|---|
| `actionType` | `number` (default `-1` = nothing) | `0` Custom Callback, `1` Set State |
| `script` / `functionName` | `ScriptComponent` / `string` | actionType 0: calls `script[functionName]("a")` |
| `targetObjects` | `CallbackTargetObjectAction[]` | actionType 1: each `{targetObject: SceneObject, setValue: boolean}` |

## `EasingData`

`easing: number` combo values: `0` None, `1–3` Linear In/Out/InOut, `4–6`
Quadratic, `7–9` Cubic, `10–12` Quartic, `13–15` Quintic, `16–18` Exponential,
`19–21` Circular, `22–24` Elastic, `25–27` Back, `28–30` Bounce, `31–33`
Sinusoidal. The tween default (no easing set) is linear.

## Prefab: `InteractableHelper__PLACE_IN_SCENE.prefab`

Under the root, in order:

- `Guide`: the overview panel with the "Ok, I understood" button.
- `ExampleCarousel`: the carousel that shows one example at a time (Previous /
  Next, minimize).
- 12 example groups: Set State, Toggle, Scale, Move + Rotate, Play Animation,
  Iteration, Material Property, Material BaseColor, Callback, BlendShape
  Animation, Audio Control, Image with VideoTexture.

In each example group, a child named `Interactable` carries a
`RenderMeshVisual` (round button), a **Box collider 3 × 3 × 3 cm with
FitVisual off**, and the `InteractableHelper`. The response targets are its
siblings.

## Demo scaffolding (`Example/`)

These scripts ship in `InteractableHelper.lspkg/Example/` and are wired inside
`InteractableHelper__PLACE_IN_SCENE.prefab`. They only present the demo, and the
InteractableHelper component doesn't need them.

| Object / script | Class | Key inputs |
|---|---|---|
| `Guide`: `Example/GuideDismissPanel/GuideDismissPanel.ts` | `GuideDismissPanel` | `hideUntilDismissed: SceneObject[]` lists the objects hidden until "Ok, I understood" is pressed (here: `ExampleCarousel` and the 12 example groups). `buttonLabel: string = "Ok, I understood"` is only used when the panel is built at runtime |
| `ExampleCarousel`: `Example/ExampleCarousel/ExampleCarousel.ts` | `ExampleCarousel` | `examples: SceneObject[]` (the 12 example groups, in order), `exampleInfo: string[]` (one line per example), `steps: SceneObject[]` (empty here), `stepInfo: string[] = []` (one line per step, same order as `steps`; an empty entry falls back to the step's example info), `startIndex: number = 0`, `previousLabel` / `nextLabel`, `examplesPushBack: number = 20`, `anchorExamples: boolean = true`, `startMinimized: boolean = false`, `extraPanelDrop: number = 0` |

Both inputs point at the example groups rather than the prefab root, because
hiding the root would also hide the guide and the carousel.

## Demo assets (`Examples/VisResources/`)

Assets the 12 example groups use; the component itself references none of
them.

- `Elephant/`: `Elephant.prefab` with `Animations/Armature_BaseLayer.animationAsset`,
  `Meshes/elephant_med.mesh`, `Materials/Elephant Uber PBR.mat`,
  `Shaders/uber_pbr.graphShader` and its three textures (Play Animation example)
- `Materials/`: `Pink`, `Pink With Property`, `Blue`, `Green`, `Image`,
  `Image 2`, `Image With VideoTexture`, `VideoThumbnail`, `Ghost Material 2`,
  `ButtonIdle 2`
- `Shaders/`: `shaderWithPropery`, `ButtonIdle`, `flat`, `Ghost Material 2`,
  `uber_pbr` (`.graphShader`)
- `Meshes/`: `BoxMesh 2.mesh`, `PlatformSphereButton 2.mesh`
- `Textures/`: `Video.mp4`, `VideoThumbnail.png`, `Image.png`, `Base.png`,
  `Normal.png`, `ArrowDown.png`, `SimpleIdle.jpg`, `Speaker-cone.png`
- `Audio/cheering_mid.mp3` (Audio Control example)

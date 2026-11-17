# HandAttacher components

[← Agent usage index](../README.md)

## Use when

You need the exact import path, inputs, defaults, methods or enum values. All
facts come from `Scripts/HandAttacher.ts` in this package revision.

## Module

```typescript
import {HandAttacher, HandSide, HandJoint} from "HandAttacher.lspkg/Scripts/HandAttacher";
```

Script dependencies: `InteractionKit.lspkg/IK`,
`Utilities.lspkg/Scripts/Utils/MathUtils`, `Utilities.lspkg/Scripts/Utils/Logger`,
`SnapDecorators.lspkg/decorators`.

## `HandAttacher` (component)

This component makes `targetObject` follow a SIK hand joint in **world space**
every frame. The target is not reparented.

### Inputs

| Input | Type | Default | Read | Meaning |
|---|---|---|---|---|
| `targetObject` | `SceneObject` (`@allowUndefined`) | host object | in `onAwake`, re-read on the next update when reassigned (and by `setTarget`) | Object that follows the joint |
| `handSide` | `string` (combo) | `"right"` | in `onAwake`, re-read on the next update when reassigned (and by `setHand`) | `"left"`, `"right"`, `"dominant"`, `"nondominant"` |
| `handJoint` | `string` (combo) | `"indexTip"` | every frame | SIK `TrackedHand` joint property name (see `HandJoint`) |
| `positionOffset` | `vec3` | `(0,0,0)` | every frame | Offset in the joint's local space (cm), rotated by the joint rotation |
| `rotationOffset` | `vec3` | `(0,0,0)` | every frame | Euler degrees; target rotation = joint rotation × offset |
| `usePositionSmoothing` | `boolean` | `true` | every frame | Lerp the position toward the joint |
| `positionSmoothSpeed` | `number` | `10.0` | every frame | Lerp factor = `min(1, speed × deltaTime)` |
| `useRotationSmoothing` | `boolean` | `true` | every frame | Slerp the rotation toward the joint |
| `rotationSmoothSpeed` | `number` | `8.0` | every frame | Slerp factor = `min(1, speed × deltaTime)` |
| `enablePosition` | `boolean` | `true` | every frame | Follow the joint position |
| `enableRotation` | `boolean` | `true` | every frame | Follow the joint rotation |
| `hideWhenNotTracked` | `boolean` | `true` | on tracking change | Set `targetObject.enabled` from the tracking state |
| `debugMode` | `boolean` | `false` (prefab: `true`) | in `onAwake` + events | Print hand found/lost and tracking started/stopped |
| `enableLogging` | `boolean` | `false` | throughout | General logging, including per-frame joint positions (verbose) |
| `enableLoggingLifecycle` | `boolean` | `false` | throughout | Lifecycle logging (`onAwake`, every update) |

### Public methods

| Method | Effect |
|---|---|
| `setHand(side: string): void` | Sets `handSide`, re-resolves the SIK hand and moves the found/lost subscriptions to it (the previous hand's subscriptions are removed). With `hideWhenNotTracked`, re-shows a hidden target when the new hand is already tracked |
| `setTarget(target: SceneObject): void` | Sets `targetObject` (empty = host) and re-caches its transform immediately |
| `refresh(): void` | Re-reads `targetObject` and `handSide` immediately after plain assignment (otherwise picked up on the next update) |
| `setJoint(joint: string): void` | Sets `handJoint` (applies on the next frame) |
| `setPositionOffset(offset: vec3): void` | Sets `positionOffset` |
| `setRotationOffset(offset: vec3): void` | Sets `rotationOffset` (degrees) |
| `isHandTracked(): boolean` | `true` when the current hand is tracked, `false` if no hand is resolved |

The component exposes no events. For tracking events, subscribe to the SIK hand
directly (`SIK.HandInputData.getHand("right").onHandFound` / `onHandLost`).

### Lifecycle

1. `onAwake`: create the logger, default `targetObject` to the host, cache its
   transform, resolve the hand from `handSide` (`getHand("left"|"right")`,
   `getDominantHand()`, `getNonDominantHand()`), and subscribe to
   `onHandFound` / `onHandLost`.
2. Each `UpdateEvent` (bound by the SnapDecorators `@bindUpdateEvent`): re-resolve
   the target / hand if `targetObject` / `handSide` were reassigned. When the
   tracking state changes (including on the first frame), apply
   `hideWhenNotTracked`. If the hand is tracked, look up the joint and write the
   world position and/or rotation. The first write after the hand is found (or
   the target/hand changes) snaps to the joint without smoothing.
3. A target that is the host itself stops this update loop while hidden; it is
   re-shown by SIK `onHandFound`, or by `setHand()` onto an already-tracked hand.

## `HandSide` (enum)

`Left = "left"`, `Right = "right"`, `Dominant = "dominant"`, `NonDominant = "nondominant"`.

## `HandJoint` (enum, 25 members)

| Member | Value | Member | Value |
|---|---|---|---|
| `Wrist` | `wrist` | | |
| `ThumbBase` | `thumbToWrist` | `ThumbKnuckle` | `thumbKnuckle` |
| `ThumbMid` | `thumbMidJoint` | `ThumbTip` | `thumbTip` |
| `IndexBase` | `indexToWrist` | `IndexKnuckle` | `indexKnuckle` |
| `IndexMid` | `indexMidJoint` | `IndexUpper` | `indexUpperJoint` |
| `IndexTip` | `indexTip` | `MiddleBase` | `middleToWrist` |
| `MiddleKnuckle` | `middleKnuckle` | `MiddleMid` | `middleMidJoint` |
| `MiddleUpper` | `middleUpperJoint` | `MiddleTip` | `middleTip` |
| `RingBase` | `ringToWrist` | `RingKnuckle` | `ringKnuckle` |
| `RingMid` | `ringMidJoint` | `RingUpper` | `ringUpperJoint` |
| `RingTip` | `ringTip` | `PinkyBase` | `pinkyToWrist` |
| `PinkyKnuckle` | `pinkyKnuckle` | `PinkyMid` | `pinkyMidJoint` |
| `PinkyUpper` | `pinkyUpperJoint` | `PinkyTip` | `pinkyTip` |

The thumb has no `Upper` joint.

## Prefab: `HandAttacher__PLACE_IN_SCENE.prefab`

- Root `HandAttacher__PLACE_IN_SCENE` carries the `HandAttacher` component:
  `handSide "right"`, `handJoint "indexTip"`, `positionOffset (0, 2, 0)`,
  `rotationOffset (2, 0, 0)`, smoothing on (10 / 8), `hideWhenNotTracked` on,
  `debugMode` on.
- `targetObject` is `HandAttacherDemo/Box`: a 3 cm cube with the package's `PBR.mat`
  (unit cube under the `HandAttacherDemo` group, which has scale 3).

Demo assets: `Materials/PBR.mat` uses `Shaders/pbr.graphShader` with
`Textures/Base.png` (`baseTex`), `Textures/Normal.png` (`normalTex`) and
`Textures/MaterialParams.png` (`materialParamsTex`). They only style the demo box
and are not part of the API.

## Prefab layout

`HandAttacher__PLACE_IN_SCENE.prefab` (root at the origin, scale 1, carrying the
`HandAttacher` component) has these children in order:

- `Guide` (local 0, 0, −100): the guide panel (GuideDismissPanel + UIKit Frame,
  `GuideText`, `OkButton`).
- `ExampleCarousel`: the carousel, with one example (no Next / Previous buttons,
  only minimize).
- `HandAttacherDemo` (scale 3): the demo content, the `Box` target.

## Demo scaffolding (`Example/`)

These scripts ship in `HandAttacher.lspkg/Example/` and are wired inside
`HandAttacher__PLACE_IN_SCENE.prefab`. They only present the demo, and the
HandAttacher script doesn't need them.

| Object / script | Class | Key inputs |
|---|---|---|
| `Guide`: `Example/GuideDismissPanel/GuideDismissPanel.ts` | `GuideDismissPanel` | `hideUntilDismissed: SceneObject[]` lists the objects hidden until "Ok, I understood" is pressed (here: `ExampleCarousel`, `HandAttacherDemo`). `buttonLabel: string = "Ok, I understood"` is only used when the panel is built at runtime |
| `ExampleCarousel`: `Example/ExampleCarousel/ExampleCarousel.ts` | `ExampleCarousel` | `examples: SceneObject[]` (here the single `HandAttacherDemo`), `exampleInfo: string[]` (one line per example), `steps: SceneObject[]`, `stepInfo: string[] = []` (text per step, in the same order as `steps`; empty entries fall back to the example's info), `startIndex: number = 0`, `previousLabel` / `nextLabel`, `examplesPushBack: number = 20`, `anchorExamples: boolean = true` (off here), `startMinimized: boolean = false`, `extraPanelDrop: number = 0` |

Both inputs point at the `HandAttacherDemo` group rather than the prefab root,
because hiding the root would also hide the guide and the carousel. They also
don't point at `Box` directly, because `hideWhenNotTracked` toggles `Box.enabled`
itself and would show it while the guide is up.

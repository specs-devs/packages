# Solvers components

[← Agent usage index](../README.md)

## Use when

Use this as the import, input and method index after picking a solver in
[api-status.md](api-status.md). Everything here comes from the scripts in this
package revision.

## Conventions

- TS import prefix: `Solvers.lspkg/Scripts/TS/`. JS twins live in
  `Solvers.lspkg/Scripts/JS/`. Attach them as script assets in the Inspector;
  they are not modules.
- All units are Lens Studio world units (cm) and degrees.
- Every TS solver binds `OnStartEvent` and `UpdateEvent` with the SnapDecorators
  `@bindStartEvent` / `@bindUpdateEvent` decorators, and does its work in
  `UpdateEvent`, every frame. `onAwake` only creates the logger (SharpTurnTS
  also sizes its buffer there).
- `target` can be assigned at any time. Solvers that prepare state at start
  (TetherTS, TetherBetweenAngleRangeTS, DistanceEventsTS) do it on the first
  update that has a target if there was none at start. The one-time
  "No target set" log at start is harmless in that case.
- Every TS solver also has `enableLogging: boolean = false` and
  `enableLoggingLifecycle: boolean = false` (Utilities `Logger`). Both are read
  only in `onAwake`. The JS twins do not have these inputs.
- `target` inputs are `@allowUndefined`. No solver falls back to the camera, so
  assign one.
- Create TS solvers from code with `createComponent(<Class>.getTypeName())`.
  Inputs are plain public fields: assign them after creation, unless the
  component notes say a field is read in `onAwake`.

## Current API

### BillboardTS

Import: `Solvers.lspkg/Scripts/TS/BillboardTS` · JS twin: `Scripts/JS/BillboardJS.js`

| Input | Type | Default | Meaning |
|---|---|---|---|
| `lookAway` | `boolean` | `true` | `false`: the object's local +Z points toward the target. `true`: it points away from it. |
| `target` | `SceneObject` | — | object to face (usually the camera) |

Public method: `billboarding(): void`, which runs every frame. Rotation is
yaw-only (XZ plane), set in world space, and slerped at a fixed
`getDeltaTime() * 5`. There is no speed input.

### TetherTS

Import: `Solvers.lspkg/Scripts/TS/TetherTS` · JS twin: `Scripts/JS/TetherJS.js`

| Input | Type | Default | Meaning |
|---|---|---|---|
| `target` | `SceneObject` | — | object to follow |
| `offset` | `vec3` | `(0,0,0)` | desired position relative to the target (see the modes below) |
| `lerpSpeed` | `number` | `5.0` | world-position lerp factor per second, clamped to 1 per frame |
| `verticalDistanceFromTarget` | `number` | `0.1` | recompute the goal when \|content.y − target.y\| exceeds this |
| `horizontalDistanceFromTarget` | `number` | `0.1` | recompute the goal when the XZ distance content↔target exceeds this |
| `reorientDuringTargetRotation` | `boolean` | `true` | apply `offset` along the target's axes; `false` = world-space offset |
| `flattenDuringTargetRotation` | `boolean` | `true` | with reorient: use the target's yaw-flattened right/forward, and `offset.y` as world up |

Offset modes: reorient + flatten (the default) puts the goal at
`targetPos + flatRight·x + up·y + flatForward·z`, where forward is the
target's +Z (behind a camera). Reorient without flatten uses
`targetRot · offset`. Without reorient, the goal is `targetPos + offset`.
The thresholds compare the content's distance **to the target**, not to the
goal. Any non-zero offset larger than the thresholds therefore re-targets every
frame, so it behaves as a smoothed follow. No public methods in TS.

### TetherBetweenAngleRangeTS

Import: `Solvers.lspkg/Scripts/TS/TetherBetweenAngleRangeTS` · JS twin: `Scripts/JS/TetherBetweenAngleRangeJS.js`

| Input | Type | Default | Meaning |
|---|---|---|---|
| `target` | `SceneObject` | — | object to follow |
| `offset` | `vec3` | `(0,0,-100)` | goal = `targetPos + right·x + forward·z`, with `y` added in world space (1 m in front of a camera by default) |
| `lerpSpeed` | `number` | `5.0` | position lerp factor per second |
| `angleThreshold` | `number` | `45.0` | degrees between the target's view direction and the content (on XZ) before it repositions |
| `verticalDistanceThreshold` | `number` | `150.0` | vertical content↔target distance that triggers a reposition |
| `horizontalDistanceThreshold` | `number` | `150.0` | horizontal content↔target distance that triggers a reposition |
| `showDebug` | `boolean` | `false` | print the angle and distance evaluation every frame (log flood) |

It repositions when **any** threshold is exceeded, and lerps toward the last
goal every frame. This is the "lazy follow" variant: content stays put until
you look about 45° away. No public methods in TS.

### MatchTransformTS

Import: `Solvers.lspkg/Scripts/TS/MatchTransformTS` · JS twin: `Scripts/JS/MatchTransformJS.js`

| Input | Type | Default | Meaning |
|---|---|---|---|
| `target` | `SceneObject` | — | object to copy |
| `positionOffset` | `vec3` | `(0,0,0)` | **world-space** offset added to the target position |
| `usePositionLerp` | `boolean` | `true` | `false` = snap position each frame |
| `positionLerpSpeed` | `number` | `1.0` | position lerp factor per second |
| `rotationLerpSpeed` | `number` | `1.0` | rotation slerp factor per second, clamped to 1 per frame |
| `scaleLerpSpeed` | `number` | `1.0` | scale lerp factor per second; `0` freezes scale |
| `constrainPositionX/Y/Z` | `boolean` | `false` | `true` keeps this object's own value on that axis |
| `constrainRotationX/Y/Z` | `boolean` | `false` | same, on Euler axes (via `MathUtils.quaternionToEuler`) |
| `constrainScaleX/Y/Z` | `boolean` | `false` | same, for scale |

It writes position, rotation and scale in world space (scale copies the
target's world scale into this object's world scale). All three lerp factors
are clamped to `0..1` per frame, so large speeds snap instead of overshooting. Rotation is always
matched: to stop matching it, set all three `constrainRotation*`. No public
methods in TS.

### ScaleOverDistanceLinearTS

Import: `Solvers.lspkg/Scripts/TS/ScaleOverDistanceLinear` (file name has no
`TS` suffix) · JS twin: `Scripts/JS/ScaleOverDistanceLinearJS.js`

| Input | Type | Default | Meaning |
|---|---|---|---|
| `target` | `SceneObject` | — | object to measure from |
| `minDistance` | `number` | `1.0` | distance mapped to `minScale` (the prefab uses `0`) |
| `maxDistance` | `number` | `10.0` | distance mapped to `maxScale` (the prefab uses `100`) |
| `minScale` | `number` | `0.5` | uniform local scale at or below `minDistance` |
| `maxScale` | `number` | `2.0` | uniform local scale at or above `maxDistance` |

It clamps the distance and remaps it linearly, then calls
`setLocalScale(vec3(s,s,s))` every frame, which overrides any authored scale.
Keep `maxDistance` greater than `minDistance`. If they are equal, the scale
steps from `minScale` to `maxScale` at that distance. No public methods in TS.

### DistanceEventsTS and DistanceRange

Import: `Solvers.lspkg/Scripts/TS/DistanceEventsTS` (exports `DistanceEventsTS`
and `DistanceRange`) · JS twin: `Scripts/JS/DistanceEventsJS.js`

| Input | Type | Default | Meaning |
|---|---|---|---|
| `target` | `SceneObject` | — | object to measure from (3D distance) |
| `distances` | `number[]` | `[]` | Inspector thresholds |
| `triggerOnGreaterThan` | `boolean` | `true` | `true`: range `[d, Number.MAX_VALUE]`; `false`: `[0, d]` |
| `events` | `ScriptComponent[]` | `[]` | script per threshold that owns the callback |
| `eventFunctions` | `string[]` | `[]` | method name called on `events[i]` when entering range `i` |

Inspector events fire once on entering a range, and re-arm when the range is
exited. The Inspector ranges are created in `OnStartEvent`, or on the first
update after `target` is assigned if it was unset at start. Ranges added from
code with `addRange()` are kept either way. The three arrays must have equal length, or nothing is registered (it
logs an error).

| Method | Notes |
|---|---|
| `addRange(min: number, max: number): DistanceRange` | registers a range that is checked every frame |
| `clearRanges(): void` | removes all ranges, including the Inspector ones |
| `resetTriggeredDistances(): void` | re-arms the Inspector one-shot callbacks |
| `getDistanceToTarget(): number` | distance computed in the last update |

`DistanceRange` has public `minDistance` and `maxDistance`, and `update(distance)`
(called by the owner). Its listeners are
`addOnEnterRangeListener(cb: () => void)`,
`addOnExitRangeListener(cb: () => void)` and
`addOnPercentInsideRangeListener(cb: (percent: number) => void)`, plus the
matching `remove…Listener`. The percent listener fires **every frame** while
inside: 0 at `max`, 1 at `min`. Both ends are inclusive.

### DistanceEventsCallbacks

Import: `Solvers.lspkg/Scripts/TS/DistanceEventsCallbacks` · JS twin: `Scripts/JS/DistanceEventsCallbacks.js`

Sample callback holder for `events` / `eventFunctions`. Its methods only print:
`onDistanceThresholdCrossed`, `onReturnWithinThreshold`, `showElement`,
`hideElement`, `triggerAnimation`, `playSound`, `onCallback1`, `onCallback2`,
`onCallback3`. Replace it with your own component that exposes public
zero-argument methods.

### InBetweenRotationUtilityTS

Import: `Solvers.lspkg/Scripts/TS/InBetweenRotationUtilityTS` · JS twin: `Scripts/JS/InBetweenRotationUtilityJS.js`

| Input | Type | Default | Meaning |
|---|---|---|---|
| `target1` | `SceneObject` | — | first object (its world forward, +Z, is used) |
| `target2` | `SceneObject` | — | second object |

Every frame it sets this object's world rotation to the 50 % slerp of the two
targets' look rotations (world up). Public helpers:
`getInBetweenRotation(dirA: vec3, dirB: vec3): quat` and
`getInBetweenRotationFromTransforms(a: SceneObject, b: SceneObject): quat`.

### SharpTurnTS

Import: `Solvers.lspkg/Scripts/TS/SharpTurnTS` · JS twin: `Scripts/JS/SharpTurnJS.js`

| Input | Type | Default | Meaning |
|---|---|---|---|
| `step` | `number` | `10` | samples back used for the "old" direction |
| `frameCount` | `number` | `30` | ring-buffer size (at least 2); changing it at runtime rebuilds the buffer |
| `minVertexDistance` | `number` | `0.001` | minimum movement (cm) before a new sample is recorded |
| `debug` | `boolean` | `false` | print the dot product per sample |

It tracks **its own** SceneObject's world position. A turn fires when the dot
product of the newest and older directions is below `-0.1`. Detection only
runs while the buffer index is at least `step`, so it pauses briefly after each
wrap of the ring buffer.
Events: `addOnTurnListener(cb: () => void)` and `removeOnTurnListener(cb)`.

### SolversShowcase (demo driver)

Import: `Solvers.lspkg/Scripts/TS/SolversShowcase`. On the package prefab it
sits on the `Solvers` child, which holds the `[…]`-named example groups. Put it
on the object that holds those groups. It
creates a red "Head pose" sphere, retargets every solver in the active group to
that sphere, and cycles the groups. Solvers with a `target` input are matched by
component type, so a solver whose `target` is unset is retargeted too.

| Input | Type | Default | Meaning |
|---|---|---|---|
| `interval` | `number` | `8` | seconds per example |
| `autoPlay` | `boolean` | `true` | `false`: follow whichever group is enabled (for example by a carousel) |
| `showLabels` | `boolean` | `false` | `true`: float the solver name and a "Head pose" label above the sphere. Leave off when a panel already names each solver |

It uses `WorldCameraFinderProvider` from SIK. It is demo code: it duck-types
solver fields (`target`, `offset`, `target1`, …) and overrides offsets at
runtime. Do not copy that pattern into a Lens.

## Demo scaffolding (`Example/`)

The prefab carries its own demo UI, shipped in `Solvers.lspkg/Example/`. These
are demo scripts, not solver API: reuse them for a demo, not as a Lens pattern.
Both need SIK and UIKit in the scene.

### ExampleCarousel

`Example/ExampleCarousel/ExampleCarousel.ts`, on the prefab's `ExampleCarousel`
child. A UIKit panel with the example name, a description, Previous / Next and
a minimize button. It shows one step at a time and moves the examples in front
of the user's head pose.

| Input | Type | Default | Meaning |
|---|---|---|---|
| `examples` | `SceneObject[]` | `[]` | example roots; the prefab lists its `Solvers` child |
| `exampleInfo` | `string[]` | `[]` | description per example |
| `steps` | `SceneObject[]` | `[]` | sub-examples stepped through one at a time; the prefab lists the nine `[…]` solver groups |
| `stepInfo` | `string[]` | `[]` | description per step |
| `startIndex` | `number` | `0` | step shown first |
| `previousLabel` / `nextLabel` | `string` | `"Previous"` / `"Next"` | button labels |
| `examplesPushBack` | `number` | `20` | extra distance (cm) of the examples behind the panel |
| `anchorExamples` | `boolean` | `true` | move the examples to the head pose at start |
| `startMinimized` | `boolean` | `false` | start collapsed to the title bar |
| `extraPanelDrop` | `number` | `0` | extra drop (cm) of the panel |

### GuideDismissPanel

`Example/GuideDismissPanel/GuideDismissPanel.ts`, on the prefab's `Guide`
child (next to a UIKit `Frame`, with a `GuideText` and an `OkButton` child).
It shows the guide in front of the user and closes it on "Ok, I understood".

| Input | Type | Default | Meaning |
|---|---|---|---|
| `buttonLabel` | `string` | `"Ok, I understood"` | button label when the panel is built at runtime |
| `hideUntilDismissed` | `SceneObject[]` | `[]` | objects hidden while the guide shows; the prefab lists `ExampleCarousel` and `Solvers`, never the prefab root |

This is not the older `Scripts/GuideDismissPanel/GuideDismissPanel` (Internal,
unreferenced; see [api-status](api-status.md#internal)). Both have the same
class name, so pick the script asset by path.

## JS twins

The JS files expose the same inputs (without `enableLogging*`) through
`//@input` and assign helpers on `script`, for example `script.addRange`,
`script.addOnTurnListener` and `script.getDistanceToTarget`. Some helpers that
are private in TS are public in JS. See [api-status](api-status.md#ts--js-parity).
From TS, a JS twin has no types. Prefer the TS component.

## Demo assets

Visuals for the example spheres and boxes; no solver script references them.

- `Materials/`: `SimpleDiffuse.mat`, `Simple PBR.mat`
- `Shaders/`: `Simple Diffuse.graphShader`, `Simple Diffuse 2.graphShader`,
  `simple_pbr.graphShader`, `simple_pbr 2.graphShader`
- `Meshes/`: `Box.mesh`, `Sphere.mesh`
- `Textures/`: `Base.png`, `Base 2.png`

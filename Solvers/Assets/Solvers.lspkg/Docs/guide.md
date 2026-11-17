# Solvers guide and recipes

[← Agent usage index](../README.md)

## Use when

Read this when you need to know how a solver behaves, or want a longer recipe
than [examples](examples.md). This is the tutorial content from earlier
README revisions, corrected for this package revision: import paths, creation
by type name, cm units and the Distance Events start order. Exact inputs and
defaults are in [components](components.md).

## How each solver works

### Billboard

Rotates the object around world Y only, so it stays upright while facing (or,
with `lookAway = true`, facing away from) the target. It computes the direction
to the target on the XZ plane, converts it to a yaw with `atan2`, and slerps
the world rotation toward it at a fixed rate of `5 × deltaTime`. Use it for
labels, sprites and panels that must not tilt when the user looks up or down.

### Tether

Computes a goal position from the target position and `offset`. With
`reorientDuringTargetRotation`, the offset follows the target's axes, and with
`flattenDuringTargetRotation` they are yaw-flattened so the content stays
level with the horizon. Otherwise the offset is in world space. The content
lerps to the goal at `lerpSpeed`. The goal is recomputed whenever the content's
vertical or horizontal distance to the target exceeds the thresholds. With
the defaults (0.1 cm), that is every frame, so `TetherTS` acts as a smoothed
follow.

### Tether Between Angle Range

The same idea with a lazy trigger. The goal is recomputed only when the
content is more than `angleThreshold` degrees off the target's view direction
on the XZ plane, or farther than the vertical/horizontal distance thresholds
(150 cm). Between triggers, the content stays where it is. This is the usual
choice for "keep this panel nearby, but don't chase my head".

### Match Transform

Copies the target's world position (plus a world-space `positionOffset`),
world rotation and scale every frame. Each channel has its own lerp speed. Per
axis, a `constrain*` flag keeps the object's current value instead. Use it for
followers, mirrors, and objects that track another object without being
parented to it.

### Distance Events

Measures the 3D distance to the target every frame and updates every
registered `DistanceRange`. A range fires enter and exit once per crossing,
and a percent value every frame while inside (0 at the far edge, 1 at the near
edge). The Inspector arrays create one range per threshold, either
`[d, ∞)` or `[0, d]` depending on `triggerOnGreaterThan`, which calls a named
method once per entry. Use it for proximity reveals, audio zones and
"come closer" hints.

### Scale Over Distance (linear)

Clamps the distance to `[minDistance, maxDistance]`, remaps it linearly to
`[minScale, maxScale]`, and applies that as a uniform local scale. Use
`minScale < maxScale` to keep a roughly constant apparent size (bigger when
farther), or the reverse for a grow-as-you-approach effect.

### In-Between Rotation

Builds a look rotation from each target's world forward (+Z) and applies the
50 % slerp. Useful for an object that should point "between" two things, for
example a pointer between the head and a hand.

### Sharp Turn

Keeps a ring buffer of its own object's positions. It compares the newest
movement direction with the direction from `step` samples ago and fires the
turn listeners when their dot product drops below −0.1. That is roughly a turn
sharper than 95°.

## Combining solvers

Each solver writes its channel every frame, so combine solvers that write
different channels. Tether (position) + Billboard (rotation) is the classic
floating menu. The tethers never write rotation:
`reorientDuringTargetRotation` only changes which axes the offset uses, so the
billboard alone drives facing. Do not stack two position writers or two rotation
writers on one object. Put the second solver on a parent or child instead.

## Recipes

All snippets assume `@input camera: SceneObject` wired to the Camera object.

### Floating menu (tether + billboard)

```ts
import {BillboardTS} from "Solvers.lspkg/Scripts/TS/BillboardTS"
import {TetherTS} from "Solvers.lspkg/Scripts/TS/TetherTS"

@component
export class FloatingMenu extends BaseScriptComponent {
  @input camera: SceneObject
  @input menuPanel: SceneObject

  private tether: TetherTS

  onAwake(): void {
    this.tether = this.menuPanel.createComponent(TetherTS.getTypeName()) as TetherTS
    this.tether.target = this.camera
    this.tether.offset = new vec3(30, 0, -80) // right and in front, cm
    this.tether.reorientDuringTargetRotation = true
    this.tether.lerpSpeed = 6

    const billboard = this.menuPanel.createComponent(BillboardTS.getTypeName()) as BillboardTS
    billboard.target = this.camera
    billboard.lookAway = false
  }

  repositionToLeft(): void {
    this.tether.offset = new vec3(-30, 0, -80)
  }
}
```

### Info display that stays level with the horizon

```ts
import {TetherTS} from "Solvers.lspkg/Scripts/TS/TetherTS"

@component
export class TetheredInfoDisplay extends BaseScriptComponent {
  @input camera: SceneObject
  @input infoPanel: SceneObject

  onAwake(): void {
    const tether = this.infoPanel.createComponent(TetherTS.getTypeName()) as TetherTS
    tether.target = this.camera
    tether.offset = new vec3(15, -20, -60) // 15 right, 20 below, 60 in front (cm)
    tether.reorientDuringTargetRotation = true
    tether.flattenDuringTargetRotation = true // ignore head pitch and roll
    tether.lerpSpeed = 8
  }
}
```

### Follower that copies position only

```ts
import {MatchTransformTS} from "Solvers.lspkg/Scripts/TS/MatchTransformTS"

@component
export class FollowerObject extends BaseScriptComponent {
  @input leader: SceneObject

  onAwake(): void {
    const matcher = this.sceneObject.createComponent(MatchTransformTS.getTypeName()) as MatchTransformTS
    matcher.target = this.leader
    matcher.positionOffset = new vec3(0, 30, 50) // world space: above and +Z
    matcher.usePositionLerp = true
    matcher.positionLerpSpeed = 3
    matcher.constrainRotationX = true
    matcher.constrainRotationY = true
    matcher.constrainRotationZ = true
    matcher.scaleLerpSpeed = 0
  }
}
```

### Animated offset around a moving object

`positionOffset` is read every frame, so you can animate it:

```ts
import {MatchTransformTS} from "Solvers.lspkg/Scripts/TS/MatchTransformTS"

@component
export class OrbitFollower extends BaseScriptComponent {
  @input pathObject: SceneObject

  private matcher: MatchTransformTS
  private time = 0

  onAwake(): void {
    this.matcher = this.sceneObject.createComponent(MatchTransformTS.getTypeName()) as MatchTransformTS
    this.matcher.target = this.pathObject
    this.matcher.positionLerpSpeed = 2
    this.matcher.constrainPositionY = true // keep own height
    this.matcher.constrainRotationX = true
    this.matcher.constrainRotationY = true
    this.matcher.constrainRotationZ = true
    this.matcher.scaleLerpSpeed = 0

    this.createEvent("UpdateEvent").bind(() => {
      this.time += getDeltaTime()
      const r = 50 // cm
      this.matcher.positionOffset = new vec3(Math.cos(this.time) * r, 20, Math.sin(this.time) * r)
    })
  }
}
```

### Multi-zone proximity reveal

Ranges are added while `target` is unset, and `target` is assigned on the first
update (see [cheat sheet](cheat-sheet.md) rule 6):

```ts
import {DistanceEventsTS} from "Solvers.lspkg/Scripts/TS/DistanceEventsTS"

@component
export class ProximityZones extends BaseScriptComponent {
  @input camera: SceneObject
  @input level1Content: SceneObject
  @input level2Content: SceneObject
  @input level3Content: SceneObject

  onAwake(): void {
    const events = this.sceneObject.createComponent(DistanceEventsTS.getTypeName()) as DistanceEventsTS
    const zones: [number, number, SceneObject][] = [
      [300, 500, this.level1Content],
      [150, 300, this.level2Content],
      [0, 150, this.level3Content]
    ]
    for (const [min, max, content] of zones) {
      content.enabled = false
      const range = events.addRange(min, max)
      range.addOnEnterRangeListener(() => (content.enabled = true))
      range.addOnExitRangeListener(() => (content.enabled = false))
    }

    let armed = false
    this.createEvent("UpdateEvent").bind(() => {
      if (!armed) {
        armed = true
        events.target = this.camera
      }
    })
  }
}
```

Adjacent ranges share their boundary value (both ends are inclusive), so
exactly at 150 cm or 300 cm, two zones can be "inside" at once.

### Distance-driven material or scale effect

Use a percent listener to drive any value smoothly. For example, the
`baseColor` of a material you own:

```ts
import {DistanceEventsTS} from "Solvers.lspkg/Scripts/TS/DistanceEventsTS"

@component
export class ProximityTint extends BaseScriptComponent {
  @input camera: SceneObject
  @input visual: RenderMeshVisual

  onAwake(): void {
    const events = this.sceneObject.createComponent(DistanceEventsTS.getTypeName()) as DistanceEventsTS
    const range = events.addRange(50, 200)
    range.addOnPercentInsideRangeListener((p) => {
      // p: 0 at 200 cm, 1 at 50 cm
      this.visual.mainPass.baseColor = new vec4(1, 1 - p, 1 - p, 1)
      const s = 1 + 0.2 * p
      this.sceneObject.getTransform().setLocalScale(new vec3(s, s, s))
    })
    range.addOnExitRangeListener(() => {
      this.visual.mainPass.baseColor = new vec4(1, 1, 1, 1)
      this.sceneObject.getTransform().setLocalScale(vec3.one())
    })

    let armed = false
    this.createEvent("UpdateEvent").bind(() => {
      if (!armed) {
        armed = true
        events.target = this.camera
      }
    })
  }
}
```

`baseColor` exists only on materials whose shader exposes it. Material
parameters are engine and shader API: see the Lens Studio documentation.

### Constant apparent size

```ts
import {ScaleOverDistanceLinearTS} from "Solvers.lspkg/Scripts/TS/ScaleOverDistanceLinear"

@component
export class DepthScaledSprite extends BaseScriptComponent {
  @input camera: SceneObject

  onAwake(): void {
    const scaler = this.sceneObject.createComponent(
      ScaleOverDistanceLinearTS.getTypeName()
    ) as ScaleOverDistanceLinearTS
    scaler.target = this.camera
    scaler.minDistance = 50 // cm
    scaler.maxDistance = 500
    scaler.minScale = 0.5
    scaler.maxScale = 5
  }
}
```

Linear scaling only approximates constant angular size. It is exact only when
`minScale / minDistance == maxScale / maxDistance`, as in this example.

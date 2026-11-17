# Solvers minimal examples

[← Agent usage index](../README.md)

## Use when

Copy the smallest example that establishes the package wiring. Do not treat this
file as an application template.

## Prefab (no code)

1. Drag `Solvers.lspkg/Solvers__PLACE_IN_SCENE.prefab` into the Scene
   Hierarchy. It runs the full demo: a guide, then a carousel through the
   solvers. Each `[…]` group under its `Solvers` child is one solver, with a TS
   and a JS copy.
2. To reuse one solver group, drag it out of the prefab and keep only the group
   you need enabled. Then set each solver's `target` in the
   Inspector, usually to the Camera object.
3. To reuse a solver on your own object, add it with **Add Component → Script**
   and choose the TS script asset (for example `TetherTS`).

## Billboard + tether a panel in front of the camera

```ts
import {BillboardTS} from "Solvers.lspkg/Scripts/TS/BillboardTS"
import {TetherTS} from "Solvers.lspkg/Scripts/TS/TetherTS"

@component
export class FollowPanel extends BaseScriptComponent {
  @input camera: SceneObject
  @input panel: SceneObject

  onAwake(): void {
    const tether = this.panel.createComponent(TetherTS.getTypeName()) as TetherTS
    tether.target = this.camera
    tether.offset = new vec3(0, -10, -60) // cm: 10 below, 60 in front (camera +Z is behind it)
    tether.lerpSpeed = 6

    const billboard = this.panel.createComponent(BillboardTS.getTypeName()) as BillboardTS
    billboard.target = this.camera
    billboard.lookAway = false // local +Z faces the camera
  }
}
```

Tether writes position and Billboard writes rotation, so they can share an
object. Whether `lookAway` should be `true` or `false` depends on which side of
your mesh is the front. The default Lens Studio plane and Text face +Z.

## Lazy follow (reposition only when the user looks away)

```ts
import {TetherBetweenAngleRangeTS} from "Solvers.lspkg/Scripts/TS/TetherBetweenAngleRangeTS"

@component
export class LazyFollow extends BaseScriptComponent {
  @input camera: SceneObject

  onAwake(): void {
    const tether = this.sceneObject.createComponent(
      TetherBetweenAngleRangeTS.getTypeName()
    ) as TetherBetweenAngleRangeTS
    tether.target = this.camera
    tether.offset = new vec3(0, 0, -80)
    tether.angleThreshold = 35
  }
}
```

## Distance ranges from code

Ranges added with `addRange()` are kept when `DistanceEventsTS` sets up its
Inspector ranges, so `target` can be assigned at any time. This example
assigns it on the first update:

```ts
import {DistanceEventsTS} from "Solvers.lspkg/Scripts/TS/DistanceEventsTS"

@component
export class ProximityReveal extends BaseScriptComponent {
  @input camera: SceneObject
  @input detail: SceneObject

  private events: DistanceEventsTS
  private armed = false

  onAwake(): void {
    this.events = this.sceneObject.createComponent(DistanceEventsTS.getTypeName()) as DistanceEventsTS
    const near = this.events.addRange(0, 80) // cm
    near.addOnEnterRangeListener(() => (this.detail.enabled = true))
    near.addOnExitRangeListener(() => (this.detail.enabled = false))
    near.addOnPercentInsideRangeListener((p) => {
      const s = 0.5 + 0.5 * p // p: 0 at 80 cm, 1 at 0 cm
      this.detail.getTransform().setLocalScale(new vec3(s, s, s))
    })
    this.detail.enabled = false

    this.createEvent("UpdateEvent").bind(() => {
      if (!this.armed) {
        this.armed = true
        this.events.target = this.camera
      }
    })
  }
}
```

At start, the component logs "No target set for DistanceEvents" once. That is
expected with this pattern.

## Inspector-driven distance events

On a `DistanceEventsTS`, fill `distances` (for example `100, 200`), `events`
(one ScriptComponent per distance) and `eventFunctions` (the method name for
each), with equal lengths. Any component with public zero-argument methods
works:

```ts
@component
export class ZoneCallbacks extends BaseScriptComponent {
  @input farHint: SceneObject

  showFarHint(): void {
    this.farHint.enabled = true
  }
}
```

With `triggerOnGreaterThan = true`, `showFarHint` runs once each time the
distance goes above the threshold.

## Sharp turn listener

```ts
import {SharpTurnTS} from "Solvers.lspkg/Scripts/TS/SharpTurnTS"

@component
export class TurnFeedback extends BaseScriptComponent {
  // SharpTurnTS is on this object in the Inspector (frameCount set there).
  @input sharpTurn: SharpTurnTS

  onAwake(): void {
    this.createEvent("OnStartEvent").bind(() => {
      this.sharpTurn.addOnTurnListener(() => print("sharp turn"))
    })
  }
}
```

`SharpTurnTS` watches the movement of **its own** object. Put it on the object
that moves (a grabbed item, or a hand-attached object), not on the camera
rig's parent.

## Match position only

```ts
import {MatchTransformTS} from "Solvers.lspkg/Scripts/TS/MatchTransformTS"

@component
export class FollowBelow extends BaseScriptComponent {
  @input leader: SceneObject

  onAwake(): void {
    const match = this.sceneObject.createComponent(MatchTransformTS.getTypeName()) as MatchTransformTS
    match.target = this.leader
    match.positionOffset = new vec3(0, -15, 0) // world space
    match.positionLerpSpeed = 4
    match.constrainRotationX = true
    match.constrainRotationY = true
    match.constrainRotationZ = true
    match.scaleLerpSpeed = 0 // keep own scale
  }
}
```

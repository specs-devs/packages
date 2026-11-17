# FaceMesh examples

[← Agent usage index](../README.md)

## Use when

Configure a follower without assuming automatic camera or landmark discovery.

Attach MatchTransformTS to the follower, assign its target, then optionally configure it from a consumer:

```typescript
import {MatchTransformTS} from "FaceMesh.lspkg/Scripts/MatchTransform"

@component
export class ConfigureFaceFollower extends BaseScriptComponent {
  @input follower: MatchTransformTS
  @input trackingTarget: SceneObject

  onAwake(): void {
    this.follower.target = this.trackingTarget
    this.follower.positionOffset = new vec3(0, 5, 0)
    this.follower.usePositionLerp = true
    this.follower.positionLerpSpeed = 5
    this.follower.constrainPositionX = true
  }
}
```

Use the native HeadBinding object as trackingTarget only after confirming tracking on your platform. This locks the follower's current world X; it does not lock it to target X. The offset points along world Y even if the head rotates.

## Prefab drop-in

Drag `FaceMesh.lspkg/FaceMesh__PLACE_IN_SCENE.prefab` into an empty Specs scene (no other camera): it brings the camera with Device Tracking, the ambient light, the face mesh, the onboarding guide and the example carousel. In a scene that already has a camera, unpack the prefab and move `Device Tracking`, `AmbientLight` and `Effects` onto your camera, then delete the prefab's `Camera` so one camera remains. To hide the effect at runtime, toggle `Effects`, not the prefab root or its `Camera`:

```typescript
@component
export class ToggleFaceMesh extends BaseScriptComponent {
  @input effects: SceneObject

  setVisible(visible: boolean): void {
    this.effects.enabled = visible
  }
}
```

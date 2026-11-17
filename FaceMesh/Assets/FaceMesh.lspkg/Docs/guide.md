# FaceMesh guide

[← Agent usage index](../README.md)

## Use when

Read retained follower tutorials for offsets, axis constraints and smoothing.

The source contract in the focused docs governs these examples. Contrary to the old feature description/Inspector hint, there is no default mainCamera target. MatchTransformTS performs no landmark discovery; the face-point recipes below get their targets from native `Head` components (`setAttachmentPointType`). Scale matching mixes target world scale with follower local scale; do not assume hierarchy independence. The native face mesh was verified in the Preview (face video input); the adapted follower recipes are not live-tested.

## Quick Start

Basic transform matching with smooth following:

```typescript
import {MatchTransformTS} from "FaceMesh.lspkg/Scripts/MatchTransform";

@component
export class FaceLandmarkAttacher extends BaseScriptComponent {
  @input targetLandmark: SceneObject; // a tracked object, e.g. the prefab's Camera / Effects / Head Binding
  @input objectToAttach: SceneObject;

  onAwake() {
    // Add MatchTransformTS component
    const matcher = this.objectToAttach.createComponent(MatchTransformTS.getTypeName()) as MatchTransformTS;
    matcher.target = this.targetLandmark;

    // Enable position matching with smooth lerp
    matcher.usePositionLerp = true;
    matcher.positionLerpSpeed = 5.0;

    // Enable rotation matching
    matcher.rotationLerpSpeed = 3.0;

    // Optional: Add position offset
    matcher.positionOffset = new vec3(0, 5, 0);
  }
}
```

## Script Highlights

### MatchTransform.ts

The core transform matching component that enables objects to follow and synchronize with target transforms. Implements granular control with separate constraint flags for each axis of position, rotation, and scale. Position matching supports world-space offsets and optional smooth lerping with configurable speed for natural movement. Rotation matching uses quaternion slerp interpolation with per-axis constraints applied in Euler space. Scale matching lerps between current and target scales with per-axis control. The component updates continuously via UpdateEvent to maintain synchronization. Includes helper methods for quaternion-to-Euler conversion and vector lerping with proper clamping. It has no default target: assign `target` explicitly (the Inspector hint mentions mainCamera, but no fallback is implemented).

## Core API Methods

Signature reference (not a runnable script):

```text
// Configuration inputs
@input target: SceneObject                    // Target to match (required; no default)
@input positionOffset: vec3                   // World-space offset from target
@input usePositionLerp: boolean              // Enable smooth position transitions
@input positionLerpSpeed: number             // Position lerp speed multiplier
@input rotationLerpSpeed: number             // Rotation slerp speed multiplier
@input scaleLerpSpeed: number                // Scale lerp speed multiplier

// Position constraints
@input constrainPositionX: boolean           // Lock X position axis
@input constrainPositionY: boolean           // Lock Y position axis
@input constrainPositionZ: boolean           // Lock Z position axis

// Rotation constraints
@input constrainRotationX: boolean           // Lock X rotation axis
@input constrainRotationY: boolean           // Lock Y rotation axis
@input constrainRotationZ: boolean           // Lock Z rotation axis

// Scale constraints
@input constrainScaleX: boolean              // Lock X scale axis
@input constrainScaleY: boolean              // Lock Y scale axis
@input constrainScaleZ: boolean              // Lock Z scale axis

// Internal methods
updatePosition(myTransform: Transform, targetTransform: Transform): void
updateRotation(myTransform: Transform, targetTransform: Transform): void
updateScale(myTransform: Transform, targetTransform: Transform): void
```

## Advanced Usage

### Face Point Follower with Offset

MatchTransformTS cannot find facial features itself. To follow a face point, give it a target that native face tracking moves: a SceneObject with a `Head` component (the same component as the prefab's `Head Binding`) set to one of the `AttachmentPointType` values (`HeadCenter`, `CandideCenter`, `TriangleBarycentric`, `LeftEyeballCenter`, `RightEyeballCenter`, `MouthCenter`, `Chin`, `Forehead`, `LeftForehead`, `RightForehead`, `LeftCheek`, `RightCheek`). There is no nose attachment point. Create the anchor under the same parent as the prefab's `Head Binding` (`Camera / Effects`) so it sits in the tracked camera's space:

```typescript
import {MatchTransformTS} from "FaceMesh.lspkg/Scripts/MatchTransform"

@component
export class ForeheadFollowerWithOffset extends BaseScriptComponent {
  @input trackingParent: SceneObject; // e.g. the prefab's Camera / Effects
  @input uiElement: SceneObject;
  @input uiOffset: vec3 = new vec3(0, 10, 5);

  onAwake() {
    const anchor = this.createFaceAnchor("ForeheadAnchor", AttachmentPointType.Forehead);

    const matcher = this.uiElement.createComponent(MatchTransformTS.getTypeName()) as MatchTransformTS;
    matcher.target = anchor;
    matcher.usePositionLerp = true;
    matcher.positionLerpSpeed = 8.0;
    matcher.positionOffset = this.uiOffset;

    // Only match position, not rotation
    matcher.rotationLerpSpeed = 0;
  }

  createFaceAnchor(name: string, point: AttachmentPointType): SceneObject {
    const anchor = global.scene.createSceneObject(name);
    anchor.setParent(this.trackingParent);
    const head = anchor.createComponent("Component.Head") as Head;
    head.faceIndex = 0;
    head.setAttachmentPointType(point);
    return anchor;
  }
}
```

### Selective Axis Matching

Match only specific axes while constraining others:

```typescript
import {MatchTransformTS} from "FaceMesh.lspkg/Scripts/MatchTransform"

@component
export class HorizontalOnlyFollower extends BaseScriptComponent {
  @input targetObject: SceneObject;
  @input followerObject: SceneObject;

  onAwake() {
    const matcher = this.followerObject.createComponent(MatchTransformTS.getTypeName()) as MatchTransformTS;
    matcher.target = this.targetObject;

    // Only follow X and Z (horizontal plane), lock Y (height)
    matcher.constrainPositionX = false;  // Follow X
    matcher.constrainPositionY = true;   // Lock Y
    matcher.constrainPositionZ = false;  // Follow Z

    // Smooth horizontal movement
    matcher.usePositionLerp = true;
    matcher.positionLerpSpeed = 6.0;

    // Don't match rotation or scale
    matcher.rotationLerpSpeed = 0;
    matcher.scaleLerpSpeed = 0;

    print("Horizontal-only follower active");
  }
}
```

### Multi-Object Face Attachment System

Attach multiple objects to different face points, each through its own `Head` anchor (see [Face Point Follower with Offset](#face-point-follower-with-offset)):

```typescript
import {MatchTransformTS} from "FaceMesh.lspkg/Scripts/MatchTransform"

@component
export class MultiFacialAttachments extends BaseScriptComponent {
  @input trackingParent: SceneObject; // e.g. the prefab's Camera / Effects
  @input leftEyeObject: SceneObject;
  @input rightEyeObject: SceneObject;
  @input chinObject: SceneObject;
  @input mouthObject: SceneObject;

  onAwake() {
    const attachments: AttachmentConfig[] = [
      {name: "LeftEye", point: AttachmentPointType.LeftEyeballCenter, object: this.leftEyeObject, offset: new vec3(0, 0, 1), lerpSpeed: 10.0},
      {name: "RightEye", point: AttachmentPointType.RightEyeballCenter, object: this.rightEyeObject, offset: new vec3(0, 0, 1), lerpSpeed: 10.0},
      {name: "Chin", point: AttachmentPointType.Chin, object: this.chinObject, offset: new vec3(0, -2, 2), lerpSpeed: 8.0},
      {name: "Mouth", point: AttachmentPointType.MouthCenter, object: this.mouthObject, offset: new vec3(0, 0, 2), lerpSpeed: 7.0}
    ];
    attachments.forEach((config) => this.attach(config));
  }

  attach(config: AttachmentConfig) {
    const anchor = global.scene.createSceneObject(config.name + "Anchor");
    anchor.setParent(this.trackingParent);
    const head = anchor.createComponent("Component.Head") as Head;
    head.faceIndex = 0;
    head.setAttachmentPointType(config.point);

    const matcher = config.object.createComponent(MatchTransformTS.getTypeName()) as MatchTransformTS;
    matcher.target = anchor;
    matcher.positionOffset = config.offset;
    matcher.usePositionLerp = true;
    matcher.positionLerpSpeed = config.lerpSpeed;
    matcher.rotationLerpSpeed = config.lerpSpeed * 0.8;
  }
}

interface AttachmentConfig {
  name: string;
  point: AttachmentPointType;
  object: SceneObject;
  offset: vec3;
  lerpSpeed: number;
}
```

### Rotation-Only Matching

Match rotation without affecting position or scale:

```typescript
import {MatchTransformTS} from "FaceMesh.lspkg/Scripts/MatchTransform"

@component
export class RotationMirror extends BaseScriptComponent {
  @input sourceObject: SceneObject;
  @input mirrorObject: SceneObject;
  @input invertX: boolean = false;
  @input invertY: boolean = false;
  @input invertZ: boolean = false;

  onAwake() {
    const matcher = this.mirrorObject.createComponent(MatchTransformTS.getTypeName()) as MatchTransformTS;
    matcher.target = this.sourceObject;

    // Only match rotation
    matcher.usePositionLerp = false;
    matcher.positionLerpSpeed = 0;
    matcher.scaleLerpSpeed = 0;

    // Smooth rotation matching
    matcher.rotationLerpSpeed = 5.0;

    // Apply rotation axis inversions if needed
    if (this.invertX || this.invertY || this.invertZ) {
      this.createEvent("UpdateEvent").bind(() => {
        this.applyRotationInversion();
      });
    }
  }

  applyRotationInversion() {
    const rotation = this.mirrorObject.getTransform().getLocalRotation();
    const euler = this.quaternionToEuler(rotation);

    const newEuler = new vec3(
      this.invertX ? -euler.x : euler.x,
      this.invertY ? -euler.y : euler.y,
      this.invertZ ? -euler.z : euler.z
    );

    const newRotation = quat.fromEulerAngles(newEuler.x, newEuler.y, newEuler.z);
    this.mirrorObject.getTransform().setLocalRotation(newRotation);
  }

  quaternionToEuler(q: quat): vec3 {
    // Euler conversion implementation
    const x = q.x, y = q.y, z = q.z, w = q.w;
    const roll = Math.atan2(2 * (w * x + y * z), 1 - 2 * (x * x + y * y));
    const pitch = Math.asin(Math.max(-1, Math.min(1, 2 * (w * y - z * x))));
    const yaw = Math.atan2(2 * (w * z + x * y), 1 - 2 * (y * y + z * z));
    return new vec3(roll, pitch, yaw);
  }
}
```

### Dynamic Offset Animation

Animate the position offset over time:

```typescript
import {MatchTransformTS} from "FaceMesh.lspkg/Scripts/MatchTransform"

@component
export class AnimatedOffsetFollower extends BaseScriptComponent {
  @input targetObject: SceneObject;
  @input followerObject: SceneObject;
  @input orbitRadius: number = 10;
  @input orbitSpeed: number = 1.0;

  private matcher: MatchTransformTS;
  private time: number = 0;

  onAwake() {
    this.matcher = this.followerObject.createComponent(MatchTransformTS.getTypeName()) as MatchTransformTS;
    this.matcher.target = this.targetObject;
    this.matcher.usePositionLerp = true;
    this.matcher.positionLerpSpeed = 5.0;

    // Animate offset in update loop
    this.createEvent("UpdateEvent").bind(() => {
      this.updateOrbit();
    });
  }

  updateOrbit() {
    this.time += getDeltaTime() * this.orbitSpeed;

    // Calculate circular orbit offset
    const offsetX = Math.cos(this.time) * this.orbitRadius;
    const offsetZ = Math.sin(this.time) * this.orbitRadius;

    this.matcher.positionOffset = new vec3(offsetX, 0, offsetZ);
  }
}
```

### Constraint Toggle System

Dynamically enable/disable axis constraints:

```typescript
import {MatchTransformTS} from "FaceMesh.lspkg/Scripts/MatchTransform"

@component
export class DynamicConstraintController extends BaseScriptComponent {
  @input targetObject: SceneObject;
  @input followerObject: SceneObject;

  private matcher: MatchTransformTS;
  private isXLocked: boolean = false;
  private isYLocked: boolean = false;
  private isZLocked: boolean = false;

  onAwake() {
    this.matcher = this.followerObject.createComponent(MatchTransformTS.getTypeName()) as MatchTransformTS;
    this.matcher.target = this.targetObject;
    this.matcher.usePositionLerp = true;
    this.matcher.positionLerpSpeed = 5.0;
  }

  toggleXConstraint() {
    this.isXLocked = !this.isXLocked;
    this.matcher.constrainPositionX = this.isXLocked;
    print(`X axis ${this.isXLocked ? "locked" : "unlocked"}`);
  }

  toggleYConstraint() {
    this.isYLocked = !this.isYLocked;
    this.matcher.constrainPositionY = this.isYLocked;
    print(`Y axis ${this.isYLocked ? "locked" : "unlocked"}`);
  }

  toggleZConstraint() {
    this.isZLocked = !this.isZLocked;
    this.matcher.constrainPositionZ = this.isZLocked;
    print(`Z axis ${this.isZLocked ? "locked" : "unlocked"}`);
  }

  lockAllAxes() {
    this.matcher.constrainPositionX = true;
    this.matcher.constrainPositionY = true;
    this.matcher.constrainPositionZ = true;
    this.isXLocked = this.isYLocked = this.isZLocked = true;
    print("All axes locked");
  }

  unlockAllAxes() {
    this.matcher.constrainPositionX = false;
    this.matcher.constrainPositionY = false;
    this.matcher.constrainPositionZ = false;
    this.isXLocked = this.isYLocked = this.isZLocked = false;
    print("All axes unlocked");
  }
}
```

### Scale Matching with Constraints

Match scale while constraining specific axes:

```typescript
import {MatchTransformTS} from "FaceMesh.lspkg/Scripts/MatchTransform"

@component
export class UniformScaleMatcher extends BaseScriptComponent {
  @input sourceObject: SceneObject;
  @input targetObject: SceneObject;
  @input scaleMultiplier: number = 1.0;

  onAwake() {
    const matcher = this.targetObject.createComponent(MatchTransformTS.getTypeName()) as MatchTransformTS;
    matcher.target = this.sourceObject;

    // Only match scale uniformly on all axes
    matcher.usePositionLerp = false;
    matcher.rotationLerpSpeed = 0;
    matcher.scaleLerpSpeed = 3.0;

    // Ensure uniform scaling by locking individual axis constraints
    // and applying multiplier in update loop
    this.createEvent("UpdateEvent").bind(() => {
      const currentScale = this.targetObject.getTransform().getLocalScale();
      const avgScale = (currentScale.x + currentScale.y + currentScale.z) / 3;
      const uniformScale = new vec3(avgScale, avgScale, avgScale).uniformScale(this.scaleMultiplier);
      this.targetObject.getTransform().setLocalScale(uniformScale);
    });
  }
}
```

## Configuration Tips

### Lerp Speed Guidelines

Choose appropriate lerp speeds for different use cases:

1. **Face Tracking (5-10)**: Higher speeds for tight following of facial movements
2. **UI Elements (3-5)**: Medium speeds for natural, smooth UI movement
3. **Ambient Objects (1-3)**: Slower speeds for subtle, floating effects
4. **Instant Matching (0 or very high)**: Disable lerp or use high values for immediate response

### Axis Constraint Strategies

Common constraint patterns:

1. **Horizontal Plane**: Constrain Y to keep objects at fixed height
2. **Vertical Column**: Constrain X and Z to create elevator-like movement
3. **Rotation Lock**: Constrain all rotation axes while allowing position changes
4. **Look At Target**: Constrain position while matching rotation

### Performance Optimization

Best practices for optimal performance:

1. **Disable Unused Matching**: Set lerp speeds to 0 for unused transform components
2. **Batch Updates**: Group multiple matchers under single manager component
3. **Conditional Activation**: Enable/disable matchers based on visibility or distance
4. **Position Lerp Toggle**: Disable lerp for objects far from camera

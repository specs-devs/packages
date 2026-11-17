# HandAttacher minimal examples

[← Agent usage index](../README.md)

## Use when

Copy the smallest example that matches your setup. For longer compositions see
[guide](guide.md).

## Prefab (no code)

1. Make sure the scene has the InteractionKit prefab.
2. Drag `HandAttacher.lspkg/HandAttacher__PLACE_IN_SCENE.prefab` into the scene.
3. Replace `HandAttacherDemo/Box` with your content, or point `targetObject` at another
   object, then pick `Hand` / `Joint` in the Inspector.

## Inspector-wired component

Add `HandAttacher` to an empty host object, set `targetObject` to the content
object (ideally a child), and choose the hand and joint. No code is needed.

## Create from script

```typescript
import {HandAttacher, HandSide, HandJoint} from "HandAttacher.lspkg/Scripts/HandAttacher";

@component
export class FingertipMarker extends BaseScriptComponent {
  @input marker: SceneObject;

  onAwake() {
    // onAwake of HandAttacher runs inside createComponent: the target becomes `marker`
    // and the hand is resolved as "right" (the default).
    const attacher = this.marker.createComponent(HandAttacher.getTypeName()) as HandAttacher;
    attacher.setHand(HandSide.Left);            // re-resolves the hand now (plain assignment waits for the next update)
    attacher.handJoint = HandJoint.IndexTip;    // read every frame
    attacher.setPositionOffset(new vec3(0, 1, 0)); // 1 cm above the tip, joint-local
    attacher.positionSmoothSpeed = 15;
  }
}
```

## Switch joint and query tracking at runtime

```typescript
import {HandAttacher, HandJoint} from "HandAttacher.lspkg/Scripts/HandAttacher";

@component
export class JointToggle extends BaseScriptComponent {
  @input attacher: HandAttacher;

  private onTip = true;

  toggle() {
    if (!this.attacher.isHandTracked()) return;
    this.onTip = !this.onTip;
    this.attacher.setJoint(this.onTip ? HandJoint.IndexTip : HandJoint.Wrist);
  }
}
```

`@input attacher: HandAttacher` takes the `HandAttacher` script component of
another object (wire it in the Inspector).

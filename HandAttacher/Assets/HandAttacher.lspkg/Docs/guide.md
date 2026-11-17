# HandAttacher guide and recipes

[← Agent usage index](../README.md)

## Use when

You want a longer, worked pattern (hand-held tool, fingertip UI, wrist display,
rings, hand swap) built on `HandAttacher`. For the exact API read
[components.md](components.md) first; for the smallest compiling snippets read
[examples.md](examples.md).

These recipes are illustrative compositions, not shipped scripts. They follow the
rules in the [cheat sheet](cheat-sheet.md): the component is created with
`HandAttacher.getTypeName()`, the hand is changed with `setHand()` after
`createComponent` (it applies immediately; a plain `handSide` assignment is
picked up on the next update), and SIK's
`getHand()` takes `"left" | "right"`. Every snippet assumes these imports:

```typescript
import {HandAttacher} from "HandAttacher.lspkg/Scripts/HandAttacher";
import {SIK} from "SpectaclesInteractionKit.lspkg/SIK";
```

Generic scripting (events, timers, `@input` patterns) is covered by the CLAD
`lens-api` skill; hand gestures such as pinch by `specs-interaction-recipes`.

## Recipes

### Hand-Held Weapon System

Create a weapon that attaches near the palm (index knuckle) with gesture activation:

```typescript
import {SIK} from "SpectaclesInteractionKit.lspkg/SIK";

@component
export class HandWeapon extends BaseScriptComponent {
  @input weapon: SceneObject;
  @input muzzleFlash: SceneObject;

  private attacher: HandAttacher;
  private isPinching: boolean = false;

  onAwake() {
    this.attacher = this.weapon.createComponent(HandAttacher.getTypeName()) as HandAttacher;
    this.attacher.setHand("right"); // setHand() re-resolves the hand immediately after createComponent
    this.attacher.handJoint = "indexKnuckle";
    this.attacher.usePositionSmoothing = true;
    this.attacher.positionSmoothSpeed = 15.0;
    this.attacher.useRotationSmoothing = true;
    this.attacher.rotationSmoothSpeed = 12.0;
    this.attacher.hideWhenNotTracked = true;

    // Position weapon in hand
    this.attacher.positionOffset = new vec3(0, -2, 1);
    this.attacher.rotationOffset = new vec3(15, 0, 0);

    // Hide muzzle flash initially
    this.muzzleFlash.enabled = false;

    // Listen for pinch gestures
    const handInputData = SIK.HandInputData;
    const rightHand = handInputData.getHand("right");

    rightHand.onPinchDown.add(() => {
      this.isPinching = true;
      this.fireWeapon();
    });

    rightHand.onPinchUp.add(() => {
      this.isPinching = false;
    });

    print("Hand weapon system initialized");
  }

  fireWeapon() {
    print("Weapon fired!");

    // Show muzzle flash
    this.muzzleFlash.enabled = true;

    // Hide after short duration
    const delayed = this.createEvent("DelayedCallbackEvent");
    delayed.bind(() => {
      this.muzzleFlash.enabled = false;
    });
    delayed.reset(0.1);
  }
}
```

### Multi-Finger UI Attachment

Attach UI elements to multiple fingertips:

```typescript
@component
export class MultiFingerUI extends BaseScriptComponent {
  @input handSide: string = "right";
  @input uiElements: SceneObject[];

  private attachers: HandAttacher[] = [];

  private fingerJoints: string[] = [
    "thumbTip",
    "indexTip",
    "middleTip",
    "ringTip",
    "pinkyTip"
  ];

  onAwake() {
    if (this.uiElements.length !== 5) {
      print("ERROR: Need exactly 5 UI elements for 5 fingers");
      return;
    }

    for (let i = 0; i < this.uiElements.length; i++) {
      this.attachToFinger(this.uiElements[i], this.fingerJoints[i], i);
    }
  }

  attachToFinger(uiElement: SceneObject, joint: string, index: number) {
    const attacher = uiElement.createComponent(HandAttacher.getTypeName()) as HandAttacher;
    attacher.setHand(this.handSide); // setHand() re-resolves the hand immediately after createComponent
    attacher.handJoint = joint;
    attacher.positionOffset = new vec3(0, 1, 0.5);
    attacher.usePositionSmoothing = true;
    attacher.positionSmoothSpeed = 12.0;
    attacher.hideWhenNotTracked = true;

    // Only match position, let UI face camera
    attacher.enablePosition = true;
    attacher.enableRotation = false;

    this.attachers.push(attacher);
    print(`Attached UI to ${joint}`);
  }

  hideAll() {
    this.uiElements.forEach(elem => elem.enabled = false);
  }

  showAll() {
    this.uiElements.forEach(elem => elem.enabled = true);
  }
}
```

### Gesture-Based Hand Swap

Switch attachment between hands based on gesture:

```typescript
@component
export class GestureHandSwap extends BaseScriptComponent {
  @input attachedObject: SceneObject;

  private attacher: HandAttacher;
  private currentHand: string = "right";

  onAwake() {
    this.attacher = this.attachedObject.createComponent(HandAttacher.getTypeName()) as HandAttacher;
    this.attacher.setHand(this.currentHand); // setHand() re-resolves the hand immediately after createComponent
    this.attacher.handJoint = "indexTip";
    this.attacher.usePositionSmoothing = true;
    this.attacher.positionSmoothSpeed = 10.0;

    // Listen for double pinch on either hand to swap
    const handInputData = SIK.HandInputData;

    handInputData.getHand("left").onPinchDown.add(() => {
      this.swapToHand("left");
    });

    handInputData.getHand("right").onPinchDown.add(() => {
      this.swapToHand("right");
    });
  }

  swapToHand(newHand: string) {
    if (newHand !== this.currentHand) {
      this.currentHand = newHand;
      this.attacher.setHand(newHand);
      print(`Swapped to ${newHand} hand`);
    }
  }
}
```

### Wrist-Mounted Display

Create a wrist-worn AR interface:

```typescript
@component
export class WristDisplay extends BaseScriptComponent {
  @input displayPanel: SceneObject;
  @input textElement: Text;

  private attacher: HandAttacher;
  private displayActive: boolean = false;

  onAwake() {
    this.attacher = this.displayPanel.createComponent(HandAttacher.getTypeName()) as HandAttacher;
    this.attacher.setHand("left"); // setHand() re-resolves the hand immediately after createComponent
    this.attacher.handJoint = "wrist";
    this.attacher.usePositionSmoothing = true;
    this.attacher.positionSmoothSpeed = 8.0;
    this.attacher.useRotationSmoothing = true;
    this.attacher.rotationSmoothSpeed = 6.0;

    // Position display above wrist, tilted toward user
    this.attacher.positionOffset = new vec3(0, 3, 2);
    this.attacher.rotationOffset = new vec3(-30, 0, 0);

    // Initially hidden
    this.displayPanel.enabled = false;

    // Activate with right hand pinch
    const handInputData = SIK.HandInputData;
    handInputData.getHand("right").onPinchDown.add(() => {
      this.toggleDisplay();
    });

    // Update display content
    this.updateDisplayContent();
  }

  toggleDisplay() {
    this.displayActive = !this.displayActive;
    this.displayPanel.enabled = this.displayActive;
    print(`Wrist display: ${this.displayActive ? "shown" : "hidden"}`);
  }

  updateDisplayContent() {
    if (!this.textElement) return;

    const updateEvent = this.createEvent("UpdateEvent");
    updateEvent.bind(() => {
      const time = new Date();
      this.textElement.text = `Time: ${time.toLocaleTimeString()}`;
    });
  }
}
```

### Dynamic Joint Switching

Switch between joints based on hand pose:

```typescript
@component
export class DynamicJointSwitcher extends BaseScriptComponent {
  @input attachedObject: SceneObject;

  private attacher: HandAttacher;
  private handInputData: any;
  private currentJoint: string = "indexTip";

  onAwake() {
    this.attacher = this.attachedObject.createComponent(HandAttacher.getTypeName()) as HandAttacher;
    this.attacher.setHand("right"); // setHand() re-resolves the hand immediately after createComponent
    this.attacher.handJoint = this.currentJoint;
    this.attacher.usePositionSmoothing = true;
    this.attacher.positionSmoothSpeed = 15.0;

    this.handInputData = SIK.HandInputData;

    const updateEvent = this.createEvent("UpdateEvent");
    updateEvent.bind(() => {
      this.checkHandPose();
    });
  }

  checkHandPose() {
    const rightHand = this.handInputData.getHand("right");

    if (!rightHand.isTracked()) return;

    // Check if making a fist
    if (this.isHandClosed(rightHand)) {
      this.switchToJoint("wrist");
    }
    // Check if pointing
    else if (this.isPointing(rightHand)) {
      this.switchToJoint("indexTip");
    }
    // Otherwise the index knuckle (there is no palm joint)
    else {
      this.switchToJoint("indexKnuckle");
    }
  }

  isHandClosed(hand: any): boolean {
    // Simple check: all fingertips close to wrist
    // Real implementation would check distances
    return false; // Placeholder
  }

  isPointing(hand: any): boolean {
    // Check if index extended, others curled
    // Real implementation would check joint angles
    return true; // Placeholder
  }

  switchToJoint(joint: string) {
    if (joint !== this.currentJoint) {
      this.currentJoint = joint;
      this.attacher.setJoint(joint);
      print(`Switched to joint: ${joint}`);
    }
  }
}
```

### Finger Ring Attachments

Attach rings to specific finger joints:

```typescript
@component
export class FingerRings extends BaseScriptComponent {
  @input handSide: string = "right";
  @input indexRing: SceneObject;
  @input middleRing: SceneObject;
  @input ringRing: SceneObject;
  @input pinkyRing: SceneObject;

  onAwake() {
    // Index finger ring (mid joint)
    this.attachRing(this.indexRing, "indexMidJoint");

    // Middle finger ring (upper joint)
    this.attachRing(this.middleRing, "middleUpperJoint");

    // Ring finger ring (mid joint)
    this.attachRing(this.ringRing, "ringMidJoint");

    // Pinky ring (mid joint)
    this.attachRing(this.pinkyRing, "pinkyMidJoint");

    print("Finger rings initialized");
  }

  attachRing(ring: SceneObject, joint: string) {
    const attacher = ring.createComponent(HandAttacher.getTypeName()) as HandAttacher;
    attacher.setHand(this.handSide); // setHand() re-resolves the hand immediately after createComponent
    attacher.handJoint = joint;
    attacher.usePositionSmoothing = true;
    attacher.positionSmoothSpeed = 20.0; // Fast response for rings
    attacher.useRotationSmoothing = true;
    attacher.rotationSmoothSpeed = 15.0;
    attacher.hideWhenNotTracked = true;

    // No offset - rings sit directly on joints
    attacher.positionOffset = vec3.zero();
    attacher.rotationOffset = vec3.zero();
  }
}
```

### Palm-Mounted Tool

Attach a tool that appears over the palm, anchored to the wrist joint (`HandJoint` has no palm joint):

```typescript
@component
export class PalmTool extends BaseScriptComponent {
  @input tool: SceneObject;
  @input activationHand: string = "left";

  private attacher: HandAttacher;
  private isActive: boolean = false;

  onAwake() {
    this.attacher = this.tool.createComponent(HandAttacher.getTypeName()) as HandAttacher;
    this.attacher.setHand(this.activationHand); // setHand() re-resolves the hand immediately after createComponent
    this.attacher.handJoint = "wrist"; // No palm joint; offset from the wrist instead
    this.attacher.usePositionSmoothing = true;
    this.attacher.positionSmoothSpeed = 12.0;
    this.attacher.useRotationSmoothing = true;
    this.attacher.rotationSmoothSpeed = 10.0;

    // Position in palm, facing up
    this.attacher.positionOffset = new vec3(0, 1, 1);
    this.attacher.rotationOffset = new vec3(-90, 0, 0);

    this.tool.enabled = false;

    // Activate with pinch gesture
    const handInputData = SIK.HandInputData;
    const hand = handInputData.getHand(this.activationHand as "left" | "right");

    hand.onPinchDown.add(() => {
      this.toggleTool();
    });
  }

  toggleTool() {
    this.isActive = !this.isActive;
    this.tool.enabled = this.isActive;
    print(`Palm tool: ${this.isActive ? "activated" : "deactivated"}`);
  }
}
```

## Configuration tips

### Joint Selection Guidelines

Choose appropriate joints for different use cases:

1. **Wrist**: Best for wrist-worn interfaces, watches, bracelets
2. **Knuckles**: Stable mounting points for larger objects
3. **Fingertips**: UI buttons, interaction points, precise positioning
4. **Mid Joints**: Rings, small decorative items
5. **Base Joints**: Large attachments that need stability

### Smoothing Speed Recommendations

Optimal lerp speeds for different scenarios:

1. **Tight Following (15-20)**: Weapons, tools that need immediate response
2. **Balanced (8-12)**: UI elements, decorative items
3. **Smooth Float (3-7)**: Ambient effects, non-critical attachments
4. **No Smoothing (disabled)**: Frame-perfect sync for critical gameplay

### Offset Configuration

Position and rotation offset best practices:

1. **Position Offset**: Measured in centimeters in joint's local space
2. **Rotation Offset**: Euler angles in degrees, applied after joint rotation
3. **Test Both Hands**: Offsets may need adjustment per hand
4. **Account for Joint Size**: Larger objects need larger offsets

### Performance Optimization

Best practices for optimal hand attachment performance:

1. **Disable When Hidden**: Use hideWhenNotTracked to save processing
2. **Selective Updates**: Use enablePosition or enableRotation to disable unused transform updates
3. **Skip smoothing when you need frame-exact sync**: smoothing speed does not change the per-frame cost; it only changes how fast the object catches up
4. **Debug Mode Off**: Disable debug logging in production builds


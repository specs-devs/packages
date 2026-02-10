![HandAttacher](AssetImage/HandAttacher.png)

# Hand Attacher

A comprehensive hand tracking integration package for attaching objects to specific hand joints with SIK compatibility. This package provides configurable joint attachment across all 26 hand joints, hand side selection (left/right/dominant/nondominant), transform matching with smooth interpolation, position and rotation offsets in joint-local space, tracking state management, and debug mode for creating hand-held AR objects, UI elements, and gesture-responsive experiences.

## Features

- **26 Joint Support**: Attach to any of 26 hand tracking joints (wrist, thumb, index, middle, ring, pinky)
- **Hand Side Selection**: Choose left, right, dominant, or non-dominant hand
- **SIK Integration**: Works seamlessly with Spectacles Interaction Kit hand tracking
- **Transform Matching**: Synchronized position and rotation updates
- **Joint-Local Offsets**: Apply position and rotation offsets in joint's local coordinate space
- **Smooth Interpolation**: Configurable lerp speeds for position and rotation
- **Tracking State Awareness**: Automatic show/hide when hand tracking is lost
- **Selective Updates**: Option to update only position or only rotation
- **Debug Mode**: Console logging for tracking status and joint positions
- **Hand Swapping**: Runtime hand side switching support

## Quick Start

Attach an object to the index fingertip:

```typescript
import {HandAttacher, HandSide, HandJoint} from "HandAttacher.lspkg/HandAttacher";

@component
export class FingerAttachment extends BaseScriptComponent {
  @input attachedObject: SceneObject;

  onAwake() {
    const attacher = this.attachedObject.createComponent("Component.ScriptComponent") as HandAttacher;
    attacher.handSide = HandSide.Right;
    attacher.handJoint = HandJoint.IndexTip;
    attacher.positionOffset = new vec3(0, 0.5, 0);
    attacher.usePositionSmoothing = true;
    attacher.positionSmoothSpeed = 10.0;
    attacher.useRotationSmoothing = true;
    attacher.rotationSmoothSpeed = 8.0;
    attacher.hideWhenNotTracked = true;

    print("Finger attachment initialized");
  }
}
```

## Script Highlights

### HandAttacher.ts

Integrates with SIK's HandInputData system to attach objects to specific hand joints with comprehensive configuration options. Supports all hand sides (left, right, dominant, nondominant) through getHand() and getDominantHand() methods. Provides access to all 26 hand joints across five fingers including wrist, bases, knuckles, mid joints, upper joints, and tips. Implements world-space attachment where target object is not parented but follows joint position and rotation with smooth interpolation. Uses separate lerp speeds for position and rotation with configurable smoothing enabled/disabled per axis. Applies position offset in joint's local coordinate space by rotating offset vector with joint rotation before adding to position. Rotation offset applied as quaternion multiplication with joint rotation after converting from Euler degrees. Monitors hand tracking state through isTracked() and triggers onHandFound/onHandLost callbacks for visibility management. Features updatePositionOnly and updateRotationOnly flags for selective transform updates. Includes comprehensive debug mode with detailed console logging of joint positions, tracking state changes, and component initialization. Provides public API methods for runtime reconfiguration including setHand(), setJoint(), setPositionOffset(), setRotationOffset(), and isHandTracked() for external state queries.

## Core API Methods

```typescript
// Configuration inputs
@input targetObject: SceneObject                 // Object to attach (default: this object)
@input("string") handSide: string               // "left" | "right" | "dominant" | "nondominant"
@input("string") handJoint: string              // Joint name (see HandJoint enum)
@input positionOffset: vec3                      // Offset in joint's local space
@input rotationOffset: vec3                      // Rotation offset in degrees
@input usePositionSmoothing: boolean            // Enable position lerp
@input positionSmoothSpeed: number              // Position lerp speed (default: 10.0)
@input useRotationSmoothing: boolean            // Enable rotation slerp
@input rotationSmoothSpeed: number              // Rotation slerp speed (default: 8.0)
@input updatePositionOnly: boolean              // Only update position
@input updateRotationOnly: boolean              // Only update rotation
@input hideWhenNotTracked: boolean              // Hide when hand not tracked
@input debugMode: boolean                        // Console debug logging

// Public methods
setHand(side: string): void                     // Change hand at runtime
setJoint(joint: string): void                   // Change joint at runtime
setPositionOffset(offset: vec3): void           // Update position offset
setRotationOffset(offset: vec3): void           // Update rotation offset
isHandTracked(): boolean                         // Query tracking state

// Available joints (HandJoint enum)
Wrist, ThumbBase, ThumbKnuckle, ThumbMid, ThumbTip,
IndexBase, IndexKnuckle, IndexMid, IndexUpper, IndexTip,
MiddleBase, MiddleKnuckle, MiddleMid, MiddleUpper, MiddleTip,
RingBase, RingKnuckle, RingMid, RingUpper, RingTip,
PinkyBase, PinkyKnuckle, PinkyMid, PinkyUpper, PinkyTip
```

## Advanced Usage

### Hand-Held Weapon System

Create a weapon that attaches to the palm with gesture activation:

```typescript
import {SIK} from "SpectaclesInteractionKit.lspkg/SIK";

@component
export class HandWeapon extends BaseScriptComponent {
  @input weapon: SceneObject;
  @input muzzleFlash: SceneObject;

  private attacher: HandAttacher;
  private isPinching: boolean = false;

  onAwake() {
    this.attacher = this.weapon.createComponent("Component.ScriptComponent") as HandAttacher;
    this.attacher.handSide = "right";
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
    const attacher = uiElement.createComponent("Component.ScriptComponent") as HandAttacher;
    attacher.handSide = this.handSide;
    attacher.handJoint = joint;
    attacher.positionOffset = new vec3(0, 1, 0.5);
    attacher.usePositionSmoothing = true;
    attacher.positionSmoothSpeed = 12.0;
    attacher.hideWhenNotTracked = true;

    // Only match position, let UI face camera
    attacher.updateRotationOnly = false;

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
    this.attacher = this.attachedObject.createComponent("Component.ScriptComponent") as HandAttacher;
    this.attacher.handSide = this.currentHand;
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
    this.attacher = this.displayPanel.createComponent("Component.ScriptComponent") as HandAttacher;
    this.attacher.handSide = "left";
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
    this.attacher = this.attachedObject.createComponent("Component.ScriptComponent") as HandAttacher;
    this.attacher.handSide = "right";
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
    // Default to palm
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
    const attacher = ring.createComponent("Component.ScriptComponent") as HandAttacher;
    attacher.handSide = this.handSide;
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

Attach a tool that appears in the palm:

```typescript
@component
export class PalmTool extends BaseScriptComponent {
  @input tool: SceneObject;
  @input activationHand: string = "left";

  private attacher: HandAttacher;
  private isActive: boolean = false;

  onAwake() {
    this.attacher = this.tool.createComponent("Component.ScriptComponent") as HandAttacher;
    this.attacher.handSide = this.activationHand;
    this.attacher.handJoint = "wrist"; // Center of palm area
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
    const hand = handInputData.getHand(this.activationHand);

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

## Configuration Tips

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
2. **Selective Updates**: Use updatePositionOnly or updateRotationOnly when appropriate
3. **Reduce Smooth Speed**: Lower lerp speeds = fewer calculations
4. **Debug Mode Off**: Disable debug logging in production builds

## Built with 👻 by the Spectacles team

---

[See more packages](https://github.com/specs-devs/packages)




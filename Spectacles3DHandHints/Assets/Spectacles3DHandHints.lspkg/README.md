# Spectacles3DHandHints

An animated 3D hand hint system for Spectacles that teaches users hand gestures and interactions through beautiful visual demonstrations. This package provides a comprehensive library of pre-animated hand gestures including pinch, tap, swipe, rotate, and system gestures with automatic material animations, cursor feedback, and sequence support. The system plays looping animations that fade in and out smoothly, showing users exactly how to interact with AR content using natural hand movements.

## Features

- **40+ Pre-Animated Gestures** - Complete library covering pinch, tap, swipe, rotate, grab, and system interactions
- **Left/Right/Both Hands** - Support for one-handed and two-handed gesture demonstrations
- **Animated Hand Models** - Professionally animated 3D hand meshes with outline shaders and fingertip glow effects
- **Cursor Feedback** - Dynamic cursor that triggers and squishes during pinch gestures
- **Sequence Support** - Chain multiple gestures together for multi-step tutorials
- **Looping Control** - Configurable number of loops and animation speed
- **Position Control** - Place hint animations at specific world positions
- **Event System** - Callbacks when animation sequences complete
- **Auto-Play** - Optional automatic playback on component initialization

## Quick Start

```typescript
import { InteractionHintController, HandMode, HandAnimationsLibrary } from "./Spectacles3DHandHints.lspkg/Scripts/InteractionHintController";

@component
export class HandHintExample extends BaseScriptComponent {
    @input
    hintController: InteractionHintController;

    onAwake() {
        // Play a single pinch gesture hint
        this.hintController.playHintAnimation(
            HandMode.Right,
            HandAnimationsLibrary.Right.PinchNear,
            3, // loops
            1.0 // speed
        );

        // Listen for completion
        this.hintController.animationEndEvent.bind(() => {
            print("Hint animation completed!");
        });
    }

    showTwoHandedGesture() {
        // Play a two-handed scale gesture
        this.hintController.playHintAnimation(
            HandMode.Both,
            HandAnimationsLibrary.Both.TwoHandsPinchScale,
            5,
            0.8
        );
    }

    showGestureSequence() {
        // Create a sequence of gestures
        const sequence = [
            new HandAnimationClipInfo(
                HandMode.Right,
                HandAnimationsLibrary.Right.PinchNear,
                new vec3(0, 0, 50)
            ),
            new HandAnimationClipInfo(
                HandMode.Right,
                HandAnimationsLibrary.Right.PinchMoveY,
                new vec3(0, 10, 50)
            ),
            new HandAnimationClipInfo(
                HandMode.Both,
                HandAnimationsLibrary.Both.TwoHandsPinchScale,
                new vec3(0, 0, 50)
            )
        ];

        this.hintController.playHintAnimationSequence(sequence, 2);
    }
}
```

## Script Highlights

### InteractionHintController

The InteractionHintController manages all hand hint animations through a sophisticated system that coordinates hand meshes, materials, cursors, and animation playback. The component initializes by finding the HandHints prefab in the scene hierarchy and setting up references to left and right hand geometry, finger joint landmarks, and the cursor object. Material cloning ensures each instance has independent shader properties for the outline fade and fingertip glow effects. The playHintAnimation method accepts a hand mode, animation name, loop count, and speed, while playHintAnimationSequence chains multiple gestures with smooth fades between each. The system automatically enables/disables hand meshes based on whether gestures are one-handed or two-handed.

### Automatic Pinch Detection

The update loop monitors finger joint distances to detect pinch gestures and trigger visual feedback automatically. For each frame, it calculates the world space distance between the index fingertip and thumb tip for both hands. When this distance drops below 2 units, the system activates the fingertip glow material and triggers the cursor animation. The cursor material's isTriggering property smoothly animates the cursor's appearance, while circleSquishScale remaps the finger distance to create a squishing effect that provides tactile visual feedback. This real-time detection works for both pre-programmed animations and live hand tracking, creating cohesive visual language across the experience.

### Animation Sequencing

The sequence system allows developers to create multi-step tutorials by chaining gestures with automatic transitions. Each HandAnimationClipInfo in a sequence specifies the hand mode, animation clip name, and world position for that step. When a clip completes, the system fades out the current hand, disables the completed animation, sets up the next clip with its position and animation, and fades in the new hand. The numberOfLoops parameter controls how many times the entire sequence repeats before completion. The animationEndEvent fires only when all loops of the complete sequence finish, allowing developers to chain hint sequences or trigger the next tutorial step.

### Material Animation System

The package uses LSTween for smooth material property animations during hand fades and cursor feedback. The fadeInHand method creates outline fade tweens that transition the hand mesh outline material's fadeLevel property from 0 to 1 over 200 milliseconds using cubic easing. Separate tweens manage left hand, right hand, and both hands scenarios. The fadeOutHand method reverses this process, and both return tween objects that support onComplete callbacks for sequencing. Fingertip glow intensity animates instantly when pinches are detected, while the cursor uses separate properties for trigger state and squish scale to create layered animation effects.

### HandAnimationsLibrary Catalog

The package includes 40+ professionally animated hand gestures organized into Left, Right, and Both namespaces. Single-hand animations include pinch near/far (basic selection), pinch move X/Y/Z (translation), pinch rotate X/Y/Z (rotation), pinch swipe X/Y (quick gestures), finger tap near/surface (direct interaction), finger swipe/scroll (UI manipulation), palm touch/swipe/grab (palm-based controls). Two-handed animations include system gestures like tap settings, rotate up/down (device controls), tap watch/exit (navigation), and interaction gestures like pinch scale, pinch rotate Y/Z (3D manipulation), and palm grab X/Y (large object control). All animations loop seamlessly and can be played at variable speeds.

## Core API Methods

### InteractionHintController

```typescript
// Play single animation
playHintAnimation(
    handMode: HandMode,
    animationName: HandAnimationsLibrary,
    numberOfLoops: number,
    animationSpeed?: number
): void;

// Play animation sequence
playHintAnimationSequence(
    sequence: HandAnimationClipInfo[],
    numberOfLoops: number
): void;

// Animation complete event
animationEndEvent: DelayedCallbackEvent;

// Configuration
autoPlay: boolean;
animationSpeed: number;
numberOfLoops: number;
hintAnimations: HintAnimation[];
```

### HandMode Enum

```typescript
enum HandMode {
    Left = 0,
    Right = 1,
    Both = 2
}
```

### HandAnimationsLibrary

```typescript
// Left hand gestures
HandAnimationsLibrary.Left.PinchNear
HandAnimationsLibrary.Left.PinchFar
HandAnimationsLibrary.Left.PinchMoveX/Y/Z
HandAnimationsLibrary.Left.PinchRotateX/Y/Z
HandAnimationsLibrary.Left.PinchSwipeX/Y
HandAnimationsLibrary.Left.FingerTapNear/TapSurface
HandAnimationsLibrary.Left.FingerSwipeX/Y
HandAnimationsLibrary.Left.FingerScrollMirco
HandAnimationsLibrary.Left.PalmTouchNear/TouchSurface
HandAnimationsLibrary.Left.PalmSwipeX
HandAnimationsLibrary.Left.PalmGrabX/Y

// Right hand gestures (same as left)
HandAnimationsLibrary.Right.*

// Both hands gestures
HandAnimationsLibrary.Both.SystemTapSettings
HandAnimationsLibrary.Both.SystemTapRotateDown/Up
HandAnimationsLibrary.Both.SystemTapWatch
HandAnimationsLibrary.Both.SystemTapExit
HandAnimationsLibrary.Both.TwoHandsPinchScale
HandAnimationsLibrary.Both.TwoHandsPinchRotateY/Z
HandAnimationsLibrary.Both.TwoHandsPalmGrabX/Y
```

## Advanced Usage

### Example 1: Tutorial System with Progressive Hints

```typescript
@component
export class TutorialSystem extends BaseScriptComponent {
    @input hintController: InteractionHintController;
    @input tutorialText: Text;

    private currentStep: number = 0;
    private steps = [
        { gesture: HandAnimationsLibrary.Right.PinchNear, text: "Pinch to select objects" },
        { gesture: HandAnimationsLibrary.Right.PinchMoveY, text: "Pinch and move up/down" },
        { gesture: HandAnimationsLibrary.Both.TwoHandsPinchScale, text: "Use two hands to scale" }
    ];

    onAwake() {
        this.hintController.animationEndEvent.bind(() => {
            this.nextStep();
        });

        this.showCurrentStep();
    }

    showCurrentStep() {
        if (this.currentStep >= this.steps.length) {
            this.tutorialText.text = "Tutorial Complete!";
            return;
        }

        const step = this.steps[this.currentStep];
        this.tutorialText.text = step.text;

        const handMode = this.currentStep === 2 ? HandMode.Both : HandMode.Right;
        this.hintController.playHintAnimation(handMode, step.gesture, 3, 0.8);
    }

    nextStep() {
        this.currentStep++;

        const delayedEvent = this.createEvent("DelayedCallbackEvent");
        delayedEvent.bind(() => {
            this.showCurrentStep();
        });
        delayedEvent.reset(1.0); // 1 second delay between steps
    }

    skipTutorial() {
        this.currentStep = this.steps.length;
        this.tutorialText.text = "";
        // Hide hint controller
    }
}
```

Built with 👻 by the Spectacles team


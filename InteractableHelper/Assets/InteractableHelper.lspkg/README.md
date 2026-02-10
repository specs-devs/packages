![InteractableHelper](AssetImage/InteractableHelper.png)

# Interactable Helper

A powerful event-driven animation system that connects Spectacles Interaction Kit (SIK) events to visual and audio responses. This package provides a no-code interface for creating interactive experiences with transform animations, material property changes, blendshape morphing, audio playback, and video control.

## Features

- **Event-Driven Responses**: React to SIK interaction events (Hover, Trigger, Down, Up, Move, Cancel)
- **Transform Animations**: Animate position, rotation, and scale with easing curves
- **Material Property Animation**: Animate shader parameters including colors, floats, and textures
- **Blendshape Animation**: Morph between mesh shapes with smooth interpolation
- **Audio Control**: Play, pause, and stop audio clips based on interactions
- **Video Texture Control**: Control video playback with interaction events
- **Play Options**: Three modes - Play From Current, Play Everytime, or Toggle between states
- **Callback Actions**: Chain multiple animations and trigger custom logic on start/complete

## Quick Start

Add the Interactable Helper to any SIK Interactable to create animated responses:

```typescript
import {EventResponseType} from "InteractableHelper.lspkg/Scripts/EventResponseType";
import {TransformAnimation} from "InteractableHelper.lspkg/Scripts/TransformAnimation";

@component
export class InteractiveButton extends BaseScriptComponent {
  @input interactable: Interactable;
  @input targetObject: SceneObject;

  private responseHandler: EventResponseType;

  onAwake() {
    // Create transform animation
    const scaleAnimation = new TransformAnimation();
    scaleAnimation.animationType = 2;  // Scale Local
    scaleAnimation.playOption = 2;     // Toggle
    scaleAnimation.a = new vec3(1, 1, 1);
    scaleAnimation.b = new vec3(1.2, 1.2, 1.2);
    scaleAnimation.animationDurationInSeconds = 0.3;

    // Create response handler
    this.responseHandler = new EventResponseType();
    this.responseHandler.eventType = EventType.OnTriggerStart;
    this.responseHandler.transformAnimation = scaleAnimation;

    // Connect to interactable
    this.interactable.onTriggerStart.add(() => {
      this.responseHandler.execute(this.targetObject.getTransform());
    });
  }
}
```

## Script Highlights

### EventResponseType.ts
The central orchestrator that maps SIK interaction events to animation responses. It supports eight event types: OnHoverStart, OnHoverEnd, OnTriggerStart, OnTriggerEnd, OnTriggerCanceled, OnDown, OnUp, and OnMove. Each event can trigger multiple response types simultaneously including transform animations, material property changes, blendshape morphing, audio playback, and video control. The system uses a unified execute() interface that accepts the target object and triggers all configured animations with their specified delays and easing curves.

### TransformAnimation.ts
Provides six animation types for transform manipulation: Move Local, Move World, Scale Local, Scale World, Rotate Local, and Rotate World. It implements three play options - Play From Current Value (animates from current state to target), Play Everytime (always animates between fixed start/end values), and Toggle (alternates between two states on each trigger). The animation system includes configurable duration, delay, easing curves, and optional callbacks for onStart and onComplete events.

### MaterialPropertyAnimation.ts
Animates shader parameters on materials including float properties, color properties, and texture swaps. Supports smooth interpolation of numeric values and color transitions with alpha blending. The system can target specific material passes and property names, enabling complex visual effects like glowing edges, color shifts, or animated texture coordinates. Includes the same play options and callback system as transform animations for synchronized multi-material effects.

### BlendshapeAnimation.ts
Controls mesh morphing by animating blendshape weights from 0.0 to 1.0. Enables smooth transitions between different mesh deformations for effects like character expressions, button depressions, or organic shape changes. The animation system supports multiple blendshapes per mesh and can sequence or layer morphs using the callback chaining system.

### AudioComponentControl.ts
Manages AudioComponent playback with three actions: Play, Pause, and Stop. Provides precise control over audio feedback for interactions, enabling responsive sound design. Can be combined with other animations to create synchronized audio-visual experiences, such as playing a "click" sound when a button scales up.

## Core API Methods

### EventResponseType

```typescript
// Set which SIK event triggers the response
eventType: EventType

// Configure animation responses
transformAnimation: TransformAnimation
materialPropertyAnimation: MaterialPropertyAnimation
blendshapeAnimation: BlendshapeAnimation

// Configure audio/video responses
audioControl: AudioComponentControl
videoControl: VideoTextureControl

// Execute all configured responses
execute(target: Transform | Material | RenderMeshVisual): void
```

### TransformAnimation

```typescript
// Animation type (Move/Scale/Rotate in Local/World space)
animationType: number

// Play mode (FromCurrent/PlayEverytime/Toggle)
playOption: number

// Animation timing
animationDurationInSeconds: number
delay: number

// Easing configuration
easingData: EasingData

// Callbacks
onStartAction: CallbackAction
onCompleteAction: CallbackAction
```

### MaterialPropertyAnimation

```typescript
// Target property configuration
propertyName: string
materialPass: number

// Animation values
startValue: number | vec3
endValue: number | vec3

// Timing and easing
animationDurationInSeconds: number
easingData: EasingData
```

## Advanced Usage

### Chained Button Sequence

Create a sequence of animations that play one after another:

```typescript
@component
export class AnimationChain extends BaseScriptComponent {
  @input button: Interactable;
  @input buttonObject: SceneObject;
  @input feedbackText: Text;

  onAwake() {
    // Animation 1: Scale up
    const scaleUp = new TransformAnimation();
    scaleUp.animationType = 2;  // Scale Local
    scaleUp.playOption = 1;     // Play Everytime
    scaleUp.startValue = new vec3(1, 1, 1);
    scaleUp.endValue = new vec3(1.3, 1.3, 1.3);
    scaleUp.animationDurationInSeconds = 0.2;
    scaleUp.doOnComplete = true;

    // Animation 2: Scale back down
    const scaleDown = new TransformAnimation();
    scaleDown.animationType = 2;
    scaleDown.playOption = 1;
    scaleDown.startValue = new vec3(1.3, 1.3, 1.3);
    scaleDown.endValue = new vec3(1, 1, 1);
    scaleDown.animationDurationInSeconds = 0.2;

    // Chain them together
    scaleUp.onCompleteAction = new CallbackAction(() => {
      this.executeAnimation(scaleDown);
      this.feedbackText.text = "Action Complete!";
    });

    // Trigger on interaction
    this.button.onTriggerStart.add(() => {
      this.executeAnimation(scaleUp);
    });
  }

  executeAnimation(anim: TransformAnimation) {
    const transform = this.buttonObject.getTransform();
    anim.execute(transform);
  }
}
```

### Multi-Material Color Wave

Animate multiple materials in sequence to create a wave effect:

```typescript
@component
export class ColorWave extends BaseScriptComponent {
  @input trigger: Interactable;
  @input materials: Material[];

  private colorAnim: MaterialPropertyAnimation;

  onAwake() {
    this.trigger.onTriggerStart.add(() => {
      this.playColorWave();
    });
  }

  playColorWave() {
    const waveColor = new vec3(0, 1, 1);  // Cyan
    const baseColor = new vec3(1, 1, 1);  // White

    this.materials.forEach((material, index) => {
      const anim = new MaterialPropertyAnimation();
      anim.propertyName = "baseColor";
      anim.startValue = baseColor;
      anim.endValue = waveColor;
      anim.animationDurationInSeconds = 0.3;
      anim.delay = index * 0.1;  // Stagger each material
      anim.playOption = 2;  // Toggle

      // Execute with callback to return to base color
      anim.doOnComplete = true;
      anim.onCompleteAction = new CallbackAction(() => {
        const returnAnim = new MaterialPropertyAnimation();
        returnAnim.propertyName = "baseColor";
        returnAnim.startValue = waveColor;
        returnAnim.endValue = baseColor;
        returnAnim.animationDurationInSeconds = 0.3;
        returnAnim.execute(material);
      });

      anim.execute(material);
    });
  }
}
```

### Interactive Blendshape Morphing

Create an interactive character face that responds to proximity:

```typescript
@component
export class InteractiveFace extends BaseScriptComponent {
  @input faceInteractable: Interactable;
  @input faceVisual: RenderMeshVisual;
  @input audioComponent: AudioComponent;

  private blendshapeAnim: BlendshapeAnimation;
  private audioControl: AudioComponentControl;
  private isSmiling = false;

  onAwake() {
    // Create blendshape animation for smile
    this.blendshapeAnim = new BlendshapeAnimation();
    this.blendshapeAnim.blendshapeName = "smile";
    this.blendshapeAnim.playOption = 2;  // Toggle
    this.blendshapeAnim.a = 0.0;  // Neutral
    this.blendshapeAnim.b = 1.0;  // Full smile
    this.blendshapeAnim.animationDurationInSeconds = 0.5;

    // Create audio control
    this.audioControl = new AudioComponentControl();
    this.audioControl.action = AudioAction.Play;

    // React to hover
    this.faceInteractable.onHoverStart.add(() => {
      this.blendshapeAnim.execute(this.faceVisual);
      this.audioControl.execute(this.audioComponent);
      this.isSmiling = !this.isSmiling;
      print(`Face is now ${this.isSmiling ? "smiling" : "neutral"}`);
    });

    // Reset on hover end
    this.faceInteractable.onHoverEnd.add(() => {
      if (this.isSmiling) {
        this.blendshapeAnim.execute(this.faceVisual);
        this.isSmiling = false;
      }
    });
  }
}
```

## Built with 👻 by the Spectacles team


![LSTween](../AssetImage/LSTween.png)

# LSTween

LSTween is a powerful animation and tweening engine for Spectacles, based on the popular Tween.js library. It provides smooth property interpolation for transforms, colors, materials, and custom values with support for easing functions, chaining, repeating, and yo-yo effects. Perfect for creating polished UI animations, character movements, camera transitions, and visual effects.

## Features

- **Transform Animations**: Position, rotation, and scale tweening in local or world space
- **Material Animations**: Color, alpha, and shader property tweening
- **Text Animations**: Alpha and color tweening for text components
- **Easing Functions**: 30+ easing functions including Linear, Quadratic, Cubic, Elastic, Bounce, and more
- **Animation Control**: Chain, repeat, yoyo, delay, and pause/resume animations
- **Custom Tweens**: Tween any numeric property with custom callbacks
- **Blend Shapes**: Animate blend shape weights for facial animations
- **Rotation Modes**: Choose between LERP and SLERP interpolation for rotations
- **Automatic Updates**: Self-managing update loop requires no manual updates

## Quick Start

Basic position animation:

```typescript
import { LSTween } from "LSTween.lspkg/Examples/Scripts/LSTween";
import { Easing } from "LSTween.lspkg/TweenJS/Easing";

@component
export class SimpleAnimation extends BaseScriptComponent {
  @input target: Transform;

  onAwake() {
    // Move object up by 5 units over 1 second with bounce easing
    LSTween.moveOffset(this.target, new vec3(0, 5, 0), 1000)
      .easing(Easing.Bounce.Out)
      .start();
  }
}
```

## Script Highlights

- **LSTween.ts**: Main tweening API providing high-level methods for common animations. Includes position/rotation/scale animations (moveToLocal, moveToWorld, rotateOffset, scaleToLocal), material animations (alphaTo, colorTo, colorFromTo), text animations (textAlphaTo, colorTextTo), shader property tweening (shaderFloatPropertyFromTo, shaderColorPropertyFromTo), and blend shape animations. All methods return a Tween object for chaining additional options.

- **Tween.ts**: Core tween engine implementing property interpolation. Manages tween lifecycle (start, stop, update, complete), callback system (onStart, onUpdate, onComplete, onStop), easing function application, repeat and yoyo logic, delay handling, and chainable tween sequences. Based on the Tween.js library with Lens Studio-specific adaptations.

- **Easing.ts**: Comprehensive easing function library with 30+ pre-built functions. Includes Linear (no easing), Quadratic/Cubic/Quartic/Quintic (polynomial curves), Sinusoidal (smooth acceleration/deceleration), Exponential (sharp acceleration), Circular (quarter-circle motion), Elastic (spring-like overshoot), Back (slight overshoot), and Bounce (bouncing motion). Each has In, Out, and InOut variations.

- **Group.ts**: Tween group management for coordinating multiple animations. Allows updating multiple tweens together, adding/removing tweens dynamically, and checking group state. The default mainGroup automatically manages all tweens created through LSTween methods.

## Transform Animations

### Position Tweening

```typescript
// Offset from current position
LSTween.moveOffset(transform, new vec3(0, 5, 0), 1000).start();

// Move to local position
LSTween.moveToLocal(transform, new vec3(0, 10, 0), 1500)
  .easing(Easing.Cubic.Out)
  .start();

// Move to world position
LSTween.moveToWorld(transform, new vec3(100, 0, 0), 2000)
  .easing(Easing.Elastic.Out)
  .start();

// Move from specific position to another
LSTween.moveFromToLocal(
  transform,
  new vec3(0, 0, 0),
  new vec3(0, 5, 0),
  1000
).start();
```

### Rotation Tweening

```typescript
// Rotate by offset (quaternion multiplication)
const rotation = quat.angleAxis(Math.PI / 4, vec3.up());
LSTween.rotateOffset(transform, rotation, 1000).start();

// Rotate to target rotation (local space)
const targetRot = quat.angleAxis(Math.PI / 2, vec3.up());
LSTween.rotateToLocal(transform, targetRot, 1500)
  .easing(Easing.Sinusoidal.InOut)
  .start();

// Rotate in degrees (easier to work with)
LSTween.rotateToLocalInDegrees(transform, new vec3(0, 90, 0), 1000).start();

// Choose interpolation type
LSTween.rotateToLocal(
  transform,
  targetRot,
  1000,
  RotationInterpolationType.SLERP  // or LERP
).start();
```

### Scale Tweening

```typescript
// Scale by offset (multiplication)
LSTween.scaleOffset(transform, new vec3(2, 2, 2), 1000).start();

// Scale to target size
LSTween.scaleToLocal(transform, new vec3(1.5, 1.5, 1.5), 800)
  .easing(Easing.Back.Out)
  .start();

// Pop-in animation
LSTween.scaleFromToLocal(
  transform,
  new vec3(0, 0, 0),
  new vec3(1, 1, 1),
  500
).easing(Easing.Back.Out).start();
```

## Material Animations

### Alpha Animations

```typescript
// Fade out material
LSTween.alphaTo(material, 0.0, 1000)
  .easing(Easing.Cubic.Out)
  .start();

// Fade in from specific value
LSTween.alphaFromTo(material, 0.0, 1.0, 800).start();

// Fade out text
LSTween.textAlphaTo(textComponent, 0.0, 1000).start();

// Fade text from one value to another
LSTween.textAlphaFromTo(textComponent, 0.0, 1.0, 500).start();
```

### Color Animations

```typescript
// Animate to target color
const targetColor = new vec4(1, 0, 0, 1); // Red
LSTween.colorTo(material, targetColor, 1000).start();

// Animate between two colors
const startColor = new vec4(0, 0, 1, 1); // Blue
const endColor = new vec4(1, 0, 0, 1);   // Red
LSTween.colorFromTo(material, startColor, endColor, 1500)
  .easing(Easing.Sinusoidal.InOut)
  .start();

// Animate text color
LSTween.colorTextTo(textComponent, new vec4(1, 1, 0, 1), 800).start();

// Text color transition
LSTween.colorTextFromTo(
  textComponent,
  new vec4(1, 1, 1, 1),
  new vec4(1, 0, 1, 1),
  1000
).start();
```

### Shader Properties

```typescript
// Animate float shader property
const pass = material.mainPass;
LSTween.shaderFloatPropertyFromTo(pass, "opacity", 0.0, 1.0, 1000).start();

// Animate from current value
LSTween.shaderFloatPropertyTo(pass, "intensity", 2.0, 1500).start();

// Animate color property
LSTween.shaderColorPropertyFromTo(
  pass,
  "tintColor",
  new vec4(1, 1, 1, 1),
  new vec4(1, 0, 0, 1),
  1000
).start();

// Animate vec3 property
LSTween.shaderVec3PropertyFromTo(
  pass,
  "offset",
  new vec3(0, 0, 0),
  new vec3(1, 1, 1),
  2000
).start();
```

## Easing Functions

LSTween provides comprehensive easing options:

```typescript
import { Easing } from "LSTween.lspkg/TweenJS/Easing";

// Linear (no easing)
.easing(Easing.Linear.None)

// Quadratic (smooth acceleration)
.easing(Easing.Quadratic.In)    // Accelerate
.easing(Easing.Quadratic.Out)   // Decelerate
.easing(Easing.Quadratic.InOut) // Both

// Cubic (stronger acceleration)
.easing(Easing.Cubic.Out)

// Elastic (spring-like bounce)
.easing(Easing.Elastic.Out)

// Bounce (bouncing effect)
.easing(Easing.Bounce.Out)

// Back (slight overshoot)
.easing(Easing.Back.InOut)

// Circular (quarter-circle motion)
.easing(Easing.Circular.Out)

// Exponential (very sharp)
.easing(Easing.Exponential.In)
```

### Easing Visualization

- **In**: Slow start, fast end
- **Out**: Fast start, slow end
- **InOut**: Slow start, fast middle, slow end

## Advanced Features

### Chaining Animations

```typescript
// Execute animations in sequence
const tween1 = LSTween.moveToLocal(transform, new vec3(0, 5, 0), 1000);
const tween2 = LSTween.rotateToLocalInDegrees(transform, new vec3(0, 180, 0), 800);
const tween3 = LSTween.scaleToLocal(transform, new vec3(2, 2, 2), 500);

tween1.chain(tween2);
tween2.chain(tween3);
tween1.start();
```

### Repeating and Yoyo

```typescript
// Repeat animation 5 times
LSTween.moveOffset(transform, new vec3(0, 2, 0), 800)
  .repeat(5)
  .start();

// Repeat forever
LSTween.rotateOffset(transform, quat.angleAxis(Math.PI / 4, vec3.up()), 1000)
  .repeat(Infinity)
  .start();

// Yoyo (reverse on repeat)
LSTween.scaleToLocal(transform, new vec3(1.5, 1.5, 1.5), 600)
  .repeat(Infinity)
  .yoyo(true)
  .easing(Easing.Sinusoidal.InOut)
  .start();
```

### Delays and Callbacks

```typescript
// Delay before starting
LSTween.alphaTo(material, 0.0, 1000)
  .delay(500)
  .start();

// Callbacks
LSTween.moveToLocal(transform, new vec3(0, 5, 0), 1000)
  .onStart(() => {
    print("Animation started!");
  })
  .onUpdate((obj) => {
    print(`Progress: ${obj.t}`);
  })
  .onComplete(() => {
    print("Animation complete!");
  })
  .onStop(() => {
    print("Animation stopped!");
  })
  .start();
```

### Custom Value Tweening

```typescript
// Tween a raw numeric value
LSTween.rawTween(1000)
  .onUpdate((obj) => {
    // obj.t goes from 0 to 1
    const value = MathUtils.lerp(0, 100, obj.t);
    print(`Current value: ${value}`);
  })
  .start();

// Control custom property
let myValue = 0;
LSTween.valueTo(myValue, 100, 2000)
  .onUpdate((obj) => {
    myValue = obj.v;
    print(`myValue: ${myValue}`);
  })
  .start();
```

## Complete Examples

### Animated UI Panel

```typescript
@component
export class UIPanel extends BaseScriptComponent {
  @input panelTransform: Transform;
  @input panelMaterial: Material;

  async showPanel() {
    // Start offscreen
    this.panelTransform.setLocalPosition(new vec3(500, 0, 0));

    // Slide in and fade in simultaneously
    LSTween.moveToLocal(this.panelTransform, new vec3(0, 0, 0), 500)
      .easing(Easing.Cubic.Out)
      .start();

    LSTween.alphaFromTo(this.panelMaterial, 0.0, 1.0, 500).start();
  }

  async hidePanel() {
    // Slide out and fade out
    LSTween.moveToLocal(this.panelTransform, new vec3(500, 0, 0), 400)
      .easing(Easing.Cubic.In)
      .start();

    LSTween.alphaTo(this.panelMaterial, 0.0, 400)
      .onComplete(() => {
        this.getSceneObject().enabled = false;
      })
      .start();
  }
}
```

### Character Jump Animation

```typescript
@component
export class JumpAnimation extends BaseScriptComponent {
  @input character: Transform;

  jump() {
    const startPos = this.character.getLocalPosition();
    const jumpHeight = 3.0;
    const jumpDuration = 800;

    // Jump up
    LSTween.moveFromToLocal(
      this.character,
      startPos,
      startPos.add(new vec3(0, jumpHeight, 0)),
      jumpDuration / 2
    )
      .easing(Easing.Cubic.Out)
      .chain(
        // Fall down
        LSTween.moveFromToLocal(
          this.character,
          startPos.add(new vec3(0, jumpHeight, 0)),
          startPos,
          jumpDuration / 2
        ).easing(Easing.Cubic.In)
      )
      .start();

    // Squash and stretch
    LSTween.scaleFromToLocal(
      this.character,
      new vec3(1, 1, 1),
      new vec3(0.8, 1.2, 0.8),
      jumpDuration / 4
    )
      .easing(Easing.Quadratic.Out)
      .chain(
        LSTween.scaleToLocal(this.character, new vec3(1, 1, 1), jumpDuration / 4)
          .easing(Easing.Quadratic.In)
      )
      .start();
  }
}
```

### Pulsing Effect

```typescript
@component
export class PulsingObject extends BaseScriptComponent {
  @input target: Transform;

  onAwake() {
    // Infinite pulsing scale animation
    LSTween.scaleFromToLocal(
      this.target,
      new vec3(1, 1, 1),
      new vec3(1.2, 1.2, 1.2),
      1000
    )
      .easing(Easing.Sinusoidal.InOut)
      .repeat(Infinity)
      .yoyo(true)
      .start();
  }
}
```

### Color Cycling

```typescript
@component
export class ColorCycler extends BaseScriptComponent {
  @input material: Material;

  onAwake() {
    const colors = [
      new vec4(1, 0, 0, 1), // Red
      new vec4(1, 1, 0, 1), // Yellow
      new vec4(0, 1, 0, 1), // Green
      new vec4(0, 1, 1, 1), // Cyan
      new vec4(0, 0, 1, 1), // Blue
      new vec4(1, 0, 1, 1), // Magenta
    ];

    let currentIndex = 0;

    const cycleColor = () => {
      const nextIndex = (currentIndex + 1) % colors.length;

      LSTween.colorFromTo(
        this.material,
        colors[currentIndex],
        colors[nextIndex],
        1500
      )
        .easing(Easing.Sinusoidal.InOut)
        .onComplete(() => {
          currentIndex = nextIndex;
          cycleColor();
        })
        .start();
    };

    cycleColor();
  }
}
```

### Button Press Animation

```typescript
@component
export class AnimatedButton extends BaseScriptComponent {
  @input buttonTransform: Transform;
  @input buttonMaterial: Material;

  onPress() {
    // Scale down
    LSTween.scaleToLocal(this.buttonTransform, new vec3(0.9, 0.9, 0.9), 100)
      .easing(Easing.Quadratic.In)
      .chain(
        // Scale back up
        LSTween.scaleToLocal(this.buttonTransform, new vec3(1, 1, 1), 100)
          .easing(Easing.Back.Out)
      )
      .start();

    // Flash color
    LSTween.colorFromTo(
      this.buttonMaterial,
      new vec4(1, 1, 1, 1),
      new vec4(0.7, 0.7, 1, 1),
      100
    )
      .yoyo(true)
      .repeat(1)
      .start();
  }
}
```

### Blend Shape Animation

```typescript
@component
export class BlendShapeAnimator extends BaseScriptComponent {
  @input renderMesh: RenderMeshVisual;
  @input blendShapeName: string;

  animate() {
    // Animate blend shape from 0 to 1
    LSTween.blendShapeValueFromTo(
      this.renderMesh,
      this.blendShapeName,
      0.0,
      1.0,
      1000
    )
      .easing(Easing.Cubic.Out)
      .start();
  }

  animateToValue(value: number) {
    // Animate to specific value
    LSTween.blendShapeValueTo(this.renderMesh, this.blendShapeName, value, 500)
      .easing(Easing.Sinusoidal.InOut)
      .start();
  }
}
```

## Best Practices

1. **Choose Appropriate Easings**: Use Out easings for UI enter animations, In for exit animations, and InOut for smooth transitions
2. **Chain Related Animations**: Use `.chain()` instead of callbacks for sequential animations
3. **Yoyo for Continuous Effects**: Combine `.yoyo(true)` with `.repeat(Infinity)` for breathing/pulsing effects
4. **Memory Management**: Stop tweens that are no longer needed with `.stop()`
5. **Performance**: Avoid creating thousands of simultaneous tweens; stagger them if needed

## Performance Considerations

- **Update Cost**: All active tweens update every frame (60 FPS target)
- **Memory**: Each tween allocates minimal memory (~200 bytes)
- **Optimization**: Remove completed tweens automatically (handled internally)
- **Best Performance**: Keep active tween count under 100 for complex scenes
- **No Manual Updates**: LSTween manages its own update loop automatically

## Limitations

- **Rotation Lerp**: Rotating in degrees uses linear interpolation which may have gimbal lock issues for complex rotations
- **No Bezier Curves**: Only supports pre-defined easing functions, not custom bezier curves
- **Single Property**: Each tween animates one property at a time (create multiple tweens for complex animations)
- **No Timeline**: No built-in timeline editor; animations must be programmed

---

Built with 👻 by the Spectacles team


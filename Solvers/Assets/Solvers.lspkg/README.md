# Solvers

A comprehensive collection of spatial relationship solvers for Spectacles development. This package provides a suite of components that automatically manage object positioning, rotation, scaling, and behavior based on spatial relationships with target objects. From simple billboarding and transform matching to advanced tethering systems and distance-based event triggers, Solvers enables you to create dynamic, responsive AR experiences without manually calculating spatial transformations and relationships.

## Features

- **Billboard Solver** - Automatically rotates objects to face targets with Y-axis-only rotation
- **Tether System** - Repositions content when it moves too far from target with smooth lerping
- **Transform Matching** - Mirrors position, rotation, and scale of target objects with selective axis constraints
- **Distance Events** - Triggers callbacks when objects cross configurable distance thresholds
- **Scale Over Distance** - Linear scaling based on proximity to target objects
- **Smooth Transitions** - Built-in lerping and slerping for all transform operations
- **Flexible Constraints** - Per-axis control for position, rotation, and scale operations
- **Performance Optimized** - Efficient vector math with minimal allocations

## Quick Start

```typescript
import { BillboardTS } from "./Solvers.lspkg/TS/BillboardTS";
import { TetherTS } from "./Solvers.lspkg/TS/TetherTS";
import { DistanceEventsTS } from "./Solvers.lspkg/TS/DistanceEventsTS";

@component
export class SolversExample extends BaseScriptComponent {
    @input
    camera: SceneObject;

    @input
    billboardObject: SceneObject;

    @input
    tetheredUI: SceneObject;

    onAwake() {
        this.setupBillboard();
        this.setupTether();
        this.setupDistanceEvents();
    }

    setupBillboard() {
        // Add billboard behavior to always face camera
        const billboard = this.billboardObject.createComponent("Component.ScriptComponent");
        billboard.target = this.camera;
        billboard.lookAway = false; // Face towards camera
    }

    setupTether() {
        // Tether UI to maintain position relative to camera
        const tether = this.tetheredUI.createComponent("Component.ScriptComponent");
        tether.target = this.camera;
        tether.offset = new vec3(0, -0.3, 0.5); // 50cm in front, 30cm below
        tether.horizontalDistanceFromTarget = 0.2;
        tether.verticalDistanceFromTarget = 0.2;
    }

    setupDistanceEvents() {
        // Trigger events at specific distances
        const distanceEvents = this.sceneObject.createComponent("Component.ScriptComponent");
        distanceEvents.target = this.camera;
        distanceEvents.distances = [1.0, 2.0, 3.0]; // meters
        distanceEvents.triggerOnGreaterThan = true;

        // Add callbacks
        const range = distanceEvents.addRange(1.0, 2.0);
        range.addOnEnterRangeListener(() => {
            print("Entered 1-2m range");
        });
    }
}
```

## Script Highlights

### BillboardTS

The Billboard solver ensures objects always face a target by rotating around the Y-axis only, creating a natural billboard effect commonly used for UI elements, sprites, and heads-up displays. Unlike full 3D billboarding, this solver maintains upright orientation by restricting rotation to the horizontal plane, preventing objects from tilting when the camera moves vertically. The solver uses smooth quaternion slerping for natural transitions and supports both "face towards" and "face away" modes. The implementation calculates the direction vector on the XZ plane, normalizes it, converts to a Y-axis rotation angle using atan2, and applies the rotation with configurable lerp speed for smooth motion.

### TetherTS

The Tether solver creates a "rubber band" relationship between content and a target, repositioning the content when it strays too far or when the viewing angle becomes too extreme. This is particularly useful for UI panels, tooltips, and information displays that need to stay accessible but shouldn't be rigidly locked to a moving target. The solver monitors both horizontal and vertical distances separately, uses configurable thresholds for triggering repositioning, and supports rotation-aware offset calculations. When reorientation is enabled, the offset is transformed into the target's local space, allowing content to maintain consistent relative positioning as the target rotates. The flattening option projects rotation onto the XZ plane for horizon-locked behavior.

### MatchTransformTS

The Transform Matcher provides a flexible system for mirroring another object's position, rotation, and scale with fine-grained control over which components to match. Each axis can be independently constrained, allowing you to mirror only specific dimensions while leaving others unchanged. Position matching supports both direct 1:1 copying and smooth lerped transitions, rotation uses quaternion slerping for natural interpolation, and scale operations can be uniform or per-axis. The solver handles quaternion-to-Euler conversions for constraint application and includes world-space offset support for position matching, making it ideal for creating follower cameras, mirror effects, and synchronized animation systems.

### DistanceEventsTS

The Distance Events solver provides a robust system for triggering callbacks based on proximity to target objects. It manages multiple distance thresholds simultaneously, supports both "greater than" and "less than" trigger modes, and prevents duplicate triggers until the object leaves and re-enters a range. The system uses a DistanceRange helper class that tracks whether an object is currently inside a range and fires enter/exit events appropriately. Each range can have multiple listeners for enter, exit, and percent-inside events, where the percent value represents how deep into the range the object has penetrated (0 at the far edge, 1 at the near edge). This is particularly useful for proximity-based UI reveals, audio zones, and interaction triggers.

### ScaleOverDistanceLinearTS

The Scale Over Distance solver creates depth-perception effects by adjusting an object's scale based on its distance from a target. The scaling uses a linear remapping function that maps a configurable distance range to a corresponding scale range, with automatic clamping to prevent values outside the specified ranges. This is commonly used for billboarded sprites that need to maintain apparent size regardless of depth, or for creating "breathing" effects where objects grow and shrink as the user approaches. The solver applies uniform scaling across all axes by default, though the implementation could be extended for per-axis scaling if needed.

## Core API Methods

### BillboardTS

```typescript
// Configuration
target: SceneObject;              // Target to face (typically camera)
lookAway: boolean;                // Face away instead of towards (default: true)

// Automatic methods (called by component lifecycle)
billboarding(): void;             // Updates rotation to face target
```

### TetherTS

```typescript
// Configuration
target: SceneObject;              // Object to tether to
offset: vec3;                     // Position offset from target
verticalDistanceFromTarget: number;    // Vertical threshold (default: 0.1m)
horizontalDistanceFromTarget: number;  // Horizontal threshold (default: 0.1m)
reorientDuringTargetRotation: boolean; // Rotate with target (default: true)
flattenDuringTargetRotation: boolean;  // Flatten Y rotation (default: true)
lerpSpeed: number;                // Smooth transition speed (default: 5.0)
```

### MatchTransformTS

```typescript
// Configuration
target: SceneObject;              // Object to match
positionOffset: vec3;             // Offset for position matching
usePositionLerp: boolean;         // Enable smooth position transitions
positionLerpSpeed: number;        // Position lerp speed (default: 1.0)
rotationLerpSpeed: number;        // Rotation slerp speed (default: 1.0)
scaleLerpSpeed: number;           // Scale lerp speed (default: 1.0)

// Per-axis constraints
constrainPositionX/Y/Z: boolean;  // Lock specific position axes
constrainRotationX/Y/Z: boolean;  // Lock specific rotation axes
constrainScaleX/Y/Z: boolean;     // Lock specific scale axes
```

### DistanceEventsTS

```typescript
// Configuration
target: SceneObject;              // Target to measure distance from
distances: number[];              // Distance thresholds (meters)
events: ScriptComponent[];        // Scripts with callback functions
eventFunctions: string[];         // Function names to call
triggerOnGreaterThan: boolean;    // Trigger direction (default: true)

// Methods
addRange(minDistance: number, maxDistance: number): DistanceRange;
clearRanges(): void;
resetTriggeredDistances(): void;
getDistanceToTarget(): number;

// DistanceRange methods
addOnEnterRangeListener(callback: () => void): void;
addOnPercentInsideRangeListener(callback: (percent: number) => void): void;
addOnExitRangeListener(callback: () => void): void;
```

### ScaleOverDistanceLinearTS

```typescript
// Configuration
target: SceneObject;              // Target to measure distance from
minDistance: number;              // Minimum distance (default: 1.0m)
maxDistance: number;              // Maximum distance (default: 10.0m)
minScale: number;                 // Scale at minimum distance (default: 0.5)
maxScale: number;                 // Scale at maximum distance (default: 2.0)
```

## Advanced Usage

### Example 1: Billboard UI Panel with Smooth Transitions

Create a UI panel that smoothly faces the user while maintaining upright orientation:

```typescript
@component
export class BillboardPanel extends BaseScriptComponent {
    @input
    panel: SceneObject;

    @input
    camera: SceneObject;

    private billboard: BillboardTS;

    onAwake() {
        // Create billboard component
        this.billboard = this.panel.createComponent("Component.ScriptComponent") as BillboardTS;
        this.billboard.target = this.camera;
        this.billboard.lookAway = false; // Face towards camera

        print("Billboard panel configured for smooth camera facing");
    }
}
```

**Key Points:**
- `lookAway = false` makes the panel face the camera directly
- Y-axis-only rotation keeps the panel upright
- Built-in slerping (5x delta time) provides smooth transitions
- No manual rotation calculations needed

### Example 2: Tethered Information Display with Reorientation

Create an info display that stays near the user but repositions when needed:

```typescript
@component
export class TetheredInfoDisplay extends BaseScriptComponent {
    @input
    infoPanel: SceneObject;

    @input
    camera: SceneObject;

    private tether: TetherTS;

    onAwake() {
        this.tether = this.infoPanel.createComponent("Component.ScriptComponent") as TetherTS;

        // Position 60cm in front, 20cm below eye level, 15cm to the right
        this.tether.target = this.camera;
        this.tether.offset = new vec3(0.15, -0.2, 0.6);

        // Tight thresholds for responsive repositioning
        this.tether.horizontalDistanceFromTarget = 0.15;
        this.tether.verticalDistanceFromTarget = 0.1;

        // Reorient with camera but flatten rotation for horizon-locked effect
        this.tether.reorientDuringTargetRotation = true;
        this.tether.flattenDuringTargetRotation = true;

        // Fast lerp for responsive feel
        this.tether.lerpSpeed = 8.0;
    }
}
```

**Key Points:**
- Offset is applied in target's local space when reorientation is enabled
- Flattening keeps the panel level with the horizon
- Separate horizontal/vertical thresholds provide different behavior per axis
- High lerp speed makes repositioning feel snappy

### Example 3: Transform Mirror with Selective Constraints

Mirror a camera's position but not its rotation, creating a fixed-orientation follower:

```typescript
@component
export class FollowerCamera extends BaseScriptComponent {
    @input
    follower: SceneObject;

    @input
    leader: SceneObject;

    private matcher: MatchTransformTS;

    onAwake() {
        this.matcher = this.follower.createComponent("Component.ScriptComponent") as MatchTransformTS;
        this.matcher.target = this.leader;

        // Match position with offset
        this.matcher.positionOffset = new vec3(0, 0.3, -0.5); // Above and behind
        this.matcher.usePositionLerp = true;
        this.matcher.positionLerpSpeed = 3.0;

        // Don't match rotation at all
        this.matcher.constrainRotationX = true;
        this.matcher.constrainRotationY = true;
        this.matcher.constrainRotationZ = true;

        // Don't match scale
        this.matcher.constrainScaleX = true;
        this.matcher.constrainScaleY = true;
        this.matcher.constrainScaleZ = true;
    }
}
```

**Key Points:**
- Setting all rotation constraints to true prevents any rotation matching
- Position matching works in world space with offset
- Lerping creates smooth camera movements
- Ideal for creating cinematic camera angles

### Example 4: Multi-Threshold Distance Event System

Create a progressive reveal system with multiple distance zones:

```typescript
@component
export class ProximityReveal extends BaseScriptComponent {
    @input
    target: SceneObject;

    @input
    level1Content: SceneObject;

    @input
    level2Content: SceneObject;

    @input
    level3Content: SceneObject;

    private distanceEvents: DistanceEventsTS;
    private ranges: DistanceRange[] = [];

    onAwake() {
        this.distanceEvents = this.sceneObject.createComponent("Component.ScriptComponent") as DistanceEventsTS;
        this.distanceEvents.target = this.target;

        // Hide all content initially
        this.level1Content.enabled = false;
        this.level2Content.enabled = false;
        this.level3Content.enabled = false;

        // Zone 1: 3-5 meters - show basic content
        const range1 = this.distanceEvents.addRange(3.0, 5.0);
        range1.addOnEnterRangeListener(() => {
            print("Entered zone 1 (3-5m)");
            this.level1Content.enabled = true;
        });
        range1.addOnExitRangeListener(() => {
            this.level1Content.enabled = false;
        });

        // Zone 2: 1.5-3 meters - show intermediate content
        const range2 = this.distanceEvents.addRange(1.5, 3.0);
        range2.addOnEnterRangeListener(() => {
            print("Entered zone 2 (1.5-3m)");
            this.level2Content.enabled = true;
        });
        range2.addOnExitRangeListener(() => {
            this.level2Content.enabled = false;
        });

        // Zone 3: 0-1.5 meters - show detailed content
        const range3 = this.distanceEvents.addRange(0, 1.5);
        range3.addOnEnterRangeListener(() => {
            print("Entered zone 3 (0-1.5m)");
            this.level3Content.enabled = true;
        });
        range3.addOnExitRangeListener(() => {
            this.level3Content.enabled = false;
        });

        // Monitor percentage within closest zone
        range3.addOnPercentInsideRangeListener((percent: number) => {
            // percent = 0 at 1.5m edge, 1 at 0m (deepest)
            const scale = 0.5 + (percent * 0.5); // Scale from 0.5 to 1.0
            this.level3Content.getTransform().setLocalScale(new vec3(scale, scale, scale));
        });
    }
}
```

**Key Points:**
- Multiple ranges can overlap and trigger independently
- Enter/exit events prevent duplicate triggers
- Percent-inside listeners enable smooth transitions
- Ranges are checked every frame efficiently

### Example 5: Depth-Based Scaling for Consistent Apparent Size

Make sprites maintain consistent apparent size regardless of distance:

```typescript
@component
export class DepthScaledSprite extends BaseScriptComponent {
    @input
    sprite: SceneObject;

    @input
    camera: SceneObject;

    private scaler: ScaleOverDistanceLinearTS;

    onAwake() {
        this.scaler = this.sprite.createComponent("Component.ScriptComponent") as ScaleOverDistanceLinearTS;
        this.scaler.target = this.camera;

        // Scale inversely with distance to maintain apparent size
        // At 1m: scale = 0.1, At 10m: scale = 1.0
        this.scaler.minDistance = 1.0;
        this.scaler.maxDistance = 10.0;
        this.scaler.minScale = 0.1;
        this.scaler.maxScale = 1.0;

        print("Depth-scaled sprite configured");
    }
}
```

**Key Points:**
- Linear remapping automatically handles the math
- Values are clamped to prevent extreme scales
- Uniform scaling maintains sprite proportions
- Works in real-time with no performance overhead

### Example 6: Combined Tether and Billboard System

Create a floating menu that tethers to the user and faces them:

```typescript
@component
export class FloatingMenu extends BaseScriptComponent {
    @input
    menuPanel: SceneObject;

    @input
    camera: SceneObject;

    private tether: TetherTS;
    private billboard: BillboardTS;

    onAwake() {
        // Add tether to maintain position
        this.tether = this.menuPanel.createComponent("Component.ScriptComponent") as TetherTS;
        this.tether.target = this.camera;
        this.tether.offset = new vec3(0.3, 0, 0.8); // To the right and in front
        this.tether.horizontalDistanceFromTarget = 0.25;
        this.tether.verticalDistanceFromTarget = 0.15;
        this.tether.reorientDuringTargetRotation = false; // Don't rotate with camera
        this.tether.lerpSpeed = 6.0;

        // Add billboard to face camera
        this.billboard = this.menuPanel.createComponent("Component.ScriptComponent") as BillboardTS;
        this.billboard.target = this.camera;
        this.billboard.lookAway = false;

        print("Floating menu with tether + billboard configured");
    }

    // Method to reposition menu to other side
    repositionToLeft() {
        this.tether.offset = new vec3(-0.3, 0, 0.8); // Mirror to left side
    }
}
```

**Key Points:**
- Multiple solvers can work together on the same object
- Tether handles position, billboard handles rotation
- `reorientDuringTargetRotation = false` lets billboard handle all rotation
- Solvers execute in component order automatically

### Example 7: Distance-Based Material Animation

Animate material properties based on proximity:

```typescript
@component
export class ProximityGlow extends BaseScriptComponent {
    @input
    target: SceneObject;

    @input
    glowObject: SceneObject;

    @input
    material: Material;

    private distanceEvents: DistanceEventsTS;

    onAwake() {
        this.distanceEvents = this.glowObject.createComponent("Component.ScriptComponent") as DistanceEventsTS;
        this.distanceEvents.target = this.target;

        // Create glow range: 0.5m to 2.0m
        const glowRange = this.distanceEvents.addRange(0.5, 2.0);

        // Animate glow intensity based on distance percentage
        glowRange.addOnPercentInsideRangeListener((percent: number) => {
            // percent = 0 at 2.0m edge, 1 at 0.5m (closest)
            const intensity = percent * 2.0; // 0 to 2x intensity
            this.material.mainPass.glowIntensity = intensity;

            // Also scale object slightly
            const scale = 1.0 + (percent * 0.2); // 1.0 to 1.2x scale
            this.glowObject.getTransform().setLocalScale(new vec3(scale, scale, scale));
        });

        // Reset when exiting range
        glowRange.addOnExitRangeListener(() => {
            this.material.mainPass.glowIntensity = 0;
            this.glowObject.getTransform().setLocalScale(vec3.one());
        });
    }
}
```

**Key Points:**
- Percent-inside callbacks fire every frame while in range
- Smooth interpolation of material properties
- Combined visual effects for rich feedback
- Exit listener resets state cleanly

### Example 8: Path-Following with Transform Matching and Offset Animation

Create a camera that follows a path while maintaining custom orientation:

```typescript
@component
export class PathFollowingCamera extends BaseScriptComponent {
    @input
    camera: SceneObject;

    @input
    pathObject: SceneObject; // Object moving along path

    private matcher: MatchTransformTS;
    private time: number = 0;

    onAwake() {
        this.matcher = this.camera.createComponent("Component.ScriptComponent") as MatchTransformTS;
        this.matcher.target = this.pathObject;

        // Match position with dynamic offset
        this.matcher.usePositionLerp = true;
        this.matcher.positionLerpSpeed = 2.0;

        // Lock Y position at fixed height
        this.matcher.constrainPositionY = true;

        // Don't match rotation - camera has its own look target
        this.matcher.constrainRotationX = true;
        this.matcher.constrainRotationY = true;
        this.matcher.constrainRotationZ = true;

        this.createEvent("UpdateEvent").bind(() => {
            this.animateOffset();
        });
    }

    animateOffset() {
        this.time += getDeltaTime();

        // Animate offset in a circle around path
        const radius = 0.5;
        const x = Math.cos(this.time) * radius;
        const z = Math.sin(this.time) * radius;

        this.matcher.positionOffset = new vec3(x, 0.2, z);
    }
}
```

**Key Points:**
- Dynamic offset animation while transform matching
- Selective axis constraints for custom behavior
- Smooth lerping prevents jarring movements
- Path object can use any animation system

Built with 👻 by the Spectacles team


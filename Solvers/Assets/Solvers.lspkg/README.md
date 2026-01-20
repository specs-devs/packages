# Solvers for Snapchat Spectacles

This folder contains a collection of solver components for Snapchat Spectacles applications. Solvers help position, orient, and scale objects relative to each other or the user's view, providing smart spatial behaviors for AR experiences.

## Overview

The Solvers system provides:
- Positioning solutions to maintain content visibility
- Rotation utilities to orient objects towards targets
- Distance-based behaviors for dynamic interactions
- Scale adjustments based on spatial relationships
- Event triggers based on proximity and movement

All solvers are available in both TypeScript (TS) and JavaScript (JS) versions with identical functionality.

## Available Components

### Position and Orientation Solvers

| Component | Description |
|-----------|-------------|
| `BillboardTS/JS` | Makes an object face the target (typically the camera) by rotating around the Y-axis only |
| `MatchTransformTS/JS` | Matches position, rotation, and/or scale of a target object with customizable constraints |
| `TetherTS/JS` | Keeps content within view by repositioning when it moves too far from the target |
| `TetherBetweenAngleRangeTS/JS` | Repositions content only when specific angle or distance thresholds are exceeded |
| `InBetweenRotationUtilityTS/JS` | Smoothly interpolates between two rotation states |
| `SharpTurnTS/JS` | Detects when a sharp turn occurs and triggers events accordingly |

### Distance-Based Solvers

| Component | Description |
|-----------|-------------|
| `DistanceEventsTS/JS` | Triggers custom events when distances between objects cross specified thresholds |
| `DistanceEventsCallbacks` | Companion script to implement callback methods for distance events |
| `ScaleOverDistanceLinearTS/JS` | Linearly scales an object based on its distance from a target |

## Component Details

### BillboardTS/JS

Makes content always face the target (typically the camera), rotating only around the Y-axis for a natural look.

| Property | Description |
|----------|-------------|
| `lookAway` | Whether to face toward or away from the target |
| `target` | The object to face (defaults to main camera if not set) |

### TetherTS/JS

Keeps content within view by repositioning when it moves too far from the target or when viewing angle becomes extreme.

| Property | Description |
|----------|-------------|
| `target` | The object to tether to (typically camera) |
| `verticalDistanceFromTarget` | Minimum vertical movement to trigger repositioning |
| `horizontalDistanceFromTarget` | Minimum horizontal movement to trigger repositioning |
| `reorientDuringTargetRotation` | Whether content should rotate with the target |
| `offset` | Position offset relative to the target |
| `lerpSpeed` | Speed of position interpolation |

### MatchTransformTS/JS

Matches position, rotation, and/or scale of a target object with fine-grained control over which transforms to match.

| Property | Description |
|----------|-------------|
| `target` | The object to match transforms with |
| `positionOffset` | Offset from the target's position |
| `usePositionLerp` | Whether to use smooth position interpolation |
| `positionLerpSpeed` | Speed of position interpolation |
| `rotationLerpSpeed` | Speed of rotation interpolation |
| `scaleLerpSpeed` | Speed of scale interpolation |
| `constrainPositionX/Y/Z` | Locks specific position axes |

### DistanceEventsTS/JS

Triggers events when the distance between objects crosses specified thresholds.

| Property | Description |
|----------|-------------|
| `target` | The object to measure distance from |
| `distances` | Array of distance thresholds that will trigger events |
| `events` | Script components containing callback methods |
| `eventFunctions` | Names of callback functions to invoke |
| `triggerOnGreaterThan` | Whether to trigger when distance becomes greater than (not less than) threshold |

### ScaleOverDistanceLinearTS/JS

Linearly adjusts an object's scale based on its distance from a target.

| Property | Description |
|----------|-------------|
| `target` | The reference object for distance measurement |
| `minDistance` | Distance at which minimum scale applies |
| `maxDistance` | Distance at which maximum scale applies |
| `minScale` | Scale factor at minimum distance |
| `maxScale` | Scale factor at maximum distance |

### TetherBetweenAngleRangeTS/JS

Advanced tethering that only repositions content when specific angle or distance thresholds are exceeded.

| Property | Description |
|----------|-------------|
| `target` | The object to tether to |
| `angleThreshold` | Minimum angle difference to trigger repositioning |
| `verticalDistanceThreshold` | Minimum vertical distance to trigger repositioning |
| `horizontalDistanceThreshold` | Minimum horizontal distance to trigger repositioning |
| `offset` | Position offset relative to the target |
| `lerpSpeed` | Speed of position interpolation |
| `showDebug` | Displays debug information |

## How to Use

### Common Pattern

Most solver components follow this usage pattern:

1. Add the component script to the object you want to control
2. Set the target reference (usually another object or the camera)
3. Configure behavior parameters (distances, angles, speeds, etc.)
4. The solver will automatically update during runtime

### Example Usage

```typescript
// Example using BillboardTS to make an info panel face the camera
@component
class MyARExperience extends BaseScriptComponent {
    @input
    infoPanel!: SceneObject;
    
    @input
    mainCamera!: SceneObject;
    
    onStart(): void {
        // Add billboard behavior to info panel
        const billboard = this.infoPanel.getOrCreateComponent(BillboardTS);
        billboard.target = this.mainCamera;
        billboard.lookAway = false;  // Face toward camera
    }
}
```

## Language Support

Every solver is available in both TypeScript (.ts) and JavaScript (.js) versions:

- TypeScript files are in the `/TS` folder
- JavaScript files are in the `/JS` folder

The functionality is identical between versions, allowing you to choose the language that fits your development preference.

## Combining Solvers

These solvers can be combined to create complex spatial behaviors:

- Use `TetherTS` with `BillboardTS` to keep UI elements visible and properly oriented
- Combine `ScaleOverDistanceLinearTS` with `DistanceEventsTS` for distance-aware interactions
- Layer multiple solvers on a hierarchy of objects for sophisticated spatial relationships

## Important Notes

- Most solvers update every frame, so use only what you need for optimal performance
- When setting a target, you can typically use the main camera as a default
- Many solvers include debug options to visualize their behavior during development
- For custom behaviors, extend the solver scripts or combine multiple solvers
- All solvers support animation integration via lerping parameters
 

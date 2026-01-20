# Runtime Gizmos for Snapchat Spectacles

This folder contains a collection of visual gizmo components for Snapchat Spectacles applications. These gizmos allow you to visualize and debug spatial relationships in your AR experiences by drawing various shapes and lines at runtime.

## Overview

The Runtime Gizmos system provides:
- Visual debugging tools for spatial development
- Dynamic visualization components that update in real-time
- Customizable appearance settings for all gizmos
- Components that can follow and adapt to moving objects

## Available Components

### Line Component

The `Line` component draws a straight line between two points in 3D space.

| Property | Description |
|----------|-------------|
| `startPointObject` | The scene object that defines the start point of the line |
| `endPointObject` | The scene object that defines the end point of the line |
| `_beginColor` | Color of the line at the start point |
| `_endColor` | Color of the line at the end point |
| `lineWidth` | Width/thickness of the line |
| `lineLength` | Maximum length of the line |
| `lineStyle` | Visual style of the line (Full, Split, FadedEnd) |
| `shouldStick` | Whether the line should stick to the objects if they move |

### Circle Component

The `Circle` component visualizes a circle in 3D space.

| Property | Description |
|----------|-------------|
| `centerObject` | The scene object that defines the center of the circle |
| `radius` | The radius of the circle |
| `followRotation` | Whether the circle should follow the center object's rotation |
| `_color` | Color of the circle |
| `lineWidth` | Width/thickness of the circle line |
| `lineStyle` | Visual style of the circle (Full, Split, FadedEnd) |
| `segments` | Number of segments used to approximate the circle |

### Spline Component

The `Spline` component creates a smooth curve through a series of control points.

| Property | Description |
|----------|-------------|
| `controlPoints` | Array of scene objects that define the control points |
| `interpolationPoints` | Number of points between each control point |
| `tension` | Tension parameter that controls curve tightness (0-1) |
| `closedLoop` | Whether the spline should connect back to the first point |
| `_color` | Color of the spline |
| `lineWidth` | Width/thickness of the spline |
| `lineStyle` | Visual style of the spline (Full, Split, FadedEnd) |

### ClosedPolyline Component

The `ClosedPolyline` component draws a series of connected line segments forming a closed shape.

| Property | Description |
|----------|-------------|
| `points` | Array of scene objects that define the vertices of the polyline |
| `_color` | Color of the polyline |
| `lineWidth` | Width/thickness of the polyline |
| `lineStyle` | Visual style of the polyline (Full, Split, FadedEnd) |
| `continuousLine` | Whether to render as one continuous line or separate segments |

### Spiral Component

The `Spiral` component visualizes a 3D spiral shape.

| Property | Description |
|----------|-------------|
| `centerObject` | The scene object that defines the center of the spiral |
| `startRadiusAmplitude` | The starting radius of the spiral |
| `endRadiusAmplitude` | The ending radius of the spiral |
| `axisLength` | Length of the spiral along its axis |
| `loops` | Number of complete loops in the spiral |
| `followRotation` | Whether the spiral should follow the center object's rotation |
| `axisDirection` | Which axis the spiral expands along (X, Y, or Z) |
| `_color` | Color of the spiral |
| `lineWidth` | Width/thickness of the spiral line |
| `lineStyle` | Visual style of the spiral (Full, Split, FadedEnd) |

## How to Use

### Quick Setup

1. Drag the `RuntimeGizmos__PLACE_IN_SCENE.prefab` into your scene
2. Add any of the gizmo components to objects in your scene
3. Configure the properties to customize appearance and behavior
4. The gizmos will appear in the scene at runtime

### Common Usage Pattern

1. Create empty scene objects to serve as reference points
2. Add the appropriate gizmo component to a parent object
3. Assign the reference points to the component's properties
4. Configure visual styling (color, width, style)
5. The gizmo will automatically update if the reference points move

### Example Usage

```typescript
// Example of using a Circle gizmo to visualize a detection range
@component
class MyDetectionSystem extends BaseScriptComponent {
    @input
    circleGizmo!: Circle;
    
    @input
    detectionRange: number = 5.0;
    
    onStart(): void {
        // Set the circle radius to match the detection range
        this.circleGizmo.radius = this.detectionRange;
        
        // Customize the appearance
        this.circleGizmo._color = new vec3(1, 0, 0); // Red color
    }
}
```

## Visual Styles

All gizmo components support three visual styles:

| Style | Description |
|-------|-------------|
| `Full` | A continuous line with uniform appearance |
| `Split` | Line divided into segments with gaps |
| `FadedEnd` | Line that gradually fades toward the end points |

## Important Notes

- Gizmos are intended primarily for development and debugging
- For optimal performance, use only the necessary gizmos
- Gizmos automatically update their position and shape when reference objects move
- All gizmos leverage the Spectacles Interaction Kit for rendering
- The visual material can be customized for special rendering effects
 

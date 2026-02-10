![RuntimeGizmos](AssetImage/RuntimeGizmos.png)

# Runtime Gizmos

A debugging and visualization toolkit that renders geometric primitives in real-time. This package provides Line, Circle, Spline, ClosedPolyline, and Spiral gizmos for visualizing vectors, paths, boundaries, and spatial relationships directly in your AR experience.

## Features

- **Line Gizmos**: Render straight lines between two points with configurable width and color
- **Circle Gizmos**: Draw circles with dynamic radius and rotation following
- **Spline Curves**: Smooth interpolated curves through control points with adjustable tension
- **Closed Polylines**: Connect multiple points in a closed shape
- **Spiral Patterns**: Generate logarithmic or Archimedean spirals for decorative effects
- **Visual Styles**: Three rendering modes - Full, Split, and FadedEnd
- **Dynamic Updates**: Gizmos automatically track moving objects in real-time
- **InteractorLineRenderer Integration**: Leverages SIK's line rendering system for performance

## Quick Start

Create a line gizmo to visualize a connection between two objects:

```typescript
import {Line} from "RuntimeGizmos.lspkg/Scripts/Line";

@component
export class DebugConnection extends BaseScriptComponent {
  @input pointA: SceneObject;
  @input pointB: SceneObject;
  @input lineMaterial: Material;

  onAwake() {
    // Create line gizmo
    const lineGizmo = this.sceneObject.createComponent("Line");
    lineGizmo.startObject = this.pointA;
    lineGizmo.endObject = this.pointB;
    lineGizmo.lineMaterial = this.lineMaterial;
    lineGizmo.color = new vec3(1, 0, 0);  // Red
    lineGizmo.lineWidth = 0.5;

    // Line will automatically update as objects move
  }
}
```

## Script Highlights

### Line.ts
Renders a dynamic line segment between two scene objects with automatic position tracking. The component continuously monitors both start and end object transforms and updates the line visualization when either object moves. Supports configurable width, color (vec3), and three visual styles (Full, Split, FadedEnd). Uses InteractorLineRenderer from SIK for efficient rendering and provides enable/disable functionality for toggling visibility. The line maintains local-to-world transform calculations for proper world-space rendering.

### Circle.ts
Creates a circular gizmo that follows a center object with optional rotation tracking. The circle is approximated using a configurable number of segments (default 32) for smooth appearance. Supports dynamic radius changes and can either follow the center object's rotation or maintain a fixed orientation. The component generates circle points in the XY plane using trigonometric calculations and converts them to world space. Includes methods for runtime radius adjustment (setRadius), rotation following toggle (setFollowRotation), and segment count changes (setSegments).

### Spline.ts
Generates smooth curves through an array of control points using Catmull-Rom spline interpolation. The component supports configurable tension (0 = straight lines, 1 = tight curve) and interpolation density for smoothness control. Can create closed loops by connecting the last point to the first. The spline automatically tracks control point movements and regenerates the curve when positions change. Perfect for visualizing paths, animation curves, or creating decorative ribbons that follow multiple reference objects.

### ClosedPolyline.ts
Connects multiple scene objects with line segments forming a closed polygon. The component monitors all control points and updates the shape when any point moves. Useful for visualizing boundaries, creating selection boxes around multiple objects, or drawing arbitrary closed shapes. Supports the same visual style options as other gizmos and maintains efficient rendering by only regenerating when needed.

## Core API Methods

### Line

```typescript
// Start and end points
startObject: SceneObject
endObject: SceneObject

// Visual properties
color: vec3
lineWidth: number
lineStyle: number  // 0=Full, 1=Split, 2=FadedEnd

// Material
lineMaterial: Material

// Enable/disable
isEnabled: boolean
```

### Circle

```typescript
// Center and rotation tracking
centerObject: SceneObject
followRotation: boolean

// Circle dimensions
radius: number
segments: number

// Visual properties
color: vec3
lineWidth: number
lineStyle: number

// Runtime adjustments
setRadius(newRadius: number): void
setFollowRotation(follow: boolean): void
setSegments(segments: number): void
```

### Spline

```typescript
// Control points array
controlPoints: SceneObject[]

// Curve parameters
tension: number
interpolationPoints: number
closedLoop: boolean

// Visual properties
color: vec3
lineWidth: number
lineStyle: number

// Regenerate curve
refreshSpline(): void
```

## Advanced Usage

### Vector Field Visualization

Create a field of arrows showing direction and magnitude:

```typescript
@component
export class VectorField extends BaseScriptComponent {
  @input fieldCenter: SceneObject;
  @input gridSize: number = 10;
  @input spacing: number = 2.0;
  @input lineMaterial: Material;

  private lines: Line[] = [];

  onAwake() {
    this.generateVectorField();

    // Animate field over time
    const updateEvent = this.createEvent("UpdateEvent");
    let time = 0;
    updateEvent.bind(() => {
      time += getDeltaTime();
      this.updateVectorDirections(time);
    });
  }

  generateVectorField() {
    const centerPos = this.fieldCenter.getTransform().getWorldPosition();

    for (let x = 0; x < this.gridSize; x++) {
      for (let z = 0; z < this.gridSize; z++) {
        const startPos = new vec3(
          centerPos.x + (x - this.gridSize / 2) * this.spacing,
          centerPos.y,
          centerPos.z + (z - this.gridSize / 2) * this.spacing
        );

        // Create start point
        const startObj = global.scene.createSceneObject("VectorStart");
        startObj.getTransform().setWorldPosition(startPos);

        // Create end point (will be animated)
        const endObj = global.scene.createSceneObject("VectorEnd");

        // Create line
        const line = this.sceneObject.createComponent("Line");
        line.startObject = startObj;
        line.endObject = endObj;
        line.lineMaterial = this.lineMaterial;
        line.color = new vec3(0, 1, 1);
        line.lineWidth = 0.3;
        line.lineStyle = 2;  // FadedEnd

        this.lines.push(line);
      }
    }
  }

  updateVectorDirections(time: number) {
    this.lines.forEach((line, index) => {
      const startPos = line.startObject.getTransform().getWorldPosition();

      // Calculate direction based on some function
      const dx = Math.sin(startPos.x * 0.5 + time);
      const dz = Math.cos(startPos.z * 0.5 + time);
      const direction = new vec3(dx, 0, dz).normalize();

      const endPos = startPos.add(direction.uniformScale(1.5));
      line.endObject.getTransform().setWorldPosition(endPos);
    });
  }
}
```

### Path Preview System

Visualize a curved path with control point handles:

```typescript
@component
export class PathEditor extends BaseScriptComponent {
  @input pathPoints: SceneObject[];
  @input splineMaterial: Material;
  @input handleMaterial: Material;

  private pathSpline: Spline;
  private handleCircles: Circle[] = [];

  onAwake() {
    // Create main path spline
    this.pathSpline = this.sceneObject.createComponent("Spline");
    this.pathSpline.controlPoints = this.pathPoints;
    this.pathSpline.lineMaterial = this.splineMaterial;
    this.pathSpline.color = new vec3(1, 1, 0);
    this.pathSpline.lineWidth = 0.5;
    this.pathSpline.tension = 0.5;
    this.pathSpline.interpolationPoints = 20;
    this.pathSpline.closedLoop = false;

    // Add handle circles at each control point
    this.pathPoints.forEach((point) => {
      const circle = this.sceneObject.createComponent("Circle");
      circle.centerObject = point;
      circle.lineMaterial = this.handleMaterial;
      circle.color = new vec3(0, 1, 0);
      circle.radius = 0.5;
      circle.lineWidth = 0.2;
      circle.followRotation = false;

      this.handleCircles.push(circle);
    });
  }

  addPathPoint(newPoint: SceneObject) {
    this.pathPoints.push(newPoint);
    this.pathSpline.controlPoints = this.pathPoints;
    this.pathSpline.refreshSpline();

    // Add handle for new point
    const circle = this.sceneObject.createComponent("Circle");
    circle.centerObject = newPoint;
    circle.lineMaterial = this.handleMaterial;
    circle.color = new vec3(0, 1, 0);
    circle.radius = 0.5;
    this.handleCircles.push(circle);
  }
}
```

### Debug Boundary Visualization

Show collision boundaries and trigger zones with colored gizmos:

```typescript
@component
export class BoundaryDebugger extends BaseScriptComponent {
  @input triggerZones: SceneObject[];
  @input collisionBounds: SceneObject[];
  @input lineMaterial: Material;

  onAwake() {
    // Visualize trigger zones as green circles
    this.triggerZones.forEach((zone) => {
      const circle = this.sceneObject.createComponent("Circle");
      circle.centerObject = zone;
      circle.lineMaterial = this.lineMaterial;
      circle.color = new vec3(0, 1, 0);  // Green
      circle.radius = zone.getTransform().getLocalScale().x;
      circle.lineWidth = 0.3;
      circle.followRotation = true;
    });

    // Visualize collision bounds as red closed polylines
    this.collisionBounds.forEach((bounds) => {
      const children = bounds.getChildren();
      if (children.length > 0) {
        const polyline = this.sceneObject.createComponent("ClosedPolyline");
        polyline.controlPoints = children;
        polyline.lineMaterial = this.lineMaterial;
        polyline.color = new vec3(1, 0, 0);  // Red
        polyline.lineWidth = 0.4;
      }
    });

    // Toggle visibility with tap
    const touchEvent = this.createEvent("TapEvent");
    let debugVisible = true;
    touchEvent.bind(() => {
      debugVisible = !debugVisible;
      this.sceneObject.enabled = debugVisible;
      print(`Debug gizmos: ${debugVisible ? "ON" : "OFF"}`);
    });
  }
}
```

## Built with 👻 by the Spectacles team


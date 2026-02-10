![VolumetricLine](../AssetImage/VolumetricLine.png)

# VolumetricLine

VolumetricLine is a 3D line rendering system that creates smooth,volumetric tubes by extruding circular cross-sections along paths defined by scene objects. It features spline interpolation for curved lines, real-time mesh generation, continuous position tracking, and customizable appearance with radius, smoothness, and material properties for creating visual connections, trails, and decorative elements.

## Features

- **3D Tube Rendering**: Creates volumetric lines with circular cross-sections
- **Spline Interpolation**: Smooth curves with configurable smoothness and interpolation steps
- **Dynamic Path Following**: Lines follow scene object positions in real-time
- **Smooth Animation**: Per-frame updates with position smoothing for silky-smooth animations
- **Programmatic Creation**: Create lines via `createComponent()` without prefabs
- **End Caps**: Optional capped or open tube ends
- **Material Support**: Custom materials with color and texture control
- **Position Correction**: Automatic offset detection and coordinate space handling
- **Performance Options**: Configurable update rates, smooth vs throttled updates, and position smoothing

## Quick Start

Create a line connecting multiple objects:

```typescript
import { VolumetricLine } from "VolumetricLine.lspkg/Scripts/VolumetricLine";

@component
export class LineDemo extends BaseScriptComponent {
  @input pathPoints: SceneObject[];
  @input lineMaterial: Material;

  onAwake() {
    // Create volumetric line component
    const lineObj = global.scene.createSceneObject("MyLine");
    const line = lineObj.createComponent(VolumetricLine.getTypeName()) as VolumetricLine;

    // Configure line
    line.pathPoints = this.pathPoints;
    line.radius = 5.0;
    line.material = this.lineMaterial;
    line.capEnds = true;

    // For animated points, enable smooth updates
    line.smoothUpdate = true;        // Update every frame
    line.positionSmoothing = 0.3;   // Reduce jitter

    // Line automatically updates as path points move
  }
}
```

## Script Highlights

- **VolumetricLine.ts**: Core 3D line component with mesh generation. Creates tube geometry by extruding circle cross-sections along spline-interpolated paths. Handles vertex/UV/normal generation for render mesh, real-time position tracking with configurable update rates, spline smoothing using Catmull-Rom interpolation, coordinate space transformations (local/world), automatic offset correction for alignment issues, and end cap generation. Supports programmatic creation via createComponent().

- **RandomPositionAnimator.ts**: Helper component for animating path point positions. Randomly moves objects within specified bounds for dynamic line animation. Useful for testing and creating animated line effects with configurable speed and range parameters.

## Core API Methods

### Component Setup

```typescript
// Create via component system
const lineObj = global.scene.createSceneObject("Line");
const line = lineObj.createComponent(VolumetricLine.getTypeName()) as VolumetricLine;

// Configure path
line.pathPoints = [point1, point2, point3, point4];

// Set appearance
line.radius = 10.0;
line.circleSegments = 16; // Higher = smoother circle
line.material = myMaterial;
line.color = new vec3(1, 0, 0); // Red

// Configure smoothness
line.smoothness = 0.8; // 0=linear, 1=very smooth
line.interpolationSteps = 20; // Points between path nodes

// Options
line.capEnds = true;
line.continuousUpdate = true;
line.updateRate = 0.05; // Seconds between updates
```

### Dynamic Updates

```typescript
// Manual mesh update
line.updateMesh();

// Change properties at runtime
line.radius = 15.0; // Triggers automatic update
line.smoothness = 0.5;
```

## Advanced Usage

### Creating Curved Paths

```typescript
@component
export class CurvedLinePath extends BaseScriptComponent {
  @input startPoint: SceneObject;
  @input endPoint: SceneObject;
  @input lineMaterial: Material;

  onAwake() {
    // Create intermediate control points for smooth curve
    const controlPoints = this.generateControlPoints(
      this.startPoint.getTransform().getWorldPosition(),
      this.endPoint.getTransform().getWorldPosition(),
      5 // Number of control points
    );

    // Create line with smooth interpolation
    const lineObj = global.scene.createSceneObject("CurvedLine");
    const line = lineObj.createComponent(VolumetricLine.getTypeName()) as VolumetricLine;

    line.pathPoints = controlPoints;
    line.radius = 8.0;
    line.smoothness = 0.9; // Very smooth curve
    line.interpolationSteps = 30; // High interpolation
    line.material = this.lineMaterial;
    line.capEnds = true;
  }

  private generateControlPoints(start: vec3, end: vec3, count: number): SceneObject[] {
    const points: SceneObject[] = [];
    const direction = end.sub(start);

    for (let i = 0; i <= count; i++) {
      const t = i / count;
      const position = start.add(direction.uniformScale(t));

      // Add curve variation
      position.y += Math.sin(t * Math.PI) * 20;

      const obj = global.scene.createSceneObject(`ControlPoint_${i}`);
      obj.getTransform().setWorldPosition(position);
      points.push(obj);
    }

    return points;
  }
}
```

### Smooth Animated Lines

```typescript
@component
export class SmoothAnimatedLine extends BaseScriptComponent {
  @input pathPoints: SceneObject[];
  @input lineMaterial: Material;

  private line: VolumetricLine;

  onAwake() {
    // Create line with smooth animation settings
    const lineObj = global.scene.createSceneObject("SmoothLine");
    this.line = lineObj.createComponent(VolumetricLine.getTypeName()) as VolumetricLine;

    this.line.pathPoints = this.pathPoints;
    this.line.radius = 5.0;
    this.line.material = this.lineMaterial;

    // Enable smooth per-frame updates for animated points
    this.line.smoothUpdate = true;
    this.line.positionSmoothing = 0.3; // Reduce jitter
    this.line.continuousUpdate = true;

    // Curve settings
    this.line.smoothness = 0.8;
    this.line.interpolationSteps = 15;
    this.line.capEnds = true;

    // Line automatically tracks moving points smoothly
  }
}
```

### Animated Connection Lines

```typescript
@component
export class AnimatedConnections extends BaseScriptComponent {
  @input nodes: SceneObject[];
  @input lineMaterial: Material;

  private lines: VolumetricLine[] = [];

  onAwake() {
    // Create lines between all adjacent nodes
    for (let i = 0; i < this.nodes.length - 1; i++) {
      const line = this.createConnection(this.nodes[i], this.nodes[i + 1]);
      this.lines.push(line);
    }

    // Animate line properties
    this.createEvent("UpdateEvent").bind(() => this.updateLines());
  }

  private createConnection(start: SceneObject, end: SceneObject): VolumetricLine {
    const lineObj = global.scene.createSceneObject(`Connection_${start.name}_${end.name}`);
    const line = lineObj.createComponent(VolumetricLine.getTypeName()) as VolumetricLine;

    line.pathPoints = [start, end];
    line.radius = 3.0;
    line.material = this.lineMaterial;
    line.smoothness = 0.7;
    line.capEnds = true;

    // Enable smooth updates since nodes are moving
    line.smoothUpdate = true;
    line.positionSmoothing = 0.2;

    return line;
  }

  private updateLines() {
    const time = getTime();

    // Pulse line radius
    this.lines.forEach((line, index) => {
      const pulse = Math.sin(time * 2 + index * 0.5) * 0.5 + 0.5;
      line.radius = 2 + pulse * 3;
    });
  }
}
```

### Trail Effect

```typescript
@component
export class ObjectTrail extends BaseScriptComponent {
  @input targetObject: SceneObject;
  @input trailLength: number = 20;
  @input lineMaterial: Material;

  private trailPoints: SceneObject[] = [];
  private line: VolumetricLine;

  onAwake() {
    // Create trail points
    for (let i = 0; i < this.trailLength; i++) {
      const point = global.scene.createSceneObject(`TrailPoint_${i}`);
      point.getTransform().setWorldPosition(
        this.targetObject.getTransform().getWorldPosition()
      );
      this.trailPoints.push(point);
    }

    // Create line for trail
    const lineObj = global.scene.createSceneObject("Trail");
    this.line = lineObj.createComponent(VolumetricLine.getTypeName()) as VolumetricLine;

    this.line.pathPoints = this.trailPoints;
    this.line.radius = 4.0;
    this.line.material = this.lineMaterial;
    this.line.smoothness = 0.8;
    this.line.interpolationSteps = 5;
    this.line.capEnds = true;

    // Update trail
    this.createEvent("UpdateEvent").bind(() => this.updateTrail());
  }

  private updateTrail() {
    // Shift all points back
    for (let i = this.trailPoints.length - 1; i > 0; i--) {
      const prevPos = this.trailPoints[i - 1].getTransform().getWorldPosition();
      this.trailPoints[i].getTransform().setWorldPosition(prevPos);
    }

    // Update first point to target position
    this.trailPoints[0].getTransform().setWorldPosition(
      this.targetObject.getTransform().getWorldPosition()
    );
  }
}
```

### Dynamic Line Network

```typescript
@component
export class LineNetwork extends BaseScriptComponent {
  @input networkNodes: SceneObject[];
  @input maxConnectionDistance: number = 50.0;
  @input lineMaterial: Material;

  private connections: Map<string, VolumetricLine> = new Map();

  onAwake() {
    this.createEvent("UpdateEvent").bind(() => this.updateNetwork());
  }

  private updateNetwork() {
    // Check all node pairs
    for (let i = 0; i < this.networkNodes.length; i++) {
      for (let j = i + 1; j < this.networkNodes.length; j++) {
        const nodeA = this.networkNodes[i];
        const nodeB = this.networkNodes[j];

        const distance = nodeA.getTransform().getWorldPosition()
          .distance(nodeB.getTransform().getWorldPosition());

        const key = `${i}_${j}`;

        if (distance < this.maxConnectionDistance) {
          // Create connection if it doesn't exist
          if (!this.connections.has(key)) {
            this.connections.set(key, this.createLine(nodeA, nodeB));
          }

          // Fade line based on distance
          const line = this.connections.get(key);
          const alpha = 1 - (distance / this.maxConnectionDistance);
          line.color = new vec3(alpha, alpha, alpha);
        } else {
          // Remove connection if too far
          if (this.connections.has(key)) {
            const line = this.connections.get(key);
            line.getSceneObject().destroy();
            this.connections.delete(key);
          }
        }
      }
    }
  }

  private createLine(nodeA: SceneObject, nodeB: SceneObject): VolumetricLine {
    const lineObj = global.scene.createSceneObject("NetworkConnection");
    const line = lineObj.createComponent(VolumetricLine.getTypeName()) as VolumetricLine;

    line.pathPoints = [nodeA, nodeB];
    line.radius = 2.0;
    line.material = this.lineMaterial;
    line.smoothness = 0.3;
    line.capEnds = false;

    return line;
  }
}
```

## Configuration Options

### Appearance

```typescript
radius: number = 10.0              // Tube radius
circleSegments: number = 16         // Circle resolution
color: vec3 = new vec3(1, 1, 0)    // Line color
material: Material                  // Custom material
capEnds: boolean = true            // Cap tube ends
```

### Interpolation

```typescript
smoothness: number = 0.5           // 0=linear, 1=smooth curve
interpolationSteps: number = 10     // Points between path nodes
```

### Updates

```typescript
continuousUpdate: boolean = true    // Auto-update on path changes
updateRate: number = 0.05          // Seconds between updates (throttled mode)
smoothUpdate: boolean = true        // Update every frame for smooth animation
positionSmoothing: number = 0.3    // Smoothing factor (0=instant, 1=very smooth)
```

### Coordinate Space

```typescript
useWorldPosition: boolean = true    // Use world vs local space
autoCorrectOffset: boolean = true   // Auto-detect position offsets
zOffset: number = 0.0              // Manual Z-axis correction
```

## Best Practices

1. **Path Point Count**: Use 3-10 path points for optimal performance
2. **Circle Segments**: 12-20 segments balances quality and performance
3. **Update Mode**:
   - Use `smoothUpdate: true` (default) for animated lines - updates every frame with interpolation
   - Use `smoothUpdate: false` with higher `updateRate` (0.1-0.2s) for static or slow-moving lines
4. **Position Smoothing**:
   - Set `positionSmoothing: 0.2-0.4` for fast-moving animations to reduce jitter
   - Set `positionSmoothing: 0.0` for precise position tracking
5. **Smoothness**: Higher smoothness (0.7-0.9) for organic curves, lower (0.3-0.5) for mechanical
6. **Interpolation Steps**: 5-20 steps depending on desired curve detail
7. **Material Optimization**: Reuse materials across multiple lines

## Performance Considerations

- **Mesh Generation**: Vertex count = pathPoints × interpolationSteps × circleSegments
- **Update Modes**:
  - **Smooth mode** (`smoothUpdate: true`): Updates every frame with position interpolation - ideal for animations
  - **Throttled mode** (`smoothUpdate: false`): Updates at `updateRate` interval - better for static/slow content
- **Memory**: Each line ~100 bytes + mesh data (vertices × 32 bytes)
- **Optimization Tips**:
  - For static lines: Set `continuousUpdate: false` and call `updateMesh()` manually
  - For slow animations: Use `smoothUpdate: false` with `updateRate: 0.1`
  - For fast animations: Use `smoothUpdate: true` with `positionSmoothing: 0.3` to reduce jitter

## Limitations

- **Minimum Path Points**: Requires at least 2 path points
- **Self-Intersection**: No automatic handling of self-intersecting paths
- **Texture UVs**: UV mapping is cylindrical, not ideal for complex textures
- **Sharp Angles**: Very sharp angles may cause visual artifacts at high smoothness

---

Built with 👻 by the Spectacles team



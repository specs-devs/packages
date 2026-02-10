![Instantiation](AssetImage/Instantiation.png)

# Instantiation

A comprehensive toolkit for procedurally spawning objects in various spatial patterns. This package provides ready-to-use components for creating grids, lines, circles, spheres, boxes, and random distributions, perfect for particle systems, object placement, level generation, and visualization effects.

## Features

- **Grid Patterns**: 2D and 3D grid layouts with configurable spacing and dimensions
- **Linear Distributions**: Spawn objects along lines with fixed or variable spacing
- **Circular Patterns**: Place objects around circles (perimeter, area, or pie slices)
- **Sphere Distributions**: Random or uniform placement on sphere surface or volume
- **Box Distributions**: Random placement on box surfaces or within box volumes
- **Fixed Distance Modes**: Precise object spacing for architectural or structured layouts
- **Runtime Gizmos**: Built-in line visualization tools for debugging placement algorithms

## Quick Start

Instantiate objects in a 3D grid pattern:

```typescript
import {InstantiateOn3DGridsTS} from "Instantiation.lspkg/TS/InstantiateOn3DGridsTS";

@component
export class GridSpawner extends BaseScriptComponent {
  @input prefab: ObjectPrefab;
  @input centerObject: SceneObject;

  onAwake() {
    const gridInstantiator = this.sceneObject.createComponent("InstantiateOn3DGridsTS");
    gridInstantiator.center = this.centerObject;
    gridInstantiator.prefab = this.prefab;
    gridInstantiator.rows = 5;
    gridInstantiator.columns = 5;
    gridInstantiator.layers = 3;
    gridInstantiator.spacing = 2.0;

    // Grid will auto-instantiate on start
  }
}
```

## Script Highlights

### InstantiateOn3DGridsTS.ts
Creates a three-dimensional grid of instantiated objects with configurable rows, columns, and layers. The component calculates positions based on uniform spacing and centers the entire grid around a specified center object. Objects are spawned in a nested loop pattern (layer by layer, row by row, column by column) and parented to the instantiator's scene object. Perfect for creating structured arrays like building blocks, voxel grids, or organized particle effects.

### CircleAreaInstantiatorTS.ts
Spawns objects randomly within a circular area defined by a center point and radius. Uses polar coordinates with random angle and distance to ensure even distribution across the circle's surface. Each object is positioned using trigonometric calculations (cos/sin of angle multiplied by random distance) to create natural-looking scatter patterns. Ideal for creating ground clutter, vegetation patches, or area-of-effect visualizations.

### InstantiateAlongLineTS.ts
Distributes objects evenly along a line segment between two points with a specified number of instances. Calculates positions using linear interpolation (lerp) from start to end point, ensuring equal spacing between all objects. The component supports both 2D and 3D line segments and can orient objects along the line direction. Useful for creating paths, trails, fences, or sequential visual effects.

### RandomPointsInsideSphereTS.ts
Generates random positions within a spherical volume using uniform distribution algorithms. Uses rejection sampling to ensure points are truly random throughout the sphere rather than clustering at the center. Each point is calculated by generating a random direction vector and random distance from center (with cubic root distribution for uniform density). Perfect for creating particle bursts, explosion effects, or volumetric object clouds.

## Core API Methods

### InstantiateOn3DGridsTS

```typescript
// Grid dimensions
rows: number
columns: number
layers: number

// Spacing between objects
spacing: number

// Center reference
center: SceneObject

// Prefab to instantiate
prefab: ObjectPrefab

// Execute instantiation
instantiatePrefabs(): void
```

### CircleAreaInstantiatorTS

```typescript
// Circle parameters
center: SceneObject
radius: number
numberOfPrefabs: number

// Prefab to spawn
prefab: ObjectPrefab

// Execute instantiation
instantiatePrefabs(): void
```

### InstantiateAlongLineTS

```typescript
// Line endpoints
startPoint: SceneObject
endPoint: SceneObject

// Number of instances
numberOfPrefabs: number

// Prefab to instantiate
prefab: ObjectPrefab

// Execute instantiation
instantiatePrefabs(): void
```

## Advanced Usage

### Dynamic Particle Burst Effect

Create an expanding particle system with sphere distribution:

```typescript
@component
export class ParticleBurst extends BaseScriptComponent {
  @input particlePrefab: ObjectPrefab;
  @input burstCenter: SceneObject;
  @input particleCount: number = 50;

  private particles: SceneObject[] = [];

  onAwake() {
    // Spawn particles in sphere
    const sphereInstantiator = this.sceneObject.createComponent("RandomPointsInsideSphereTS");
    sphereInstantiator.center = this.burstCenter;
    sphereInstantiator.radius = 0.5;  // Start small
    sphereInstantiator.numberOfPrefabs = this.particleCount;
    sphereInstantiator.prefab = this.particlePrefab;

    // Store particle references
    sphereInstantiator.onInstantiated.add((instance) => {
      this.particles.push(instance);
    });

    // Animate expansion
    const updateEvent = this.createEvent("UpdateEvent");
    let time = 0;
    updateEvent.bind(() => {
      time += getDeltaTime();
      const expansionFactor = 1 + time * 5;

      this.particles.forEach((particle, index) => {
        const centerPos = this.burstCenter.getTransform().getWorldPosition();
        const particlePos = particle.getTransform().getWorldPosition();
        const direction = particlePos.sub(centerPos).normalize();
        const newPos = centerPos.add(direction.uniformScale(expansionFactor));
        particle.getTransform().setWorldPosition(newPos);
      });

      // Fade out over time
      if (time > 2.0) {
        this.particles.forEach(p => p.enabled = false);
      }
    });
  }
}
```

### Procedural Building Grid

Generate a city block layout with varied building heights:

```typescript
@component
export class CityGenerator extends BaseScriptComponent {
  @input buildingPrefab: ObjectPrefab;
  @input cityCenter: SceneObject;
  @input blockSize: number = 10;
  @input buildingSpacing: number = 3.0;

  onAwake() {
    this.generateCityBlock();
  }

  generateCityBlock() {
    const grid = this.sceneObject.createComponent("InstantiateOn3DGridsTS");
    grid.center = this.cityCenter;
    grid.prefab = this.buildingPrefab;
    grid.rows = this.blockSize;
    grid.columns = this.blockSize;
    grid.layers = 1;
    grid.spacing = this.buildingSpacing;

    // Customize building heights after instantiation
    delayedCallback(() => {
      const buildings = this.sceneObject.getChildren();
      buildings.forEach((building) => {
        const randomHeight = 2 + Math.random() * 8;
        const scale = building.getTransform().getLocalScale();
        building.getTransform().setLocalScale(new vec3(scale.x, randomHeight, scale.z));
      });
    }, 0.1);
  }
}
```

### Circular Defense Tower Pattern

Place defense towers around a perimeter with fixed arc length spacing:

```typescript
@component
export class DefensePerimeter extends BaseScriptComponent {
  @input towerPrefab: ObjectPrefab;
  @input baseCenter: SceneObject;
  @input perimeterRadius: number = 20.0;
  @input towerCount: number = 8;

  onAwake() {
    this.createDefenseRing();
  }

  createDefenseRing() {
    const centerPos = this.baseCenter.getTransform().getWorldPosition();
    const angleStep = (Math.PI * 2) / this.towerCount;

    for (let i = 0; i < this.towerCount; i++) {
      const angle = i * angleStep;
      const towerPos = new vec3(
        centerPos.x + Math.cos(angle) * this.perimeterRadius,
        centerPos.y,
        centerPos.z + Math.sin(angle) * this.perimeterRadius
      );

      // Instantiate tower
      const tower = this.towerPrefab.instantiate(this.sceneObject);
      tower.getTransform().setWorldPosition(towerPos);

      // Rotate tower to face center
      const lookDir = centerPos.sub(towerPos);
      const rotation = quat.lookAt(lookDir, vec3.up());
      tower.getTransform().setWorldRotation(rotation);

      print(`Tower ${i + 1} placed at ${angle} radians`);
    }
  }
}
```

## Built with 👻 by the Spectacles team


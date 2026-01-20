# Instantiation Utilities for Snapchat Spectacles

This folder contains a comprehensive collection of instantiation utility classes for Snapchat Spectacles applications. These utilities help you instantiate prefabs in various patterns and arrangements. All classes are available in both TypeScript (TS) and JavaScript (JS) versions.

## Overview

The Instantiation utilities provide solutions for:
- Creating objects in geometric patterns (circles, squares, lines, grids)
- Placing objects randomly within volumes or on surfaces
- Distributing objects with precise spacing or arrangements
- Setting up complex object instantiation patterns with minimal code

## Available Classes

### Circle-Based Instantiation

| Class | Description |
|-------|-------------|
| `CircleAreaInstantiatorTS/JS` | Instantiates prefabs randomly within a circular area |
| `CirclePerimeterInstantiatorTS/JS` | Places objects evenly around the perimeter of a circle |
| `CirclePerimeterInstantiatorWithFixedArcLengthTS/JS` | Places objects around a circle with fixed arc length between them |
| `CircleSlicingInstantiatorTS/JS` | Divides a circle into slices and places objects at the centers |
| `SimpleCircleAreaInstantiatorTS/JS` | A simplified version for basic circular area instantiation |

### Grid-Based Instantiation

| Class | Description |
|-------|-------------|
| `InstantiateOn2DGridsTS/JS` | Creates objects in a 2D grid pattern |
| `InstantiateOn3DGridsTS/JS` | Creates objects in a 3D grid pattern |
| `SquareAreaInstantiatorTS/JS` | Instantiates prefabs randomly within a square area |

### Line-Based Instantiation

| Class | Description |
|-------|-------------|
| `InstantiateAlongLineTS/JS` | Places objects evenly spaced along a line between two points |
| `InstantiateAlongLineWithFixedDistanceTS/JS` | Places objects along a line with a fixed distance between them |

### Random Distribution Instantiation

| Class | Description |
|-------|-------------|
| `RandomPointsInsideBoxTS/JS` | Creates objects at random positions inside a box volume |
| `RandomPointsInsideSphereTS/JS` | Creates objects at random positions inside a sphere volume |
| `RandomPointsOnBoxSurfaceTS/JS` | Places objects randomly on the surface of a box |
| `RandomPointsOnSphereSurfaceTS/JS` | Places objects randomly on the surface of a sphere |

### Special Instantiation

| Class | Description |
|-------|-------------|
| `SimpleColliderInstantiatorTS/JS` | Creates prefabs and adds physics colliders to them |

## How to Use

### Common Pattern

Most instantiation classes follow this usage pattern:

1. Add the component script to an object in your scene
2. Set the prefab reference to the object you want to instantiate
3. Configure the positioning parameters (center, radius, size, etc.)
4. Set the number of objects to create
5. Instantiation occurs automatically on start

### Example Usage

```typescript
// Example using CircleAreaInstantiatorTS
@component
class MyComponent extends BaseScriptComponent {
    @input
    instantiator!: CircleAreaInstantiatorTS;
    
    onStart(): void {
        // You can also trigger instantiation manually
        this.instantiator.instantiatePrefabs();
    }
}
```

## Language Support

Every class is available in both TypeScript (.ts) and JavaScript (.js) versions:

- TypeScript files are in the `/TS` folder
- JavaScript files are in the `/JS` folder

The functionality is identical between versions, so you can choose the language that best fits your project.

## Available Prefabs

The module includes example prefabs that can be used with these instantiators:

- `ExamplePrefabInstantiateBox1.prefab`
- `ExamplePrefabInstantiateBox2.prefab`
- `ExamplePrefabInstantiateSphere.prefab`
- `ExamplePrefabInstantiateSphere2.prefab`

## Important Notes

- All classes automatically instantiate objects when the scene starts
- Make sure to properly set up all required references before runtime
- For optimal performance, consider the number of objects you're instantiating
- Each class provides helpful input hints for configuring parameters  



 

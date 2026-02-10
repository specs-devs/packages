![AccessComponents](AssetImage/AccessComponents.png)

# Access Components 

A utility package providing helper functions and patterns for accessing and managing components on SceneObjects. This package simplifies component retrieval with null-safety checks, typename-based lookups, and required component validation.

## Features

- **Safe Component Access**: Null-checked getComponent with fallback values
- **Typename Lookups**: Find components by string typename for dynamic access
- **Required Component Validation**: Throw errors when critical components are missing
- **Recursive Search**: Find components in child hierarchies
- **Component Caching**: Store component references for performance
- **Type Guards**: Runtime type checking for component validation

## Quick Start

Access components safely with error handling:

```typescript
import {AccessComponentOnSceneObjectTS} from "AccessComponents.lspkg/AccessComponentOnSceneObjectTS";

@component
export class ComponentAccessor extends BaseScriptComponent {
  @input targetObject: SceneObject;

  onAwake() {
    // Safe access with default fallback
    const transform = this.safeGetComponent(Transform, this.targetObject);
    if (transform) {
      print(`Position: ${transform.getWorldPosition()}`);
    }

    // Require component (throws if missing)
    const renderMesh = this.requireComponent(
      RenderMeshVisual,
      this.targetObject,
      "RenderMeshVisual required for rendering"
    );

    // Find by typename string
    const camera = this.findByTypename("Component.Camera", this.targetObject);
  }

  safeGetComponent<T>(type: new() => T, obj: SceneObject): T | null {
    return obj.getComponent(type.typename) as T | null;
  }

  requireComponent<T>(type: new() => T, obj: SceneObject, msg: string): T {
    const component = obj.getComponent(type.typename);
    if (!component) {
      throw new Error(msg);
    }
    return component as T;
  }

  findByTypename(typename: string, obj: SceneObject): Component | null {
    return obj.getComponent(typename);
  }
}
```

## Script Highlights

### AccessComponentOnSceneObjectTS.ts
Provides pattern examples for accessing components on SceneObjects with proper null-safety and error handling. Demonstrates getComponent usage with typename strings, casting to specific component types, and validation of component existence before use. Shows best practices for working with the Lens Studio component system including checking for undefined/null values and providing meaningful error messages when components are missing.

## Core API Methods

```typescript
// Get component by type
getComponent(typename: string): Component | null

// Check component existence
hasComponent(typename: string): boolean

// Get all components
getComponents(typename: string): Component[]

// Recursive search in children
getComponentInChildren(typename: string): Component | null
```

## Advanced Usage

### Component Cache Manager

Create a caching system for frequently accessed components:

```typescript
@component
export class ComponentCacheManager extends BaseScriptComponent {
  private cache: Map<string, Component> = new Map();

  getCached<T extends Component>(obj: SceneObject, typename: string): T | null {
    const key = `${obj.id}_${typename}`;

    if (this.cache.has(key)) {
      return this.cache.get(key) as T;
    }

    const component = obj.getComponent(typename) as T | null;
    if (component) {
      this.cache.set(key, component);
    }

    return component;
  }

  clearCache() {
    this.cache.clear();
  }
}
```

## Built with 👻 by the Spectacles team


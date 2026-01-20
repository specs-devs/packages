# Component Access Patterns for Snapchat Spectacles

This folder contains a collection of example components demonstrating different ways to access and interact with components in Snapchat Spectacles applications. Each pattern is implemented in both TypeScript (TS) and JavaScript (JS) to provide flexibility based on your development preferences.

## Overview

The AccessComponents module provides:
- Examples for accessing built-in and custom components
- Cross-language component communication (TS↔JS)
- Different techniques for component references
- Best practices for component interactions

## Folder Structure

The module is organized into the following subfolders, each demonstrating a specific access pattern:

| Folder | Description |
|--------|-------------|
| `AccessComponentOnSceneObject` | Accessing components directly on scene objects |
| `AccessComponentOnChildSceneObject` | Accessing components on child scene objects |
| `AccessCustomComponentsUsingRequired` | Using `requireType` to reference custom components |
| `AccessCustomComponentsUsingTypename` | Using the `@typename` decorator to reference components |
| `AccessJSfromJS` | Accessing JavaScript components from JavaScript |
| `AccessJSfromTSwithDeclaration` | Accessing JS components from TS with type declarations |
| `AccessJSfromTSwithouthDeclaration` | Accessing JS components from TS without type declarations |
| `AccessTSfromJS` | Accessing TypeScript components from JavaScript |
| `AccessTSfromTS` | Accessing TypeScript components from TypeScript |

All examples are provided in both TypeScript (.ts) and JavaScript (.js) versions with identical functionality.

## Access Patterns

### 1. Accessing Built-in Components

The `AccessComponentOnSceneObject` example demonstrates how to access built-in components like RenderMeshVisual:

```typescript
// TypeScript example
const renderMeshVisual = sceneObject.getComponent("Component.RenderMeshVisual");
```

```javascript
// JavaScript example
var renderMeshVisual = sceneObject.getComponent("Component.RenderMeshVisual");
```

### 2. Accessing Components on Child Objects

The `AccessComponentOnChildSceneObject` pattern shows how to navigate the scene hierarchy to access components:

```typescript
// TypeScript example
const childComponent = parentObject.getChild(0).getComponent("Component.RenderMeshVisual");
```

### 3. Accessing Custom Components with requireType

The `AccessCustomComponentsUsingRequired` pattern demonstrates using `requireType` to reference custom components:

```typescript
// TypeScript example
private typeName = requireType('./CustomComponentTS') as keyof ComponentNameMap;

// Later use it to get the component
const customComponent = targetObject.getComponent(this.typeName) as any;
```

### 4. Using @typename Decorator

The `AccessCustomComponentsUsingTypename` pattern leverages TypeScript's @typename decorator:

```typescript
// TypeScript example
@typename
CustomComponentTS: keyof ComponentNameMap;

@input('CustomComponentTS')
customComponent: any;
```

### 5. JavaScript to TypeScript Communication

The `AccessTSfromJS` examples show how JavaScript components can interact with TypeScript components:

```javascript
// JavaScript example
script.refScript.methodName(); // Call a TS method from JS
```

### 6. TypeScript to JavaScript Communication

The `AccessJSfromTSwithDeclaration` and `AccessJSfromTSwithouthDeclaration` patterns demonstrate how TypeScript components can interact with JavaScript components, with or without type declarations:

```typescript
// TypeScript example with declaration file
import { JSComponentA } from './JSComponentA_Declaration';

@input('Component.ScriptComponent')
refScript: JSComponentA;
```

## Common Patterns and Best Practices

### Component References

- **Direct Reference**: Use the Inspector to assign component references
- **Runtime Access**: Use `getComponent()` to find components at runtime
- **Type Safety**: Use TypeScript declarations for JS components when possible

### Cross-Language Communication

- **TS → JS**: TypeScript can access JavaScript components directly
- **JS → TS**: JavaScript can access TypeScript components with standard interfaces
- **Type Declarations**: Create .ts declaration files to improve type safety when using JS from TS

### Performance Tips

- Cache component references when possible rather than repeatedly calling `getComponent()`
- Use the proper lifecycle methods (`onAwake`, `onStart`) to ensure components are fully initialized
- When accessing numerous components, consider optimization strategies like deferred loading

## Example Usage

### Accessing a Component and Calling its Methods

```typescript
// Example using AccessComponentOnSceneObject pattern
@component
class MyComponent extends BaseScriptComponent {
    @input
    targetObject!: SceneObject;
    
    onStart(): void {
        // Get a component
        const renderMesh = this.targetObject.getComponent("Component.RenderMeshVisual");
        
        // Use the component
        if (renderMesh) {
            const material = renderMesh.getMaterial(0);
            if (material) {
                material.mainPass.baseColor = new vec4(1, 0, 0, 1); // Set to red
            }
        }
    }
}
```

## Language Support

Every component access pattern is available in both TypeScript (.ts) and JavaScript (.js) versions, allowing you to choose the language that best fits your development workflow.

## Important Notes

- Component references might be null if not properly assigned in the Inspector
- Always check if a component exists before accessing its properties or methods
- When accessing custom components, you may need type assertions in TypeScript
- The appropriate access pattern depends on your specific use case and coding style
- Component access performance can impact application performance, particularly in update loops   





# AccessComponents guide

[← Agent usage index](../README.md)

## Use when

Read this to choose between the access patterns the examples demonstrate, or
for the helper and cache recipes. The Quick Start, Core API and Advanced Usage
content moved here from the package README and was corrected: the earlier
versions used members that do not exist (`type.typename`, `hasComponent`,
`getComponentInChildren`, `SceneObject.id`) and an import path without the
example folder. Exact engine signatures are in the installed `StudioLib.d.ts`.

## Choosing a pattern

| You have | Use | Example |
|---|---|---|
| An engine component on a known object | `obj.getComponent("Component.<Type>")`, null-checked | 3–4 (`AccessComponentOnSceneObject`) |
| The component on a child | `obj.getChild(i)` / `getChildrenCount()`, then `getComponent` | 1–2 (`AccessComponentOnChildSceneObject`) |
| A TS component, TS caller | Typed `@input` of the imported class, or `getComponent(MyClass.getTypeName())` | 13 (`AccessTSfromTS`) |
| A custom script, looked up by file at runtime | `requireType("./File")` then `getComponent(typeName)` | 5–6 (`AccessCustomComponentsUsingRequired`) |
| A custom script as an Inspector input with a type slot | `@typename Alias` + `@input("Alias")` (TS) or `//@typename` + `//@input Alias name` (JS) | 7–8 (`AccessCustomComponentsUsingTypename`) |
| A JS component, TS caller, want type checking | `@input("Component.ScriptComponent")` typed with a hand-written `interface … extends ScriptComponent` | 10 (`AccessJSfromTSwithDeclaration`) |
| A JS component, TS caller, quick | Same input typed `any` | 11 (`AccessJSfromTSwithouthDeclaration`) |
| A TS component, JS caller | `//@input Component.ScriptComponent ref`; call its public members on `script.ref` | 12 (`AccessTSfromJS`) |
| A JS component, JS caller | Same, members are whatever the other script assigned on `script` | 9 (`AccessJSfromJS`) |

All examples read the other component in `OnStartEvent` so its members are
initialized; do the same unless you control both scripts' order.

## Script highlights

### AccessComponentOnSceneObjectTS.ts

Shows reading an input `SceneObject`, checking it for a
`Component.RenderMeshVisual`, and printing what it found. It null-checks the
`getComponent` result, so a missing component takes the "does not have" branch
(same form as below).

## Helper recipes (corrected)

Safe access, required access and access by typename string, written against
real engine members:

```typescript
@component
export class ComponentAccessor extends BaseScriptComponent {
  @input targetObject: SceneObject;

  onAwake() {
    this.createEvent("OnStartEvent").bind(() => {
      // Safe access: null when missing
      const mesh = this.targetObject.getComponent("Component.RenderMeshVisual");
      if (mesh) {
        print(`Mesh found on ${this.targetObject.name}`);
      }

      // Required access: throw with a clear message when missing
      const camera = this.requireComponent(this.targetObject, "Component.Camera", "Camera required");

      // Search the hierarchy below an object
      const text = this.findInChildren(this.targetObject, "Component.Text");
    });
  }

  requireComponent<K extends keyof ComponentNameMap>(obj: SceneObject, type: K, msg: string): ComponentNameMap[K] {
    const component = obj.getComponent(type);
    if (!component) {
      throw new Error(msg);
    }
    return component;
  }

  findInChildren<K extends keyof ComponentNameMap>(obj: SceneObject, type: K): ComponentNameMap[K] | null {
    for (let i = 0; i < obj.getChildrenCount(); i++) {
      const child = obj.getChild(i);
      const found = child.getComponent(type) ?? this.findInChildren(child, type);
      if (found) {
        return found;
      }
    }
    return null;
  }
}
```

## Engine members the examples use

These are Lens Studio engine API (see `StudioLib.d.ts`), listed here because
the earlier README listed members that do not exist:

```text
// SceneObject
getComponent(typeName)            // first component of that type, or null
getComponents(typeName)           // all components of that type ("Component" = all)
getChild(index) / getChildrenCount()
getParent()
uniqueIdentifier                  // stable id string

// Globals
requireType(path)                 // type name of a script asset, for getComponent
```

There is no `hasComponent` (use `getComponent(...) !== null`) and no
`getComponentInChildren` (use the recursive helper above).
`getAllComponents()` is deprecated; use `getComponents("Component")`.

## Component cache manager (corrected)

A cache for frequently accessed components, keyed by the object's
`uniqueIdentifier`:

```typescript
@component
export class ComponentCacheManager extends BaseScriptComponent {
  private cache: Map<string, ComponentNameMap[keyof ComponentNameMap]> = new Map();

  getCached<K extends keyof ComponentNameMap>(obj: SceneObject, type: K): ComponentNameMap[K] | null {
    const key = `${obj.uniqueIdentifier}_${type}`;

    if (this.cache.has(key)) {
      return this.cache.get(key) as ComponentNameMap[K];
    }

    const component = obj.getComponent(type);
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

Destroyed components stay in the cache: call `clearCache()` (or delete the
key) when you destroy or replace them.

# SnapDecorators components

[← Agent usage index](../README.md)

## Use when

Look up an exact export, its signature and what it does at runtime before using
it or explaining a failure. Everything below is read from the TypeScript in this
package revision; nothing is inferred from older docs.

## Modules and import paths

| Module | Import | Exports |
|---|---|---|
| decorators | `import { bindStartEvent, bindEnableEvent, bindDisableEvent, bindUpdateEvent, bindLateUpdateEvent, bindDestroyEvent, memo, depends, provider } from "SnapDecorators.lspkg/decorators"` | 9 decorators |
| assert | `import { assert, verify } from "SnapDecorators.lspkg/assert"` | 2 functions |
| debug | `import { reportError, spath } from "SnapDecorators.lspkg/debug"` | 2 functions |
| guards | `import { isScriptObject, isComponent } from "SnapDecorators.lspkg/guards"` | 2 type guards |

The modules are plain TypeScript (no `@component`); nothing has to be in the
scene for them to work. `decorators` imports `assert` and `debug`; `debug`
imports `guards`. The modules sit at the package root: there is no `Scripts/`
folder.

## How the decorators run

All decorators use the TC39 Stage 3 decorator contract that Lens Studio's
TypeScript compiles (`context.addInitializer`). The initializer runs while Lens
Studio constructs the component instance, with `this` = the instance, before
`onAwake` is called. Consequences:

- `@depends` / `@provider` fields are already assigned when `onAwake` runs.
- `@bind...Event` replaces the instance's `onAwake` with a wrapper that first
  creates the event and then calls the class's own `onAwake`.
- The decorators do nothing on classes that Lens Studio does not instantiate as
  components: the class still needs `@component` and must extend
  `BaseScriptComponent`.

## Event binding

Each is `(target: Function, context: ClassMethodDecoratorContext) => void`,
applied to a method.

| Decorator | Event created | Fires |
|---|---|---|
| `@bindStartEvent` | `OnStartEvent` | once, before the first frame |
| `@bindEnableEvent` | `OnEnableEvent` | when the script's object is enabled by code or in the editor, not during normal initialization |
| `@bindDisableEvent` | `OnDisableEvent` | when the object is disabled, not when it is destroyed |
| `@bindUpdateEvent` | `UpdateEvent` | every frame |
| `@bindLateUpdateEvent` | `LateUpdateEvent` | every frame, after update, physics and animation |
| `@bindDestroyEvent` | `OnDestroyEvent` | right after `destroy()` |

Behavior (from `bindEvent` in `decorators.ts`):

- The wrapper calls `this.createEvent(eventType).bind(handler)` and then the
  original `onAwake`, if the class has one. With several decorated methods the
  wrappers nest; every decorated method gets its own event.
- The handler calls your method with the event arguments and the component as
  `this`. If the method returns a Promise, the Promise gets
  `.catch(reportError)`: rejections are printed, never rethrown.
- Nothing is unbound for you. For conditional or late binding use
  `createEvent` directly instead of a decorator.

## Memoization

`@memo` — `(target: any, context: ClassGetterDecoratorContext) => void`,
applied to a getter.

- Asserts at construction that the prototype member is a getter
  (`"@memo can only be applied to getters"`) and has no setter
  (`"@memo cannot be applied to a getter with a setter"`); either failure throws
  before `onAwake`.
- Defines an own accessor on the instance. The first read runs the original
  getter and replaces the accessor with a data property holding the value
  (`Object.defineProperty(this, key, { value })`), so later reads are a plain
  property lookup. The cached value is per instance, read-only and never
  recomputed.

## Dependency injection

Both are decorator factories for fields:
`(componentType: keyof ComponentNameMap) => (target: undefined, context: ClassFieldDecoratorContext) => void`.
Declare the field with a definite assignment (`mesh!: RenderMeshVisual`); it
is assigned during construction, before `onAwake`.

| Decorator | Lookup | On failure |
|---|---|---|
| `@depends("Component.X")` | `this.sceneObject.getComponent("Component.X")` — the script's own SceneObject only | throws `Error("@depends /Path/To/Object:ScriptComponent.field not found")` |
| `@provider("Component.X")` | the script's own SceneObject, then each parent up to the root; the first match wins | throws `Error("@provider /Path/To/Object:ScriptComponent.field not found")` |

The error aborts the component's initialization and Lens Studio logs it at
awake. `componentType` is typed `keyof ComponentNameMap`, which contains only
Lens Studio's built-in component names (for example `"Component.Camera"`,
`"Component.RenderMeshVisual"`, `"Component.Text"`, `"Component.LightSource"`,
`"Component.AudioListenerComponent"`, `"Physics.BodyComponent"`). It does not
accept a custom script's `TypeName`; for script components use
`this.sceneObject.getComponent(MyScript.getTypeName())` or an `@input`.

`Transform` is not a component and there is no `"Component.Transform"` key:
read it with `this.getTransform()` or `sceneObject.getTransform()` (never
null), not with `@depends`.

## Assertions

Module `SnapDecorators.lspkg/assert`.

| Export | Signature | Behavior |
|---|---|---|
| `assert` | `(condition: unknown, message?: string): asserts condition` | throws `new Error(message)` when the condition is falsy; narrows the type afterwards |
| `verify` | `<T>(value: T, message?: string): NonNullable<T>` | throws when `value == null` (null or undefined); returns the value typed non-null |

## Debug

Module `SnapDecorators.lspkg/debug`.

| Export | Signature | Behavior |
|---|---|---|
| `reportError` | `(reason: unknown): void` | `Error` → rewrites the stack with `SourceMaps.applyToStackTrace` and prints `Name: message` followed by the stack; other non-strings → prints `typeof: value`; strings → printed as is |
| `spath` | `(node: SceneObject \| Component): string` | `/Root/Child` for a SceneObject; `/Root/Child:TypeName` for a component, using `getTypeName()` |

## Guards

Module `SnapDecorators.lspkg/guards`.

| Export | Signature | Behavior |
|---|---|---|
| `isScriptObject` | `(obj: unknown): obj is ScriptObject` | true for objects whose `isOfType("ScriptObject")` exists and returns `true` |
| `isComponent` | `(obj: unknown): obj is Component` | `isScriptObject(obj) && obj.isOfType("Component")` |

## Demo component and prefab

`Examples.ts` — `@component class ExampleScript extends BaseScriptComponent`,
no `@input`s. It prints one line per event: `[AWAKE]` from a plain `onAwake`
(which also binds a `TapEvent` printing `[TAP]`), `[START]`, `[ENABLE]`,
`[DISABLE]`, `[UPDATE]` every 60 frames (frame count, elapsed seconds, FPS),
`[LATE UPDATE]` every 120 frames, and `[DESTROY]` with totals.

`SnapDecorators__PLACE_IN_SCENE.prefab` — root SceneObject at local position
(0, 0, -70) with no components and three children, in this order:

- `Guide` — UIKit `Frame` + `GuideDismissPanel`, with a `GuideText` and the
  "Ok, I understood" `OkButton`.
- `ExampleCarousel` — the `ExampleCarousel` panel.
- `SnapDecoratorsDemo` — the example: one `ScriptComponent` (`ExampleScript`).

Nothing renders apart from the guide and the carousel; the demo is the log.
Drag-and-drop path and the expected log sequence:
[examples](examples.md#demo-prefab).

## Demo scaffolding (`Example/`)

The prefab carries its own guide and example carousel, so the demo works when
only the package is installed. These two scripts are demo scaffolding, not part
of the decorator API.

### ExampleCarousel

Source: [`Example/ExampleCarousel/ExampleCarousel.ts`](../Example/ExampleCarousel/ExampleCarousel.ts).
On the prefab's `ExampleCarousel` child. Builds a UIKit panel with Previous /
Next and a minimize button and enables one example (or sub-example step) at a
time; the others stay disabled.

| Input declaration / default | Meaning |
|---|---|
| `examples: SceneObject[] = []` | Examples to step through, in order (prefab: `SnapDecoratorsDemo`) |
| `exampleInfo: string[] = []` | Info text per example, same order as `examples` |
| `steps: SceneObject[] = []` | Optional sub-examples shown one at a time (prefab: none) |
| `stepInfo: string[] = []` | Info text per step, same order as `steps`; an empty entry falls back to the example's `exampleInfo` (prefab: none) |
| `startIndex: number = 0` | Example shown first (0-based) |
| `previousLabel: string = "Previous"` / `nextLabel: string = "Next"` | Button labels |
| `examplesPushBack: number = 20` | Extra distance (cm) the examples are pushed behind the carousel |
| `anchorExamples: boolean = true` | Move the examples in front of the user's head pose |
| `startMinimized: boolean = false` | Start collapsed to the title bar |
| `extraPanelDrop: number = 0` | Extra drop (cm) of the panel below its usual spot |

### GuideDismissPanel

Source: [`Example/GuideDismissPanel/GuideDismissPanel.ts`](../Example/GuideDismissPanel/GuideDismissPanel.ts).
On the prefab's `Guide` child (next to a UIKit Frame, with a child Text and the
"Ok, I understood" button). Places the guide in front of the user and closes it
when the button is pressed.

| Input declaration / default | Meaning |
|---|---|
| `buttonLabel: string = "Ok, I understood"` | Close-button label (only used when the panel is built at runtime) |
| `hideUntilDismissed: SceneObject[] = []` | Objects hidden while the guide shows (prefab: `ExampleCarousel` and `SnapDecoratorsDemo`; never the prefab root) |

This is the same class name as the samples' own `GuideDismissPanel`. When a
project has both, pick the script asset by id or source path, not by name (see
[troubleshooting](troubleshooting.md)).

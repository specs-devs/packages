# Decorators

## What it is
Decorators (SnapDecorators) is a TypeScript utility package that removes lifecycle boilerplate from Lens components.
Its decorators bind methods to scene events, inject components from the same SceneObject or its parents, and cache
getter results, and it adds small assertion, debug and type-guard helpers. It is for Specs developers writing
`@component` classes who want declarative scripts instead of hand-wiring `createEvent` calls in `onAwake`.

## What it does
- You import from `SnapDecorators.lspkg/decorators` (and `assert`, `debug`, `guards`) and annotate members of an
  `@component` class that extends `BaseScriptComponent`; nothing has to be in the scene.
- While Lens Studio constructs the component, each decorator registers an initializer that runs before `onAwake`:
  - `@bindStartEvent`, `@bindEnableEvent`, `@bindDisableEvent`, `@bindUpdateEvent`, `@bindLateUpdateEvent` and
    `@bindDestroyEvent` wrap `onAwake` so it first creates the event and binds the method, then calls your own
    `onAwake`.
  - `@depends("Component.X")` assigns the component found on the script's SceneObject; `@provider("Component.X")`
    also searches each parent up to the root. A miss throws and the script does not initialize.
  - `@memo` turns a getter into a value computed on first read and cached per instance.
- If a bound method returns a Promise, rejections are caught and printed by `reportError` with a source-mapped stack
  instead of stopping the Lens.
- The demo prefab holds one `ExampleScript` that prints one line per decorator-bound event, plus a guide panel and
  an example carousel.

## Highlights
- Six event-binding decorators covering start, enable, disable, update, late update and destroy.
- Dependency injection by built-in `ComponentNameMap` name (`"Component.RenderMeshVisual"`, `"Component.Camera"` …),
  resolved before `onAwake`.
- `@memo` validates at construction that it decorates a getter without a setter.
- `assert` / `verify` throw plain `Error`s with your message; `verify` returns the value as non-nullable.
- `spath(node)` returns the scene hierarchy path of an object or component for clear error messages.
- The decorator modules import no other package.

## Core scripts
| Script | What it does |
|---|---|
| `decorators.ts` | The event-binding decorators, `@memo`, `@depends` and `@provider`. |
| `assert.ts` | `assert` and `verify` runtime checks with TypeScript type narrowing. |
| `debug.ts` | `reportError` (source-mapped error output) and `spath` (scene hierarchy path). |
| `guards.ts` | `isScriptObject` and `isComponent` type guards. |
| `Examples.ts` | `ExampleScript`, the demo component that logs every decorator-bound event. |

## Extra info
- **Requires:** InteractionKit, UIKit, Motion and Icons are declared, but only the `Example/` demo scaffolding imports
  UIKit and InteractionKit; the decorator modules have no dependencies. Works the same in the Lens Studio Preview and
  on Specs. Never also bind a decorated method by hand (it would run twice). There is no `"Component.Transform"`:
  use `this.getTransform()`.
- **Get started:** add `import { bindStartEvent } from "SnapDecorators.lspkg/decorators"` to a component, or drop
  `SnapDecorators__PLACE_IN_SCENE.prefab` into a scene with a Camera (Device Tracking on), lighting and Interaction
  Kit (SIK) and watch the Logger for `[AWAKE]`, `[START]`, `[UPDATE]` and `[LATE UPDATE]` lines.
- **More docs:**
  - [cheat-sheet.md](cheat-sheet.md) - the rules that most often break a decorated script, read first
  - [components.md](components.md) - every export with its signature and runtime behavior
  - [examples.md](examples.md) - usage patterns, worked examples and the demo prefab
  - [api-status.md](api-status.md) - current, removed and internal surfaces, known gaps
  - [troubleshooting.md](troubleshooting.md) - symptoms, causes and fixes

<p align="center">
  <img src="Docs/media/SnapDecorators.png" width="250px" alt="SnapDecorators"/>
</p>

# Decorators

A powerful TypeScript decorator library for SPECS development that simplifies component lifecycle management, dependency injection, and memoization. SnapDecorators leverages modern JavaScript decorator syntax to eliminate boilerplate code, automatically wire up event handlers, inject component dependencies, and optimize getter performance. This package transforms verbose Lens Studio component patterns into clean, declarative code using the Stage 3 TC39 decorator proposal, making your scripts more readable, maintainable, and less error-prone.

## Features

- **Event Binding Decorators** - Automatically bind methods to scene events without manual createEvent() calls
- **Lifecycle Event Support** - Decorators for OnStartEvent, UpdateEvent, LateUpdateEvent, OnEnableEvent, OnDisableEvent, and OnDestroyEvent
- **Memoization Decorator** - Cache getter results to avoid repeated expensive calculations
- **Dependency Injection** - Auto-inject components from the same SceneObject or parent hierarchy
- **Type-Safe Assertions** - Runtime validation utilities with TypeScript type guards
- **Error Reporting** - Enhanced error messages with source-mapped stack traces and scene hierarchy paths
- **Zero Runtime Overhead** - Decorators compile to efficient initialization code
- **Promise-Aware Event Handlers** - Automatic error catching for async methods

## Quick Start

```typescript
import { bindStartEvent, bindUpdateEvent, memo, depends, provider } from "SnapDecorators.lspkg/decorators";
import { assert, verify } from "SnapDecorators.lspkg/assert";

@component
export class DecoratorExample extends BaseScriptComponent {
    // Inject the RenderMeshVisual on this SceneObject (throws at construction if it is missing)
    @depends("Component.RenderMeshVisual")
    mesh!: RenderMeshVisual;

    // Inject the first Camera found on this SceneObject or a parent
    @provider("Component.Camera")
    camera!: Camera;

    // Transform is not a component: read it with getTransform(), not @depends
    @memo
    get transform(): Transform {
        return this.getTransform();
    }

    // Memoized getter - computed once, then cached
    @memo
    get expensiveCalculation(): number {
        print("Computing expensive value...");
        return Math.sqrt(Math.random() * 1000);
    }

    // Automatically bound to OnStartEvent
    @bindStartEvent
    onStart() {
        assert(this.mesh !== null, "RenderMeshVisual should be injected");
        print("Started with mesh: " + this.mesh.getTypeName());

        // Access memoized value multiple times - only computes once
        print(this.expensiveCalculation);
        print(this.expensiveCalculation); // Uses cached value
    }

    // Automatically bound to UpdateEvent
    @bindUpdateEvent
    onUpdate() {
        const pos = this.transform.getWorldPosition();
        print(`Position: ${pos.x}, ${pos.y}, ${pos.z}`);
    }

    // Supports async methods with automatic error handling
    @bindStartEvent
    async loadData() {
        await this.fetchRemoteData();
        print("Data loaded successfully");
    }

    async fetchRemoteData(): Promise<void> {
        // Errors are automatically caught and reported
        await new Promise<void>(resolve => setTimeout(() => resolve(), 1000));
    }
}
```

`@depends` and `@provider` take a `keyof ComponentNameMap` built-in component
name such as `"Component.RenderMeshVisual"`, `"Component.Camera"` or
`"Component.Text"`. There is no `"Component.Transform"`: use
`this.getTransform()` or `sceneObject.getTransform()`.

## Usage

This section ships with the package and describes the exact installed revision
(the version is recorded in `package.native`). Read it, then follow the
links into `Docs/` for the topic you need. It is written for both people and
coding agents; generic Lens scripting, scene construction, and Specs spatial
design are out of scope here.

### Package identity

- Package descriptor: `SnapDecorators.lspkg/package.native` (`SnapDecorators`)
- Consumer import prefix: `SnapDecorators.lspkg/` - the four modules sit at the
  package root, so import `SnapDecorators.lspkg/decorators`,
  `SnapDecorators.lspkg/assert`, `SnapDecorators.lspkg/debug` and
  `SnapDecorators.lspkg/guards`. There is no `Scripts/` folder. The older
  relative form `./SnapDecorators.lspkg/...` only resolves from a script that
  sits next to the package folder.
- Declared companion packages (`package_dependencies.json`):
  `InteractionKit`, `UIKit`, `Motion`, `Icons`. The
  decorator modules (`decorators`, `assert`, `debug`, `guards`) import none of
  them; the demo scaffolding in `Example/` (`ExampleCarousel`,
  `GuideDismissPanel`) imports `UIKit.lspkg/...` and
  `InteractionKit.lspkg/...`. See
  [API status](Docs/api-status.md#known-gaps).
- Demo prefab: `SnapDecorators.lspkg/SnapDecorators__PLACE_IN_SCENE.prefab`. It is
  self-contained: it includes the guide (dismissed with "Ok, I understood"),
  the example carousel (Previous / Next / minimize) and the
  `SnapDecoratorsDemo` example object, so dropping it into a Specs scene with
  Camera, lighting and SIK gives the full demo. The demo scaffolding scripts
  ship in `SnapDecorators.lspkg/Example/` (`ExampleCarousel`,
  `GuideDismissPanel`); they are not part of the decorator API.

### Version and API status

This README and `Docs/` ship in the package archive and describe that exact
installed revision. Read [API status](Docs/api-status.md) before reusing an
older snippet: it lists the Current, Removed and Internal surfaces and the names
that differ from external listings.

### Applicability

Use SnapDecorators when a TypeScript component should declare its lifecycle
handlers, component dependencies and cached getters instead of wiring them by
hand in `onAwake`. It adds no scene content, UI or interaction: hand interaction
is InteractionKit, spatial UI is UIKit. Plain
`createEvent(...).bind(...)` remains the right tool for events you create
conditionally or at runtime.

### Package Docs (ship in `Docs/`)

Lens Studio installs packages packed but extracts them into the project Cache on
import, so these files can be read there or from the package source. Treat only
the documented exports as supported API.

- [cheat sheet](Docs/cheat-sheet.md) - the eight rules that most often break a decorated script; read first
- [components](Docs/components.md) - every export with its signature and exact runtime behavior, plus the demo component and prefab
- [API status](Docs/api-status.md) - Current / Removed / Internal surfaces and known gaps for this revision
- [examples](Docs/examples.md) - usage patterns and the eight worked examples (moved from this README), plus the demo prefab path
- [troubleshooting](Docs/troubleshooting.md) - package-specific symptoms, causes and fixes from the QA pass

### Verification

1. Compile the Lens with no TypeScript errors and no `as any` on decorated
   members.
2. In the Logger, confirm each `@bind...Event` method prints once per event; a
   duplicate means the method is also bound by hand in `onAwake`.
3. Confirm there is no `@depends ... not found` or `@provider ... not found`
   error at awake: every injected component exists on the object (or a parent)
   in the saved scene.
4. Drop `SnapDecorators__PLACE_IN_SCENE` into a Specs scene that has the SIK prefab and
   Device Tracking on the camera: the guide shows; after "Ok, I understood"
   expect `[AWAKE]`, `[START]`, then `[UPDATE]` every 60 frames and
   `[LATE UPDATE]` every 120.
5. Make an async handler reject once and check that `reportError` prints a
   source-mapped stack instead of the Lens stopping.

## Built with 👽 by the SPECS team <!-- --> <!-- --> <!-- --> <!-- -->

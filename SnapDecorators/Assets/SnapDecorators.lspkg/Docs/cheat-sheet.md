# SnapDecorators cheat sheet (load-bearing invariants)

[← Agent usage index](../README.md)

## Use when

Read this **first**, and re-read it before writing a script that uses the
decorators. It is the short list of rules that most often break a generated
lens, each with a pointer to the detail. It is a pointer, not a substitute:
read the linked section for the how.

## The rules

1. **Import from the package root with the bare prefix.** The four modules sit
   directly in the package folder: `SnapDecorators.lspkg/decorators`,
   `SnapDecorators.lspkg/assert`, `SnapDecorators.lspkg/debug`,
   `SnapDecorators.lspkg/guards`. There is no `Scripts/` folder.
   → [components](components.md#modules-and-import-paths)
2. **Decorators only work on `@component` classes that extend
   `BaseScriptComponent`.** Every decorator registers an initializer that runs
   while Lens Studio constructs the component instance, with `this` = the
   instance, before `onAwake`. A plain class gets nothing.
   → [components](components.md#how-the-decorators-run)
3. **`@bind...Event` wraps `onAwake`; never bind the same method again by
   hand.** The decorator creates the event in a wrapper around your `onAwake`
   and then calls your `onAwake`. Adding
   `this.createEvent("OnStartEvent").bind(() => this.onStart())` as well runs
   the handler twice (found in a consuming package during QA).
   → [troubleshooting](troubleshooting.md)
4. **`@depends` / `@provider` resolve at construction and throw when
   missing.** `@depends("Component.X")` looks on the script's own SceneObject
   only; `@provider("Component.X")` looks on it and then each parent up to the
   root. A miss throws `@depends /Path:ScriptComponent.field not found` and the
   script never initializes. For optional dependencies use
   `verify(this.sceneObject.getComponent(...), "...")` inside a handler instead.
   `"Component.X"` must be a built-in `ComponentNameMap` name: there is no
   `"Component.Transform"` (use `this.getTransform()`), and custom script type
   names are not accepted.
   → [components](components.md#dependency-injection)
5. **`@memo` is for getters only, computed once per instance, never reset.** It
   asserts the member is a getter without a setter; the first read replaces the
   accessor with a read-only data property.
   → [components](components.md#memoization)
6. **Async handlers never surface rejections.** A `@bind...Event` method that
   returns a Promise gets `.catch(reportError)`: failures are printed with a
   source-mapped stack, not rethrown. Read the Logger.
   → [components](components.md#debug)
7. **`assert` / `verify` throw plain `Error`s with your message.** Use them for
   preconditions and put `spath(this)` in the message to say where.
   → [components](components.md#assertions)
8. **The demo is logs, not visuals.** `SnapDecorators__PLACE_IN_SCENE` holds one
   `ExampleScript` that prints one line per decorator-bound event (`[UPDATE]`
   every 60 frames). A Specs project that runs it needs SIK's prerequisites,
   including Device Tracking (World) on the camera.
   → [examples](examples.md#demo-prefab), [troubleshooting](troubleshooting.md)

# SnapDecorators API status

[← Agent usage index](../README.md)

## Use when

Check this file before copying an older snippet or a name seen in an external
listing. It is the compatibility index for the package revision that contains
it (the version is recorded in `package.native`).
Every row below was verified against the TypeScript in this folder.

## Status meanings

- **Current** — recommended public surface for new work.
- **Deprecated** — still present; migrate to the named replacement.
- **Experimental** — public, but compatibility is not guaranteed.
- **Removed** — unavailable in this revision.
- **Internal** — present in the source but not exported; do not import.

## Current API

| Module (import path) | Export | Kind |
|---|---|---|
| `SnapDecorators.lspkg/decorators` | `bindStartEvent`, `bindEnableEvent`, `bindDisableEvent`, `bindUpdateEvent`, `bindLateUpdateEvent`, `bindDestroyEvent` | method decorators `(target: Function, context: ClassMethodDecoratorContext)` |
| `SnapDecorators.lspkg/decorators` | `memo` | getter decorator `(target: any, context: ClassGetterDecoratorContext)` |
| `SnapDecorators.lspkg/decorators` | `depends(componentType)`, `provider(componentType)` | field decorator factories, `componentType: keyof ComponentNameMap` |
| `SnapDecorators.lspkg/assert` | `assert(condition, message?)`, `verify(value, message?)` | functions |
| `SnapDecorators.lspkg/debug` | `reportError(reason)`, `spath(node)` | functions |
| `SnapDecorators.lspkg/guards` | `isScriptObject(obj)`, `isComponent(obj)` | type guards |
| `SnapDecorators.lspkg/Examples.ts` | `ExampleScript` | demo `@component`, no inputs |
| `SnapDecorators.lspkg/SnapDecorators__PLACE_IN_SCENE.prefab` | root SceneObject at (0, 0, -70) with no components and three children: `Guide` (`GuideDismissPanel`), `ExampleCarousel` (`ExampleCarousel`) and `SnapDecoratorsDemo` (`ExampleScript`) | demo prefab |

Signatures and runtime behavior: [components](components.md).

## Deprecated

None in this revision.

## Experimental

None. The decorators use the TC39 Stage 3 decorator form (`context.addInitializer`)
that Lens Studio's TypeScript compiles; the legacy `experimentalDecorators`
form is not used and not needed.

## Removed in this revision

| Surface | Why | Replacement |
|---|---|---|
| `Scripts/GuideDismissPanel/GuideDismissPanel.ts` (demo guide panel, class `GuideDismissPanel`) | Its class name collided with the samples' own `GuideDismissPanel`; asset lookups by name bound the package copy and produced empty guides | The current demo `GuideDismissPanel` ships in `Example/GuideDismissPanel/` as demo scaffolding of the prefab (same class name, so pick script assets by id or source path). If a project upgraded from an older revision still shows the old script, re-import the package |
| Prefab child `GUIDE_ReadAndDisable` (blue instruction note with the panel above) | Instructions now live on the demo project's overview guide and carousel | The prefab's own `Guide` and `ExampleCarousel` children (scripts in `Example/`) |

## Internal (not exported)

- `bindEvent(eventType)` in `decorators.ts` — the factory behind the six
  `bind...Event` decorators.
- `getComponentInParent(sceneObject, componentType)` in `decorators.ts` — the
  walk used by `@provider`.

## Known gaps

- `package_dependencies.json` declares `SpectaclesInteractionKit`,
  `SpectaclesUIKit`, `Motion` and `Icons`. The decorator modules
  (`decorators`, `assert`, `debug`, `guards`) import none of them and need
  nothing beyond Lens Studio's scripting API. The demo scaffolding does use
  them: `Example/ExampleCarousel/ExampleCarousel.ts` and
  `Example/GuideDismissPanel/GuideDismissPanel.ts` import
  `SpectaclesUIKit.lspkg/...` (`Frame`, `RectangleButton`, `Button`) and
  `SpectaclesInteractionKit.lspkg/...` (`WorldCameraFinderProvider`), so the
  demo prefab needs them installed.
- `@depends` / `@provider` accept only built-in `ComponentNameMap` names.
  There is no `"Component.Transform"` (Transform is not a component; use
  `getTransform()`), and custom script type names do not type-check.
- External listings may call the enable/disable decorators
  `@bindOnEnableEvent` / `@bindOnDisableEvent`. The exported names are
  `bindEnableEvent` and `bindDisableEvent`.
- `ExampleScript` binds a `TapEvent` that prints `[TAP]`; whether a tap arrives
  depends on the input device, so the line is absent in hand-only sessions.

# SnapDecorators troubleshooting

[← Agent usage index](../README.md)

## Use when

A decorated script fails to initialize, a handler fires wrongly, or the demo
project behaves oddly. Generic Lens scripting, scene placement, rendering and
TypeScript issues belong to the CLAD skills. The rows marked "QA 2026-09" were
observed while making the bundled packages QA-ready.

## Known limitations

| Symptom | Package cause | Package fix |
|---|---|---|
| A `@bind...Event` method runs twice per event (e.g. a layout spawns every object twice) — QA 2026-09 | The method is also bound by hand: `onAwake() { this.createEvent("OnStartEvent").bind(() => this.onStart()) }` next to `@bindStartEvent onStart()`. The decorator already binds it in its `onAwake` wrapper. Found in the Instantiation package's TS instantiators. | Keep one binding: remove either the decorator or the manual `createEvent`. |
| `Error: @depends /Root/Obj:ScriptComponent.field not found` (or `@provider ...`) at awake, and the script does nothing afterwards | The component is not on the SceneObject (`@depends`) or on it or any parent (`@provider`) when Lens Studio constructs the script. Injection runs before `onAwake`, so adding the component later does not help. | Add the component in the saved scene, or for runtime-created objects add it before `createComponent` of the script. For optional dependencies drop the decorator and use `verify(this.sceneObject.getComponent(...), "...")` inside a handler. |
| `@memo can only be applied to getters` or `@memo cannot be applied to a getter with a setter` thrown at awake | `@memo` is on a method, a field, or a getter that has a setter | Apply it to a plain getter only. |
| A `@memo` value is stale after the scene changed | By design: the value is computed once per instance and stored as a read-only property | Use a normal getter, or cache in a field that you reset yourself. |
| `@depends("Component.Transform")` or `getComponent("Component.Transform")` fails to compile (argument not assignable to `keyof ComponentNameMap`) | `Transform` is not a component, so `ComponentNameMap` has no `"Component.Transform"` key | Use `this.getTransform()` / `sceneObject.getTransform()`; keep `@depends` / `@provider` for real components such as `"Component.RenderMeshVisual"` or `"Component.Camera"`. |
| `Cannot find module 'SnapDecorators.lspkg/Scripts/decorators'` or a relative `./SnapDecorators.lspkg/...` import fails from a subfolder | The package has no `Scripts/` folder; the modules are at the package root. The relative form only resolves from a script next to the package folder. | Import `SnapDecorators.lspkg/decorators`, `.../assert`, `.../debug`, `.../guards`. |
| An async handler fails silently | By design: a Promise returned from a `@bind...Event` method gets `.catch(reportError)`; the error is printed with a source-mapped stack, not rethrown | Read the Logger. In your own `catch` blocks call `reportError(error)` for the same formatting. |
| Demo project: the Lens stops at start with `Your main camera is currently missing a 'Device Tracking Component'` and `Rendering failed 5 times in a row` — QA 2026-09 | Not a SnapDecorators bug: SIK's `WorldCameraFinderProvider` requires Device Tracking (World) on the main camera, and the SnapDecorators demo scene shipped without it before the 2026-09-30 revision, so any UIKit frame built at start threw | Add a Device Tracking component (mode World) to the camera. The bundled demo scene now has one. |
| Demo prints only `[AWAKE]` and `[DISABLE]`, never `[START]` or `[UPDATE]` — QA 2026-09 | The Examples object is disabled before `OnStart`. In the demo project the overview guide hides it until "Ok, I understood" is pressed. | Dismiss the guide or enable the object: `[ENABLE]`, `[START]` and then `[UPDATE]` every 60 frames follow. |
| `[UPDATE]` arrives every two seconds instead of once a second — QA 2026-09 | The demo logs every 60 frames; the Lens Studio Preview ran at about 30 FPS | Expected. The frame count and FPS in the line are the ground truth. |
| A project's own `GuideDismissPanel` shows an empty frame, or a script lookup by name binds the wrong `GuideDismissPanel` — QA 2026-09 | Older revisions (before 2026-09-30) bundled `Scripts/GuideDismissPanel/GuideDismissPanel.ts` with the same class name as the samples' panel; asset lookups by name could pick the package copy, which can linger in a project's Cache after an upgrade | Removed from the package. In affected projects pick script assets by id or source path and re-import the package. |
| The removed prefab guide still appears in a scene after upgrading the package | A prefab instance keeps the children it had when it was placed; Lens Studio does not sync removed prefab children into existing instances | Delete the stale `GUIDE_ReadAndDisable` child, or re-instantiate `SnapDecorators__PLACE_IN_SCENE`. |

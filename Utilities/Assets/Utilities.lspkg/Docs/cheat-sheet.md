# Utilities cheat sheet

[← Agent usage index](../README.md)

## Use when

Read first, before writing a script that imports Utilities. These are the rules
that most often break a generated Lens.

1. Import from `Utilities.lspkg/Scripts/Utils/<Class>` - one module per class.
   `UtilitiesKit.lspkg/...` (older docs) does not resolve. → [components](components.md)
2. Every class is static except `Logger`: create one with
   `new Logger(tag, debugEnabled = true, useColors = true)`. `debugEnabled = false`
   silences every level (info, warn, error, success, header, separator), not just
   `debug`. → [components](components.md#logger)
3. Type-name parameters are runtime type strings: `"Component.Text"`,
   `"Component.ScriptComponent"`, `"Component.Camera"`. For your own TypeScript
   component pass `String(MyComponent.getTypeName())` - it is an opaque id like
   `Component.123:456`, so the class name `"MyComponent"` never matches.
   → [troubleshooting](troubleshooting.md)
4. `ComponentUtils.findRootWithComponent` / `getRootCamera` look at scene ROOT
   objects only, and `getRootCamera` throws when no root has a Camera.
   `SceneObjectUtils.findComponentInHierarchy` only inspects ScriptComponents.
   → [components](components.md#componentutils)
5. `AnimationUtils` runs on SpectaclesInteractionKit's `animate()`: `makeTween`
   returns a cancel function, `animateScale` / `animateVisualFeedback` return a
   SIK `CancelSet` (call `.cancel()`). Nothing cancels itself when the object is
   disabled or destroyed - cancel in your own `OnDisableEvent` / `OnDestroyEvent`.
   → [animation](animation.md)
6. `animateVisualFeedback` "fades" by scaling 0 ↔ 1; it overwrites the object's
   local scale and does not touch opacity. → [animation](animation.md)
7. `MeshUtils` builds position-only meshes in the XY plane, facing +Z. Use an
   unlit material (no normals or UVs), and `addRenderMeshVisual` uses the
   material you pass as-is - clone it first if you recolor per object.
   → [components](components.md#meshutils)
8. Validation means "not null/undefined": `ValidationUtils` does not detect
   destroyed engine objects, `NaN`, `0`, `false` or empty strings.
   → [components](components.md#validationutils)
9. Parsing is `parseFloat` based: `"12abc"` → 12, only the first comma becomes a
   dot, and `safeParseInt` floors (`"-1.5"` → −2). → [components](components.md#typeconversionutils)

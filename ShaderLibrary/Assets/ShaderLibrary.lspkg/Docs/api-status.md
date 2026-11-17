# ShaderLibrary API status

[← Agent usage index](../README.md)

## Use when

Read before relying on a class or shader property from an older tutorial or snippet.

Source-derived asset contract for the revision this file ships with.

## Current

Seven graph assets and fourteen Material assets, ShaderLibrary__PLACE_IN_SCENE.prefab, Sphere mesh, six general textures and sixteen Matcap textures. See [exact asset/parameter index](components.md). No package-defined ScriptComponent inputs, methods, functions, interfaces or events exist.

## Experimental

Runtime access to a selected compiled graph variant's optional properties needs Inspector/Preview verification. Shader performance, glow compositing and hardware visual quality were not measured here.

## Deprecated

No deprecated source API is declared. Examples from older versions of the tutorial were illustrative application code, not installed exports.

## Removed / absent claims

No removal history is supplied. `ShaderManager.ts`, `EffectController.ts`, `MaterialPresets.ts`, loadShader/applyMaterial/cloneMaterial/setShaderParameter/getShaderParameter/animateParameter/getMaterialPreset/listAvailablePresets are **absent**, not confirmed historical removals. Use actual engine Material methods and asset inputs; do not invent package imports.

## Internal

Generated Port_*, NODE_* and Tweak_* identifiers and cached graph properties are implementation records, not a stable controller API. Static graph switches control variants rather than generic animation endpoints.

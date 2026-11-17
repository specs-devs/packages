# Raymarching API status

[← Agent usage index](../README.md)

## Current surface

- `MetaballField`: `configure`, `setPreset`, `smoothness`, `wobble`, `intensity`, `gloss`, `iridescence`, `setColors`, `addSource`, `removeSource`, `getSources`, `getVisual`, `findFor`, `presetNames`.
- `MetaballSource`: `field`, `radius`, `scaleWithObject`, `getWorldPosition`, `getWorldRadius`, `getField`, `setField`.
- `MetaballPresets`: `METABALL_PRESETS`, `PRESET_NAMES`, `findPreset`.
- Shader parameters: see [components](components.md#shader-parameters).

This is the first release; there is nothing to migrate.

## Platform notes

- Uses only standard Lens Scripting and Shader Graph features (custom code node, `discard`, view/world matrices). No experimental APIs, no internet, no camera.
- Stereo: the ray starts at the eye of the rendered view. If a build renders both eyes from one view matrix, use `eyeMode = 1` (see [troubleshooting](troubleshooting.md)). Verified so far in the Lens Studio preview only.
- Credits: the Assistant Orb example and the raymarching approach are inspired by the Specs AI assistant orb (SnapLab/specs-ai-proto-staging, `Blob.lspkg`).

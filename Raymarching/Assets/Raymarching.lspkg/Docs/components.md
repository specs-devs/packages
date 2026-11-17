# Raymarching components

[← Agent usage index](../README.md)

## MetaballField

`Scripts/MetaballField.ts`. Draws up to 8 `MetaballSource`s as one raymarched surface.

On start it creates a child `MetaballVolume` with a `RenderMeshVisual` (the proxy mesh) and its own clone of `material`. Every LateUpdate it fits the volume around the active balls, converts them to the volume's object space and writes the material parameters.

| Input | Default | What it does |
| --- | --- | --- |
| `material` | — | The MetaballField material (`Shaders/MetaballField.mat`). Each field uses its own copy. |
| `proxyMesh` | — | Sphere mesh the field is raymarched inside (`Meshes/UnitSphere`). |
| `preset` | Bubblegum | Look applied on start: Bubblegum, Liquid Chrome, Neon Plasma or Lava. |
| `overrideSmoothness` / `smoothnessOverride` | off / 0.35 | Use your own smoothness instead of the preset's. |
| `fitMargin` | 1.5 cm | Extra room around the balls so the gooey bridges are never clipped. |
| `renderOrder` | 0 | Render order of the volume. |

| Member | Description |
| --- | --- |
| `configure(material, proxyMesh, preset?)` | Set up a field created from code. |
| `setPreset(name)` | Apply a look from `MetaballPresets`; returns the preset. |
| `smoothness` | 0 = hard spheres … 1 = very gooey, relative to the mean ball radius. |
| `wobble` | Travelling ripples, 0 = smooth. |
| `intensity` | Overall brightness (on SPECS also how solid it looks). |
| `gloss`, `iridescence` | 0..1 look controls (set-only). |
| `setColors(colorA, colorB, rimColor)` | Ball tints (first → last ball) and fresnel rim. |
| `addSource` / `removeSource` / `getSources()` | Manage balls yourself (`MetaballSource` does this on its own). |
| `getVisual()` | The volume's `RenderMeshVisual`. |
| `MetaballField.findFor(sceneObject)` | The field a source on that object would join. |
| `MetaballField.presetNames` | Names accepted by `setPreset`. |

## MetaballSource

`Scripts/MetaballSource.ts`. One ball: follows its object's world position.

| Input | Default | What it does |
| --- | --- | --- |
| `field` | empty | Field to join. Empty: the nearest `MetaballField` up the hierarchy, else the first field in the scene. |
| `radius` | 3 cm | Ball radius; 0 hides the ball without unregistering it. |
| `scaleWithObject` | off | Multiply the radius by the object's world scale (x). |

Members: `getWorldPosition()`, `getWorldRadius()` (0 when disabled), `getField()`, `setField(field)`. Disabling the component or its object removes the ball.

## MetaballPresets

`Scripts/MetaballPresets.ts`: `METABALL_PRESETS`, `PRESET_NAMES`, `findPreset(name)`.

| Preset | Look |
| --- | --- |
| Bubblegum | Sky blue → pink, soap-bubble rim. |
| Liquid Chrome | Silver, very glossy, faint iridescence. |
| Neon Plasma | Cyan → magenta, bright, wobbling. |
| Lava | Yellow → red, soft gloss, slow ripples. |

## Shader parameters

`Shaders/MetaballField.graphShader` exposes these material parameters (the field writes them; you normally don't):

| Parameter | Type | Meaning |
| --- | --- | --- |
| `ball0` … `ball7` | vec4 | xyz = centre in the volume's object space, w = radius (0 = off). |
| `boundRadius` | float | Usable radius of the proxy sphere (object space). |
| `smoothness` | float | Width of the smooth-union band (object space). |
| `rippleScale` | float | Size of the wobble ripples (object space). |
| `wobble` | float | Ripple strength. |
| `intensity` | float | Brightness. |
| `colorA`, `colorB`, `rimColor` | vec3 | Ball tints and fresnel rim. |
| `gloss`, `iridescence` | float | Specular and soap-bubble hue shift. |
| `eyeMode`, `eyeOffset` | float | 0 = ray from the rendered view's eye (default); 1 = centre camera + `eyeOffset` cm per eye. |

## Example components (`Example/`)

Demo-only; they show how to drive sources.

| Component | Key inputs |
| --- | --- |
| `HandGoo` | `field`, `tipRadius` 1.6, `palmRadius` 3.4, `idleRadius` 3 |
| `PinchMerge` | `field`, `count` 5, `radius` 3.2, `ringRadius` 9, `returnDelay` 2.5 s; `resetOrbs()` |
| `LavaLamp` | `field`, `glassMaterial`, `capMaterial`, `count` 6, `height` 30, `columnRadius` 6.5, `blobRadius` 2.6, `speed` |
| `AssistantOrb` | `field`, `orbSize` 90, `intensity` 1, `animationSpeed` 1.5, `showPanel`, `panelOffset`; `excite(seconds)` |
| `StyleLab` | `field`, `radius` 3.4, `orbitRadius` 6, `panelOffset` |

Demo scaffolding: `ExampleCarousel` (Previous / Next through the examples, one info line each; `examples`, `exampleInfo`, `extraPanelDrop`, `anchorExamples`) and `GuideDismissPanel` (the "Ok, I understood" guide; `hideUntilDismissed`). `Example/Shared/DemoUI.ts` builds the example panels at runtime with UI Kit.

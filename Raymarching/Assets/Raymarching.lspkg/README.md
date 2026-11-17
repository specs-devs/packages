<p align="center">
  <img src="Docs/media/Raymarching.png" width="250px" alt="Raymarching"/>
</p>

# Raymarching

Raymarching draws shapes that have no mesh: for every pixel the shader steps a ray forward by the distance to the nearest surface (a **signed distance field**) until it touches one. **Metaballs** are balls whose distance fields are blended with a *smooth union*, so instead of overlapping they melt into one continuous, gooey surface.

This package brings that to Specs with one component pair: a `MetaballField` draws up to 8 `MetaballSource`s as a single glossy, iridescent surface. Put a source on any object — a fingertip, a grabbable orb, a lava blob — and it joins the goo.

## Features

- **One surface, many balls**: up to 8 balls per field merge with a polynomial smooth union; tune how gooey with `smoothness`.
- **Cheap by design**: the shader only marches inside a proxy sphere that the field fits tightly around the balls every frame, and stops after 32 steps.
- **Stereo-correct**: each eye's ray starts at that eye, so the goo sits in depth like real geometry.
- **Four looks**: Bubblegum, Liquid Chrome, Neon Plasma and Lava presets — per-ball tints, an iridescent fresnel rim, a camera-relative key light with tunable gloss and optional travelling ripples.
- **Live controls**: change preset, smoothness, wobble and intensity at runtime.
- **Self-contained demo**: the prefab ships a guide and an example carousel with five playable examples.

## Examples

| Step | What you do |
| --- | --- |
| **Hand Goo** | Raise your hands: thumb, index and middle fingertips and both palms are metaballs. Touch fingers or bring your hands together and watch them melt. |
| **Pinch & Merge** | Pinch an orb, drag it into another and squash them together. Released orbs drift back home. |
| **Lava Lamp** | Six wax blobs heat up at the bottom, rise, cool and sink, merging and splitting on the way. |
| **Assistant Orb** | An AI-assistant orb that breathes when idle and gets wild as the intensity rises. Inspired by the Specs AI assistant orb. |
| **Style Lab** | Four orbiting balls with a panel to try every preset and tune smoothness, wobble and intensity live. |

## Quick Start

1. Drag `Raymarching__PLACE_IN_SCENE` into a Specs scene (Camera with Device Tracking and the SIK prefab are already there) and press "Ok, I understood".
2. To add goo to your own Lens:
   - Add an object with a **MetaballField** and set its `material` (`Shaders/MetaballField.mat`) and `proxyMesh` (`Meshes/UnitSphere`). Pick a `preset`.
   - Add a **MetaballSource** to every object that should become a ball, and set its `radius` (cm). Sources join the nearest field up the hierarchy, or the one you assign.
3. Move the source objects however you like — the field follows them every frame.

```ts
import {MetaballField} from "Raymarching.lspkg/Scripts/MetaballField"

@component
export class GooPulse extends BaseScriptComponent {
  @input field: MetaballField

  onAwake() {
    this.field.setPreset("Neon Plasma")
    this.createEvent("UpdateEvent").bind(() => (this.field.wobble = 0.5 + 0.5 * Math.sin(getTime() * 2)))
  }
}
```

## Performance

A field costs one draw call; the price is per pixel it covers. Keep fields to a few per scene, keep balls close together (spread-out balls make a big volume with mostly empty pixels) and prefer fewer, bigger balls. See [performance](Docs/performance.md).

## Usage

This section ships with the package and describes the exact installed revision.
Read it, then follow the links into `Docs/` for the topic you need. It is
written for both people and coding agents; generic Lens scripting, scene
construction, and Specs spatial design are out of scope here.

### Package identity

- Package descriptor: `Raymarching.lspkg/package.native`
- Consumer import prefix: `Raymarching.lspkg/Scripts/`. The components are
  `Raymarching.lspkg/Scripts/MetaballField` and `Raymarching.lspkg/Scripts/MetaballSource`;
  the looks are in `Raymarching.lspkg/Scripts/MetaballPresets`. See [components](Docs/components.md).
- Shader: `Shaders/MetaballField.graphShader` (one custom-code node; source in
  `Shaders/MetaballField.glsl.md`) and its material `Shaders/MetaballField.mat`. Proxy mesh:
  `Meshes/UnitSphere`. See [shader](Docs/shader.md).
- Prefab entry point: `Raymarching__PLACE_IN_SCENE.prefab`. It is self-contained:
  drop it into a Specs scene (Camera with Device Tracking + SIK) and you get the guide
  panel ("Ok, I understood"), the example carousel and the five examples.
- Demo scaffolding: `Example/` holds the guide and carousel scripts
  (`Example/GuideDismissPanel`, `Example/ExampleCarousel`), the five example scripts
  (`Example/HandGoo`, `Example/PinchMerge`, `Example/LavaLamp`, `Example/AssistantOrb`,
  `Example/StyleLab`), their runtime UI helper (`Example/Shared/DemoUI`) and the lava lamp's
  glass and cap materials. Your own Lens only needs `Scripts/`, `Shaders/` and `Meshes/`.
- Required companion packages (`package_dependencies.json`): `InteractionKit` (hand data and Pinch in the examples) and `UIKit` (example panels,
  buttons and sliders), plus UI Kit's `Motion` and `Icons`. The core
  (`Scripts/`, `Shaders/`) has no package dependency. No internet, camera or Snap Cloud access.

### Version and API status

This is the first release. [API status](Docs/api-status.md) lists the public surface and
the platform notes.

### Applicability

Use this package for organic, merging, liquid-looking shapes — goo, blobs, plasma, lava,
assistant orbs — that react to hands or scripts. For ordinary materials, use Shader
Library; for particle effects, use a VFX graph.

### Package Docs (ship in Docs/)

- [Cheat sheet](Docs/cheat-sheet.md): read this first. It covers the rules that most often break a lens.
- [Components](Docs/components.md): `MetaballField`, `MetaballSource`, the presets, the shader parameters and the example components.
- [Examples](Docs/examples.md): prefab drag-and-drop, goo on your own objects, hands, runtime fields, presets.
- [Shader](Docs/shader.md): how the raymarcher works and how to add your own SDF shape.
- [Performance](Docs/performance.md): what it costs and how to keep it cheap.
- [Troubleshooting](Docs/troubleshooting.md): symptom → cause → fix.
- [API status](Docs/api-status.md): what's current in this revision and platform notes.

### Verification

1. TypeScript compiles with no errors; the shader graph compiles.
2. In the Lens Studio preview: the guide shows, "Ok, I understood" opens the carousel, and every step renders goo: Hand Goo shows three idle balls without hands (and follows the simulated hands), Pinch & Merge orbs can be dragged together, the lava lamp loops, the assistant orb reacts to its slider and Excite, Style Lab switches presets.
3. On SPECS: the goo sits at a stable depth with both eyes (no doubling), fingertips melt together, and the frame rate stays smooth with one example on screen.

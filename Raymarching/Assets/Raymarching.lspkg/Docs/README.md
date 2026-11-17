# Raymarching

## What it is
A package that draws mesh-free, merging "metaball" goo on Specs. A shader raymarches a signed distance field per pixel,
and balls are blended with a smooth union so they melt into one continuous, glossy surface. It is for developers who
want organic, liquid-looking shapes (goo, blobs, plasma, lava, assistant orbs) that follow hands, objects or scripts.

## What it does
1. Add a `MetaballField` with `material` = `Shaders/MetaballField.mat` and `proxyMesh` = `Meshes/UnitSphere`, and pick
   a `preset`.
2. Add a `MetaballSource` (radius in cm) to every object that should be a ball; it joins the nearest field up the
   hierarchy, the first field in the scene, or the one you assign.
3. On start the field creates a child `MetaballVolume` with its own copy of the material. Every LateUpdate it fits that
   proxy sphere tightly around the active balls and writes their positions and radii to the material.
4. The shader marches only inside the volume (up to 32 steps), starting each ray at the rendered eye for correct
   stereo depth, and shades the hit with per-ball tints, an iridescent fresnel rim and a camera-relative key light.
5. The place-in-scene prefab shows five examples in a carousel: Hand Goo (fingertips and palms become goo), Pinch &
   Merge (grab orbs and squash them together), Lava Lamp, Assistant Orb and Style Lab (live preset and slider panel).

## Highlights
- Up to 8 balls per field, merged with a polynomial smooth union; `smoothness` is relative to the mean ball radius.
- One draw call per field; cost is per covered pixel, so keep balls close together and fields few.
- Four presets: Bubblegum, Liquid Chrome, Neon Plasma and Lava.
- Runtime control: `setPreset`, `smoothness`, `wobble`, `intensity`, `gloss`, `iridescence`, `setColors`.
- Fields can be created from code with `configure(material, proxyMesh, preset?)`.
- The core (`Scripts/`, `Shaders/`, `Meshes/`) has no package dependency; only the examples use Interaction Kit (SIK)
  and UI Kit.

## Core scripts
| Script | What it does |
|---|---|
| `Scripts/MetaballField.ts` | Fits the proxy volume around its balls every frame and drives the raymarching material. |
| `Scripts/MetaballSource.ts` | One ball: follows its object's world position with a radius in cm. |
| `Scripts/MetaballPresets.ts` | The four ready-made looks and `findPreset`. |
| `Example/HandGoo/HandGoo.ts` | Example: fingertips and palms of both hands as metaballs. |
| `Example/PinchMerge/PinchMerge.ts` | Example: pinchable orbs that melt together and drift back home. |
| `Example/LavaLamp/LavaLamp.ts` | Example: six blobs that heat, rise, cool and sink. |
| `Example/AssistantOrb/AssistantOrb.ts` | Example: an assistant-style orb that reacts to an intensity slider. |
| `Example/StyleLab/StyleLab.ts` | Example: orbiting balls with preset and slider controls. |

## Extra info
- **Requires:** InteractionKit, UIKit, Motion, Icons (used by the examples). No internet, camera or Snap Cloud access.
  The additive Specs display makes dark colours see-through; raise `intensity` for a more solid look. Stereo
  behaviour is verified in the Lens Studio Preview; if goo doubles on device, set the material's `eyeMode` to 1.
  Hands are only available from `OnStart`.
- **Get started:** `Raymarching__PLACE_IN_SCENE.prefab` (guide, example carousel and five examples); for your own
  Lens you only need `Scripts/`, `Shaders/` and `Meshes/`.
- **More docs:**
  - [cheat-sheet.md](cheat-sheet.md) - the rules that most often break the Lens, read first.
  - [components.md](components.md) - field, source, presets, shader parameters and examples.
  - [examples.md](examples.md) - prefab, goo on your objects and hands, fields from code.
  - [shader.md](shader.md) - how the raymarcher works and adding your own SDF shape.
  - [performance.md](performance.md) - what it costs and how to keep it cheap.
  - [api-status.md](api-status.md) - current surface and platform notes.
  - [troubleshooting.md](troubleshooting.md) - symptom, cause and fix.

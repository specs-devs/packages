# Shader Library

## What it is
An asset package of ready-made shader graphs and materials for Specs Lenses: Unlit, Simple, Uber, Toon, Matcap,
Rim Highlight and Outer Glow. It gives Lens creators a starting set of looks they can assign to their own meshes
without writing shaders. The library itself has no scripts; the only TypeScript in it is demo scaffolding.

## What it does
- Each of the seven families ships a shader graph, a base material and an `[EXAMPLE]` material.
- Assign a family's material to any `RenderMeshVisual`; no code is needed.
- To change a look per object, clone the material and write the graph's ScriptName on `mainPass` (for example
  `rimColor`, `rimExponent`); capitalised ports such as `ENABLE_RIM` are compile-time switches set in the Inspector.
- The demo prefab shows one sphere per family. After the guide panel is dismissed, a carousel steps through the
  seven families with Previous / Next, all shown at the same spot in front of the viewer.

## Highlights
- Seven families: Unlit, Simple, Uber, Toon (specular, shadow and outline line), Matcap, and the Rim Highlight
  and Outer Glow overlays.
- Rim Highlight and Outer Glow use Screen blending and only add light, so they read best as halos on a second,
  slightly larger copy of a mesh over dark surroundings.
- Unlit offers emissive, rim highlight, recolor, opacity texture and UV tiling / scrolling switches.
- Ships a sphere mesh, water, lava and electric-noise textures, and sixteen matcap textures.
- The shaders and materials depend on no other package.

## Core scripts
The package has no library scripts; these are the files a developer opens first.

| Script | What it does |
|---|---|
| `Materials/Unlit/unlit.graphShader` | Unlit graph with emissive, rim, recolor, opacity and UV switches. |
| `Materials/Simple/simple_glasses.graphShader` | Simple graph: base color / texture, optional rim, opacity texture and animation. |
| `Materials/Uber/uber.graphShader` | Uber graph, the one with the most parameters. |
| `Materials/Toon/toon_spec.graphShader` | Toon shading with specular highlight, shadow intensity and outline line. |
| `Materials/Matcap/matcap_glasses.graphShader` | Matcap shading from a matcap texture, with optional normal map. |
| `Materials/Rim Highight/rim_highlight_glasses.graphShader` | Screen-blended rim highlight overlay (folder spelled `Rim Highight`). |
| `Materials/Outer Glow/outer_glow.graphShader` | Screen-blended outer glow overlay. |
| `Example/ExampleCarousel/ExampleCarousel.ts` | Demo carousel that shows one family at a time. |
| `Example/GuideDismissPanel/GuideDismissPanel.ts` | Demo guide panel; hides the examples until dismissed. |

## Extra info
- **Requires:** InteractionKit, UIKit, Motion and Icons, used only by the demo scripts in `Example/`. Check
  transparency and performance on Specs; no performance figures are established for these graphs.
- **Get started:** `ShaderLibrary__PLACE_IN_SCENE.prefab` in a Specs scene, or assign a material such as
  `Materials/Toon/Toon.mat` to your own mesh. Remove `Guide` and `ExampleCarousel` when you build your own Lens.
- **More docs:**
  - [cheat-sheet.md](cheat-sheet.md) - asset selection and shared-material pitfalls; read first
  - [components.md](components.md) - material paths, render states and graph parameter index
  - [api-status.md](api-status.md) - what ships versus scripts older tutorials described
  - [examples.md](examples.md) - material cloning and application snippet
  - [troubleshooting.md](troubleshooting.md) - looks, labels and layering issues
  - [tutorial.md](tutorial.md) - step-by-step use of the prefab, materials and parameters

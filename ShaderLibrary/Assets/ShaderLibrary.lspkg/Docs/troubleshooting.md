# ShaderLibrary troubleshooting

[← Agent usage index](../README.md)

## Use when

Read when a material property or historical controller cannot be found.

| Symptom | Source-derived cause / action |
|---|---|
| Import cannot resolve ShaderManager/EffectController/MaterialPresets | Those scripts do not ship. Use actual Material inputs and engine methods. |
| rimPower/glowIntensity/scanlineOffset/mainTexOffset missing | Those names from older tutorial versions are not current named graph contracts. Use graph index (e.g. rimExponent), then inspect variant. |
| Per-object update changes another mesh | Shared asset was mutated. Clone once for distinct parameter values. |
| Glow ignores depth or appears behind/through geometry | Outer Glow intentionally disables depth test/write and culls front (its materials are also `TwoSided: true`); inspect compositing/material configuration. |
| Source path typo | `Materials/Rim Highight` is intentionally indexed exactly as shipped. |
| Toggle property does not animate like a numeric uniform | Static graph switch controls a compiled variant; verify its Inspector configuration. |
| “Instancing” code copied from an older tutorial still shares material | Its `MultiMaterialManager.cloneMaterial` returned the source asset; it was never a package implementation. Call `Material.clone()` (see [examples](examples.md)). |
| Sphere labels read "Matcap Glasses", "Uber Glasses", … | A product-rename pass rewrote the original second line. Fixed in this revision (labels are the family names). If an older copy shows it, update the package or edit the `<Family> Text` labels. |
| No name label above the spheres | The `<Family> Text` labels ship disabled (no floating text). Enable them in your scene copy, or name the families in your own UI panel. |
| All seven spheres overlap when the carousel is removed | Every group is authored at the same position, (0, −16, −120), for one-at-a-time display. For a static gallery, give each group its own position and enable them all. |
| Matcap sphere looks dull grey in the Lens Studio Preview | The example matcap is a dark chrome texture: it renders correctly but has little contrast on the grey Preview background. Try a brighter `Textures/Matcaps/Matcap_*` texture. |
| Outer Glow looks like a flat orange disc | On its own sphere the glow (front-culled, Screen, no depth) fills the silhouette with a soft edge. As a halo, put it on a slightly larger copy of the mesh, around the base object. |
| Rim Highlight / Outer Glow almost invisible | Screen blending only adds light. Show them over dark content. |

## Preview QA (Lens Studio Preview, 2026-10-01)

The demo project's carousel showed each family alone in front of the user (Unlit, Simple, Uber, Toon, Matcap, Rim Highlight, Outer Glow). All seven render with no magenta or missing textures, and the log stayed clean. Not checked: device rendering quality, performance, and runtime writes to each graph variant's optional properties.

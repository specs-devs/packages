# ShaderLibrary cheat sheet

[← Agent usage index](../README.md)

## Use when

Read first when applying one of the installed material families.

1. This is an asset-only package: no ShaderManager, EffectController or MaterialPresets TS exports ship. → [Status](api-status.md)
2. Choose the exact family material or `[EXAMPLE]` variant, then clone for instance-specific writes. → [Assets](components.md#material-families)
3. Use graph ScriptName values such as `rimExponent`; legacy `rimPower`, `glowIntensity`, `scanlineOffset` and `mainTexOffset` are not established here. → [Parameters](components.md#graph-parameter-index)
4. Static bool/dropdown switches compile shader variants; do not equate every ScriptName with a writable runtime uniform. → [Parameters](components.md#graph-parameter-index)
5. Outer Glow uses Screen blending, front-face culling (with `TwoSided: true`), no depth test/write; Rim Highlight uses Screen and no depth write. Composite intentionally and inspect actual view. → [Render states](components.md#render-states)
6. Preserve the source folder spelling `Rim Highight`; guessing a corrected path misses the asset. → [Assets](components.md#material-families)
7. The prefab stacks all seven groups at the same position, (0, −16, −120) cm, for a viewer at the origin; the `ExampleCarousel` shows one at a time. It is a showcase, not a reusable placement. Copy a sphere or just its material into your own scene. → [Examples](examples.md#existing-prefab)
8. Rim Highlight and Outer Glow are Screen-blended overlays: they only add light, so they read as glows on dark surroundings and almost vanish on bright ones. → [Troubleshooting](troubleshooting.md)

# ShaderLibrary tutorial

[← Agent usage index](../README.md)

## Use when

Read for a step-by-step walk through what the package actually ships: seven shader graphs,
their materials, a demo prefab and textures. The package has no scripts of its own beyond the
demo scaffolding in `Example/`. Exact paths, ScriptNames and render states are in
[components](components.md).

## What ships

- Seven families, each with a graph, a base material and an `[EXAMPLE]` material: Unlit, Simple,
  Uber, Toon, Matcap, Rim Highlight, Outer Glow ([families](components.md#material-families)).
- `Meshes/Sphere.mesh`, six general textures (`Water_BaseColor`, `Lava_BaseColor`,
  `Lava_Emissive`, `Lava_NormalMap`, `Noise_Electro_A`, `Noise_Electro_B`) and sixteen
  `Textures/Matcaps/Matcap_*` textures.
- `ShaderLibrary__PLACE_IN_SCENE.prefab`: the seven example groups plus the `Guide` panel and the
  `ExampleCarousel` ([demo scaffolding](components.md#demo-scaffolding-example)).

Older versions of this tutorial described `ShaderManager.ts`, `EffectController.ts`,
`MaterialPresets.ts` and methods such as `loadShader`, `applyMaterial` or `animateParameter`.
None of these ship; see [API status](api-status.md#removed--absent-claims).

## 1. Look at the families in the demo

1. Drag `ShaderLibrary.lspkg/ShaderLibrary__PLACE_IN_SCENE.prefab` into a Specs scene.
2. Run Preview and press "Ok, I understood" on the guide.
3. Step through the families with Previous / Next on the carousel. All seven groups are
   authored at the same position, (0, −16, −120), so the carousel shows one at a time.

Each group holds a `<Family> [EXAMPLE]` sphere (scale 10) and a disabled `<Family> Text`
label 10 cm above it.

## 2. Use a family on your own mesh

No code is needed. Select your object's `RenderMeshVisual` and assign the family's
`[EXAMPLE]` material or its base material, for example `Materials/Toon/Toon.mat`. Keep the
folder spelling `Materials/Rim Highight/` when you look for the Rim Highlight assets.

## 3. Change a parameter from a script

Write to the graph's ScriptName on `mainPass`, and clone the material first so other objects
that share the asset keep their look:

```typescript
@component
export class TintRim extends BaseScriptComponent {
  @input renderMesh: RenderMeshVisual
  @input rimMaterial: Material // Materials/Rim Highight/Rim Highlight.mat

  onAwake(): void {
    const instance = this.rimMaterial.clone()
    instance.mainPass.rimColor = new vec4(0.2, 0.8, 1, 1)
    instance.mainPass.rimExponent = 3
    this.renderMesh.mainMaterial = instance
  }
}
```

ScriptNames in capitals (`ENABLE_RIM`, `ENABLE_BASE_TEX`, …) and other ports marked static in
the [parameter index](components.md#graph-parameter-index) are compile-time switches. Set them in
the Inspector, not per frame. A non-static port can still be absent from the compiled variant
the material uses, so check it in Preview.

## 4. Layer an overlay

Rim Highlight (Screen blend, no depth write) and Outer Glow (Screen blend, front-face culling,
no depth test or write) only add light. To use them as a halo or rim on another object, put the
material on a second, slightly larger copy of the mesh around the base object, and show it over
dark surroundings ([render states](components.md#render-states),
[troubleshooting](troubleshooting.md)).

## 5. Build your own Lens

Delete `Guide` and `ExampleCarousel` from your prefab instance, keep the group or material you
need, and remove the rest.

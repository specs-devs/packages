# ShaderLibrary examples

[← Agent usage index](../README.md)

## Use when

Read for a small actual Material integration rather than legacy nonexistent manager APIs.

## Apply a per-object material clone

Bind renderMesh and a material from the family table. Unlit has a named baseColor port. The engine API, not a package manager, applies and clones the asset.

```typescript
@component
export class LibraryMaterialExample extends BaseScriptComponent {
  @input renderMesh: RenderMeshVisual;
  @input unlitMaterial: Material;

  onAwake(): void {
    const instance = this.unlitMaterial.clone();
    instance.mainPass.baseColor = new vec4(0.2, 0.6, 1, 1);
    this.renderMesh.mainMaterial = instance;
  }
}
```

## Existing prefab

`ShaderLibrary.lspkg/ShaderLibrary__PLACE_IN_SCENE.prefab` contains seven groups (`Matcap`, `Uber`, `Unlit`, `Simple`, `Toon`, `Rim Highlight`, `Outer Glow`). Each group holds a `<Family> [EXAMPLE]` sphere (`Meshes/Sphere.mesh`, scale 10, the matching `[EXAMPLE]` material) and a `<Family> Text` label 10 cm above it. The labels ship disabled so nothing floats in the scene; enable them if you lay the spheres out as a static gallery, or show the family name in your own UI (the demo project's carousel title does this). The prefab also carries the demo scaffolding: a `Guide` panel (dismissed with "Ok, I understood") and an `ExampleCarousel` that shows one group at a time (Previous / Next / minimize); their scripts ship in `Example/` (see [components](components.md#demo-scaffolding-example)). All seven groups sit at the same position, (0, −16, −120). To use the spheres as a static gallery instead, delete `Guide` and `ExampleCarousel` from your instance, give each group its own position and enable the groups yourself.

To reuse one look, drag the prefab in, keep the group you want, and assign its `[EXAMPLE]` material (or the family's base material) to your own mesh.

The snippet type-checks against installed Lens Studio ambient declarations. Static compilation cannot prove the chosen graph variant renders a written parameter; Preview and device checks remain required.

<p align="center">
  <img src="Docs/media/ShaderLibrary.png" width="250px" alt="ShaderLibrary"/>
</p>

# Shader Library

Seven shader graphs and fourteen material assets demonstrate Unlit, Simple,
Uber, Toon, Matcap, Rim Highlight and Outer Glow rendering. This revision is an
asset library: it contains no TypeScript manager/controller implementation.

## Usage

This section ships with the package and describes the exact installed revision.
Generic Lens scripting, scene construction and Specs spatial design are out of scope here; graph parameters, materials and package-specific limitations live here.

### Package identity

- Descriptor: `ShaderLibrary.lspkg/package.native`.
  Existing ReadMe reference retained; no setup script or Instantiable prefab assignment.
- Consumer asset prefix: `ShaderLibrary.lspkg/`; there are no TS imports/exports (the demo
  scripts in `Example/` are scaffolding, not library API).
- Prefab: `ShaderLibrary.lspkg/ShaderLibrary__PLACE_IN_SCENE.prefab`, self-contained drag-and-drop demo.
  Besides the seven example groups it includes the guide panel (`Guide`, closed with
  "Ok, I understood") and the `ExampleCarousel` panel that steps through the families one at a
  time, so an empty Specs scene with SIK + UIKit gets the full demo. Their scripts ship in the
  package's `Example/` folder (`Example/ExampleCarousel/`, `Example/GuideDismissPanel/`)
  ([components](Docs/components.md#demo-scaffolding-example)).
- Declared companions (`package_dependencies.json`): InteractionKit,
  UIKit, Motion, Icons. Only the demo scripts in `Example/` import
  InteractionKit and UIKit; the shaders and materials need none of them.

### Version and API status

Read [API status](Docs/api-status.md). Older versions of the tutorial advertised
scripts and methods (`ShaderManager`, `EffectController`, `MaterialPresets`) that do
not ship. Shader graph ScriptName ports and selected material pass values are the
mechanical surface.

### Applicability

Use for the seven included render effects and their material presets. Select
another package or write application scripts when you need a material manager,
transition controller or runtime pooling: this library does not provide those.

### Package Docs (ship in Docs/)

- [Cheat sheet](Docs/cheat-sheet.md): read first for asset selection and shared-material pitfalls.
- [API status](Docs/api-status.md): read for present assets vs absent historical API claims.
- [Materials and graph parameters](Docs/components.md): read for exact paths, port names and render states.
- [Examples](Docs/examples.md): read for a compile-checked material cloning/application snippet.
- [Troubleshooting](Docs/troubleshooting.md): read when a look, label or layer doesn't come out as expected (includes the Preview QA results).
- [Tutorial](Docs/tutorial.md): step-by-step use of the shipped prefab, materials and graph parameters.

### Verification

1. Compile application scripts against installed declarations; do not import nonexistent manager scripts.
2. Verify each of the seven material families on the sphere examples, including glow/rim overlay composition.
3. Inspect the selected shader variant before writing a parameter; static graph switches are not ordinary uniform inputs.
4. Confirm no unresolved shaders/textures, magenta surfaces or clipped example labels (if you enable them) in Preview.
5. Check device performance and transparency visually; no performance figures are established for these graphs.

## Built with 👽 by the SPECS team

---

[See more packages](https://github.com/specs-devs/packages)


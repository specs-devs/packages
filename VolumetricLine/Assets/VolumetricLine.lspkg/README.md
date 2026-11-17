<p align="center">
  <img src="Docs/media/VolumetricLine.png" width="250px" alt="VolumetricLine"/>
</p>

# VolumetricLine

VolumetricLine is a 3D line rendering system that creates smooth, volumetric tubes by extruding circular cross-sections along paths defined by scene objects. It features spline interpolation for curved lines, real-time mesh generation, continuous position tracking, and customizable appearance with radius, smoothness, and material properties for creating visual connections, trails, and decorative elements.

## Usage

This section ships with the package and describes the exact installed revision. Generic Lens scripting, scene construction and Specs spatial design live in the CLAD skills; package-specific setup and behavior are documented here.

### Package identity

- Descriptor: `package.native` (holds the package version).
- Consumer import prefix: `VolumetricLine.lspkg/Scripts/`.
- Required companions from `package_dependencies.json`: SnapDecorators, SpectaclesInteractionKit, Utilities, SpectaclesUIKit, Motion and Icons.
- Example prefab: `VolumetricLine__PLACE_IN_SCENE.prefab`. Drop it into a Specs scene (Camera + SpectaclesInteractionKit) to get the full demo: it contains the guide panel, the example carousel and the `VolumetricLine Example` group (the line, its animator and four control-point Boxes).
- Demo scaffolding: `VolumetricLine.lspkg/Example/` holds the scripts the prefab uses for the guide and carousel (`ExampleCarousel/`, `GuideDismissPanel/`). They are not part of the line API; see [components](Docs/components.md#demo-scaffolding-example).

### Version and API status

Read [API status](Docs/api-status.md) before relying on lifecycle, update timing or performance claims.

### Applicability

Use this package for tube geometry following authored SceneObject control points. It does not solve self-intersection, guarantee a device performance budget, or provide tracked drawing input. RandomPositionAnimator is an optional local-position demo helper.

### Related CLAD skills

[mesh-builder-scripting](https://github.com/lens-studio-devs/ls-extensions/blob/main/plugins/ls-clad/skills/mesh-builder-scripting/SKILL.md), [materials](https://github.com/lens-studio-devs/ls-extensions/blob/main/plugins/ls-clad/skills/materials/SKILL.md). These skills cover the surrounding Lens workflow.

[Install CLAD](https://developers.specs.com/docs/clad/setup/setup-ai/) or browse its [source](https://github.com/lens-studio-devs/ls-extensions). Read the installed package docs for this revision’s APIs.

### Package Docs (ship in Docs/)

- [Cheat sheet](Docs/cheat-sheet.md): read first for initialization, material and update rules.
- [Components](Docs/components.md): read when wiring inputs or calling public methods.
- [Lifecycle and geometry](Docs/lifecycle.md): read when choosing coordinate spaces, smoothing and mesh budgets.
- [Examples](Docs/examples.md): read when placing the prefab or controlling an authored component.
- [Troubleshooting](Docs/troubleshooting.md): read when geometry is missing, displaced or frozen.
- [API status](Docs/api-status.md): read when comparing older tutorial claims with the current source.
- [Human tutorial](Docs/guide.md): retained long-form examples and background, with current-source caveats.

### Verification

1. Compile with the installed companion versions and valid material/control-point references.
2. Start with at least two distinct, non-null points wired before VolumetricLine's OnStartEvent; verify the RenderMeshVisual actually appears.
3. Compare two preview timestamps while the demo animator runs, then exercise manual refresh and throttled/smooth modes.
4. Scale/rotate the line root and check the tube still passes through the points; with a material that has `baseColor`, check `color` changes (the shipped Rainbow/PBR materials have none).
5. Measure the device mesh/update budget (the example rebuilds 24,022 vertices every frame).

---

## Built with 👽 by the SPECS team







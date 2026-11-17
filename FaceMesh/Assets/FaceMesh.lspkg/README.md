<p align="center">
  <img src="Docs/media/FaceMesh.png" width="250px" alt="FaceMesh"/>
</p>

# Face Mesh

A native face-mesh/head-binding prefab plus a reusable MatchTransformTS component. MatchTransformTS follows an explicitly assigned object's position, rotation and scale with per-axis constraints and smoothing. It does not discover facial landmarks or choose a default camera.

## Features

- Drop-in prefab: camera with Device Tracking, ambient light, and a face-index-zero Head Binding carrying the textured Face Mesh, plus the onboarding guide and example carousel.
- Generic transform follower with world-position offset and per-axis constraints.
- Separate position/rotation/scale smoothing controls.

## Usage

This section ships with the package and describes the exact installed revision. Generic Lens scripting, scene construction and Specs spatial design live in the CLAD skills; this package owns its API, prefab wiring and limitations.

### Package identity

- Descriptor: `package.native` (holds the package version).
- Consumer import: `FaceMesh.lspkg/Scripts/MatchTransform`; exported class `MatchTransformTS`.
- Prefab: `FaceMesh.lspkg/FaceMesh__PLACE_IN_SCENE.prefab` (its `Camera` child is the scene camera; keep one camera).
- The `__PLACE_IN_SCENE` prefab is self-contained: besides the Camera → Effects / AmbientLight setup it includes the onboarding `Guide` and the `ExampleCarousel`, so dropping it into an empty Specs scene gives the full demo. Their demo-only scripts ship in `FaceMesh.lspkg/Example/` (`ExampleCarousel/`, `GuideDismissPanel/`), and the Camera's render target ships in `FaceMesh.lspkg/Render/`. Delete `Guide` and `ExampleCarousel` from your instance when you build your own Lens ([components](Docs/components.md#demo-scaffolding-example)).
- Declared companions: SnapDecorators, Utilities, SpectaclesInteractionKit, SpectaclesUIKit, Motion and Icons. See `package_dependencies.json`.

### Version and API status

Read [API status](Docs/api-status.md) for the current prefab contents, follower behavior and what was verified in the Preview.

### Applicability

Use the native prefab for its authored face geometry and HeadBinding; use MatchTransformTS for a separately assigned tracking target. Face detection and landmark acquisition come from native tracking, not the follower script. Use BodyMesh for its separate native body-tracking example.

### Related CLAD skills

[scene-construction](https://github.com/lens-studio-devs/ls-extensions/blob/main/plugins/ls-clad/skills/scene-construction/SKILL.md), [lens-api](https://github.com/lens-studio-devs/ls-extensions/blob/main/plugins/ls-clad/skills/lens-api/SKILL.md). These skills cover the surrounding Lens workflow.

[Install CLAD](https://developers.specs.com/docs/clad/setup/setup-ai/) or browse its [source](https://github.com/lens-studio-devs/ls-extensions). Read the installed package docs for this revision’s APIs.

### Package Docs (ship in Docs/)

- [Cheat sheet](Docs/cheat-sheet.md): read first for camera, lighting, target and coordinate rules.
- [Components](Docs/components.md): read when wiring follower inputs or adapting the prefab.
- [API status](Docs/api-status.md): read before relying on default camera or hierarchy behavior.
- [Examples](Docs/examples.md): read for a minimal follower consumer.
- [Troubleshooting](Docs/troubleshooting.md): read when geometry or following looks wrong.
- [Guide](Docs/guide.md): read for retained offset/constraint tutorials.

### Verification

1. Compile clean against the branch dependencies (no `as any`), with exactly one camera carrying DeviceTracking (World).
2. Preview with Multimedia input and a face video (e.g. `Idle/Facial Expressions`): the white soft-edged mask covers the face and follows it; the log shows no "missing a 'Device Tracking Component'" error.
3. Remove or disable the light and confirm the mesh goes black, so you know the scene lighting is load-bearing.
4. For MatchTransformTS: assign a non-null target, move/rotate it, observe the follower at two timestamps, then lock one axis and confirm it stays fixed.
5. Test nonidentity parent scale before relying on scale matching.

## Built with 👽 by the SPECS team <!-- --> <!-- --> <!-- --> <!-- -->

---

[See more packages](https://github.com/specs-devs/packages)

<p align="center">
  <img src="Docs/media/CropCameraTexture.png" width="250px" alt="CropCameraTexture"/>
</p>

# Crop Camera Texture

CameraTexture requests a Default_Color camera feed, applies normalized crop boundaries to an authored RectCropTextureProvider and displays the result on an Image. It exposes cropped and original textures for consumers. The longer guide contains native camera/crop recipes.

## Features

- Runtime cropLeft/cropRight/cropBottom/cropTop boundaries.
- Cropped and original texture getters.
- Image output refreshed from the camera's frame callback.
- Fixed requested resolution of 352 in Preview and 756 on device.

## Usage

This section ships with the package and describes the exact installed revision. Generic Lens scripting, scene construction and Specs spatial design live in the CLAD skills; this package owns its API and wiring.

### Package identity

- Descriptor: `package.native`.
- Consumer import: `CropCameraTexture.lspkg/Scripts/CameraTexture`.
- Prefab: `CropCameraTexture.lspkg/CropCameraTexture__PLACE_IN_SCENE.prefab`. It's self-contained: it holds the guide panel ("Ok, I understood"), the example carousel and the `CropCameraTextureDemo` group, so dropping it into a Specs scene with Camera, lighting and SIK gives the full demo.
- Demo scaffolding: `CropCameraTexture.lspkg/Example/` holds `ExampleCarousel` and `GuideDismissPanel`. The prefab uses them to present the demo; CameraTexture doesn't depend on them.
- Declared companions: SnapDecorators, Utilities, SpectaclesInteractionKit, SpectaclesUIKit, Motion and Icons. See `package_dependencies.json`. `Scripts/CameraTexture.ts` imports SnapDecorators and Utilities; the `Example/` scaffolding imports SpectaclesInteractionKit and SpectaclesUIKit.

### Version and API status

Read [API status](Docs/api-status.md) for lifecycle, supported behavior and verification gaps.

### Applicability

Use this package for a rectangular region of a camera feed. Use CompositeCameraTexture for its authored render-texture composition example. Zoom/pan/aspect recipes in the guide are consumer patterns, not additional components or automatic crop policies.

### Related CLAD skills

[specs-camera](https://github.com/lens-studio-devs/ls-extensions/blob/main/plugins/ls-clad/skills/specs-camera/SKILL.md). These skills cover the surrounding Lens workflow.

[Install CLAD](https://developers.specs.com/docs/clad/setup/setup-ai/) or browse its [source](https://github.com/lens-studio-devs/ls-extensions). Read the installed package docs for this revision’s APIs.

### Package Docs (ship in Docs/)

- [Cheat sheet](Docs/cheat-sheet.md): read first for required assets and crop coordinates.
- [Components](Docs/components.md): read when wiring inputs or calling getters.
- [API status](Docs/api-status.md): read before relying on availability and timing.
- [Examples](Docs/examples.md): read for a minimal consumer.
- [Troubleshooting](Docs/troubleshooting.md): read when the crop or output is blank.
- [Guide](Docs/guide.md): read for retained crop-animation tutorials.

### Verification

1. Compile clean with the branch dependencies, without adding `as any`. Check that the CameraModule, Screen Crop Texture and Image inputs are bound.
2. In Preview (SPECS 27, Interactive), place the instance about 100–120 cm in front of the user: `CaptureCropped` shows the cropped feed with no "Camera setup failed" log.
3. Turn the Preview camera: the cropped region updates every frame.
4. Change cropLeft/Right/Bottom/Top and confirm that the region changes. Editing the asset's own crop has no effect, by design.
5. On Specs, check the real camera output and the crop orientation.

## Built with 👽 by the SPECS team <!-- --> <!-- --> <!-- --> <!-- -->

---

[See more packages](https://github.com/specs-devs/packages)

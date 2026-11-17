<p align="center">
  <img src="Docs/media/CompositeCameraTexture.png" width="250px" alt="CompositeCameraTexture"/>
</p>

# Composite View

A camera-feed and render-texture example for SPECS. CameraService requests one camera feed and connects it to a CropTextureProvider; the prefab draws that feed and the Lens's rendered output into one composite texture and shows it on a panel 100 cm in front of the user. The longer guide includes native camera recipes that are not additional package components.

## Features

- Editor/device camera selection in CameraService.
- Camera texture routed into the authored crop texture.
- Screen-space images and an orthographic render-to-texture camera in the prefab.

## Usage

This section ships with the package and describes the exact installed revision. Generic Lens scripting, scene construction and SPECS spatial design are out of scope here; this package owns its wiring and limitations.

### Package identity

- Descriptor: `package.native` (holds the package version).
- Consumer import: `CompositeCameraTexture.lspkg/Scripts/CameraService`.
- Drop-in prefab: `CompositeCameraTexture.lspkg/CompositeCameraTexture__PLACE_IN_SCENE.prefab`.
- The `__PLACE_IN_SCENE` prefab is self-contained: besides the composite pipeline (`CompositeDemo`) it includes the onboarding `Guide` and the `ExampleCarousel`, so dropping it into an empty Specs scene gives the full demo. Their demo-only scripts ship in `CompositeCameraTexture.lspkg/Example/` (`ExampleCarousel/`, `GuideDismissPanel/`). Delete `Guide` and `ExampleCarousel` from your instance when you build your own Lens ([components](Docs/components.md#demo-scaffolding-example)).
- Declared companions: Utilities, SnapDecorators, InteractionKit, UIKit, Motion and Icons. See `package_dependencies.json`.

### Version and API status

Read [API status](Docs/api-status.md) for the source contract and verification gaps.

### Applicability

Use this example to connect a device camera to an authored crop/composite texture pipeline. Use CropCameraTexture for its separate crop example. Dual cameras, recording and adaptive resolution in the guide are native API recipes, not services implemented by this package.

### Package Docs (ship in Docs/)

- [Cheat sheet](Docs/cheat-sheet.md): read first for required inputs and camera selection.
- [Components](Docs/components.md): read when wiring CameraService or adapting the prefab.
- [API status](Docs/api-status.md): read before relying on a listed feature.
- [Examples](Docs/examples.md): read for minimal component usage.
- [Troubleshooting](Docs/troubleshooting.md): read when the feed or composite is blank.
- [Guide](Docs/guide.md): read for the retained native-camera tutorials.

### Verification

1. Compile with the branch dependencies; CameraService's three required object inputs resolve (no `Input … was not provided`).
2. In Preview (SPECS 27, Interactive), the CompositeImage panel shows the simulated room plus the Lens's own virtual content, which repeats inside itself (the "infinite mirror"). That proves both halves reach the composite.
3. After dropping the prefab into another project, check that `editorCamera` is the Camera that renders the Lens; CameraService assigns its render target to `Materials/ImageVC.mat` at start (see [Troubleshooting](Docs/troubleshooting.md)).
4. On SPECS, confirm the Right_Color feed is used and the background updates every frame.

## Built with 👽 by the SPECS team <!-- --> <!-- --> <!-- --> <!-- -->

---

[See more packages](https://github.com/specs-devs/packages)

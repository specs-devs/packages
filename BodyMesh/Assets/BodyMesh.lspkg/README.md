<p align="center">
  <img src="Docs/media/BodyMesh.png" width="250px" alt="BodyMesh"/>
</p>

# Body Mesh

A body tracking package for Specs that provides a native 3D body tracking configuration, full-body mesh, material, shader, and a camera-inclusive setup prefab. Use the mesh as a reference for pose-driven effects and the configured attachment labels for accessories.

## Quick Start

1. Install BodyMesh and resolve its declared companion packages.
2. Drag `BodyMesh__PLACE_IN_SCENE.prefab` into the scene.
3. Keep the included Camera, or unpack the instance and move its `Effects` hierarchy under your existing compatible camera. Avoid duplicate rendering cameras.
4. Keep `3D Body Tracking` → `Body Mesh` together and their tracking/body indices aligned.
5. Test with a fully visible person in camera input. A visible video background alone does not prove that tracking or mesh rendering works.

See [setup and examples](Docs/examples.md) for exact asset paths and the hierarchy.

## Usage

This section ships with the package and describes the exact installed revision. Version-specific BodyMesh setup lives here; generic Lens scripting, scene construction, and Specs spatial design are out of scope here.

### Package identity

- Descriptor: `BodyMesh.lspkg/package.native`.
- Consumer asset prefix: `BodyMesh.lspkg/`. The package's main surface is native assets and components, with no TypeScript body-tracking manager to import.
- The `__PLACE_IN_SCENE` prefab is self-contained: besides the Camera → Effects → 3D Body Tracking setup it includes the onboarding `Guide` and the `ExampleCarousel`, so dropping it into an empty Specs scene gives the full demo. Their demo-only scripts ship in `BodyMesh.lspkg/Example/` (`ExampleCarousel/`, `GuideDismissPanel/`), and the Camera's render target ships in `BodyMesh.lspkg/Render/`. Delete `Guide` and `ExampleCarousel` from your instance when you build your own Lens ([components](Docs/components.md#demo-scaffolding-example)).
- Declared companion packages in `package_dependencies.json`: **InteractionKit**, **UIKit**, **Motion**, **Icons**. The demo scripts in `Example/` import InteractionKit and UIKit; the native body setup needs none of them.

### Version and API status

Read [API status](Docs/api-status.md) before relying on the native setup. This descriptor contains no formal minimum Lens Studio version or hardware compatibility matrix.

### Applicability

Use BodyMesh for camera-observed human pose and body mesh effects. Its asset index is zero and its native tracker has 22 configured attachment labels. Hand interaction belongs to the companion interaction package; this body configuration has `TrackHand: false`.

### Package Docs (ship in Docs/)

- [Cheat sheet](Docs/cheat-sheet.md) — read first for camera ownership, index pairing, and required hierarchy.
- [API status](Docs/api-status.md) — read when checking the installed revision's supported surface and gaps.
- [Components](Docs/components.md) — read when wiring native tracking, mesh, material, or attachment points.
- [Examples](Docs/examples.md) — read when placing the prefab or observing tracking from a script.
- [Troubleshooting](Docs/troubleshooting.md) — read when the body effect is absent, the Preview never tracks, or a camera conflicts.

### Verification

- Compile cleanly with all declared dependencies resolved and native mesh/material/shader references present.
- Confirm exactly the intended rendering camera remains active; retain the tracker and mesh beneath its `Effects` hierarchy.
- Use actual full-body input on the target device and verify `isTracking()` on the native component; the background image is insufficient evidence, and the Lens Studio Preview may not acquire a body at all ([details](Docs/troubleshooting.md#preview-never-tracks-a-body)).
- Observe the same tracked mesh at two distinct poses, checking head, hands, and legs for movement.
- If using attachments, exercise a configured label such as `Head` and check both acquisition and loss of tracking.

## Notes

Tracking quality depends on camera input, visibility, and the target device. The descriptor does not establish a supported-device or minimum-editor-version guarantee. Test on the intended Specs hardware before relying on this setup.

## Built with 👽 by the SPECS team

# Body Mesh 

A body tracking package for Specs that provides 3D body mesh visualization and tracking. This package includes a full setup prefab with 3D Body Tracking, mesh visualization, materials, and shaders—ready to drop into your scene and use with your camera.

## Features

- **3D Body Tracking**: Leverages Lens Studio 3D Body Tracking for full-body pose estimation
- **Full Setup Prefab**: Preconfigured prefab with mesh, materials, and tracking—unpack and place in your scene
- **Camera-Ready**: Designed to work with your scene camera; use the included prefab as a starting point
- **Mesh & Materials**: Includes mesh assets and shaders for body visualization
- **Dependencies Included**: Uses Utilities and SnapDecorators packages (resolved via package dependencies)

## Quick Start

1. **Add the package** to your Lens Studio project (Asset Library or local package).
2. **Place the prefab**: Drag `BodyMeshFullSetup_UnpackUseYourCamera__PLACE_IN_SCENE` into your Scene Hierarchy.
3. **Unpack** the prefab instance so you can wire it to your camera or adjust the setup.
4. **Assign your camera** to the 3D Body Tracking component or scene setup as needed.
5. **Preview** in the simulator or on device to see body tracking and mesh.

## Package Contents

| Asset | Description |
|-------|-------------|
| `3D Body Tracking.bodyTracking3D` | Body tracking configuration asset |
| `BodyMeshFullSetup_UnpackUseYourCamera__PLACE_IN_SCENE.prefab` | Full setup prefab (mesh, materials, tracking) |
| `Materials/` | Materials used for body mesh rendering |
| `Mesh/` | Mesh assets for body visualization |
| `Shaders/` | Shaders for the body mesh |

## Dependencies

This package depends on:

- **Utilities** – shared utilities
- **SnapDecorators** – decorators used in the package

These are declared in `package_dependencies.json` and are resolved when the package is installed.

## Requirements

- Lens Studio 5.15+
- Specs device or simulator with body tracking support
- A camera in the scene to drive the body tracking

## Notes

- Unpack the prefab after placing it in the scene so you can connect your camera and customize the setup.
- Body tracking availability and quality may vary by device and environment. <!-- --> <!-- --> <!-- --> <!-- -->







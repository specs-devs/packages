# FaceMeshExamples API status

[← Agent usage index](../README.md)

## Current surface

- `FaceMeshExamplesMain`: `cycle(delta)`, `recenterStage()`, plus the inputs listed in [components](components.md#facemeshexamplesmain).
- `FaceMeshExamplesHeadController`: `setActive(index)`, `getActiveIndex()`, `getSlotCount()`, `getSlot(index)`, `isFaceBound()`.
- `FaceMeshExamplesDebugFaceMesh`: `isDebugVisible()`, `setDebugVisible(visible)`.
- `FaceMeshExamplesSceneContracts`: `CHARACTERS`, `SCENE_NAMES`, `FACE_INDEX`, `wrapIndex`.

This is the first release; there is nothing to migrate.

## Platform notes

- Uses Lens face tracking (Head binding + Face Mesh expression weights) on the Specs world camera. It tracks people in front of the wearer, not the wearer.
- No internet, no camera-frame access, no Snap Cloud, no experimental APIs.
- The heads are static GLB meshes with expression shape keys. The package does not load or generate 3D content at runtime.
- Verified in the Lens Studio preview. Face tracking quality, distance range and expression fidelity still need checking on a SPECS device.

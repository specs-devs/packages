# BodyMesh API status

[← Agent usage index](../README.md)

## Use when

Check what belongs to the installed revision before selecting an asset or interpreting an older setup instruction.

## Revision evidence

`package.native` carries the package version and retains its README reference. `package_dependencies.json` declares SpectaclesInteractionKit, SpectaclesUIKit, Motion, and Icons. No Utilities or SnapDecorators dependency is declared here.

Body tracking is provided through native assets/components serialized in the prefab, not a custom package TypeScript manager. Native methods used in the [examples](examples.md) are Lens runtime APIs, verified against the declarations generated for the open project; they are not new BodyMesh exports.

## Current

| Surface | Evidence / behavior |
|---|---|
| Full setup prefab | `BodyMesh__PLACE_IN_SCENE.prefab` contains Camera, World DeviceTracking, Effects, ObjectTracking3D, and RenderMeshVisual, plus the demo `Guide` and `ExampleCarousel`. |
| Demo scaffolding | `Example/ExampleCarousel/ExampleCarousel.ts` and `Example/GuideDismissPanel/GuideDismissPanel.ts` drive the prefab's guide and carousel. They are demo-only, not package API ([components](components.md#demo-scaffolding-example)). |
| Tracking configuration | `3D Body Tracking.bodyTracking3D` defines 22 attachment labels and `TrackHand: false`. |
| Mesh | `Mesh/Full Body Mesh.bodyMesh` uses body index 0; body, head, left-hand, and right-hand geometry are enabled. |
| Rendering | `Materials/Body Mesh.mat` references `Shaders/body_mesh.graphShader`. See exact serialized defaults in [components](components.md). |

## Deprecated

No explicit deprecated annotations or declared replacements were found in package source.

## Experimental

No experimental API annotations or opt-in surface were found in package source. Hardware support and tracking quality still require validation on the target device.

## Removed

| Surface | Current state |
|---|---|
| Old `GUIDE_ReadAndDisable` / guide Text in setup | Removed from the exported prefab hierarchy. A stale scene instance placed from an older revision may still contain it; re-place the prefab. |
| `Scripts/GuideDismissPanel/GuideDismissPanel.ts` (legacy guide helper) | Replaced. The current guide helper ships as demo scaffolding in `Example/GuideDismissPanel/`. |

## Gaps

The descriptor declares no minimum editor version, tested-device list, multi-person demonstration, or custom body-tracking events. No claim of on-device compatibility follows from this document. `TrackingScope` is null in both native tracking and mesh assets; do not interpret that as a tested special scope.

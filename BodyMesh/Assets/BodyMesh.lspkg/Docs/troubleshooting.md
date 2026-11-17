# BodyMesh troubleshooting

[← Agent usage index](../README.md)

## Use when

The camera feed appears without the intended body effect, the Preview never tracks a body, the setup conflicts with another camera, or an old guide remains visible.

## Person visible but no body effect

**Possible causes:** the native tracker has not acquired the person, its root is disabled, tracker/body indices differ, mesh/material references are unresolved, or the material's source visibility properties suppress the intended visual result.

**Check:** verify native `isTracking()` with actual body input (see the observer in [examples](examples.md#read-native-tracking-state)); confirm `3D Body Tracking` is enabled after any onboarding UI is dismissed; retain the `Body Mesh` child; verify both selected indices are 0. Confirm the mesh, material, and graph shader references resolve. The shipped material has `Port_Opacity_N023: 0` and `PreviewEnabled: 0` with blend mode Disabled; inspect these separately from tracking, using a project material copy for visual experiments. Do not treat a camera video of a person as mesh deformation proof.

## Preview never tracks a body

**Symptom:** the Preview shows a full-body video (for example the built-in `Video/Object Tracking/Body.mp4` in Multimedia mode), but no mesh appears and `ObjectTracking3D.isTracking()` stays `false`.

**Observed (Lens Studio Preview, Public build):** `isTracking()` stayed `false` for more than 8 seconds of Body.mp4 in SPECS 27 stereo simulation. It also stayed `false` with mobile simulation and back camera, with the camera's World DeviceTracking disabled, and for a freshly created built-in `BodyMeshObjectPreset`. The editor itself is not running body tracking here, so the package setup is not the cause.

**Do:** verify acquisition and mesh deformation on the target device. Use the Preview only for compile, hierarchy, and UI checks. Do not "fix" this by changing indices, materials, or camera setup.

**Note:** an interactive room preview has no camera-observed person and can never establish body tracking.

## Duplicate camera or incorrect placement

The full setup prefab includes a perspective Camera with World DeviceTracking, authored at `(0, 0, 40)` cm. If your project already owns its camera, unpack and move the entire `Effects` hierarchy under the intended compatible camera, then remove the unused included Camera. Do not re-anchor or push the tracker with a layout/carousel script (`anchorExamples`-style repositioning). Its pose belongs to native tracking.

## Onboarding UI hides the camera

A guide that disables "content until dismissed" must not disable the prefab's Camera, or nothing renders. Hide the `3D Body Tracking` object (and your own panels) instead, and leave `BodyMesh__PLACE_IN_SCENE/Camera` enabled.

## Old guide text still visible

Older revisions shipped a `GUIDE_ReadAndDisable` child. It is removed (see [API status](api-status.md#removed)). If a scene instance placed from an older revision still shows that text, delete the instance and place the prefab again. The current prefab's `Guide` ("Ok, I understood") is intended demo scaffolding; delete it from your instance if you don't want it.

## Dependency names disagree with older notes

Read `package_dependencies.json`: SpectaclesInteractionKit, SpectaclesUIKit, Motion, and Icons are declared in this source revision. The previous README's Utilities/SnapDecorators list did not match that file.

## Preview warns about depth format

`Depth format Depth24UnormStencil8 is not renderable; using Depth32FloatStencil8.` is a macOS renderer fallback in the editor. It is unrelated to body tracking or TypeScript compilation.

# Composite Camera (SnapCloudExamples)

## What is this about?

The shared camera rig used by the SnapCloudExamples media examples (image, video and composite capture and streaming). It is part of the SnapCloudExamples package: you get it by installing SnapCloudExamples.

## How to use

1. The main `SnapCloudExamples__PLACE_IN_SCENE.prefab` already contains this rig as `[CompositeImage]`. Use that, and keep its `VirtRender/Object 0/ImageBackground-CS` object (the CameraService host) enabled on layer 2.
2. To use the rig on its own, add `CompositeCameraWork/SnapCloudExamples_CompositeImage__PLACE_IN_SCENE.prefab` (it sits in this folder; there is no Prefabs folder).
3. Share this one `CameraService` between capture scripts (wire it where a media component asks for it) and wait for it to start before capturing; see `../Docs/media.md`.

## Contents

- `Scripts/CameraService.ts`: on Start requests the camera through the Camera Module (Default_Color in the editor, Right_Color on device), feeds it into the Screen Crop Texture and exposes `cameraTexture` and `cameraTextureProvider`. Inputs and behavior: [`../Docs/media.md`](../Docs/media.md#cameraservice).
- `SnapCloudExamples_CompositeImage__PLACE_IN_SCENE.prefab`: the camera rig (CameraService, virtual render camera, composite image).
- `Render/`: `CompositeImage` and `Render Target` render targets, `Screen Crop Texture`, `Device Camera Texture`.
- `Modules/Camera Module.cameraModule`, `Materials/ImageB|ImageCI|ImageVC.mat`, `Shaders/flat.graphShader`.
- `SetUpCopositeCamera-Screenshots/`: setup screenshots (00 to 04).

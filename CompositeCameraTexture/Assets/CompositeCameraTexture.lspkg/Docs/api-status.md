# CompositeCameraTexture api-status

[← Agent usage index](../README.md)

## Use when

Check what the installed revision actually implements.

| Status | API or behavior | Source evidence / limit |
| --- | --- | --- |
| Current | CameraService component | `Scripts/CameraService.ts`; one camera request routed into `Render/Screen Crop Texture` |
| Current | Prefab composite pipeline | `CompositeCameraTexture__PLACE_IN_SCENE.prefab`: `VirtRender` orthographic camera → `Render/CompositeImage.renderTarget` → `Materials/ImageCI.mat` on the CompositeImage panel |
| Current | Lens content assignment | `lensContentMaterial` + optional `lensRenderTarget` inputs; falls back to `editorCamera.renderTarget`, so a fresh install composites the Lens content without editing `ImageVC.mat` |
| Current | Logging flags | `enableLogging`, `enableLoggingLifecycle`; both false on the prefab instance; Utilities Logger |
| Deprecated | None | No migration aliases |
| Experimental | Multi-camera, recording and adaptive-resolution recipes in [Guide](guide.md) | Tutorial patterns only; not package services, not QA-verified |
| Removed | `Scripts/GuideDismissPanel` location and the prefab's `Guide_ReadAndDisable` note | The note is gone from the prefab. The guide script now ships inside the package as demo scaffolding at `Example/GuideDismissPanel/GuideDismissPanel.ts`, used by the prefab's `Guide` object (see [Components](components.md#demo-scaffolding-example)) |

Verified in the Lens Studio Preview (2026-10-02): compile clean, composite panel shows camera background plus virtual content (infinite-mirror recursion) with `ImageVC.mat` defaulting to the package render target, so the Lens content comes from the runtime assignment; no runtime errors. Not verified: Right_Color on device. `imageSmallerDimension` is commented out in CameraService, so the feed uses the native default resolution. `Render/Render Target.renderTarget` is the authored default of `ImageVC.mat` (its clear texture is `Render/Device Camera Texture`); CameraService replaces it at start.

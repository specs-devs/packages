# CropCameraTexture api-status

[← Agent usage index](../README.md)

## Use when

Check the installed source contract and what remains unverified.

| Status | API / behavior | Evidence / limit |
| --- | --- | --- |
| Current | CameraTexture | `Scripts/CameraTexture.ts`; Start initializes camera, crop and Image |
| Current | getCameraTexture(): Texture | Assigns the camera feed and the configured crop to screenTexture's provider; falls back to the original texture when there's no provider or on an exception |
| Current | getOriginalCameraTexture(): Texture | Returns the original live cameraTexture; undefined before setup succeeds |
| Current | Resolution selection | 352 in Preview / 756 on device, chosen once during setup |
| Fixed (this revision) | Empty crop input | The camera feed used to be assigned only when the crop texture already had an input, so a fresh Screen Crop Texture stayed blank. It's now assigned whenever the provider exposes `inputTexture` |
| Deprecated | None declared | No renamed getter aliases |
| Experimental | Zoom/pan/multi-window/focus recipes | Consumer examples in the guide, not package features |
| Removed | Prefab instruction Text | The blue "Modify the offset in the Screen Crop Texture…" note under `CropCameraTexture__PLACE_IN_SCENE` was removed. It was editor-only and wrong, because CameraTexture's inputs overwrite the asset's crop |

No public ready/error/frame event is exported. initialize() catches and logs setup failures; it doesn't reject a promise. Camera ID is Default_Color on both platforms. There's no clamping, aspect locking, automatic resolution feedback or provider type validation. The package source reaches the provider through `any` casts.

The cropRect field belongs to native RectCropTextureProvider, a subclass of CropTextureProvider. The tutorial annotations in the guide use this type.

Verified in the Lens Studio Preview (SPECS 27, Interactive): the cropped feed renders on the Image and updates as the view turns, with the supplied input and with an empty crop input. On-device camera output and orientation are not yet verified.

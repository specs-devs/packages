# CompositeCameraTexture cheat-sheet

[← Agent usage index](../README.md)

## Use when

Read first before placing or scripting the camera pipeline.

1. Keep the prefab's texture graph intact; CameraService only feeds the crop texture, the prefab does the compositing. → [Components](components.md)
2. At start CameraService sets `Materials/ImageVC.mat` → `baseTex` (input `lensContentMaterial`) to `lensRenderTarget`, or to `editorCamera`'s render target when that is empty. Point `editorCamera` at the Camera that renders your Lens; no material edit is needed. → [Troubleshooting](troubleshooting.md)
3. Wire `camModule` and a `screenCropTexture` whose control is CropTextureProvider. → [Examples](examples.md)
4. The service picks Default_Color in Preview and Right_Color on device; there is no camera-ID input. → [API status](api-status.md)
5. `editorCamera` is only read for its render target (the Lens content); it doesn't change which device camera is requested. → [Components](components.md)
6. Start is bound by SnapDecorators `@bindStartEvent` and runs when the object is first enabled. Don't call `start()` again: each call requests another camera texture. → [Troubleshooting](troubleshooting.md)
7. The `onNewFrame` callback in CameraService is empty; add frame processing in your own script. → [Guide](guide.md)

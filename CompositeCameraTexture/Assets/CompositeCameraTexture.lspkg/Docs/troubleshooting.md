# CompositeCameraTexture troubleshooting

[← Agent usage index](../README.md)

## Use when

Diagnose a blank feed, incorrect crop or unsupported feature assumption.

| Symptom | Cause to check | Fix |
| --- | --- | --- |
| Composite shows the camera but no virtual content | CameraService could not set `Materials/ImageVC.mat` → `baseTex`: `lensContentMaterial` is empty, or neither `lensRenderTarget` nor `editorCamera` gives a render target (a warning is logged) | Wire `lensContentMaterial` to `Materials/ImageVC` and `editorCamera` to the Camera that renders your Lens, or set `lensRenderTarget` directly |
| Panel repeats inside itself | Expected: the panel is part of the virtual content it composites | None. Hide the CompositeImage panel in your Lens if you only need the texture |
| requestCamera throws | `camModule` not wired, or the camera is unavailable | Wire `Modules/Camera Module`; check the platform camera logs |
| Composite background stays black | `screenCropTexture` missing or its control isn't CropTextureProvider | Wire `Render/Screen Crop Texture` |
| Virtual overlay missing or misplaced | Render target / image / material graph changed | Restore the prefab bindings (see [Components](components.md)) before changing code |
| Camera never starts | The CameraService object (or a parent) was disabled from the start | Start runs on first enable; enable the prefab instance when the feed is needed |
| Virtual half shows the wrong content | `editorCamera` is not the camera that renders your Lens | Point `editorCamera` at that camera, or set `lensRenderTarget` |
| Repeated requests | `start()` called more than once | Let `@bindStartEvent` run it once |
| Recording stores the same frame | The camera texture is live and reused | Copy pixel data per frame; pushing the same Texture into an array is not a recording |
| Old prefab instance shows a "GUIDE_ReadAndDisable" note or a missing-script warning | Stale instance from an older revision of the prefab | Delete that child from the instance (the prefab and its import cache no longer have it) |

Preview check (2026-10-02, Lens Studio Preview, SPECS 27 Interactive): the Default_Color feed is the simulated room, so the composite shows the room plus the Lens content. Device-only: Right_Color selection, frame rate, and alignment of the virtual layer with the real camera image.

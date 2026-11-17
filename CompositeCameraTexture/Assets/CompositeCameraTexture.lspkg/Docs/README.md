# Composite View

## What it is
A camera-feed and render-texture package for Specs. It shows how to combine the device camera feed and the
Lens's own rendered content into a single composite texture, displayed on a panel in front of the user. It is
for developers who need a starting point for camera-plus-content pipelines (previews, capture-style views).

## What it does
1. Drop `CompositeCameraTexture__PLACE_IN_SCENE` into the scene. Its `CompositeDemo` group holds the pipeline.
2. At start, `CameraService` requests one camera feed (`Default_Color` in the Lens Studio Preview,
   `Right_Color` on Specs) and assigns it to the `inputTexture` of a `CropTextureProvider`
   (`Render/Screen Crop Texture`).
3. It also sets `Materials/ImageVC.mat` → `baseTex` to `lensRenderTarget`, or to `editorCamera`'s render
   target when that is empty, so the Lens content is part of the composite.
4. An orthographic `VirtRender` camera draws two screen-space images (camera background, virtual content on
   top) into `Render/CompositeImage.renderTarget`.
5. The `CompositeImage` panel, 100 cm in front of the user, shows that texture. Because the panel is itself
   rendered by the main camera, it repeats inside itself (an expected "infinite mirror").

## Highlights
- Single small script: `CameraService` only feeds the crop texture and Lens-content material; the prefab's
  texture graph does the compositing.
- Automatic editor/device camera selection, no camera-ID input.
- Optional `lensRenderTarget` override for the content texture.
- Empty `onNewFrame` callback ready for your own per-frame processing.
- Start is bound with SnapDecorators `@bindStartEvent`; calling `start()` again would request another camera
  texture.

## Core scripts
| Script | What it does |
|---|---|
| `Scripts/CameraService.ts` | Requests the camera feed, routes it into the crop texture and assigns the Lens content to `ImageVC.mat`. |
| `Example/GuideDismissPanel/GuideDismissPanel.ts` | Demo-only onboarding panel that hides the demo until dismissed. |
| `Example/ExampleCarousel/ExampleCarousel.ts` | Demo-only carousel panel around the composite example. |

## Extra info
- **Requires:** Utilities, SnapDecorators, InteractionKit, UIKit, Motion, Icons. Works in the Lens Studio
  Preview (simulated room) and on Specs. Point `editorCamera` at the Camera that renders your Lens.
- **Get started:** `CompositeCameraTexture__PLACE_IN_SCENE.prefab`; delete `Guide` and `ExampleCarousel` from
  your instance when building your own Lens.
- **More docs:**
  - [cheat-sheet.md](cheat-sheet.md) — required inputs and camera selection; read first
  - [components.md](components.md) — `CameraService` inputs and the composite prefab graph
  - [api-status.md](api-status.md) — source contract and verification gaps
  - [examples.md](examples.md) — minimal component usage
  - [troubleshooting.md](troubleshooting.md) — blank feed or composite
  - [guide.md](guide.md) — native-camera recipes (dual camera, recording, adaptive resolution), not package
    components

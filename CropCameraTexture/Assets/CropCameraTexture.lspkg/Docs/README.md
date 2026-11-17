# Crop Camera Texture

## What it is
Crop Camera Texture is a package that shows a rectangular region of the Specs camera feed. Its `CameraTexture`
component requests the camera, applies normalized crop boundaries to a Screen Crop Texture and displays the result
on an Image, while exposing both the cropped and the original camera texture to other scripts. It is for Lens
developers who need a cropped camera view or a cropped texture to feed into their own processing.

## What it does
1. You drop `CropCameraTexture__PLACE_IN_SCENE.prefab` into the scene. The root carries `CameraTexture`, already
   bound to the package's Image, `Render/Screen Crop Texture` and `Modules/Camera Module`.
2. On Start (via SnapDecorators' `@bindStartEvent`) it requests a `Default_Color` camera feed, at a fixed resolution
   of 352 in the Preview and 756 on device, and sets the crop texture's input to that feed.
3. On every new camera frame it reapplies `cropLeft` / `cropRight` / `cropBottom` / `cropTop` and refreshes the Image,
   so the cropped region follows the live camera.
4. Other scripts call `getCameraTexture()` for the cropped texture or `getOriginalCameraTexture()` for the live,
   uncropped feed.
5. The prefab also holds a guide panel ("Ok, I understood") and an example carousel that present the
   `CropCameraTextureDemo` group.

## Highlights
- Runtime crop boundaries in normalized coordinates (-1 to 1); full frame is -1, 1, -1, 1.
- Script defaults crop the center (±0.2); the prefab instance overrides them to ±0.8.
- The component's crop inputs overwrite the asset's own serialized crop on every frame.
- `getCameraTexture()` falls back to the uncropped camera texture when the crop control is missing or an error occurs.
- Optional `enableLogging` / `enableLoggingLifecycle` output through the Utilities `Logger`.

## Core scripts
| Script | What it does |
|---|---|
| `Scripts/CameraTexture.ts` | Requests the camera feed, applies the crop rectangle and updates the Image every frame; exposes cropped and original textures. |
| `Example/GuideDismissPanel/GuideDismissPanel.ts` | Demo scaffolding: guide panel that hides the demo until "Ok, I understood" is pressed. |
| `Example/ExampleCarousel/ExampleCarousel.ts` | Demo scaffolding: carousel panel that presents the demo group. |

## Extra info
- **Requires:** SnapDecorators and Utilities (imported by `CameraTexture.ts`); InteractionKit, UIKit, Motion and
  Icons (used by the `Example/` scaffolding). Works in the Lens Studio Preview with the simulated camera; check the
  real camera output and crop orientation on Specs. Keep left < right and bottom < top: nothing clamps or reorders
  the values. Getters return `undefined` until camera setup has succeeded.
- **Get started:** add `CropCameraTexture__PLACE_IN_SCENE.prefab` to a scene with a Camera, lighting and Interaction
  Kit (SIK), place it in front of the user, or import `CropCameraTexture.lspkg/Scripts/CameraTexture` and wire
  `camModule`, `screenTexture` and `uiImage` yourself.
- **More docs:**
  - [cheat-sheet.md](cheat-sheet.md) - required assets and crop coordinates, read first
  - [components.md](components.md) - inputs, public methods, prefab and asset wiring
  - [guide.md](guide.md) - camera and crop recipes (zoom, pan, aspect)
  - [examples.md](examples.md) - a minimal consumer
  - [api-status.md](api-status.md) - availability, timing and verification gaps
  - [troubleshooting.md](troubleshooting.md) - blank crop or output

# CompositeCameraTexture components

[← Agent usage index](../README.md)

## Use when

Wire the actual component inputs or preserve the prefab graph.

## CameraService

Import `CompositeCameraTexture.lspkg/Scripts/CameraService`.

| Input | Type / default | Meaning |
| --- | --- | --- |
| editorCamera | Camera / prefab: the scene's main Camera | The Lens camera; its `renderTarget` is the Lens content used when `lensRenderTarget` is empty |
| screenCropTexture | Texture / `Render/Screen Crop Texture` | Must expose CropTextureProvider; its `inputTexture` is set to the camera feed |
| camModule | CameraModule (private input) / `Modules/Camera Module` | Used for `requestCamera` |
| lensContentMaterial | Material, optional / prefab: `Materials/ImageVC` | Its `mainPass.baseTex` is set to the Lens content at start; empty = no assignment |
| lensRenderTarget | Texture, optional / empty | Overrides the Lens content texture; empty = `editorCamera.renderTarget` |
| enableLogging | boolean / false | Logs the requested texture |
| enableLoggingLifecycle | boolean / false | Logs onAwake / start |

Methods: `onAwake(): void` creates the Utilities Logger; `start(): void` is decorated with `@bindStartEvent`. Start requests `CameraModule.CameraId.Default_Color` in the editor or `Right_Color` on device, assigns the texture to the crop provider and adds an empty `onNewFrame` callback, then sets `lensContentMaterial.mainPass.baseTex` to `lensRenderTarget ?? editorCamera.renderTarget` (warns if neither is available). No output property, camera-switch method or event is exported.

## Composite prefab

`CompositeCameraTexture__PLACE_IN_SCENE.prefab` (root at the origin) holds, in order, `Guide`, `ExampleCarousel` ([demo scaffolding](#demo-scaffolding-example)) and `CompositeDemo`, the group with the composite pipeline below (local (0, 0, 0), so the authored positions are unchanged):

| Object | Components | Role |
| --- | --- | --- |
| VirtRender | Camera (orthographic, Size 84, Aspect 1, ClearColor None) → `Render/CompositeImage.renderTarget` | Renders the composite |
| └ Object 0 | ScreenRegion (SafeRender), ScreenTransform (anchors y −0.57…0.85) | Screen space of VirtRender; the band both images fill |
| &nbsp;&nbsp;├ ImageVirtContent | Image (renderOrder 2, `Materials/ImageVC.mat`), ScreenTransform (full) | Virtual content; `ImageVC.mat` ships pointing at the package's `Render/Render Target`; CameraService swaps in the Lens camera's render target at start |
| &nbsp;&nbsp;└ ImageBackground | Image (renderOrder 1, Stretch, `Materials/ImageB.mat`), ScreenTransform, CameraService | Camera feed via `Render/Screen Crop Texture` |
| CompositeImage | Image (Fit, `Materials/ImageCI.mat`), local (0, 0, −100), scale 40×40 | World panel that displays the composite |

All three materials use `Shaders/flat.graphShader`. Because the panel is itself rendered by the main camera, it appears inside the composite again: the recursive "infinite mirror" is expected and confirms the pipeline works.

## Demo scaffolding (Example/)

Demo-only scripts shipped in `CompositeCameraTexture.lspkg/Example/` so the prefab works on its own. They aren't part of the package API. Remove `Guide` and `ExampleCarousel` when you build your own Lens; `CompositeDemo` works without them.

| Script | Object | Key inputs (prefab values) |
| --- | --- | --- |
| `Example/GuideDismissPanel/GuideDismissPanel.ts` | `Guide` (UIKit Frame at local (0, 0, −100), `GuideText`, `OkButton`) | `buttonLabel` (`"Ok, I understood"`; only used in text-only mode, see below), `hideUntilDismissed: SceneObject[]` (`CompositeDemo`, `ExampleCarousel`): hidden while the guide shows, enabled when it's closed |
| `Example/ExampleCarousel/ExampleCarousel.ts` | `ExampleCarousel` (local (0, −22, −80)) | `examples: SceneObject[]` (`CompositeDemo`), `exampleInfo: string[]` (one entry), `steps: SceneObject[]` (empty), `stepInfo: string[]` (empty; text per step, in the same order as `steps`, empty entries fall back to the example's info), `startIndex` (`0`), `previousLabel` / `nextLabel`, `examplesPushBack` (`20` cm), `anchorExamples` (`false`, the panel stays where it is authored), `startMinimized` (`true`), `extraPanelDrop` (`20` cm) |

GuideDismissPanel has two modes. Authored (what the prefab uses): the `Guide` object carries a UIKit `Frame` with a child Text (`GuideText`) and a child UIKit Button (`OkButton`); the script places the panel in front of the user, fits the frame to the text and closes the guide when the button is pressed, so `buttonLabel` has no effect (edit the button's own label). Text-only: when the object has no `Frame`, the script builds the Frame, a copy of the child Text and a button labelled `buttonLabel` at runtime. In both modes `hideUntilDismissed` objects are disabled on awake and re-enabled when the guide closes.

With a single example the carousel only shows its title bar, the info text and the minimize button.

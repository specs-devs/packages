# CropCameraTexture components

[← Agent usage index](../README.md)

## Use when

Wire Inspector inputs and call the exact source methods.

## CameraTexture

Import `CropCameraTexture.lspkg/Scripts/CameraTexture`.

| Input | Type / default | Meaning |
| --- | --- | --- |
| uiImage | Image / authored reference | Optional display assignment is guarded; bind for visible output |
| screenTexture | Texture / authored reference | Required by setup; should expose RectCropTextureProvider |
| camModule | CameraModule / authored reference | Validated before requesting camera |
| cropLeft | number / -0.2 | Left normalized boundary |
| cropRight | number / 0.2 | Right normalized boundary |
| cropBottom | number / -0.2 | Bottom normalized boundary |
| cropTop | number / 0.2 | Top normalized boundary |
| enableLogging | boolean / false | General setup and texture logs |
| enableLoggingLifecycle | boolean / false | Initialization stage logs |

Public methods: `onAwake(): void`, `initialize(): void`, `getCameraTexture(): Texture`, `getOriginalCameraTexture(): Texture`.

onAwake creates a Utilities Logger. @bindStartEvent invokes initialize, which requests Default_Color at 352 or 756 smaller dimension, sets the crop provider's inputTexture to the camera feed (even when it was empty), binds CameraTextureProvider.onNewFrame to update uiImage and assigns initial Image output. Calling initialize repeatedly requests additional feeds and registers additional callbacks; leave initialization to lifecycle.

getCameraTexture reapplies crop fields on each call and returns screenTexture when both screenTexture and cameraTexture exist and no exception is thrown. Missing controls or exceptions fall back to cameraTexture. It does not guarantee the returned texture contains a valid crop. getOriginalCameraTexture returns the underlying live camera Texture, not a frozen frame.

## Prefab and assets

`CropCameraTexture__PLACE_IN_SCENE.prefab` (children in order: Guide, ExampleCarousel, CropCameraTextureDemo):

- Root `CropCameraTexture__PLACE_IN_SCENE` (local position 0, 0, −50) holds CameraTexture, with crop inputs ±0.8 and logging off. Its uiImage, screenTexture and camModule are bound to the package's own Image, `Render/Screen Crop Texture` and `Modules/Camera Module`.
- `Guide` (local 0, 0, −50) is the guide panel (GuideDismissPanel). `ExampleCarousel` (local 0, 0, +50) is the carousel, which starts minimized.
- `CropCameraTextureDemo` (local 0, −27, 0) is the demo group. Its child `CaptureCropped` (local z +1, scale 17, 17, 1) holds the Image (render order 10, `Materials/ContainerImageMaterial`). Its baseTex is replaced at runtime. `ContainerImageMaterial` uses `Shaders/SpritePreset.graphShader`.

`Render/Screen Crop Texture.screenCropTexture` ships with a Device Camera Texture input and a -0.5..0.5 serialized crop. CameraTexture assigns its own camera request and its crop inputs whenever the getter runs, on every camera frame. Keep the camera module and render assets when adapting the example.

## Demo scaffolding (`Example/`)

These scripts ship in `CropCameraTexture.lspkg/Example/` and are wired inside `CropCameraTexture__PLACE_IN_SCENE.prefab`. They only present the demo, and CameraTexture doesn't need them.

| Object / script | Class | Key inputs |
| --- | --- | --- |
| `Guide`: `Example/GuideDismissPanel/GuideDismissPanel.ts` | `GuideDismissPanel` | `hideUntilDismissed: SceneObject[]` lists the objects hidden until "Ok, I understood" is pressed (here: ExampleCarousel and CropCameraTextureDemo). Only the ones enabled at start are re-enabled. `buttonLabel: string = "Ok, I understood"` is only used when the panel is built at runtime |
| `ExampleCarousel`: `Example/ExampleCarousel/ExampleCarousel.ts` | `ExampleCarousel` | `examples: SceneObject[]` (here the single `CropCameraTextureDemo` group), `exampleInfo: string[]` (one line per example), `steps: SceneObject[]` (empty here), `stepInfo: string[]` (one line per `steps` entry; empty entries fall back to the example's info; empty here), `startIndex: number = 0`, `previousLabel` / `nextLabel`, `examplesPushBack: number = 20`, `anchorExamples: boolean = true`, `startMinimized: boolean = false` (on here), `extraPanelDrop: number = 0` (10 here) |

Both inputs point at the `CropCameraTextureDemo` group rather than the prefab root, because hiding the root would also hide the guide and the carousel. CameraTexture stays on the root and keeps running while the group is hidden.

# MarkerTrackingHelper components

[← Agent usage index](../README.md)

## Use when

You need the exact class name, import path, inputs or behavior of a marker
script, or the layout of a prefab. All facts come from `Scripts/*.ts` and the
prefabs in this revision.

## Modules

| Class (export) | Import path | Used by prefab |
|---|---|---|
| `SimpleImageTracking` | `MarkerTrackingHelper.lspkg/Scripts/SimpleImageTracking` | Simple |
| `ImageTrackingController` | `MarkerTrackingHelper.lspkg/Scripts/ImageTrackingController` | Resizable |
| `MarkerCallbacks` | `MarkerTrackingHelper.lspkg/Scripts/MarkerCallback` | Resizable |
| `ExtendMarkerTrackingController` | `MarkerTrackingHelper.lspkg/Scripts/ExtendedMarkerTracking` | Extended |
| `Utils` (static helpers) | `MarkerTrackingHelper.lspkg/Scripts/Utils` | all |

Shared rule: every controller **re-parents its own SceneObject under the root
camera** in `onAwake`, via `Utils.getRootCamera()` →
`ComponentUtils.getRootCamera()`. `ExtendMarkerTrackingController` does this
only when the camera's `DeviceTracking` is in World mode; otherwise it throws
(see below). That call throws `Camera not found in
scene…` if there is no root object with a Camera. Put the
`MarkerTrackingComponent` on a child of that object, and the content under the
`MarkerTrackingComponent`.

## `SimpleImageTracking`

It has no inputs. In `onAwake` it parents its object under the root camera.
The child `MarkerTrackingComponent` then places its children on the marker
while the marker is tracked.

## `ImageTrackingController`

| Input | Type | Default | Notes |
|---|---|---|---|
| `markerTrackingComponent` | `MarkerTrackingComponent` | — | Required |
| `resizeObjectArray` | `SceneObject[]` | — | Each gets local scale `(aspect × height, height, height)` at start. Author them at **unit size** (1 × 1 cm) |
| `editEventCallbacks` | `boolean` | `false` | Turns on the callback group below |
| `customFunctionScript` | `ScriptComponent` (private, `@allowUndefined`) | — | Script whose functions are called |
| `onMarkerFoundFunctionNames` | `string[]` (private) | `[]` | Called, in order, on marker found |
| `onMarkerLostFunctionNames` | `string[]` (private) | `[]` | Called, in order, on marker lost |
| `enableLogging` / `enableLoggingLifecycle` | `boolean` | `false` | |

Lifecycle:

1. `onAwake`: parent under the camera, then read `marker.getAspectRatio()` and
   `marker.height`. If the marker has no texture, it falls back to aspect 1 and
   height 0, and logs a WARN only when logging is on.
2. `OnStartEvent`: scale `resizeObjectArray`. If the `MarkerTrackingComponent`
   is enabled, chain its handlers onto `onMarkerFound` / `onMarkerLost` with
   `Utils.addMarkerFoundHandler` / `addMarkerLostHandler`. Handlers assigned
   before keep firing.

Callbacks: each listed name is looked up on `customFunctionScript` and called
with the argument `true` on found and `false` on lost. Names that don't exist are
skipped silently.

Public methods: `onMarkerFoundCallback()`, `onMarkerLostCallback()`,
`scaleResizeObjectArray()`.

## `MarkerCallbacks`

| Input | Type | Default | Notes |
|---|---|---|---|
| `animationImage` | `Image` | — | Its material's pass 0 `baseTex` should be an animated texture |
| `enableLogging` / `enableLoggingLifecycle` | `boolean` | `false` | |

Public methods:

- `onMarkerFound()`: if `baseTex.control` is an `AnimatedTextureFileProvider`,
  calls `play(1, 0)`. Otherwise it logs a WARN (with logging on) and returns.
- `onMarkerLost()`: no-op placeholder.

Wire these method names into `ImageTrackingController.onMarkerFoundFunctionNames`
/ `onMarkerLostFunctionNames`. The Resizable prefab does exactly that.

## `ExtendMarkerTrackingController`

| Input | Type | Default | Notes |
|---|---|---|---|
| `markerTrackingComponent` | `MarkerTrackingComponent` | — | Required |
| `parentObject` | `SceneObject` | — | Object to detach into the world. The prefab uses its own root |
| `enableLogging` / `enableLoggingLifecycle` | `boolean` | `false` | |

Lifecycle:

1. `onAwake`: find the root camera. If its `DeviceTracking` actual mode is not
   `World`, it **throws** `You are missing a DeviceTrackingComponent with World
   tracking mode…`. Otherwise it parents itself under the camera.
2. `OnStartEvent`: if the tracker is enabled, chain its handler onto
   `markerTrackingComponent.onMarkerFound` (`Utils.addMarkerFoundHandler`).
3. On marker found (`onMarkerFoundCallback()`, public): create a scene-root
   object `NewParent` the first time (later detections reuse it). After **0.5 s**, re-parent `parentObject` to it (keeping
   the world transform) and **disable** the `MarkerTrackingComponent`. The
   content now stays where the marker was and no longer follows it.

Public methods: `onMarkerFoundCallback()` (the found handler above; you can
call it yourself to trigger the detach).

## `Utils`

- `static getRootCamera(): SceneObject | null`: forwards to Utilities'
  `ComponentUtils.getRootCamera()`, which throws when there is no camera.
- `static createMarkerCallback<T>(script: ScriptComponent, functionNames: string[]): (args: T) => void`
  returns a function that calls each named function present on `script`.
- `static addMarkerFoundHandler(tracker: MarkerTrackingComponent, handler: () => void): void`
  and `static addMarkerLostHandler(...)`: chain `handler` after the handler
  already assigned to `onMarkerFound` / `onMarkerLost`, instead of replacing it.

`Utils` is also declared as a (no-op) component; you don't need to add it to
the scene.

## Prefabs

```
MarkerTrackingHelper_Simple__PLACE_IN_SCENE            [SimpleImageTracking]
└── Image Tracking                                [MarkerTrackingComponent → Image Marker [EDIT_ME]]
    └── Box                                       (Box.mesh, scale 10 → 10 cm cube)

MarkerTrackingHelper_ResizableWithCallbacks__PLACE_IN_SCENE   [ImageTrackingController]
├── Image Tracking                                [MarkerTrackingComponent]
│   └── Image                                     (Image, ImageMaterial.mat = "thank you" animation; in resizeObjectArray)
└── MarkerCallback                                [MarkerCallbacks: animationImage = Image]
    (controller: editEventCallbacks on, found = ["onMarkerFound"], lost = ["onMarkerLost"])

MarkerTrackingHelper_Extended__PLACE_IN_SCENE          [ExtendMarkerTrackingController: parentObject = this root]
└── Marker Tracking                               [MarkerTrackingComponent]
    ├── Tree (+ Star), Gift Box, Bauble, Candy Cane   (holiday meshes)

MarkerTrackingHelper__PLACE_IN_SCENE          (demo prefab, no component)
├── Guide                                         [UIKit Frame, GuideDismissPanel]
│   ├── GuideText                                 (Text)
│   └── OkButton                                  [UIKit Button "Ok, I understood"]
├── ExampleCarousel                               [ExampleCarousel: examples = the three instances below]
├── MarkerTrackingHelper_Simple__PLACE_IN_SCENE        (instance of the Simple prefab)
├── MarkerTrackingHelper_ResizableWithCallbacks__PLACE_IN_SCENE  (instance)
└── MarkerTrackingHelper_Extended__PLACE_IN_SCENE      (instance)
```

## Demo scaffolding (`Example/`)

These two scripts drive the demo prefab only. They aren't part of the marker
API; you can delete the Guide and ExampleCarousel objects (or use one of the
three plain prefabs) in your own Lens.

| Class | Path | Key inputs |
|---|---|---|
| `ExampleCarousel` | `Example/ExampleCarousel/ExampleCarousel.ts` | `examples: SceneObject[]` (shown one at a time), `exampleInfo: string[]`, `steps: SceneObject[]`, `stepInfo: string[]` (default `[]`; text per step, same order as `steps`, empty entries fall back to the example's info), `startIndex`, `previousLabel` / `nextLabel` (default `"Previous"` / `"Next"`), `examplesPushBack` (cm), `anchorExamples` (off here: the controllers parent themselves to the camera), `startMinimized`, `extraPanelDrop` (cm) |
| `GuideDismissPanel` | `Example/GuideDismissPanel/GuideDismissPanel.ts` | `buttonLabel`, `hideUntilDismissed: SceneObject[]` (here: the carousel and the three example instances, enabled again when the guide is closed) |

The carousel panel has Previous / Next buttons, a counter (`1 / 3`), and a
minimize button that collapses it to its title bar.

## Marker asset: `Image Marker [EDIT_ME].imgmarker`

`MarkerHeight` is 21 cm. Its texture is
`Textures/Images/marker-tracking_image_marker_source.png`, the same image as
Lens Studio's default "Image Marker" Preview media. All three prefabs
reference this asset. Replace its texture and height to use your own marker.

## Other shipped assets

Content assets used by the prefabs; none of them is API.

- `Meshes/Box.mesh` with `Materials/BoxMaterials/PBR.mat` (`pbr.graphShader`,
  `Textures/Box/{Base,Normal,MaterialParams}.png`): the Simple prefab's cube.
- `Meshes/HolidayMeshes/*` (Tree, Star, Gift Box, Bauble, Candy Cane) with
  `Materials/HolidayMaterials/*` (Light Brown, Gold Sheen + `Gold Sheen.graphShader`,
  White, Red, Tree): the Extended prefab's content.
- `Textures/thank_you_animated_texture/` (`thank_you_animated_texture.t3d`,
  `atlas_0.png`, `ImageMaterial.mat`): the Resizable prefab's "thank you" animation.
- `Materials/ImageMaterials/Image.mat` (`flat.graphShader`),
  `Textures/Images/{Image,logo}.png`, `Textures/white.jpg`: a spare image
  material and textures; `Image.mat` isn't referenced by any of the prefabs.

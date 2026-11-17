# Marker Tracking Helper

## What it is
A package that wraps Lens Studio's `MarkerTrackingComponent` for Specs, so content can appear on a known printed
or displayed image. It ships three ready prefabs: content that follows the marker, content resized to the marker
with found / lost callbacks, and content that detaches from the marker and stays anchored in the world. It is for
developers building marker-triggered experiences; for surfaces without a marker or known locations, use world
query or Custom Locations instead.

## What it does
- Every controller re-parents its own SceneObject under the root camera in `onAwake`; the child
  `MarkerTrackingComponent` then places its children on the marker while it is tracked.
- Simple (`SimpleImageTracking`): no inputs; a box follows the marker.
- Resizable with callbacks (`ImageTrackingController`): at start it scales each object in `resizeObjectArray`
  (authored at unit size) to the marker's physical size, and on found / lost it calls named functions on a script
  you choose. In the prefab, `MarkerCallbacks.onMarkerFound` plays a "thank you" animated texture.
- Extended (`ExtendMarkerTrackingController`): on marker found it waits 0.5 s, re-parents `parentObject` to a
  scene-root object (keeping its world transform) and disables the `MarkerTrackingComponent`, so the content stays
  where the marker was. The prefab uses a set of holiday meshes.
- `MarkerTrackingHelper__PLACE_IN_SCENE.prefab` shows a guide and an example carousel with one instance of each
  prefab.

## Highlights
- Three prefabs covering follow, resize-and-callback, and world persistence.
- Resize to marker: objects authored at 1 × 1 cm get the marker's aspect ratio and height.
- Found / lost callbacks by function name, chained after any handler already assigned, so existing handlers keep
  firing.
- One editable marker asset, `Image Marker [EDIT_ME].imgmarker`, shared by the prefabs.
- Optional logging through `enableLogging` / `enableLoggingLifecycle`.

## Core scripts
| Script | What it does |
|---|---|
| `Scripts/SimpleImageTracking.ts` | Parents the tracking rig under the root camera so content follows the marker. |
| `Scripts/ImageTrackingController.ts` | Resizes objects to the marker and calls named found / lost functions. |
| `Scripts/MarkerCallback.ts` | `MarkerCallbacks`: example found / lost handlers that play an animated texture. |
| `Scripts/ExtendedMarkerTracking.ts` | `ExtendMarkerTrackingController`: detaches content into the world after detection. |
| `Scripts/Utils.ts` | Root camera lookup and handler-chaining helpers. |
| `Example/ExampleCarousel/ExampleCarousel.ts` | Demo carousel that steps through the three prefabs. |

## Extra info
- **Requires:** Utilities, SnapDecorators, InteractionKit, UIKit, Motion, Icons (the last four for the demo
  scaffolding). The scene needs a root object with a Camera; the Extended prefab also needs `DeviceTracking` in
  **World** mode on that camera, or it throws on awake. In the Lens Studio Preview, set the input to the "Image
  Marker" media to see content on the marker. File and class names differ: import `ExtendMarkerTrackingController`
  from `Scripts/ExtendedMarkerTracking` and `MarkerCallbacks` from `Scripts/MarkerCallback`.
- **Get started:** drag `MarkerTrackingHelper__PLACE_IN_SCENE.prefab` into an empty Specs scene for the full demo,
  or one of `MarkerTrackingHelper_Simple__PLACE_IN_SCENE.prefab`,
  `MarkerTrackingHelper_ResizableWithCallbacks__PLACE_IN_SCENE.prefab` or
  `MarkerTrackingHelper_Extended__PLACE_IN_SCENE.prefab`, then edit `Image Marker [EDIT_ME].imgmarker`.
- **More docs:**
  - [cheat-sheet.md](cheat-sheet.md): load-bearing rules; read first.
  - [components.md](components.md): the scripts, `Utils`, the prefabs and the marker asset.
  - [examples.md](examples.md): prefab setup, custom marker and a callback script.
  - [guide.md](guide.md): choosing a prefab, how each behaves and multi-marker setup.
  - [troubleshooting.md](troubleshooting.md): symptoms and fixes.
  - [api-status.md](api-status.md): current, deprecated and removed surfaces.

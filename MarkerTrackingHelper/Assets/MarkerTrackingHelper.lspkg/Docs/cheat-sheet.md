# MarkerTrackingHelper cheat sheet (load-bearing rules)

[← Agent usage index](../README.md)

## Use when

Read this **first**, and again right before you set up marker content.

## The rules

1. **Start from a prefab and configure it in the Inspector.** Each controller
   reads its inputs and re-parents itself in `onAwake`, so a bare
   `createComponent` followed by property assignment doesn't work. → [examples](examples.md)
2. **Class names differ from file names.** Use
   `ExtendMarkerTrackingController` from `Scripts/ExtendedMarkerTracking` and
   `MarkerCallbacks` from `Scripts/MarkerCallback`. → [components](components.md)
3. **The camera must be a scene root with a Camera component.** The rig is
   re-parented under it at awake. The Extended prefab also requires
   `DeviceTracking` in **World** mode, and throws otherwise. → [troubleshooting](troubleshooting.md)
4. **The marker needs a texture and a real height.** Edit
   `Image Marker [EDIT_ME].imgmarker`: set your image and its printed height in cm.
   Without a texture nothing is ever detected, and resizing falls back to height 0. → [examples](examples.md)
5. **Resize targets must be unit-sized.** `resizeObjectArray` objects get scale
   `(aspect × height, height, height)`. Author them 1 × 1 cm (for example a unit Image). → [components](components.md)
6. **Chain, don't assign.** `onMarkerFound`/`onMarkerLost` are single
   properties. The controllers chain onto whatever is already assigned
   (`Utils.addMarkerFoundHandler` / `addMarkerLostHandler`), but a plain
   assignment made later replaces every earlier handler. Use the callback
   function names or the `Utils` helpers. → [guide](guide.md)
7. **Extended = one-shot.** 0.5 s after the first detection, the content
   detaches to the world and tracking is disabled. To track again, re-enable the
   `MarkerTrackingComponent` (and re-parent the content) yourself. Later detections
   reuse the same `NewParent`. → [guide](guide.md)

## Verify

In Preview, use the "Image Marker" media input. The content must appear on the
marker, with no `Camera not found`, `DeviceTrackingComponent with World` or
`missing provider` errors.

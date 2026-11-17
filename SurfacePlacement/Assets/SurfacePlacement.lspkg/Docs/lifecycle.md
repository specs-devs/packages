# SurfacePlacement lifecycle

[← Agent usage index](../README.md)

## Use when

Read this before starting, restarting or cancelling placement from your own
script, or when the reticle, slider or hint stays in the scene longer than
expected.

## Lifecycle

1. **First `getInstance()`** creates a scene-root SceneObject
   `"SurfacePlacementController"` (calibration `AudioComponent` + hidden hand
   hint). It lives for the rest of the Lens and is never parented under your
   content. Calling `getInstance()` from a field initializer (as `Example` does)
   is fine.
2. **`startSurfacePlacement(settings, callback)`**
   - stops the running session, if any (rule: one session at a time);
   - instantiates the mode's placement prefab under the controller object;
   - Near Surface: if `useAdjustmentWidget`, instantiates `SurfaceSlider.prefab`
     at the **scene root** (hidden until placement completes);
   - head pose: disables the prefab's SIK `Interactable`s, so no pinch/tap/drag
     reaches the reticle;
   - starts a World Query hit-test session (Horizontal / Vertical) and an
     `UpdateEvent` that drives the reticle.
3. **Confirmation**: head-pose dwell, pinch/tap (Horizontal / Vertical with
   `PINCH_OR_TAP`), or a stable palm / phone tap (Near Surface).
4. **Completion**, in this order: the update loop stops, the calibration sound
   plays, the ring animates, then **your callback runs** with the world pose,
   then the reticle scales to zero and is switched off (visual disabled,
   interactables off). The hit-test session stops 0.1 s later.
   You may call `startSurfacePlacement` or `stopSurfacePlacement` from inside the
   callback.
5. **After completion** the detector object stays (disabled visual) under the
   controller until the next start or stop. In Near Surface mode with the widget,
   the slider appears at the placement point and keeps calling
   `onSliderUpdated` until the session is stopped or restarted.
6. **`stopSurfacePlacement()`** disables the detector's interactables, stops the
   hit test and update loop, and destroys the Near Surface slider and the
   detector SceneObject on the next frame (so SIK's cursor never references a
   destroyed interactable). The completion callback is not called; the optional
   `onCancelled` passed to `startSurfacePlacement` is, if the session had not
   completed. Starting a new placement over an unfinished one cancels it the same way.

## Minimal example

See [examples](examples.md). The pattern: hide content → start → show and move
content in the callback → stop on disable/destroy.

## Limitations

- No progress/state events and no `isRunning` query: track your own
  "placing" flag if you need one (clear it in both the callback and `onCancelled`).
- No pose updates after completion (the surface is not tracked); start a new
  placement to move content.

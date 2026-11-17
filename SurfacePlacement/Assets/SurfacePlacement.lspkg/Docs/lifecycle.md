# SurfacePlacement lifecycle

[← Agent usage index](../README.md)

## Use when

Read this before starting, restarting or stopping placement from your own
script, or when the reticle stays in the scene longer than expected.

## Lifecycle

1. **First `getInstance()`** creates a scene-root SceneObject
   `"SurfacePlacementController"` with an `AudioComponent` for the calibration
   chime, and on the next frame plays the chime once at zero volume (then
   restores the volume) so starting audio output does not stall the first
   placement. The object lives for the rest of the Lens and is never parented
   under your content. Calling `getInstance()` from a field initializer (as
   `Example` does) is fine.
2. **`startSurfacePlacement(settings, callback)`**
   - stops the running placement, if any (rule: one session at a time); its
     callback never fires;
   - instantiates the mode's placement prefab under the controller object and
     applies `settings.showDebug`;
   - scales the placement visual in over 0.5 s and starts an `UpdateEvent`;
   - Ground / Wall: starts a World Query hit-test session and hit-tests along
     the gaze every frame;
   - Tabletop: follows the tracked hands, with no hit tests until calibration
     starts; in the Lens Studio editor it also listens for a `TapEvent`.
3. **Confirmation**: dwell on a steady view (Ground / Wall), or a flat, still
   palm (Tabletop; a click in the editor). On device, a high-accuracy hit-test
   session runs alongside while the ring fills.
4. **Completion**, in this order: the ring pops full (0.5 s); then the
   high-accuracy session stops, the update loop is removed, the chime plays and
   the ring collapses (0.5 s); then **your callback runs** with the world pose;
   then the placement visual scales to zero (0.5 s). The coarse hit-test session
   stops 0.1 s after the chime. If your callback starts or stops placement, the
   detector has already been destroyed when the callback returns, and the
   scale-out is skipped.
5. **After completion** the detector object stays (scaled to zero, no update
   loop, hit tests stopped) under the controller until the next start or stop.
6. **`stopSurfacePlacement()`** stops the detector's hit-test sessions
   (including the high-accuracy one) and update loop and destroys its
   SceneObject at once. The callback is not called. Starting a
   new placement over an unfinished one ends it the same way.

`SurfaceMove` is independent of this sequence: it sits on your Frame, sets
itself up on `OnStartEvent`, and moves the content whenever the Frame is
dragged.

## Minimal example

See [examples](examples.md). The pattern: hide content → start → show and move
content in the callback → stop on disable/destroy, only while your own
placement is unfinished.

## Limitations

- No progress or state events, no cancel callback and no `isRunning` query:
  track your own "placing" flag if you need one (set it when you start, clear
  it in the callback and wherever you stop or replace the placement).
- One placement at a time across the whole Lens: `stopSurfacePlacement()` stops
  whichever placement is running, not only yours.
- No pose updates after completion (the surface is not tracked). `SurfaceMove`
  moves content across the placed plane; start a new placement to move it to
  another surface.

# SurfacePlacement cheat sheet (load-bearing rules)

[← Agent usage index](../README.md)

## Use when

Read this **first**, and again right before you wire a placement flow. Each rule
points to the detail.

## The rules

1. **Import from `Scripts/`.** `SurfacePlacementController` from
   `"SurfacePlacement.lspkg/Scripts/SurfacePlacementController"`;
   `PlacementSettings`, `PlacementMode`, `PlacementInteraction` from
   `"SurfacePlacement.lspkg/Scripts/PlacementSettings"`. → [components](components.md)
2. **Use the singleton, never add the placement prefabs yourself.**
   `SurfacePlacementController.getInstance().startSurfacePlacement(settings, (pos, rot) => …)`
   instantiates the right `Prefabs/*Placement.prefab` under its own scene-root
   object. Placing `HorizontalPlacement.prefab` etc. in the scene does nothing
   useful. → [lifecycle](lifecycle.md)
3. **The callback is your only result.** It fires once with a world position
   (cm) and world rotation; hide your content before starting and show/move it
   in the callback. Pass the optional third argument `onCancelled` if you wait on the
   result; it fires when an unfinished session is stopped or replaced. There is no progress or "running" event. → [lifecycle](lifecycle.md)
4. **The placement UI is not under your object.** Disabling or destroying your
   object leaves the reticle running. Call `stopSurfacePlacement()` from your
   `OnDisableEvent` / `OnDestroyEvent` (the `Example` component does it on
   `OnDisableEvent`). → [troubleshooting](troubleshooting.md)
5. **Head pose is the default for Horizontal and Vertical.** `new PlacementSettings()`
   = Horizontal + `PlacementInteraction.HEAD_POSE`. Pass
   `PlacementInteraction.PINCH_OR_TAP` as the **fifth** constructor argument for
   pinch/tap confirmation. `NEAR_SURFACE` always uses palms and ignores it. → [guide](guide.md)
6. **`PlacementMode` values ≠ the `Example` combo box values.** Enum:
   `HORIZONTAL = 0`, `VERTICAL = 1`, `NEAR_SURFACE = 2`. `Example.placementSettingMode`:
   Near Surface = 0, Horizontal = 1, Vertical = 2. Never cast one into the other. → [components](components.md)
7. **One session at a time.** Starting a new placement stops the previous one; a
   stopped detector is destroyed on the next frame. Do not keep references to
   placement internals. → [lifecycle](lifecycle.md)
8. **Head pose needs real surface hits.** Placement completes only with a
   surface hit in the last 0.5 s and a still view (0.5 s) plus a 1.5 s fill. The
   default Preview room has a floor but no walls. → [troubleshooting](troubleshooting.md)

## Verify

In Preview, Horizontal + Head Pose: the ring lands on the floor, fills while you
hold still, and your content appears at the delivered pose. Disable the
starting object and confirm the ring disappears. → [troubleshooting](troubleshooting.md)

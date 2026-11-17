# SurfacePlacement cheat sheet (load-bearing rules)

[← Agent usage index](../README.md)

## Use when

Read this **first**, and again right before you wire a placement flow. Each rule
points to the detail.

## The rules

1. **Import from `Scripts/`.** `SurfacePlacementController` from
   `"SurfacePlacement.lspkg/Scripts/SurfacePlacementController"`;
   `PlacementSettings` and `PlacementMode` from
   `"SurfacePlacement.lspkg/Scripts/PlacementSettings"`; `SurfaceMove` from
   `"SurfacePlacement.lspkg/Scripts/SurfaceMove"`. → [components](components.md)
2. **Use the singleton, never add the placement prefabs yourself.**
   `SurfacePlacementController.getInstance().startSurfacePlacement(settings, (pos, rot) => …)`
   instantiates the right `Prefabs/*Placement.prefab` under its own scene-root
   object. Placing `HorizontalPlacement.prefab` etc. in the scene does nothing
   useful. → [lifecycle](lifecycle.md)
3. **Always pass a mode.** `new PlacementSettings(PlacementMode.GROUND)` (or
   `WALL`, `TABLETOP`); there is no default. The only other argument is
   `showDebug` (default `false`). → [components](components.md)
4. **The callback is your only result.** It fires once with a world position
   (cm) and world rotation; hide your content before starting and show/move it
   in the callback. Stopping or replacing a placement never calls it, and there
   is no cancel, progress or "running" event. → [lifecycle](lifecycle.md)
5. **The placement UI is not under your object.** Disabling or destroying your
   object leaves the reticle running. Call `stopSurfacePlacement()` from your
   `OnDisableEvent` / `OnDestroyEvent`, but only while your own placement is
   unfinished: it stops whatever placement is running. `Example` keeps an
   `active` flag for this. → [troubleshooting](troubleshooting.md)
6. **`PlacementMode` values ≠ the `Example` combo box values.** Enum:
   `GROUND = 0`, `WALL = 1`, `TABLETOP = 2`. `Example.placementSettingMode`:
   Tabletop = 0, Ground = 1, Wall = 2. Never cast one into the other. → [components](components.md)
7. **One session at a time.** Starting a new placement stops the previous one,
   whose callback then never fires. Starting or stopping placement from inside
   the callback is safe: the finished detector skips its scale-out. Do not keep
   references to placement internals.
   → [lifecycle](lifecycle.md)
8. **Dwell needs real surface hits.** Ground and Wall complete only with an
   accepted surface hit in the last 0.5 s, 0.5 s of steady aim, then a 1 s fill.
   Tabletop needs a tracked hand in view, flat and still, resting on the table;
   in the editor a click places instead. → [troubleshooting](troubleshooting.md)
9. **Know the delivered axes.** Ground: local +Y up, local +Z toward the user.
   Tabletop: local +Y up, local +Z back along the hand toward the wrist (toward
   the camera in the editor). Wall: local +Y out of the wall toward the user,
   local −Z up the wall. `SurfaceMove` takes the content's +Y as the surface
   normal.
   → [guide](guide.md)

## Verify

In Preview, Ground: the ring lands on the floor, fills while you hold still,
and your content appears at the delivered pose. Disable the starting object and
confirm the ring disappears. → [troubleshooting](troubleshooting.md)

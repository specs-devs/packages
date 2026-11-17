# SurfacePlacement troubleshooting

[← Agent usage index](../README.md)

## Use when

Use this table for package-specific failures. Generic Lens scripting, scene
placement, World Query and TypeScript issues are outside this package's scope.

## Known limitations

| Symptom | Package cause | Package fix |
|---|---|---|
| Import under `SurfacePlacement.lspkg/` is unresolved | `Scripts/` dropped from the path (only `Example` sits at the package root) | `SurfacePlacement.lspkg/Scripts/SurfacePlacementController`, `SurfacePlacement.lspkg/Scripts/PlacementSettings`, `SurfacePlacement.lspkg/Scripts/SurfaceMove` |
| `PlacementMode.HORIZONTAL`, `PlacementInteraction` or `new PlacementSettings()` no longer compiles | Code written for the previous revision | `PlacementMode.GROUND` / `WALL` / `TABLETOP`; `new PlacementSettings(mode, showDebug?)`. See [guide](guide.md#migration) |
| Ring/reticle keeps floating after the object that started placement was disabled or hidden by a carousel | The placement UI lives under the scene-root `SurfacePlacementController` object, not under your object | Call `stopSurfacePlacement()` from `OnDisableEvent` / `OnDestroyEvent` while your placement is unfinished (`Example` does it on `OnDisableEvent`) |
| Another script's placement stops when your object is disabled | Your `OnDisableEvent` calls `stopSurfacePlacement()` unconditionally; it stops whichever placement is running | Keep a flag from start to result and stop only while it is set (`Example` uses `active`) |
| Placement starts twice / two sessions flash on first show | Starting from both `OnStart` and `OnEnableEvent` on the first enable | Only restart on re-enable after `OnStart` has run (`Example` uses a `started` flag) |
| Wrong surface type, e.g. a wall mode when you meant ground | `Example.placementSettingMode` integers (0 Tabletop, 1 Ground, 2 Wall) used as `PlacementMode` (0 Ground, 1 Wall, 2 Tabletop) | Use the `PlacementMode` enum members in code; map the combo values explicitly |
| Ground / Wall never completes; ring keeps restarting | No accepted surface hit within the last 0.5 s (the fallback reticle cannot place), or the view is not still enough (4 cm over 0.5 s, measured 100 cm out) | Aim at a scanned floor / wall and hold still; in Preview choose an environment with that geometry |
| Placement completes as soon as the experience opens | The user was already looking at the floor; dwell starts as soon as placement starts, and `Example` starts on `OnStartEvent` | Start placement from your own trigger when the user is ready |
| Pinch / tap does nothing on the reticle | Pinch and tap confirmation were removed; every mode confirms by dwell | Hold the view steady (Ground / Wall) or the palm flat and still (Tabletop) |
| Wall keeps showing "Find an empty space on the wall." | No wall hits: the surface is not near vertical (`abs(normal.y) < 0.15`), outside 50–1000 cm, or the Preview environment has no walls | Aim at a wall; use a Preview environment with walls, or test on device |
| Wall: content authored for the previous revision is rotated 90° | The wall rotation now has local +Y out of the wall and local −Z up it (previously upright) | Pitch upright content −90° about local X, as `Example` does for its menu |
| Tabletop: ring stays a full circle in front of you | No tracked hand with its thumb tip in view; after 2 s the prompt reads "Look at your hand on the surface" | Look at the hand resting on the table |
| Tabletop: ring sits round the hand but never fills | The hand is not flat (fingertips and knuckles within 2 cm of a plane tipped under 25°) or not still (thumb tip within 1.5 cm over the last 22 frames) | Lay the palm flat, fingers straight, and hold it still |
| Tabletop: ring starts filling, then empties again | The hand moved, curled, turned more than 15° or left the view; or the depth pass found the hand more than 7 cm above the table, or no upward-facing surface within 10 cm of it (a hand held flat in the air); it waits 1.5 s before retrying | Rest the hand on the table and keep it in view; turn on `showDebug` to see the depth hits and the reason in the log |
| Tabletop cannot be confirmed in Preview | The Preview has no tracked hand to lay down | Click in the Preview: it places 50 cm ahead of the camera and 20 cm below it at once; verify the palm flow on device |
| Log: `High-accuracy hit test unavailable on this runtime, using coarse placement` | The device runtime has no high-accuracy hit-test option | Harmless; placement uses the standard hit test |
| `SurfaceMove on …: needs a UIKit Frame on the same object` or `needs Surface Content` | `SurfaceMove` sits on an object without a UIKit `Frame`, or **Surface Content** is unset | Put it on the Frame's own object and assign the content |
| Dragging the Frame tilts it toward the user | The Frame's own billboarding is on | Turn off billboarding on the Frame; `SurfaceMove` turns it about the vertical itself |
| Dragged content slides off the edge of the table or wall | `SurfaceMove` keeps the content on the plane of the placed surface; it does not hit-test while dragging | By design; start a new placement to move to another surface |
| Dragged wall content moves as if on a floor | `surfaceContent` has a local rotation, so its +Y is not the wall normal | Leave `surfaceContent` unrotated under the placed root; pitch a child of it instead |
| Code awaiting the placement result hangs after `stopSurfacePlacement()` | Stop and replace never call the callback, and there is no cancel callback | Track your own "placing" flag and clear it wherever you stop or replace the placement |

## Verification

After a fix, reproduce it in Preview (Ground on a Preview floor, or Tabletop
with a click) and confirm the callback pose and that the reticle disappears on
completion, stop and disable. Wall placement and the Tabletop palm flow need a
device or suitable Preview geometry.

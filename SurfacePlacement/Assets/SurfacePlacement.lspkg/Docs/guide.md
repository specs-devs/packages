# SurfacePlacement guide

[← Agent usage index](../README.md)

## Use when

Read this for the longer explanation of the placement modes, how dwell and palm
placement decide when to place, how placed content is moved, and how to migrate
from the previous revision. API details are in [components](components.md);
ordering in [lifecycle](lifecycle.md).

## Try the example

1. Open the SurfacePlacement project, or install the package and add `SurfacePlacement__PLACE_IN_SCENE` to your scene, then pinch **Ok, I understood** on the guide.
2. The carousel shows one example at a time: **Tabletop**, **Ground** and **Wall** (Placement Setting Mode 0, 1 and 2 on each group's `Example`).
3. Tabletop: lay a palm flat on a table and hold it flat and still until the ring round your hand fills. Ground and Wall: look at the floor or a wall; after about half a second of steady aim, the ring fills over one second and places. Moving your head or losing the surface restarts the timer.
4. Drag the menu beside the cube to move the cube across the surface, or pinch **Reset Placement** (`resetPlacement()`) to place again.

Ground and Wall use the world camera's position and forward direction; they do not require eye tracking or a hand gesture. Keep the project's world-tracked camera and InteractionKit setup. On device, World Query needs a scanned, trackable surface. Preview placement depends on the selected environment containing suitable surface geometry.

## Quick start

Create settings with a mode, `new PlacementSettings(PlacementMode.GROUND)`, and pass them to `SurfacePlacementController.getInstance().startSurfacePlacement(settings, callback)`. Starting another placement automatically stops the previous one. Call `stopSurfacePlacement()` to stop without starting another; neither calls the callback. The callback receives the world position in centimeters and a world rotation quaternion after the ring closes, before the placement visual scales away. Code: [examples](examples.md).

## Placement modes

| Mode | Confirmation | Behavior |
| --- | --- | --- |
| `PlacementMode.GROUND` | Dwell | Finds floors and other upward-facing surfaces 20–350 cm along the gaze. Delivers a yaw-only rotation facing the user. |
| `PlacementMode.WALL` | Dwell | Finds walls 50–1000 cm along the gaze; averages recent wall normals to steady the facing. Delivers local +Y out of the wall. |
| `PlacementMode.TABLETOP` | Flat, still palm | Fits a ring round one hand lying flat on a table and measures the table height with depth. In the editor a click stands in for the hand. |

The constructor is `PlacementSettings(mode, showDebug = false)`. `showDebug` prints how placement goes and, in Tabletop, marks with a "+" where the depth pass aims round the hand (yellow) and where its hits land: green for hits that set the table height, blue for hits taken but outside that band, red for hits rejected as not the table. In the example it comes from the `SHOW_DEBUG` constant at the top of `Example.ts`.

**Ground and Wall (dwell):** the reticle follows your view across the surface. Hold the view steady and the ring fills; the text on it reads "Find an empty spot.", then "Placing...", then "Complete". Ground also shows "Look below to place." at eye level. Wall dims the ring and shows "Find an empty space on the wall." until it has hit a wall for more than 15 consecutive results. There is no pinch or tap.

**Tabletop (palm):** without a hand in view the ring stands in front of you as a full circle with "Place palm flat down on a surface". Once a tracked hand is in view the ring opens into a half circle fitted round the fingers, its opening toward the wrist. Lay the palm flat on the table and hold it flat and still: the ring fills over 0.85 s and holds full briefly before placing. Moving, curling or turning the hand more than 15°, or taking it out of view, restarts it. If a tracked hand stays out of view for 2 s, the prompt becomes "Look at your hand on the surface". The placed content stands upright, facing back along the hand toward the wrist.

In the Lens Studio editor, a click in the Preview stands in for the hand and places at once: 50 cm in front of the camera along its heading, 20 cm below its height, facing the camera.

## Moving placed content

`SurfaceMove` goes on a UIKit Frame placed beside the content (the example's `TestMenu`). Dragging the Frame moves the content across the surface it was placed on, keeping the layout they had before the first drag. On floors and tables the content turns to face the wearer as the Frame does while dragged; on walls neither turns. When you let go, the Frame eases back beside the content. The content stays on the plane of the placed surface; there is no hit testing while dragging. Setup: [examples](examples.md).

## Migration

Code written for the previous revision needs these changes:

- Rename the modes: `HORIZONTAL` → `GROUND`, `VERTICAL` → `WALL`, `NEAR_SURFACE` → `TABLETOP`. The numeric values (0, 1, 2) are unchanged, as are the `Example` combo values (Tabletop = 0, Ground = 1, Wall = 2, which are not `PlacementMode` values).
- Construct settings as `new PlacementSettings(mode, showDebug?)`. The mode is required; the widget arguments and the `PlacementInteraction` argument are gone.
- Every mode confirms by dwell; remove pinch / tap prompts. Phone (mobile controller) input is no longer supported.
- Drop the third `onCancelled` argument; track your own "placing" flag ([lifecycle](lifecycle.md)).
- The height slider is gone: Tabletop measures the table height, and `SurfaceMove` lets users slide content across the surface.
- Wall content: the delivered rotation now has local +Y out of the wall and local −Z up it; pitch upright content −90° about X.
- `Example`: `placementInteraction`, `autoStart`, `enableLogging` and `enableLoggingLifecycle` are gone; assign the new `menuObj` input.

## Tracking and feedback

Stillness is measured at a point 100 cm along the camera's view, so noisy hit depths do not continually restart the timer. Aim may move up to 4 cm across a half-second window before the fill starts and, while it fills, up to 10 cm from where it started (Ground allows half as much again once filling). These are aim-point distances, not physical head translation limits.

Placement also requires an accepted surface hit within the last half second. A fallback reticle position alone cannot trigger placement. When no floor is hit, the Ground reticle glides along the last known floor height (or 100 cm below the camera) under your gaze, no further than 350 cm; Wall keeps its last wall pose through brief misses and otherwise floats 200 cm in front of you.

On device, the package uses high-accuracy World Query hit testing whenever the runtime supports it: it starts with the fill, refines the pose while the ring fills, and never delays placement. In Tabletop the same pass measures the table at points around the hand and tells a hand resting on the table from one held flat in the air; if the hand sits more than 7 cm above the surface found, or no upward-facing surface is found near it, calibration stops and can start again after 1.5 s.

The Ground and Wall reticle is scaled with its distance so it keeps a constant size on screen. The Tabletop ring is sized to the hand instead.

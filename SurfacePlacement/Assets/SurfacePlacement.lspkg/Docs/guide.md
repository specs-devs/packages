# SurfacePlacement guide

[← Agent usage index](../README.md)

## Use when

Read this for the longer explanation of the placement modes, how head-pose
confirmation decides when to place, and how to migrate from pinch/tap. API
details are in [components](components.md); ordering in [lifecycle](lifecycle.md).

## Try the example

1. Open the SurfacePlacement project, or install the package and add `SurfacePlacement__PLACE_IN_SCENE` to your scene.
2. Keep **Placement Setting Mode → Horizontal** and **Placement Interaction → Head Pose (hold still)** for the default experience. Select **Vertical** for walls.
3. Look at a real surface. After about half a second of steady aim, the ring fills over 1.5 seconds and confirms placement. Moving your head or losing the surface restarts the timer.
4. Call the example's `resetPlacement()` to place again. To use the previous confirmation behavior, select **Pinch or Tap**.

Head pose uses the world camera's position and forward direction; it does not require eye tracking or a hand gesture. Keep the project's world-tracked camera and SIK setup. On device, World Query needs a scanned, trackable surface. Preview placement depends on the selected environment containing suitable surface geometry.

## Quick start

Starting another placement automatically cancels the previous session. Call `SurfacePlacementController.getInstance().stopSurfacePlacement()` to cancel without starting another. The completion callback receives world position in centimeters and a world rotation quaternion after the confirmation ring animation, before the reticle scales away. Code: [examples](examples.md).

## Placement options

| Mode | Default confirmation | Behavior |
| --- | --- | --- |
| `PlacementMode.HORIZONTAL` | Head pose | Finds floors and other upward-facing surfaces, 20–500 cm away. |
| `PlacementMode.VERTICAL` | Head pose | Finds walls, 50–1000 cm away; averages recent normals to stabilize orientation. |
| `PlacementMode.NEAR_SURFACE` | Palms | Keeps the existing near-surface workflow and optional height-adjustment widget. In Preview, use tap confirmation. |

The constructor is `PlacementSettings(mode = HORIZONTAL, useWidget = true, widgetOffset = new vec3(2, 2, 0), onSliderUpdated = null, interaction = HEAD_POSE)`. The first four arguments and existing `PlacementMode` values are unchanged. Widget settings apply only to `NEAR_SURFACE`; its palm workflow ignores `interaction`.

**Pinch or Tap (Horizontal / Vertical):** the reticle follows your view; pinch with either hand, tap the paired phone, or pinch the ring while looking at it to confirm. Pinching the ring and dragging more than 11 cm moves it along the surface plane before you release. Releasing while the ring is out of view cancels that attempt.

**Near Surface:** rest one or both hands palm-down and still on a surface; the ring fills over about 60 stable frames. With a paired phone, move the phone onto the surface and tap. In the Lens Studio editor, any tap confirms immediately.

## Migration

Horizontal and vertical calls that omit the new fifth argument now confirm by head pose. Pass `PlacementInteraction.PINCH_OR_TAP` to retain the previous interaction. Existing serialized example mode values stay unchanged: Near Surface = 0, Horizontal = 1, Vertical = 2 (these are the `Example` combo values, not `PlacementMode` values).

## Tracking and feedback

Stillness is measured at a point 100 cm along the camera's view, so noisy hit depths do not continually restart the timer. Aim may move up to 4 cm over a half-second window and up to 10 cm from the start of the fill. These are aim-point distances, not physical head translation limits.

Placement also requires an accepted surface hit within the last half second. A fallback reticle position alone cannot trigger automatic placement. The reticle scales with distance to stay readable, and wall placement preserves its last valid pose through brief misses. The package uses public World Query hit testing; it does not depend on experimental refinement APIs.

When no floor is hit, the horizontal reticle is projected onto the last known floor height (or 100 cm below the camera) along a slightly tilted view ray, so it stays near where you are looking; it still cannot place until a real hit arrives.

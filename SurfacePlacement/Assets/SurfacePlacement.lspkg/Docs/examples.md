# SurfacePlacement minimal examples

[← Agent usage index](../README.md)

## Use when

Copy the smallest example that establishes the placement flow. Build the rest
of the experience with the CLAD scripting and scene skills; this file is not an
application template.

## Prefab path (no code)

1. Add the SIK prefab and keep the camera world-tracked.
2. Drag `SurfacePlacement__PLACE_IN_SCENE.prefab` (package root) into the scene.
   It includes a guide and a carousel that steps through four example groups.
3. On an example group's `Example` component pick **Placement Setting Mode**
   (0 Near Surface, 1 Horizontal, 2 Vertical) and **Placement Interaction**;
   keep **Auto Start** on. Replace its red panda child (and `objectVisuals`)
   with your content. To keep a single example, delete `Guide`,
   `ExampleCarousel` and the other groups, and enable the one you keep.
4. Each group's button calls `Example.resetPlacement()`.

## Place content on the floor (head pose, default)

```ts
import {PlacementSettings} from "SurfacePlacement.lspkg/Scripts/PlacementSettings"
import {SurfacePlacementController} from "SurfacePlacement.lspkg/Scripts/SurfacePlacementController"

@component
export class PlaceOnFloor extends BaseScriptComponent {
  @input content: SceneObject

  onAwake() {
    this.createEvent("OnStartEvent").bind(() => this.place())
    // The placement UI is not under this object: stop it explicitly.
    this.createEvent("OnDisableEvent").bind(() =>
      SurfacePlacementController.getInstance().stopSurfacePlacement()
    )
  }

  place() {
    this.content.enabled = false
    SurfacePlacementController.getInstance().startSurfacePlacement(
      new PlacementSettings(), // HORIZONTAL + HEAD_POSE
      (position: vec3, rotation: quat) => {
        const t = this.content.getTransform()
        t.setWorldPosition(position)
        t.setWorldRotation(rotation)
        this.content.enabled = true
      }
    )
  }
}
```

## Wall placement and pinch/tap confirmation

```ts
import {
  PlacementInteraction,
  PlacementMode,
  PlacementSettings,
} from "SurfacePlacement.lspkg/Scripts/PlacementSettings"

// Wall, head-pose confirmation (default interaction).
const wall = new PlacementSettings(PlacementMode.VERTICAL)

// Floor, previous pinch/tap confirmation with drag adjustment.
// `undefined` keeps the default widget offset; the widget is unused outside NEAR_SURFACE.
const manual = new PlacementSettings(
  PlacementMode.HORIZONTAL,
  true,
  undefined,
  null,
  PlacementInteraction.PINCH_OR_TAP
)
```

## Near-surface placement with the height widget

```ts
import {PlacementMode, PlacementSettings} from "SurfacePlacement.lspkg/Scripts/PlacementSettings"
import {SurfacePlacementController} from "SurfacePlacement.lspkg/Scripts/SurfacePlacementController"

function placeOnTable(content: SceneObject): void {
  const t = content.getTransform()
  content.enabled = false
  const settings = new PlacementSettings(
    PlacementMode.NEAR_SURFACE,
    true,                 // show the ±4 cm height slider after placement
    new vec3(10, 10, 0),  // slider offset in cm from the placement point
    (adjusted: vec3) => t.setWorldPosition(adjusted) // world position
  )
  SurfacePlacementController.getInstance().startSurfacePlacement(settings, (pos, rot) => {
    t.setWorldPosition(pos)
    t.setWorldRotation(rot)
    content.enabled = true
  })
}
```

Call `SurfacePlacementController.getInstance().stopSurfacePlacement()` when the
user is done adjusting; it removes the slider.

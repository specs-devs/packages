# SurfacePlacement minimal examples

[← Agent usage index](../README.md)

## Use when

Copy the smallest example that establishes the placement flow. Build the rest
of the experience yourself; this file is not an
application template.

The scripts below can live anywhere under your project's `Assets/`; they import
the package through the `SurfacePlacement.lspkg/` prefix.

## Prefab path (no code)

1. Add the InteractionKit prefab and keep the camera world-tracked.
2. Drag `SurfacePlacement__PLACE_IN_SCENE.prefab` (package root) into the scene.
   It includes a guide and a carousel that steps through three example groups:
   `Tabletop`, `Ground` and `Wall`.
3. On an example group's `Example` component pick **Placement Setting Mode**
   (0 Tabletop, 1 Ground, 2 Wall). Replace the cube under its `SurfaceContent`
   with your content; keep `objectVisuals` and `menuObj` assigned. To keep a
   single example, delete `Guide`, `ExampleCarousel` and the other groups, and
   enable the one you keep.
4. Each group's **Reset Placement** button calls `Example.resetPlacement()`;
   dragging its `TestMenu` moves the content across the surface (`SurfaceMove`).

## Place content on the ground

```ts
import {PlacementMode, PlacementSettings} from "SurfacePlacement.lspkg/Scripts/PlacementSettings"
import {SurfacePlacementController} from "SurfacePlacement.lspkg/Scripts/SurfacePlacementController"

@component
export class PlaceOnGround extends BaseScriptComponent {
  @input content!: SceneObject

  // True from start to result, so this script only ever stops its own placement.
  private placing = false

  onAwake() {
    this.createEvent("OnStartEvent").bind(() => this.place())
    // The placement UI is not under this object: stop it explicitly.
    this.createEvent("OnDisableEvent").bind(() => {
      if (this.placing) {
        this.placing = false
        SurfacePlacementController.getInstance().stopSurfacePlacement()
      }
    })
  }

  place() {
    this.content.enabled = false
    this.placing = true
    SurfacePlacementController.getInstance().startSurfacePlacement(
      new PlacementSettings(PlacementMode.GROUND),
      (position: vec3, rotation: quat) => {
        this.placing = false
        const t = this.content.getTransform()
        t.setWorldPosition(position)
        t.setWorldRotation(rotation)
        this.content.enabled = true
      }
    )
  }
}
```

## Wall and tabletop settings

```ts
import {PlacementMode, PlacementSettings} from "SurfacePlacement.lspkg/Scripts/PlacementSettings"

// Wall: hold the view steady on a wall.
// Delivered rotation: local +Y out of the wall toward the user, local -Z up the wall.
const wall = new PlacementSettings(PlacementMode.WALL)

// Tabletop: lay a palm flat on a table and hold it still.
// `true` prints placement logs and marks where the depth pass aims round the hand.
const table = new PlacementSettings(PlacementMode.TABLETOP, true)
```

Pass either one to `startSurfacePlacement` exactly as in the ground example.

## Stand upright content on a wall

The wall rotation's +Y points out of the wall. For content authored upright
(+Y up, +Z toward the viewer), pitch a child −90° about X, as `Example` does for
its menu:

```ts
import {PlacementMode, PlacementSettings} from "SurfacePlacement.lspkg/Scripts/PlacementSettings"
import {SurfacePlacementController} from "SurfacePlacement.lspkg/Scripts/SurfacePlacementController"

@component
export class PlaceOnWall extends BaseScriptComponent {
  // Placed with the delivered pose.
  @input placedRoot!: SceneObject
  // Child of placedRoot, authored upright.
  @input uprightContent!: SceneObject

  onAwake() {
    this.uprightContent
      .getTransform()
      .setLocalRotation(quat.fromEulerVec(new vec3(-90 * MathUtils.DegToRad, 0, 0)))
    this.createEvent("OnStartEvent").bind(() => {
      this.placedRoot.enabled = false
      SurfacePlacementController.getInstance().startSurfacePlacement(
        new PlacementSettings(PlacementMode.WALL),
        (position: vec3, rotation: quat) => {
          const t = this.placedRoot.getTransform()
          t.setWorldPosition(position)
          t.setWorldRotation(rotation)
          this.placedRoot.enabled = true
        }
      )
    })
  }
}
```

Stop the placement on disable as in the ground example.

## Let the user move placed content (`SurfaceMove`)

No code is needed; wire it in the Inspector:

1. Under the object you place, put the content in one SceneObject with no
   local rotation, so its local +Y faces out of the surface. Any upright pitch
   for walls goes on a child of it, not on this object.
2. Also under the placed object, beside the content (for example as its
   sibling), add a SceneObject with a UIKit `Frame`: translation on,
   billboarding off.
3. Add the `SurfaceMove` script (`Scripts/SurfaceMove`) to the Frame's object
   and set **Surface Content** to the content object.

Dragging the Frame then slides the content across the placed surface; on floors
and tables both turn to face the user. The prefab's `TestMenu` objects are set
up this way.

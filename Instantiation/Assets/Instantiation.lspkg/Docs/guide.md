# Instantiation guide and recipes

[← Agent usage index](../README.md)

## Use when

You need to choose a layout, size it for Specs, or build a longer pattern
(burst, city block, ring of towers). This guide replaces the older README's
"Script Highlights" and "Advanced Usage", whose code used inputs and events
this package doesn't have. Exact names are in [components.md](components.md).

## Choosing a layout

| Goal | Layout |
|---|---|
| Even ring, clock face | `CirclePerimeterInstantiator` |
| Partial arc (fan of cards, a semicircle menu) | `CirclePerimeterInstantiatorWithFixedArcLength` (`startAngle`, `arcAngleSpan`) |
| Polygon outline | `CircleSlicingInstantiator` |
| Scatter on a disc | `SimpleCircleAreaInstantiator` (uniform) or `CircleAreaInstantiator` (denser at the center) |
| Scatter on a square | `SquareAreaInstantiator` |
| Wall / board of items | `InstantiateOn2DGrids` (vertical X–Y plane) |
| Lattice / voxels | `InstantiateOn3DGrids` |
| Path, fence, trail | `InstantiateAlongLine` (count) or `…WithFixedDistance` (spacing) |
| Cloud / burst volume | `RandomPointsInsideSphere`, `RandomPointsInsideBox` |
| Shell around an object | `RandomPointsOnSphereSurface`, `RandomPointsOnBoxSurface` |
| Fill a scaled box or sphere, with size variety | `SimpleColliderInstantiator` |

## Sizing for Specs

All distances are world centimeters. The center's scale doesn't shrink a
layout. A layout about 40–60 cm across at 1–1.5 m stays inside the display's
field of view. The QA pass had to move the larger demo layouts back to 1–2 m
(and shrink the 2D grid and circle radius) so they were fully visible. For
where to place content relative to the user, follow the CLAD spatial-design
guidance.

## Orientation

The 12 center-based layouts follow the center object's **rotation**. Rotate
the center to tilt a ring flat, or turn a grid toward the user. Line layouts
follow their endpoints. The copies themselves keep their prefab rotation:
nothing rotates them to face the center or the line direction.

## Recipe: burst from a sphere volume

Spawn with `RandomPointsInsideSphereTS` (`radius` = 2), then push the copies
outward:

```typescript
@component
export class Burst extends BaseScriptComponent {
  @input instantiator: SceneObject; // carries RandomPointsInsideSphereTS
  @input burstCenter: SceneObject;  // the same object as its `sphere` input
  @input speed: number = 30;        // cm/s

  private t = 0;

  onAwake() {
    this.createEvent("UpdateEvent").bind(() => {
      this.t += getDeltaTime();
      const c = this.burstCenter.getTransform().getWorldPosition();
      for (let i = 0; i < this.instantiator.getChildrenCount(); i++) {
        const tr = this.instantiator.getChild(i).getTransform();
        const p = tr.getWorldPosition();
        const dir = p.sub(c).normalize();
        tr.setWorldPosition(p.add(dir.uniformScale(this.speed * getDeltaTime())));
      }
      if (this.t > 2) this.instantiator.enabled = false;
    });
  }
}
```

## Recipe: city block

Use an `InstantiateOn3DGridsTS` with `gridHeight = 1`, so you get one layer.
Rotate the `gridCenter` so the layer lies flat, or keep it vertical. Then
randomize each copy's Y scale on the first frame, as in the "Post-process"
example in [examples](examples.md).

## Recipe: ring of towers facing the center

```typescript
@component
export class FaceCenter extends BaseScriptComponent {
  @input ring: SceneObject;   // carries CirclePerimeterInstantiatorTS
  @input center: SceneObject; // its `center` input

  private done = false;

  onAwake() {
    this.createEvent("UpdateEvent").bind(() => {
      if (this.done) return;
      this.done = true;
      const c = this.center.getTransform().getWorldPosition();
      for (let i = 0; i < this.ring.getChildrenCount(); i++) {
        const tr = this.ring.getChild(i).getTransform();
        const toCenter = c.sub(tr.getWorldPosition());
        tr.setWorldRotation(quat.lookAt(toCenter.normalize(), vec3.up()));
      }
    });
  }
}
```

The perimeter layout lies in the center's local X–Y plane. To get a ground ring
around the user, rotate `center` −90° about X.

## Tips

- Spawning is one-shot. To change counts at runtime, destroy the children and
  call the layout method once (see "Clear and respawn" in [examples](examples.md)).
- Keep the JS twins for JS-only projects. Otherwise use TS: it adds logging and
  typed access.

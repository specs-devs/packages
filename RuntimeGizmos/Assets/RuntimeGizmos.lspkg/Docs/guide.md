# RuntimeGizmos guide and recipes

[← Agent usage index](../README.md)

## Use when

You want a longer pattern (vector field, path preview, boundary debugger) built
on the gizmos. These recipes replace the README's older "Advanced Usage"
section. That section assigned inputs after `createComponent` and expected the
gizmo to draw; a gizmo builds its lines in `onAwake`, so after
`createComponent` you must assign the references, call `setLineMaterial()`
and then the public `rebuild()` (see [cheat sheet](cheat-sheet.md) rule 1 and
[examples](examples.md)). The recipes below author the gizmos in the Inspector
or instantiate them from a prefab that has its references already wired.

Generic scripting (prefab instantiation, update events, taps) is covered by the
CLAD `lens-api` skill.

## Gizmo descriptions

- **Line**: renders a line between two scene objects and re-reads both
  endpoints every frame. It supports begin/end colors and the Full / Split /
  FadedEnd styles. It uses local positions, so keep the endpoints as siblings of
  the Line object.
- **Closed Polyline**: connects N points into a closed shape, either as one
  continuous line or as one line per edge. It is built once; call `refreshLine()`
  after moving points.
- **Circle**: approximates a ring with `segments` points around a center
  object, optionally oriented by the center's rotation. It updates when the
  center moves or rotates.
- **Spline**: a curve through control points with `tension` (0 straight,
  0.5 Catmull-Rom, 1 tight), `interpolationPoints` per segment and an optional
  closed loop. It updates when any control point moves.
- **Spiral**: linear, exponential, logarithmic or helix growth along X/Y/Z,
  with start/end radius, axis length and loop count.

## Recipe: vector field (prefab instances of a Line group)

Author one prefab `VectorArrow.prefab`: a root, with three children `Gizmo`
(`Line`, material wired, `lineStyle` = FadedEnd), `Start` (at the origin) and `End`.
Because the Line reads the endpoints every frame, moving `End` is enough.

```typescript
@component
export class VectorField extends BaseScriptComponent {
  @input arrowPrefab: ObjectPrefab;   // VectorArrow.prefab
  @input gridSize: number = 6;
  @input spacing: number = 8;         // cm

  private ends: Transform[] = [];
  private origins: vec3[] = [];
  private t = 0;

  onAwake() {
    for (let x = 0; x < this.gridSize; x++) {
      for (let z = 0; z < this.gridSize; z++) {
        const arrow = this.arrowPrefab.instantiate(this.sceneObject);
        const local = new vec3((x - this.gridSize / 2) * this.spacing, 0, (z - this.gridSize / 2) * this.spacing);
        arrow.getTransform().setLocalPosition(local);
        // Children order follows the prefab: Gizmo, Start, End
        this.ends.push(arrow.getChild(2).getTransform());
        this.origins.push(local);
      }
    }
    this.createEvent("UpdateEvent").bind(() => {
      this.t += getDeltaTime();
      this.ends.forEach((end, i) => {
        const o = this.origins[i];
        const dir = new vec3(Math.sin(o.x * 0.1 + this.t), 0, Math.cos(o.z * 0.1 + this.t)).normalize();
        end.setLocalPosition(dir.uniformScale(4));
      });
    });
  }
}
```

## Recipe: path preview with control-point handles

In the Inspector, author a `Spline` with its control points, plus one `Circle`
per control point (`centerObject` = that point, `followRotation` off). The
script only extends the path at runtime.

```typescript
import {Spline} from "RuntimeGizmos.lspkg/Scripts/Spline";

@component
export class PathEditor extends BaseScriptComponent {
  @input path: Spline;
  @input handlePrefab: ObjectPrefab; // a Circle group whose center is its own child

  addPathPoint(worldPos: vec3) {
    const handle = this.handlePrefab.instantiate(this.sceneObject);
    handle.getTransform().setWorldPosition(worldPos);
    this.path.addControlPoint(handle);   // rebuilds the curve; it then tracks the new point
  }

  setSmoothness(tension: number) {
    this.path.setTension(tension);       // clamped to 0..1
  }
}
```

## Recipe: boundary debugger with a visibility toggle

Author the debug gizmos (Circles around trigger zones, a ClosedPolyline over a
collision outline) under one `DebugGizmos` parent. Toggle that parent to hide
them all at once. Each gizmo's own `isEnabled` also works.

```typescript
import {ClosedPolyline} from "RuntimeGizmos.lspkg/Scripts/ClosedPolyline";

@component
export class BoundaryDebugger extends BaseScriptComponent {
  @input debugRoot: SceneObject;
  @input outline: ClosedPolyline;

  private visible = true;

  toggle() {
    this.visible = !this.visible;
    this.debugRoot.enabled = this.visible;
  }

  // Call after the outline's corner objects moved (ClosedPolyline is not tracked)
  outlineChanged(color: vec3) {
    this.outline.refreshLine();
    this.outline.setColor(color);
  }
}
```

## Tips

- When a target moves, Line, Circle, Spline and Spiral rewrite the points of
  their existing renderers, which regenerates the mesh. That's fine for debug
  overlays, but avoid it for hundreds of constantly moving gizmos.
- Spiral with the same start and end amplitude grows 5 % along its length
  unless `spiralType` is Helix (`3`).

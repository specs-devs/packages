# RuntimeGizmos minimal examples

[← Agent usage index](../README.md)

## Use when

You need the smallest working setup. Longer compositions are in [guide](guide.md).

## Prefab (no code)

Drag `RuntimeGizmos.lspkg/RuntimeGizmos__PLACE_IN_SCENE.prefab` into the
scene. Keep the gizmo group you need (`Line`, `ClosedPolyline`, `Circle`,
`Spline` or `Spiral`), delete the others, and move the group where you want
it. Every gizmo is already wired to SpectaclesInteractionKit's
`SpectaclesInteractionKit.lspkg/Components/Interaction/InteractorLineVisual/InteractorLineMaterial.mat`.

## Add a gizmo in the Inspector

1. Create a parent object `MyLine`. Under it, create three children: `Gizmo`
   (identity transform), `Start` and `End`.
2. Add the `Line` script to `Gizmo`. Set `Start Point Object` = `Start`,
   `End Point Object` = `End`, and `Line Material` = a line material, for
   example SpectaclesInteractionKit's `InteractorLineMaterial.mat` (the one
   the prefab uses).
3. Move `Start` / `End`: the line follows every frame.

## Drive an authored gizmo from script

```typescript
import {Circle} from "RuntimeGizmos.lspkg/Scripts/Circle";
import {ClosedPolyline} from "RuntimeGizmos.lspkg/Scripts/ClosedPolyline";

@component
export class GizmoDriver extends BaseScriptComponent {
  @input circle: Circle;              // a Circle authored in the scene, center + material wired
  @input polyline: ClosedPolyline;    // a ClosedPolyline authored in the scene

  private t = 0;

  onAwake() {
    this.createEvent("UpdateEvent").bind(() => {
      this.t += getDeltaTime();
      this.circle.setRadius(8 + 2 * Math.sin(this.t * 2));
      this.circle.color = new vec3(0, 1, 0.5);
    });
  }

  // Call after moving any of the polyline's point objects
  onPointsMoved() {
    this.polyline.refreshLine();
  }
}
```

## Line colors and style

```typescript
import {Line} from "RuntimeGizmos.lspkg/Scripts/Line";
import {VisualStyle} from "SpectaclesInteractionKit.lspkg/Components/Interaction/InteractorLineVisual/InteractorLineRenderer";

@component
export class LineStyler extends BaseScriptComponent {
  @input line: Line; // a Line authored in the scene

  onAwake() {
    // Wait for OnStart so the Line's own onAwake has built its renderer.
    this.createEvent("OnStartEvent").bind(() => {
      this.line.beginColor = new vec3(1, 0, 0);
      this.line.endColor = new vec3(0, 0, 1);
      this.line.visualStyle = VisualStyle.Split;
    });
  }
}
```

The `lineStyle` input is only read when the line is built. Use `visualStyle`
to restyle a live Line.

## Build a gizmo from code

`createComponent` runs `onAwake` before you can assign anything, so the gizmo
skips its build. Assign the references, give it a material, then call
`rebuild()`.

```typescript
import {Line} from "RuntimeGizmos.lspkg/Scripts/Line";
import {Circle} from "RuntimeGizmos.lspkg/Scripts/Circle";

@component
export class CodeGizmos extends BaseScriptComponent {
  @input lineMaterial: Material;   // e.g. SIK InteractorLineMaterial
  @input start: SceneObject;       // siblings of this object (Line uses local positions)
  @input end: SceneObject;
  @input center: SceneObject;

  onAwake() {
    const line = this.sceneObject.createComponent(Line.getTypeName());
    line.startPointObject = this.start;
    line.endPointObject = this.end;
    line.setLineMaterial(this.lineMaterial);
    line.setLineWidth(0.3);
    line.rebuild();

    const ringObject = global.scene.createSceneObject("Ring");
    const ring = ringObject.createComponent(Circle.getTypeName());
    ring.centerObject = this.center;
    ring.setLineMaterial(this.lineMaterial); // builds once the center and material are set
    ring.setRadius(8);
  }
}
```

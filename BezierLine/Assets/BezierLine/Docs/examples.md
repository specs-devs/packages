# BezierLine examples

[← Agent usage index](../README.md)

## Use when

Set up a core connector or place the bundled board. The snippets use the consumer package import prefix and source-declared types. These three snippets and the preserved guide's factory example passed static TypeScript checking with project ambient declarations and a temporary consumer-import alias. The bundled board itself was exercised in the Lens Studio Preview.

## Runtime connector

```typescript
import {BezierLine} from "BezierLine.lspkg/Scripts/BezierLine";

@component
export class ConnectTwoObjects extends BaseScriptComponent {
  @input from: SceneObject;
  @input to: SceneObject;
  @input lineMaterial: Material;
  @input camera: Camera;

  onAwake(): void {
    this.createEvent("OnStartEvent").bind(() => {
      const line = BezierLine.createBezierLine(
        this.getSceneObject(), this.lineMaterial, this.from, this.to
      );
      line.camera = this.camera;
      line.width = 0.3;
      line.segments = 30;
      line.axisUseLocal = true;
      line.startAxis = "X";
      line.endAxis = "X";
      line.setControlOffsets(15, -15);
    });
  }
}
```

The factory returns a component on a new child named `BezierLine`. The supplied material is reused, not cloned. Clone it first if each connector needs a different tint. `setControlOffsets()` chooses axis mode and marks the curve dirty.

## Sample a moving marker

```typescript
import {BezierLine} from "BezierLine.lspkg/Scripts/BezierLine";

@component
export class RideConnector extends BaseScriptComponent {
  @input line: BezierLine;
  @input marker: SceneObject;

  onAwake(): void {
    this.createEvent("UpdateEvent").bind(() => {
      const t = (getTime() * 0.3) % 1;
      const point = this.line.getPointAtT(t);
      const tangent = this.line.getTangentAtT(t);
      if (!point || !tangent) return;
      const transform = this.marker.getTransform();
      transform.setWorldPosition(point);
      transform.setWorldRotation(quat.lookAt(tangent, vec3.up()));
    });
  }
}
```

This traverses the curve parameter 0–1 at 0.3 laps per second, not constant physical speed. Avoid degenerate geometry and validate the orientation when the tangent is parallel to the chosen up vector. Queries operate in world space before the mesh is built.

## Inspector connector

1. Add a Render Mesh Visual and `BezierLine` to a dedicated scene object. Give the visual a material and leave its mesh empty.
2. Assign `meshVisual`, `start`, `end`, and the facing `camera`.
3. Choose axis mode (`useCtrlObjects=false`) or assign both controls and enable `useCtrlObjects`.
4. For the Whiteboard-style curve, use local X axes, `startCtrlOffset=15`, `endCtrlOffset=-15`, width 0.3 and segments 30.

Keep the mesh on a dedicated object: each rebuild moves its owner to the curve midpoint.

## Drop-in board

Drag `BezierLine.lspkg/BezierLine__PLACE_IN_SCENE.prefab` into a Specs scene with the InteractionKit prefab. In this source project the editable asset is `Assets/BezierLine/BezierLine__PLACE_IN_SCENE.prefab`.

The package prefab root is at `(0, 0, -130)` cm. Its children are `Guide` (local `(0, 0, 50)`), `ExampleCarousel` and `BezierDemo`, which holds the board `(0, 7, 0)` and the panel `(0, -33, 2)`. The sample scene moves the instance to `(0, 0, -150)`. These are source defaults, not a verified fit to every device field of view. The guide hides `BezierDemo` and the carousel until "Ok, I understood" is pressed; see [Demo scaffolding](components.md#demo-scaffolding-example).

On start, the board builds Idea, Design and Ship cards, connected Idea→Design, Design→Ship and Idea→Ship. Pinch a card to move it. Drag a dot to an anchor on another card to connect; a connection between the same two cards is replaced. Release near the source without a target (under 1.5 cm) to clear its attached connectors.

The control panel changes Width (0.1–1.5), Curve (0–30 cm), Segments (4–64), Camera, Flow and Debug, and provides Add card, Clear and Reset. Its controls route through the board's public setters. Flow markers sample the curve at `getTime() * flowSpeed`, wrapping once per parameter lap.

## Board events

```typescript
import {BezierExamples} from "BezierLine.lspkg/Examples/BezierExamples";

@component
export class ObserveBoard extends BaseScriptComponent {
  @input board: BezierExamples;

  onAwake(): void {
    this.createEvent("OnStartEvent").bind(() => {
      print(`Connections now: ${this.board.connectionCount}`);
      this.board.onConnectionsChanged.add((count: number) => {
        print(`Connections changed: ${count}`);
      });
    });
  }
}
```

Read the current count immediately as well as subscribing: startup callbacks may run after starter-board creation. Replacing a connection emits a removal count followed by an addition count. Counts exclude a temporary drag connector.

# BezierLine guide

[← Agent usage index](../README.md)

## Use when

Read the original setup tutorial, feature overview and Whiteboard mapping. The focused [components](components.md) reference is authoritative for exact field names and source limitations.

## Features

- **Cubic Bézier ribbon**: smooth curve between a `start` and an `end` scene object
- **Two control modes**: derive handles from a per-end axis + offset, or drive them with explicit control-point objects
- **Attach offsets**: nudge each endpoint along its axis so the line starts just outside the object it connects
- **Camera facing**: the ribbon uses the camera back direction to orient its width; degenerate curve directions still need validation
- **Change detection**: rebuilds only when something moved; facing rebuilds are throttled
- **Reused mesh buffers**: pre-allocated vertex/index arrays and inlined curve math in the sampling loop
- **Curve queries**: `getPointAtT()` / `getTangentAtT()` to place objects along the curve
- **Prefab-free factory**: `BezierLine.createBezierLine()` builds a working line at runtime
- **Debug drawing**: optional curve, control points and handles drawn with the debug render system
- **Whiteboard-style example**: grabbable cards, drag-to-connect anchor dots, flow markers and a UIKit control panel

## Package Contents

| Path | Purpose |
|---|---|
| `Scripts/BezierLine.ts` | The connector component. No dependencies |
| `Examples/BezierExamples.ts` | Demo board: spawns cards, owns connections, flow markers, live settings |
| `Examples/BezierCard.ts` | Grabbable card (SIK) with four anchor dots |
| `Examples/BezierAnchor.ts` | Anchor dot: Whiteboard handle rules + pinch-drag to connect |
| `Examples/BezierExamplesPanel.ts` | UIKit panel: width / curve / segments sliders, switches, buttons, stats |
| `BezierLine__PLACE_IN_SCENE.prefab` | Drop-in demo: `Guide`, `ExampleCarousel` and `BezierDemo` (board + panel) |
| `Example/` | Demo scaffolding scripts for the guide and carousel (`ExampleCarousel/`, `GuideDismissPanel/`) |
| `Materials/` | `Card.mat`, `Anchor.mat`, `Connector.mat`, `FlowMarker.mat` (wired to the board's `cardMaterial`, `anchorMaterial`, `connectorMaterial`, `markerMaterial`) and their `unlit.graphShader` |
| `Meshes/` | `CardBox.mesh` (`cardMesh`) and `AnchorSphere.mesh` (`anchorMesh`) |

> **NOTE:** `Scripts/BezierLine.ts` is all you need for your own connectors. Only the `Examples` folder imports InteractionKit and UIKit.

## Design Guidelines

Designing Lenses for SPECS offers all-new possibilities for immersive AR experiences. View Design Guidelines

## Original environment notes

The following device/app minimum versions were listed in the original tutorial. They have not been revalidated in this source-only documentation pass. The Lens Studio version the package was saved with is in `package.native`; companion packages are listed in `package_dependencies.json`.


- **SPECS OS Version**: v7.0+
- **SPECS App iOS**: v1.7+
- **SPECS App Android**: v1.7+
- **Examples only**: InteractionKit and UIKit (UIKit also needs Motion and Icons)

## Getting Started

### Option A: set it up in the Inspector

1. Create a scene object (for example `LineMesh`) and add a **Render Mesh Visual** component. Leave its mesh empty and assign a material.
2. Add the **BezierLine** script component to the same object.
3. Assign **Mesh Visual** (the Render Mesh Visual from step 1), **Start**, **End** and **Camera**.
4. Pick how the curve bends:
   - **Use Control Objects? = off**: choose an axis and offset for each end (see *Inputs*).
   - **Use Control Objects? = on**: assign **Start Ctrl** / **End Ctrl** scene objects and move them around.
5. Move `Start` or `End`. The ribbon follows.

A good starting point, taken from the Whiteboard connector: axis in local space, `X` axis on both ends, start offset `15`, end offset `-15`, width `0.3`, segments `30`, face camera on.

### Option B: create it from code

```typescript
import { BezierLine } from "BezierLine.lspkg/Scripts/BezierLine";

@component
export class ConnectTwoObjects extends BaseScriptComponent {
  @input from: SceneObject;
  @input to: SceneObject;
  @input lineMaterial: Material;
  @input camera: Camera;

  onAwake() {
    const line = BezierLine.createBezierLine(this.getSceneObject(), this.lineMaterial, this.from, this.to);
    line.camera = this.camera;
    line.width = 0.3;
    line.segments = 30;
    line.setControlOffsets(15, -15);
  }
}
```

`createBezierLine()` creates a child scene object with a `RenderMeshVisual` and a `BezierLine` component already wired together. Everything else is configured through the public properties or the API below.

## Examples

Drop `BezierLine__PLACE_IN_SCENE.prefab` into a Specs scene that has the InteractionKit prefab. You first get a `Guide` panel; after you press "Ok, I understood" the `ExampleCarousel` panel and the `BezierDemo` group appear: three cards joined by connectors and a UIKit panel.

Try it in Preview or on device:

- **Pinch a card and move it.** Every connector attached to it follows. Nothing is re-wired; `BezierLine` detects the moved anchors and rebuilds.
- **Pinch a dot on a card edge and drag to a dot on another card.** A live connector follows your hand and snaps to the dot you hover. Release to keep it. Like the Whiteboard, one connector exists per pair of cards, so a new one replaces the old.
- **Tap a dot** to clear the connectors attached to it.
- **Use the panel** to change width, curve (handle length), segments, camera facing, flow markers and debug drawing on every live connector, and to add cards, clear or reset the board.

How the example maps to the Whiteboard code:

| Whiteboard | Example | What it does |
|---|---|---|
| `BezierNode` | `BezierAnchor` | Knows its side (Left / Right / Top / Bottom) and sets `startAxis` / `startCtrlOffset` / `startAttachOffset` accordingly: Left/Right handles run along local **X**, Top/Bottom along local **Y**, 15 cm long. Pinch-drag uses `InteractableManipulation.setManipulateRoot()` to move a hidden drag target instead of the dot |
| `BezierLineHolder` + `MoveableObjectBase` | `BezierCard` | A grabbable card that owns four anchors |
| `SharedSpaceManager` (connections) | `BezierExamples` | Creates lines with `BezierLine.createBezierLine()`, applies the handle rules, replaces duplicate connections, and rides a marker along each curve with `getPointAtT()` / `getTangentAtT()` |

The board and panel are `@component` classes with Inspector inputs. `BezierCard` and `BezierAnchor` are runtime-created helpers initialized from code. Use the anchor interaction pattern as a starting point for your own "drag from A to B to connect" consumer.

## Inputs

| Input | Type | Default | Description |
|---|---|---|---|
| Mesh Visual | `RenderMeshVisual` | | Visual that receives the generated ribbon mesh |
| Start / End | `SceneObject` | | Curve endpoints (world position and rotation are tracked) |
| Use Control Objects? | `bool` | `false` | `true`: handles come from Start Ctrl / End Ctrl objects. `false`: handles come from axis + offset |
| Start Ctrl / End Ctrl | `SceneObject` | | Control-point objects (only when *Use Control Objects?* is on) |
| Axis in Local Space | `bool` | `true` | Interpret the axes below in each endpoint's local space instead of world space |
| Start Axis / End Axis | `X` `Y` `Z` | `Z` | Direction of each handle |
| Start Offset / End Offset | `float` | `0` | Handle length along its axis, in cm. Clamped to half the endpoint distance |
| Start Attach Offset / End Attach Offset | `float` | `0` | Moves the endpoint itself along its axis, in cm; ignored in explicit control-object mode |
| Width | `float` | `1` | Ribbon width in cm |
| Segments | `int` | `32` | Curve subdivisions; Inspector range 2 to 128, runtime assignments are not clamped |
| Face Camera | `bool` | `true` | Rotate the ribbon toward the camera |
| Camera | `Camera` | | Camera used for facing |
| Draw curve & points | `bool` | `false` | Draw the curve, control points and handles with the debug render system |
| Log mesh stats | `bool` | `false` | Print vertex and index counts on every rebuild |

Object inputs are marked `@allowUndefined`, which is what lets `createBezierLine()` create the component from code and wire it afterwards.

## API

Signatures below are a reference, not a standalone executable snippet.

```text
// Runtime factory: scene object + RenderMeshVisual + BezierLine, ready to use
static createBezierLine(parent: SceneObject, material: Material, start?: SceneObject, end?: SceneObject): BezierLine

// Curve sampling (t in 0..1), world space
getPointAtT(t: number): vec3 | null
getTangentAtT(t: number): vec3 | null

// Reconfigure at runtime
setEndpoints(startObj: SceneObject, endObj: SceneObject): void
setControlPoints(startCtrlObj: SceneObject, endCtrlObj: SceneObject): void
setControlOffsets(startOffset: number, endOffset: number): void

// Rebuild control
markDirty(): void      // rebuild on the next LateUpdate
forceRebuild(): void   // rebuild now
```

Changing `width`, `segments`, axes or offsets directly does not trigger a rebuild by itself. Call `markDirty()` afterwards, or use the setters above, which do it for you.

## How It Works

- Control points `P0..P3` are computed in world space, then converted to the mesh object's local space.
- The mesh object is moved to the curve midpoint before building, which keeps vertex coordinates small and precise.
- For each segment the script evaluates the curve and its tangent, builds a side vector perpendicular to the tangent and the camera direction, and emits two vertices (left/right). Vertex layout: position, normal, texture0 (u across the ribbon, v along it).
- A rebuild happens in `LateUpdateEvent` only when an endpoint or control point moved beyond a small epsilon, or when the camera direction changed enough (checked at most every 0.1 s).

## Tips

- Use an **Unlit** material for a flat connector look. If you turn *Face Camera* off, enable **Double Sided** on the material.
- The `texture0` v coordinate runs 0 to 1 from start to end, so a scrolling texture gives a flow animation for free.
- Keep `Segments` low (16 to 32) for many simultaneous lines. Each segment adds two vertices.
- Axis-mode handle lengths are capped to half the adjusted endpoint distance. Explicit control objects are not capped; this is not a general guarantee against loops.
- Tint per connector by cloning the material (`material.clone()`) and setting `mainPass.baseColor`, as the example does with each card's color.

## Support

If you have any questions or need assistance, please don't hesitate to reach out to the [SPECS Developer Community](https://developers.specs.com).

## Contributing

This package is maintained by the SPECS team. For feature requests or bug reports, visit https://developers.specs.com.

## Built with 👽 by the SPECS team <!-- -->

---

[See more packages](https://github.com/specs-devs/packages)

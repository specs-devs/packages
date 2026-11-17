# Bezier Line

## What it is
A package that draws a thick cubic Bézier ribbon between two scene objects, built at runtime with a
`MeshBuilder`. Use it for curved connectors between objects (node graphs, whiteboards, links between UI) or for
sampling a cubic curve to place markers along it. The core is a single dependency-free component; an optional
Whiteboard-style example shows it in an interactive board.

## What it does
- Add `BezierLine` to an object with a `RenderMeshVisual` (or call `BezierLine.createBezierLine(...)`), assign
  `start` and `end`, and it rebuilds the ribbon in `LateUpdate` whenever an endpoint or control moves or rotates.
- Handles come either from explicit control objects (`useCtrlObjects`, `startCtrl` / `endCtrl`) or from each
  endpoint's X / Y / Z axis, in local or world space, with signed handle lengths and attachment offsets.
- With `faceCamera` and a `camera` assigned, the ribbon turns to face the camera.
- `getPointAtT()` and `getTangentAtT()` sample the curve in world space; `markDirty()` or `forceRebuild()` apply
  changes to width, segments or flags.
- The demo prefab shows a board with three starter cards (Idea, Design, Ship) and connectors. Pinch a card to move
  it, pinch an anchor dot and drag to another card to connect them, tap a dot to clear its lines. Animated flow
  markers run along each connector, and a UI Kit panel adjusts Width, Curve and Segments, toggles Camera, Flow and
  Debug, and adds, clears or resets cards.

## Highlights
- The core `Scripts/BezierLine.ts` imports no other package; Interaction Kit (SIK) and UI Kit are only used by
  the examples.
- Two handle modes: explicit control objects, or axis-based handles capped at half the endpoint span.
- Rebuilds only on change: endpoint pose and control positions are compared each frame, and camera facing is
  re-evaluated at most every 0.1 s.
- Optional debug drawing of the curve, handles and control points, plus mesh-stat logging.
- The example board exposes `connect()`, `addCard()`, `clearBoard()` and an `onConnectionsChanged` event, and
  replaces an existing connector between the same two cards.

## Core scripts
| Script | What it does |
|---|---|
| `Scripts/BezierLine.ts` | Core component: builds the ribbon mesh, handles control modes, camera facing and curve sampling. |
| `Examples/BezierExamples.ts` | Example board: cards, connections, drag-to-connect and flow markers. |
| `Examples/BezierCard.ts` | Movable card with a label, collider, SIK manipulation and four anchors. |
| `Examples/BezierAnchor.ts` | Anchor dot with a hidden drag target, hover discovery and drag events. |
| `Examples/BezierExamplesPanel.ts` | UI Kit control panel for width, curve, segments and the board toggles. |
| `Example/GuideDismissPanel/GuideDismissPanel.ts` | Demo guide panel; keeps the board hidden until dismissed. |
| `Example/ExampleCarousel/ExampleCarousel.ts` | Demo carousel panel that frames the example. |

## Extra info
- **Requires:** InteractionKit and UIKit, plus Motion and Icons (needed by UIKit); only the examples and demo
  scaffolding import them. The core assigns no material: give the `RenderMeshVisual` one yourself.
- **Get started:** `BezierLine__PLACE_IN_SCENE.prefab` in a Specs scene with the InteractionKit prefab. For
  your own Lens, use `Scripts/BezierLine.ts` alone and remove `Guide` and `ExampleCarousel` from the prefab.
- **More docs:**
  - [cheat-sheet.md](cheat-sheet.md) - required wiring and rebuild rules; read first
  - [components.md](components.md) - exact inputs, methods, types and events
  - [api-status.md](api-status.md) - compatibility and known source gaps
  - [examples.md](examples.md) - minimal factory code and prefab setup
  - [troubleshooting.md](troubleshooting.md) - missing ribbons, stale curves, example behavior
  - [guide.md](guide.md) - long tutorial, usage options and implementation notes

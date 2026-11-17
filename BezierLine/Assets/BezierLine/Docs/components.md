# BezierLine components

[← Agent usage index](../README.md)

## Use when

Look up exact inputs, callable methods and events. All distances are centimeters unless specified. Object inputs have no source default unless one is listed. Inspector ranges do not enforce runtime assignments. The signatures below describe source. Documentation examples passed a separate static TypeScript check; the demo itself was exercised in the Lens Studio Preview against SpectaclesInteractionKit and SpectaclesUIKit.

## BezierLine

Import: `BezierLine.lspkg/Scripts/BezierLine` (named `BezierLine`). This `@component` has no companion-package imports and no public events. `onAwake()` caches already-wired transforms and binds `LateUpdateEvent`; setters and lazy caches support factory wiring after component creation.

### Core inputs

| Field | Type | Default | Meaning |
|---|---|---|---|
| `meshVisual` | `RenderMeshVisual` | Unassigned, `@allowUndefined` | Receives generated mesh. Assign a material separately. Mesh owner is repositioned to curve midpoint. |
| `start`, `end` | `SceneObject` | Unassigned, `@allowUndefined` | Endpoint world positions and rotations. Both required to rebuild or sample. |
| `useCtrlObjects` | `boolean` | `false` | Use explicit controls when both exist; otherwise axis mode. |
| `startCtrl`, `endCtrl` | `SceneObject` | Unassigned, `@allowUndefined` | Explicit world-space handles; Inspector shown when `useCtrlObjects` is enabled. |
| `axisUseLocal` | `boolean` | `true` | Axes come from endpoint transforms instead of world axes. |
| `startAxis`, `endAxis` | `string` | `"Z"` | Inspector choices `X`, `Y`, `Z`. Use only these axis values. |
| `startCtrlOffset`, `endCtrlOffset` | `number` | `0` | Signed axis-mode handle lengths; capped in magnitude to half adjusted endpoint span. |
| `startAttachOffset`, `endAttachOffset` | `number` | `0` | Signed axis-mode displacement of endpoint itself; ignored in explicit-control mode. |
| `width` | `number` | `1` | Ribbon width; Inspector 0.01–2. No runtime positivity/finite-value check. |
| `segments` | `number` (`@input("int")`) | `32` | Subdivision count; Inspector 2–128. No core runtime clamp. |
| `faceCamera` | `boolean` | `true` | Use assigned camera's back direction for ribbon facing. |
| `camera` | `Camera` | Unassigned, `@allowUndefined` | Facing camera. Without it, rebuild uses the fallback up direction. |
| `debugDraw` | `boolean` | `false` | Draw curve, handles and control points through debug render system. |
| `debugLog` | `boolean` | `false` | Log rebuild mesh counts and missing-input messages. |

### Core methods

| Method | Result and behavior |
|---|---|
| `static createBezierLine(parent: SceneObject, material: Material, start?: SceneObject, end?: SceneObject): BezierLine` | Create scene object named `BezierLine`, parent it, create RMV and script, wire `meshVisual` and supplied material. Material is not cloned. If both endpoints are supplied, call `setEndpoints()`. Camera is not assigned. |
| `getPointAtT(t: number): vec3 \| null` | World-space cubic point. Null without both endpoints. Intended `t` range 0–1; not clamped. |
| `getTangentAtT(t: number): vec3 \| null` | Normalized world-space curve derivative. Null without both endpoints; degenerate derivatives need validation. |
| `setEndpoints(startObj: SceneObject, endObj: SceneObject): void` | Assign both endpoints, refresh their transform caches, mark dirty. |
| `setControlPoints(startCtrlObj: SceneObject, endCtrlObj: SceneObject): void` | Enable explicit-control mode, assign controls, refresh their transform caches, mark dirty. |
| `setControlOffsets(startOffset: number, endOffset: number): void` | Disable explicit-control mode, assign handle offsets, mark dirty. Does not change axes or attachment offsets. |
| `markDirty(): void` | Invalidate pose/facing change state; rebuild on next LateUpdate. Does not clear every cached object transform. |
| `forceRebuild(): void` | Rebuild immediately from current inputs; requires visual and both endpoints. |
| `onAwake(): void` | Lifecycle hook, normally invoked by Lens runtime. Do not call to reinitialize a live component. |

Use setters for changing endpoint/control references. After direct changes to numeric settings or flags call `markDirty()`. Do not swap `meshVisual` or `camera` after first build and expect cached transforms to refresh automatically.

### Control modes

In explicit mode, `P0=start.position`, `P1=startCtrl.position`, `P2=endCtrl.position`, `P3=end.position`. Both controls must be assigned. Axis attachment offsets and handle-length caps are bypassed.

In axis mode, each endpoint moves along its chosen local or world axis by its signed attachment offset. Its control handle then extends by its signed control offset, capped to half the distance between the adjusted endpoints. Local X/Y/Z use transform right/up/forward; world X/Y/Z use right/up/forward vectors.

Change detection compares endpoint position/rotation and explicit control positions with epsilon 0.0001. Facing compares camera back directions with dot threshold 0.99966, at least 0.1 seconds between facing rebuilds. Camera position alone is not tracked. Generated mesh uses two vertices per sampled point, six indices per subdivision, position/normal/texture0 layout and UInt16 index type.

## BezierExamples

Import: `BezierLine.lspkg/Examples/BezierExamples` (named `BezierExamples`; also exports `Connection`). Optional SIK-based board. `onAwake()` creates Cards and Connections child roots, resolves the camera with SIK's `WorldCameraFinderProvider`, binds an OnStart starter-board build and an Update flow-marker callback.

### Board inputs

| Field | Type | Default | Meaning |
|---|---|---|---|
| `cardMesh` | `RenderMesh` | Unassigned | Box mesh for card face. |
| `anchorMesh` | `RenderMesh` | Unassigned | Sphere mesh for dots and markers. |
| `cardMaterial` | `Material` | Unassigned | Cloned and tinted per card. |
| `anchorMaterial` | `Material` | Unassigned | Cloned per dot. |
| `connectorMaterial` | `Material` | Unassigned | Cloned and tinted per connector. |
| `markerMaterial` | `Material` | Unassigned | Cloned and tinted per flow marker. |
| `lineWidth` | `number` | `0.45` | Ribbon width; Inspector 0.05–2. |
| `segments` | `number` (`@input("int")`) | `32` | Subdivisions; Inspector 2–128. |
| `handleLength` | `number` | `15` | Axis-mode handle length; Inspector 0–30. |
| `faceCamera` | `boolean` | `true` | Facing behavior for all lines. |
| `debugDraw` | `boolean` | `false` | Debug rendering for all lines. |
| `cardSize` | `vec2` | `(16, 10)` | Card width/height. |
| `anchorRadius` | `number` | `0.9` | Dot radius; Inspector 0.4–2.5. Attachment offset is radius plus 0.3 cm. |
| `flowMarkers` | `boolean` | `true` | Enable flow marker objects. |
| `flowSpeed` | `number` | `0.3` | Parameter laps/second; Inspector 0.05–2. Not constant physical speed. |

### Board properties, methods and events

| Surface | Result and behavior |
|---|---|
| `connectionCount: number` (getter) | Current permanent connection count, excluding drag preview line. |
| `vertexCount: number` (getter) | `connectionCount * (segments + 1) * 2`; calculated estimate, not mesh query. |
| `onConnectionsChanged: PublicApi<number>` (getter) | Subscribe with `.add(callback)`; fires count when adding/removing connections. Replacement emits removal then addition. |
| `buildStarterBoard(): void` | Clear and create Idea, Design and Ship with three connecting pairs. |
| `addCard(): BezierCard` | Add numbered Note card with source-defined local jitter in front of board. |
| `addCardAt(label: string, position: vec3): BezierCard` | Create under Cards root, cycle palette, subscribe to each anchor's drag events. Position is local to Cards root. |
| `clearBoard(): void` | Clear connections, destroy cards, reset spawn counter. |
| `resetBoard(): void` | Call `buildStarterBoard()`. |
| `connect(from: BezierAnchor, to: BezierAnchor): Connection \| null` | Reject same-card pair. Replace existing connector between same two cards in either direction, clone material, configure handles and create flow marker. |
| `removeConnection(connection: Connection): void` | Remove if present, destroy line and marker, notify count. |
| `removeConnectionsAt(anchor: BezierAnchor): void` | Remove all lines with that exact anchor as an endpoint. |
| `clearConnections(): void` | Remove all permanent connections. |
| `setLineWidth(width: number): void` | Set board and permanent/temporary line widths; mark dirty. |
| `setSegments(segments: number): void` | Round and apply minimum 2, with no upper clamp; update lines and mark dirty. |
| `setHandleLength(cm: number): void` | Reapply anchor handle and attachment rules to permanent connections. |
| `setFaceCamera(on: boolean): void` | Update permanent/temporary lines and mark dirty. |
| `setDebugDraw(on: boolean): void` | Update permanent/temporary lines and mark dirty. |
| `setFlowMarkers(on: boolean): void` | Toggle current marker scene objects. |
| `onAwake(): void` | Lifecycle initialization, invoked by runtime. |

`Connection` fields: `from: BezierAnchor`, `to: BezierAnchor`, `line: BezierLine`, `material: Material`, `marker: SceneObject | null`, `phase: number`. Treat these records as board-owned; use board methods for removal. `cardSize` and `anchorRadius` configure new cards, not existing cards' geometry.

## BezierCard

Import: `BezierLine.lspkg/Examples/BezierCard` (named `BezierCard`, `BezierCardOptions`, `scaleMeshToSize`, `lighten`). Runtime helper `@component`; no Inspector inputs or public events.

`BezierCardOptions` requires all fields: `label: string`, `color: vec4`, `size: vec2`, `position: vec3`, `cardMesh: RenderMesh`, `cardMaterial: Material`, `anchorMesh: RenderMesh`, `anchorMaterial: Material`, `anchorRadius: number`, `labelTextSize: number`. Size is cm, position local under parent, labelTextSize is `Component.Text.size`.

| Surface | Result and behavior |
|---|---|
| `static create(parent: SceneObject, options: BezierCardOptions): BezierCard` | Create `Card <label>` under parent, set local position, create component and initialize visual/interaction/anchors. |
| `label: string = ""` | Stored label. Use `setLabel()` to update displayed text. |
| `color: vec4 = (1,1,1,1)` | Stored color. Use `setColor()` to update face. |
| `size: vec2 = (16,10)` | Stored card size; direct assignment does not resize built geometry. |
| `anchors: BezierAnchor[]` (getter) | Initialized Left, Right, Top, Bottom anchors. |
| `getAnchor(side: AnchorSide): BezierAnchor` | Return initialized side's anchor; source assumes `init()` already ran. |
| `init(options: BezierCardOptions): void` | Build face, label, box collider, SIK Interactable and manipulation, four anchors. Intended for factory initialization. |
| `setLabel(label: string): void` | Update stored label and Text content. |
| `setColor(color: vec4): void` | Update stored color and face material only. Anchors and existing connector tints are not changed. |
| `destroyCard(): void` | Destroy card scene object. Remove its connections through owner before destroying it. |
| `scaleMeshToSize(obj: SceneObject, mesh: RenderMesh, size: vec3): void` | Set local scale from target cm size divided by mesh AABB extents; no zero-extent guard. |
| `lighten(color: vec4, amount: number): vec4` | Mix RGB toward white, preserve alpha; amount not clamped. |

Cards use Direct + Indirect targeting, translation manipulation with rotation/scaling disabled, face thickness 0.6 cm and collider thickness 2 cm. Anchors lie at side midpoints, 0.8 cm in front of face.

## BezierAnchor

Import: `BezierLine.lspkg/Examples/BezierAnchor` (named `BezierAnchor` and types/constants below). Runtime helper `@component`; no Inspector inputs. A hidden drag target is manipulated instead of moving the visible anchor off its card.

| Surface | Result and behavior |
|---|---|
| `card: BezierCard` | Assigned by `init()`, no initial value. |
| `side: AnchorSide = "Left"` | Initialized card edge. |
| `dragTarget: SceneObject` (getter) | Hidden manipulated target. Requires initialization. |
| `axis: "X" \| "Y"` (getter) | Left/Right → X, Top/Bottom → Y. |
| `direction: number` (getter) | Right/Top → +1, Left/Bottom → -1. |
| `onDragStart: PublicApi<BezierAnchor>` | Source anchor when drag begins. |
| `onDragUpdate: PublicApi<AnchorDragUpdate>` | Source plus hovered anchor of another card, or null. |
| `onDragEnd: PublicApi<AnchorDragEnd>` | Source, target or null, and `isTap`. |
| `init(card: BezierCard, side: AnchorSide, radius: number, mesh: RenderMesh, material: Material, highlight: vec4): void` | Build cloned/tinted dot material, sphere collider and SIK manipulation; register Interactable lookup and event subscriptions. |
| `static fromInteractable(interactable: Interactable): BezierAnchor \| null` | Look up an initialized anchor in registry. |
| `applyStart(line: BezierLine, handleLength: number, attachOffset: number): void` | Set local start axis and signed control/attachment offsets; mark dirty. |
| `applyEnd(line: BezierLine, handleLength: number, attachOffset: number): void` | Configure signed local end handle by this side; mark dirty. |
| `static configureEnd(line: BezierLine, side: AnchorSide, handleLength: number, attachOffset: number): void` | End-handle equivalent usable without an anchor. |
| `setHighlight(on: boolean): void` | Switch visual tint and 1.6× scale while highlighted. |
| `onAwake(): void` | Create initially-disabled Update callback and OnDestroy registry cleanup. |

`AnchorSide` is `"Left" | "Right" | "Top" | "Bottom"`. `ANCHOR_SIDES` is ordered Left, Right, Top, Bottom. `OPPOSITE_SIDE: Record<AnchorSide, AnchorSide>` maps Left↔Right and Top↔Bottom.

`AnchorDragUpdate` fields: `source: BezierAnchor`, `hovered: BezierAnchor | null`. `AnchorDragEnd` fields: `source: BezierAnchor`, `target: BezierAnchor | null`, `isTap: boolean`. `isTap` is true only with no target and drag target ending under 1.5 cm from anchor. Hover discovery accepts another card's anchor from the active interactor's `hoveredInteractables`. Registry entries are removed on destruction.

## Demo scaffolding (`Example/`)

Demo-only scripts shipped in `BezierLine.lspkg/Example/` so the prefab works on its own. They aren't part of the package API. The prefab root holds, in order, `Guide`, `ExampleCarousel` and `BezierDemo` (the `BezierBoard` and `BezierExamplesPanel` objects). Remove `Guide` and `ExampleCarousel` when you build your own Lens.

| File | Used by | Key inputs |
|---|---|---|
| `Example/GuideDismissPanel/GuideDismissPanel.ts` | `Guide` | `buttonLabel` (`"Ok, I understood"`), `hideUntilDismissed: SceneObject[]` (`ExampleCarousel`, `BezierDemo`): hidden while the guide shows, enabled when it's closed. |
| `Example/ExampleCarousel/ExampleCarousel.ts` | `ExampleCarousel` | `examples: SceneObject[]` (`BezierDemo`), `exampleInfo: string[]`, `steps: SceneObject[]` (empty), `stepInfo: string[]` (default `[]`; one info line per `steps` entry, empty entries fall back to the example info; empty here), `startIndex` (`0`), `previousLabel` / `nextLabel`, `examplesPushBack` (`20` cm), `anchorExamples` (`false`, the board stays where it's placed), `startMinimized` (`true`), `extraPanelDrop` (`30` cm) |

With a single example the carousel shows only its title, the description and the minimize button; Previous / Next appear when `examples` lists more than one object.

## BezierExamplesPanel

Import: `BezierLine.lspkg/Examples/BezierExamplesPanel` (named `BezierExamplesPanel`). UIKit runtime control panel; no public events or consumer control methods beyond its inputs and lifecycle.

| Input | Type | Default | Meaning |
|---|---|---|---|
| `board` | `BezierExamples` | Unassigned | Board controlled by panel. Required. |
| `panelWidth` | `number` | `28` | Panel width cm; Inspector 20–40. Package prefab overrides to 26. |
| `focalDistanceCm` | `number` | `130` | Typography design distance; Inspector 60–200. Does not move panel automatically. |
| `hintText` | `string` | `"Pinch a card to move it. Pinch a dot, drag to another card. Tap a dot to clear."` | Hint under title. |

`onAwake(): void` builds the panel, then an OnStart callback validates `board`, subscribes to count changes and refreshes stats. Width slider uses 0.1–1.5, Curve 0–30 with 0.5 cm rounding, Segments 4–64 with integer rounding. Camera/Flow/Debug switches call board setters with the switch's `isOn` from `onFinished` (SpectaclesUIKit's `onFinished` argument is the explicit flag, not the state). Add card, Clear and Reset buttons act on `onTriggerUp`; sizes are set on UIKit initialization. The panel is about 26 × 30 cm.

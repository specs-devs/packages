# AiPreviewAgentInspect components

[← Agent usage index](../README.md)

## Use when

Read when you need the exact public surface: the component, the publisher, the
reader registry and the wire types. Everything here comes from the package source.

## AgentInspectScript

Import: `import {AgentInspectScript} from "AiPreviewAgentInspect.lspkg/AgentInspectScript"`

- `@component`, extends `BaseScriptComponent`. **No `@input`s.**
- `publisher: MessagePublisher<AgentCommand, AgentResponse>`: set in
  `onAwake`, only in the editor. On device it stays undefined.
- `onAwake` (editor only):
  1. creates a `LensMessageBroker` on the Preview `"MessageEvent"` bridge event.
     Replies go out through `Editor.context.postMessage`.
  2. wraps the broker in `publisher`.
  3. builds `RuntimeQueryHandler` (with `createDefaultRegistry()`) and `CaptureHandler`.
  4. subscribes `Ping` → `{type: "PingResponse", commandId}`.
  5. sets an unknown-type handler that replies `CommandError`
     (`reason: "unknown_command"`, `commandId` defaults to `"unknown"`).
- The query and capture handlers are private.

## MessagePublisher

Import: `import {MessagePublisher} from "AiPreviewAgentInspect.lspkg/messaging/MessagePublisher"`

| Member | Behavior |
|---|---|
| `subscribe(type, cb): unsubscribe` | Registers the single handler for a message `type`. A second subscribe for the same type is **ignored**: it prints `[MessagePublisher] W Duplicate subscribe() …` and returns a no-op. |
| `setUnknownHandler(cb)` | Fallback for types that have no subscriber. `AgentInspectScript` already sets one, so setting it again replaces the `unknown_command` reply. |
| `notify(message)` | Sends a response to the editor (does nothing outside the editor). |

`BaseMessage` (`AiPreviewAgentInspect.lspkg/messaging/Messaging`) is `{type: string}`.

## ComponentReaderRegistry

`createDefaultRegistry()` registers these readers. The capabilities query
returns them as short names:

| Component | Readable properties |
|---|---|
| Text | text, size, font, color, horizontalOverflow, verticalOverflow, sizeToFit, horizontalAlignment, verticalAlignment |
| Image | mainMaterial, stretchMode, flipX, flipY, pivot, renderOrder, horizontalAlignment, verticalAlignment |
| RenderMeshVisual | mesh, mainMaterial, meshShadowMode, renderOrder, blendShapesEnabled |
| Text3D | text, size, font, extrusionDepth, mainMaterial, horizontalOverflow, verticalOverflow |
| AnimationPlayer | isPlaying, activeClips |
| Camera | cameraType, fov, near, far, renderOrder, size |
| ScreenTransform | anchor, offset, pivot |
| ScriptComponent | scriptAsset |
| AudioComponent | audioTrack, volume, playbackMode |

`hasComponents` accepts short (`Text`) or full (`Component.Text`) names. It
also matches TypeScript components by script asset name or constructor name
(e.g. `ExampleCarousel`), so it works for any component, not just registered
readers. Property filters and `components` projections only work for the
readers above.

## Wire types (`AiPreviewAgentInspect.lspkg/AgentMessages`)

**Commands** (`AgentCommand`):

- `PingCommand {type: "Ping", commandId}`
- `RuntimeQueryCommand {type: "RuntimeQuery", commandId, scope, projection}`
  - `scope`: `{kind: "capabilities"}` · `{kind: "single", uniqueId}` · `{kind: "roots"}` ·
    `{kind: "filter", predicate, limit?, sortBy?}`
  - `FilterPredicate` (AND-combined): `hasComponents?`, `property? {componentType, propertyName, operator, value?}`,
    `nearPoint? {point, radius}`, `descendantOf?`, `nameContains?` (case-insensitive), `enabledOnly?`
  - `PropertyOperator`: `EQUALS | CONTAINS | GT | LT | EXISTS`; `SortBy`: `NONE | NAME | DISTANCE`
    (`DISTANCE` requires `nearPoint`, otherwise you get `invalid_params`)
  - `ProjectionSpec`: `transform?`, `components? {filter?}`, `bounds?`, `parent?`,
    `children? {maxDepth, nameFilter?, projection}`. Depth is capped at 5.
    Cheap fields (name, uniqueId, enabled, parentName, parentUniqueId,
    childCount, componentTypes) are always returned.
- `CaptureViewCommand {type: "CaptureView", commandId, viewAngle, uniqueIds?, center?, distance?, isolate?, detail?}`
  - `viewAngle`: `isometric | top | front | back | left | right`. It follows the
    object's own rotation for a single uniqueId, and world axes otherwise.
  - `detail`: `low` 256×192, `medium` 512×384 (default), `high` 1024×768
  - `distance`: AABB padding in object mode; `distance / 2` is added to each
    half-extent, so each side gets half the value. In center mode it is the cube size
    (default 100, i.e. ±50). `isolate` moves the targets to layer 31 for the
    capture and then restores their layers.

**Responses** (`AgentResponse`): `PingResponse`, `RuntimeQueryResponse {result}`
(`single` → `object | null`, `roots` → `objects`, `filter` → `matches, totalScanned,
filterBreakdown, truncated`, `capabilities`), `CaptureViewResponse {imageBase64, viewAngle, width, height}`,
`CommandErrorResponse {message, reason?, context?, handState?}`.

`reason` values: `not_found`, `disabled`, `clipped`, `obstructed`, `unreachable`,
`interactor_busy` (the last five are used by Interact), `unknown_command`, `invalid_params`,
`unknown_component`, `unknown_property`, `internal_error`, `unsupported`.

## Demo scaffolding (`Example/`)

These scripts ship in `AiPreviewAgentInspect.lspkg/Example/` and are wired inside
`AiPreviewAgentInspect__PLACE_IN_SCENE.prefab` (order: Guide, ExampleCarousel,
then `AgentInspectDemo`). They only present the demo. They are not part of the
bridge, and the agent tools don't need them.

| Object / script | Class | Key inputs |
|---|---|---|
| `Guide` — `Example/GuideDismissPanel/GuideDismissPanel.ts` | `GuideDismissPanel` | `hideUntilDismissed: SceneObject[]`: hidden until "Ok, I understood" is pressed (here: ExampleCarousel and AgentInspectDemo). Only the ones enabled at start are re-enabled. `buttonLabel: string = "Ok, I understood"` is only used when the panel is built at runtime |
| `ExampleCarousel` — `Example/ExampleCarousel/ExampleCarousel.ts` | `ExampleCarousel` | `examples: SceneObject[]` (here the single `AgentInspectDemo` group), `exampleInfo: string[]` (one line per example), `steps: SceneObject[]`, `stepInfo: string[] = []` (one line per step, same order as `steps`; empty entries fall back to the step's example info; unused here), `startIndex: number = 0`, `previousLabel` / `nextLabel`, `examplesPushBack: number = 20`, `anchorExamples: boolean = true` (off here), `startMinimized: boolean = false`, `extraPanelDrop: number = 0` |

The carousel points at the `AgentInspectDemo` parent, not at the
`AgentInspectScript` object. When the CLAD interaction tools install their own
`AiPreviewAgent Handler`, they delete a lone `AgentInspectScript` object in the
scene, and an input that pointed straight at it would be left dangling.

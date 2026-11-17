# AI Preview Agent – Inspect

## What it is
A tooling package that lets an external AI agent observe a Lens while it runs in the Lens Studio Preview. It hosts a
`postMessage` bridge between the Lens runtime and an editor-side plugin, and answers scene queries and orthographic
render captures over it. It is the universal half of the AI Preview Agent system (Specs and Snapchat Lenses); the
companion `AiPreviewAgentInteract` package adds Specs-only hand actions on top of it. It is meant for people building
or debugging agent tooling, not for shipping in an experience.

## What it does
1. You add `AgentInspectScript` to a SceneObject (normally the CLAD tools do this on an `AiPreviewAgent Handler`
   object for you).
2. In `onAwake`, editor only, it creates a `LensMessageBroker` on the Preview `MessageEvent` channel, wraps it in a
   `MessagePublisher` (exposed as the public `publisher` field) and registers handlers. On device it returns at once.
3. It then answers:
   - `Ping` → `PingResponse`, a liveness heartbeat.
   - `RuntimeQuery` → live scene inspection with the scopes `capabilities`, `single` (by `uniqueId`), `roots` and
     `filter` (AND-combined `hasComponents`, `property`, `nearPoint`, `descendantOf`, `nameContains`, `enabledOnly`,
     with `limit` / `sortBy`). A recursive `ProjectionSpec` chooses which fields come back.
   - `CaptureView` → an orthographic render framed on a set of `uniqueIds` or a world-space `center`, with a
     `viewAngle` preset, optional `isolate` and a `detail` level, returned as a base64 PNG.
4. Any handled failure comes back as a `CommandError` with a typed `reason` and the same `commandId`.

## Highlights
- Typed wire contract in `AgentMessages.ts` (`AgentCommand` / `AgentResponse` unions).
- Cheap fields (name, uniqueId, enabled, parent, childCount, componentTypes) are always returned; transform,
  components, bounds and children are fetched only when the projection asks for them.
- Pluggable component readers (`createDefaultRegistry()`) for Text, Image, RenderMeshVisual, Text3D,
  AnimationPlayer, Camera, ScreenTransform, ScriptComponent and AudioComponent.
- Deterministic error reasons (`not_found`, `unknown_command`, `invalid_params`, `unknown_component`,
  `unknown_property`, `internal_error`, …) instead of silent timeouts.
- Companion packages can subscribe their own command types on the shared `publisher`.
- The bridge scripts import nothing outside the package and do nothing on device.

## Core scripts
| Script | What it does |
|---|---|
| `AgentInspectScript.ts` | Entry component: builds the broker, registers handlers, owns `publisher`. |
| `AgentMessages.ts` | Command and response types (the wire contract). |
| `RuntimeQueryHandler.ts` | Resolves `RuntimeQuery` scopes and projections against the live scene. |
| `ComponentReaderRegistry.ts` | Readers that serialize component properties for queries and filters. |
| `CaptureHandler.ts` | Handles `CaptureView` requests and frames the target region. |
| `OrthoCapture.ts` | Renders the orthographic capture. |
| `AABBComputer.ts` | Computes bounding boxes for queried and captured objects. |
| `SceneHelpers.ts` | Scene-graph traversal helpers. |
| `messaging/MessagePublisher.ts` | `subscribe` / `notify` / `setUnknownHandler` on top of the broker. |
| `messaging/LensMessageBroker.ts` | Receives Preview messages and posts replies to the editor. |

## Extra info
- **Requires:** InteractionKit, UIKit, Motion, Icons (used by the demo prefab and `Example/` scripts; the bridge itself
  needs none of them). Works only in the Lens Studio Preview; on device the component does nothing. Keep a single
  `AgentInspectScript` per scene and remove it before you publish.
- **Get started:** `AiPreviewAgentInspect__PLACE_IN_SCENE.prefab` for the full demo (guide panel, example carousel and
  the `AgentInspectScript` object), or add `AgentInspectScript.ts` to any SceneObject by hand.
- **More docs:**
  - [cheat-sheet.md](cheat-sheet.md) – load-bearing rules, read first
  - [components.md](components.md) – `AgentInspectScript`, publisher, reader registry, wire types
  - [api-status.md](api-status.md) – current, removed and internal APIs
  - [examples.md](examples.md) – manual install, typed payloads, a companion command handler
  - [troubleshooting.md](troubleshooting.md) – timeouts, duplicate handlers, error replies, empty captures

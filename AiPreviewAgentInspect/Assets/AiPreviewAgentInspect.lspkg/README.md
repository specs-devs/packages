# AI Preview Agent — Inspect

The **lens-side nerve center** that lets an external AI agent observe a running Lens.
It hosts a `postMessage` bridge between the Lens runtime (the Preview panel) and an
editor-side plugin, and answers two kinds of request over that bridge: **scene queries**
and **orthographic render captures**.

This is the universal half of the AI Preview Agent system — it runs on both
**Specs and Snapchat** lenses. The companion `AiPreviewAgentInteract` package adds
Spectacles-only hand interactions and depends on this one.

> Normally you don't wire this up by hand. The editor-side agent tooling
> (Core-ChatTools / the `verify-preview` and `preview-inspection` skills) installs the
> packed script onto a dedicated **"AiPreviewAgent Handler"** object automatically. Import
> this package manually only when authoring/debugging the agent pipeline itself.

## What it does

- **Owns the message broker.** `AgentInspectScript` builds a `LensMessageBroker` over a
  `MessageEvent`, wraps it in a `MessagePublisher` (exposed as the public `publisher`
  field other packages borrow), and registers handlers.
- **`Ping` → `PingResponse`** — liveness heartbeat so the editor knows the handler is alive.
- **`RuntimeQuery`** — unified live scene inspection. Four scopes:
  - `capabilities` — registered component readers, present component types, scene size, schema version
  - `single` — one object by `uniqueId`
  - `roots` — top-level scene objects
  - `filter` — AND-combined predicates (`hasComponents`, `property`, `nearPoint`,
    `descendantOf`, `nameContains`, `enabledOnly`) with `limit`/`sortBy` and a
    `filterBreakdown` explaining result-set size
  - A recursive `ProjectionSpec` controls which fields are returned — cheap fields
    (name, uniqueId, enabled, parent, childCount, componentTypes) are always populated;
    `transform` / `components` / `bounds` / `parent` / `children` are lazy.
- **`CaptureView` → `CaptureViewResponse`** — orthographic render of a region (framed on
  a set of `uniqueIds` or a world-space `center`), with `viewAngle` preset, optional
  `isolate`, and `detail` (low/medium/high). Returns a base64 PNG.
- **Deterministic errors** — every failure comes back as `CommandError` with a typed
  `reason` (`not_found`, `unknown_command`, `invalid_params`, `unknown_component`,
  `unknown_property`, `internal_error`, `unsupported`, …) so a caller never hangs.

## Contents

| File | Role |
|------|------|
| `AgentInspectScript.ts` | `@component` entry point — builds broker, registers handlers, owns `publisher` |
| `RuntimeQueryHandler.ts` | Resolves `RuntimeQuery` scopes against the live scene |
| `ComponentReaderRegistry.ts` | Pluggable readers that serialize component properties (`createDefaultRegistry()`) |
| `SceneHelpers.ts` | Scene-graph traversal helpers |
| `AABBComputer.ts` | Bounding-box computation for queried objects |
| `CaptureHandler.ts` / `OrthoCapture.ts` | Orthographic render capture |
| `messaging/` | `LensMessageBroker`, `MessagePublisher`, `Messaging` — subscribe/notify/dispatch-by-type |
| `AgentMessages.ts` | Command/response type unions (the wire contract) |

## Dependencies

- SpectaclesInteractionKit `0.16.4`
- SpectaclesUIKit `0.1.4`

## Manual usage (advanced)

Add `AgentInspectScript` as a `ScriptComponent` on any SceneObject. On `onAwake` it stands
up the broker and begins answering `Ping` / `RuntimeQuery` / `CaptureView` over the
preview `postMessage` channel. The package is platform-agnostic, so this works on any lens.
For hand interactions, also add `AiPreviewAgentInteract` (it finds this script by walking
*up* the ancestor chain, so put it on the same object or a descendant).





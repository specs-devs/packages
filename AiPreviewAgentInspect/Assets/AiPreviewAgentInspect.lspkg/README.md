<p align="center">
  <img src="Docs/media/AiPreviewAgentInspect.png" width="250px" alt="AiPreviewAgentInspect"/>
</p>

# AI Preview Agent — Inspect

The **lens-side nerve center** that lets an external AI agent observe a running Lens.
In Lens Studio Preview, it hosts a `postMessage` bridge between the Lens runtime (the Preview panel) and an
editor-side plugin, and answers two kinds of request over that bridge: **scene queries**
and **orthographic render captures**.

This is the universal half of the AI Preview Agent system — it runs on both
**SPECS and Snapchat** lenses. The companion `AiPreviewAgentInteract` package adds
SPECS-only hand interactions and depends on this one.

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
  `unknown_property`, `internal_error`, `unsupported`, …) when the handler receives and processes a request. A paused or unavailable Preview can still time out.

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

The bridge scripts at the package root (and `messaging/`) import nothing
outside this package. `package_dependencies.json` lists SpectaclesInteractionKit,
SpectaclesUIKit, Motion and Icons. Those are used by the demo pieces: the
`Example/` scripts import `SpectaclesUIKit.lspkg/...` and
`SpectaclesInteractionKit.lspkg/...`, and the PLACE_IN_SCENE prefab uses UIKit
`Frame` / button components. The bridge only runs in the Lens Studio Preview, on SPECS and Snapchat projects; on
device the component does nothing.

## Usage

This section ships with the package and describes the installed package.
Read it, then follow the links into `Docs/` for the topic you need. It is
written for both people and coding agents; generic Lens scripting, scene
construction, and Specs spatial design live in the CLAD skills, not here.

### Package identity

- Package descriptor: `AiPreviewAgentInspect.lspkg/package.native` (the package version lives there)
- Consumer import prefix: `AiPreviewAgentInspect.lspkg/` (flat layout, e.g.
  `AiPreviewAgentInspect.lspkg/AgentInspectScript`,
  `AiPreviewAgentInspect.lspkg/AgentMessages`). This is the path
  `AiPreviewAgentInteract` imports.
- Entry point: the `AgentInspectScript` component.
- Demo prefab: `AiPreviewAgentInspect__PLACE_IN_SCENE.prefab`. It is
  self-contained: it carries the guide panel ("Ok, I understood"), the example
  carousel (minimize) and the `AgentInspectDemo` group with the
  `AgentInspectScript` object. Drop it into a Specs scene with a Camera and SIK
  and you get the full demo. The agent tools don't need it.
- Demo scaffolding: `AiPreviewAgentInspect.lspkg/Example/` holds the scripts the
  prefab uses for the guide and the carousel (`ExampleCarousel/`,
  `GuideDismissPanel/`). They are not part of the bridge; see
  [components](Docs/components.md#demo-scaffolding-example).
- Companion package: `AiPreviewAgentInteract` (SPECS-only hand actions) depends
  on this one. Nothing here depends on it.

### Version and API status

[API status](Docs/api-status.md) lists the current wire commands and the internal
helpers. It also records the old per-purpose commands that `RuntimeQuery` replaced.

### Applicability

Use this package only to let editor-side agent tools (scene queries, captures)
observe a Lens running in the Preview. It is not a runtime scene-query API for
Lens logic, and it does nothing on device. Install `AiPreviewAgentInteract` as
well when the tools also need to drive SIK hands. Normally the CLAD tools install
both for you on an `AiPreviewAgent Handler` object. Never ship it as part of an
experience.

### Related CLAD skills

- [preview-inspection](https://github.com/lens-studio-devs/ls-extensions/tree/main/plugins/ls-clad/skills/preview-inspection):
  querying the live Preview and taking orthographic captures through this bridge.
- [verify-preview](https://github.com/lens-studio-devs/ls-extensions/tree/main/plugins/ls-clad/skills/verify-preview):
  the end-to-end QA loop that uses it.
- No CLAD? Setup: https://developers.specs.com/docs/clad/setup/setup-ai/ ·
  source: `github.com/lens-studio-devs/ls-extensions`.

### Package Docs (ship in `Docs/`)

- [cheat sheet](Docs/cheat-sheet.md) - load-bearing rules; read first
- [components](Docs/components.md) - `AgentInspectScript`, publisher, reader registry, wire types
- [API status](Docs/api-status.md) - Current / Removed / Internal for this revision
- [examples](Docs/examples.md) - manual install and a companion command handler
- [troubleshooting](Docs/troubleshooting.md) - no response, duplicate handlers, empty captures

### Verification

1. The project compiles with no errors, and the snippets compile without `as any`.
2. In the Preview, a scene-roots query lists the scene's root objects, and the
   `AgentInspectScript` object reports the `AgentInspectScript` component type.
3. A capabilities query returns `schemaVersion` "1.0" and the nine registered readers.
4. A capture with `viewAngle` "front" returns a non-empty image of the target.
5. A query with an unknown `uniqueId` returns `null`, not a timeout.

## Manual usage (advanced)

Add `AgentInspectScript` as a `ScriptComponent` on any SceneObject. On `onAwake`
it sets up the broker and starts answering `Ping` / `RuntimeQuery` / `CaptureView`
over the Preview `postMessage` channel. For hand interactions, also add
`AgentInteractScript` from `AiPreviewAgentInteract`. It looks for this script on
its own object and then up the parent chain, so put it on the same object or on
a descendant. Keep a single `AgentInspectScript` per scene (see
[troubleshooting](Docs/troubleshooting.md)).

## Built with 👽 by the SPECS team

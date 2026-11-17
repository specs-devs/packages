<p align="center">
  <img src="Docs/media/AiPreviewAgentInteract.png" width="250px" alt="AiPreviewAgentInteract"/>
</p>

# AI Preview Agent — Interact

The **hand-interaction half** of the AI Preview Agent system. It lets an external AI agent
*drive* a running Lens in the Lens Studio Preview. The agent synthesizes pinch, poke, hover,
drag and rotate hand actions against SIK `Interactable` objects, so agent-driven verification
can exercise UI and gestures end-to-end, not just observe them.

This package is **SPECS only** (it builds on InteractionKit hand input) and
**depends on `AiPreviewAgentInspect`**: it borrows that package's message broker rather
than creating its own.

> Normally you don't wire this up by hand. The editor-side agent tooling
> (CLAD's preview tools) attaches this
> script, alongside Inspect, to an **"AiPreviewAgent Handler"** object automatically. Import
> it manually only when authoring or debugging the agent pipeline itself.

## How it attaches

`AgentInteractScript` imports `AgentInspectScript` and `MessagePublisher` from the **Inspect**
package. On `onAwake` (editor only) it looks for `AgentInspectScript` on its own SceneObject
and then on each parent, takes Inspect's `publisher` and subscribes the hand commands to it.
Put both scripts on one object, Inspect first, or put Interact on a descendant. If Inspect or
its `publisher` is missing, `onAwake` logs an error and returns.

## Commands it adds

| Command | Action |
|---------|--------|
| `Pinch` | Pinch a target (by `uniqueId`, `name` + `parentName`, or a world position); `hold` keeps it pinched |
| `Hover` | Move the fingertip into a target's hover zone and back out |
| `Poke` | Push the index fingertip into a target (SIK poke trigger) |
| `Drag` | Pinch a target (or free space) and move it to a world position; `releaseMidDrag` throws |
| `Gesture` | Move a hand to an optional position and play a hand pose |
| `Release` | Release what a hand is holding |
| `Rotate` | Rotate a held object by Euler-angle deltas (degrees) over a duration |
| `Wait` | Reply after a delay |

Successes return `CommandSuccess`. Failures return Inspect's `CommandError` with a typed
`reason`: `not_found`, `disabled`, `clipped` (outside a scroll view), `obstructed`,
`interactor_busy` (the hand is holding something, or isn't holding when it must),
`invalid_params` or `internal_error`. Both carry `handState` (`{left, right}`, each
`free` or `holding`).

## Contents

| File | Role |
|------|------|
| `AgentInteractScript.ts` | `@component` entry point: finds Inspect, builds the interaction handler |
| `InteractionHandler.ts` | Validates commands, tracks held objects, replies |
| `AgentMessages.ts` | Interaction command and response types (the wire contract) |
| `interactor/HandInteractor.ts` | Hand puppet that drives SIK's real hand pipeline |
| `interactor/Hand.ts` / `TrackedHandWrapper.ts` | LEAF hand rig + SIK `TrackedHand` overrides |
| `interactor/BaseInteractor.ts` | Shared interactor base (event waits) |
| `interactor/InteractableValidator.ts` | Clipping and obstruction checks before acting |

## Dependencies

The scripts import `AiPreviewAgentInspect` (broker, publisher, shared error and hand-state
types), `InteractionKit` (hands, interactors, `Interactable`) and `Leaf` (hand
rig, logger, frame timers). `package_dependencies.json` also lists UIKit, Motion
and Icons. The bridge scripts do not import them; the demo scaffolding does
(`Example/ExampleCarousel` and `Example/GuideDismissPanel` import UIKit
`RectangleButton`, `Button` and `Frame`).

## Usage

This section ships with the package and describes the exact installed revision. Read it,
then follow the links into `Docs/` for the topic you need. It is written for both people
and coding agents; generic Lens scripting, scene construction and Specs spatial design are out of scope here.

### Package identity

- Package descriptor: `AiPreviewAgentInteract.lspkg/package.native`
- Consumer import prefix: `AiPreviewAgentInteract.lspkg/` (flat layout, e.g.
  `AiPreviewAgentInteract.lspkg/AgentInteractScript`,
  `AiPreviewAgentInteract.lspkg/AgentMessages`)
- Entry point: the `AgentInteractScript` component.
- Demo prefab: `AiPreviewAgentInteract__PLACE_IN_SCENE.prefab`. It is
  self-contained: it carries the `AgentInspectScript` object (Inspect + Interact
  on one object), the guide panel ("Ok, I understood"), the example carousel
  (minimize) and the `AgentInteractDemo` group (a pinch / poke / hover target and
  a drag target with live event counts). Drop it into a Specs scene with a Camera
  and SIK and you get the full demo. The agent tools don't need it.
- Demo scaffolding: `AiPreviewAgentInteract.lspkg/Example/` holds the scripts and
  assets the prefab uses (`ExampleCarousel/`, `GuideDismissPanel/`,
  `InteractDemoTarget/`, `Materials/`, `Meshes/`). `Example/Materials/` holds
  `PinchTarget.mat` and `DragTarget.mat` (both on `pbr.graphShader` with the `Base.png`,
  `Normal.png` and `MaterialParams.png` textures); `Example/Meshes/Box.mesh` is the targets' mesh.
  They are not part of the hand-action bridge; see [components](Docs/components.md#demo-scaffolding-example).
- Required companions (`package_dependencies.json`): AiPreviewAgentInspect,
  InteractionKit, Leaf (plus UIKit, Motion and Icons for the demo).

### Version and API status

[API status](Docs/api-status.md) lists the current commands, their defaults, the
internal classes, and known limits of this revision.

### Applicability

Use this package only to let editor-side agent tools drive SIK hands in the Preview of a
SPECS project. Use `AiPreviewAgentInspect` alone for scene queries and captures (it also
works for Snapchat lenses). Neither one is a runtime input API: both do nothing on device,
so never build Lens logic on them or ship them in an experience.

### Package Docs (ship in `Docs/`)

- [cheat sheet](Docs/cheat-sheet.md) - load-bearing rules; read first
- [components](Docs/components.md) - `AgentInteractScript`, every command with its fields and defaults, responses
- [API status](Docs/api-status.md) - Current / Internal / Limitations for this revision
- [examples](Docs/examples.md) - manual install, typed command payloads, a target that reacts
- [troubleshooting](Docs/troubleshooting.md) - timeouts, error reasons, hover-pokes, missing replies

### Verification

1. The project compiles with no errors, and the snippets compile without `as any`.
2. In the Preview, a `Pinch` on an `Interactable` by `name` returns `CommandSuccess` with
   `resolvedUniqueId`, and the target's `onTriggerStart` fires once.
3. `Drag` with `hold: true`, then `Rotate`, then `Release` moves and turns an object that has
   `InteractableManipulation`; `handState` goes `holding` → `free`.
4. `Release` on a free hand returns `interactor_busy`; `Pinch` on an unknown name returns
   `not_found` listing the available interactables.
5. Only one `AgentInteractScript` exists in the scene (no `Duplicate subscribe()` warning).

## Manual usage (advanced)

Add `AgentInspectScript` to a SceneObject first, then add `AgentInteractScript` to the
**same object** (below it) or to a descendant. Neither has inputs. Run the Preview: Interact
handles the commands above over the Preview `postMessage` channel. Keep a single pair per
scene and delete it before you publish (see [examples](Docs/examples.md#manual-install)).

## Built with 👽 by the SPECS team

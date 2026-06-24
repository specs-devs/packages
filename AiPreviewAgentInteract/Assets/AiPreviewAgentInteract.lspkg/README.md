# AI Preview Agent — Interact

The **hand-interaction half** of the AI Preview Agent system. It lets an external AI agent
*drive* a running Lens — synthesizing pinch, poke, drag, and other hand actions against
`Interactable` objects — so agent-driven verification can exercise UI and gestures
end-to-end, not just observe them.

This package is **Specs only** (it builds on SpectaclesInteractionKit hand input) and
**depends on `AiPreviewAgentInspect`** — it borrows that package's message broker rather
than creating its own.

> Normally you don't wire this up by hand. The editor-side agent tooling
> (Core-ChatTools / the `verify-preview` and `preview-interaction` skills) attaches this
> packed script — alongside Inspect — onto a dedicated **"AiPreviewAgent Handler"** object
> automatically. Import manually only when authoring/debugging the agent pipeline itself.

## How it attaches

`AgentInteractScript` imports `AgentInspectScript` + `MessagePublisher` from the **Inspect**
package by canonical path. On `onAwake` it calls `findAgentInspectScript(obj)`, which walks
**up** the ancestor chain (same SceneObject or any parent) to locate Inspect and its
`publisher`. Because the walk accepts the *same* object, the editor attaches both scripts to
one handler object — Inspect first (so its broker exists), then Interact. If Inspect or its
`publisher` is missing, `onAwake` errors out clearly.

## Commands it adds

Subscribed against Inspect's shared `publisher` (Editor → Lens):

| Command | Action |
|---------|--------|
| `Pinch` | Pinch a target by `uniqueId` or world-space position |
| `Hover` | Move a hand to hover a target |
| `Poke` | Poke a target |
| `Drag` | Pinch-hold and drag to a target world-space position |
| `Gesture` | Move the hand to a position and perform a gesture |
| `Release` | Release a held object |
| `Rotate` | Rotate a held object by Euler-angle deltas over a duration |
| `Wait` | Idle for a duration |

(The editor-side `PreviewInteract` tool can also send these as a batch — it composes the
sequence editor-side and sends the individual commands above.)

Successes return `CommandSuccess`; failures return the shared `CommandError` with a typed
`reason` — including interaction-specific ones: `clipped` (outside a scroll view),
`obstructed`, `unreachable`, `interactor_busy` (hand already holding — `Release` or use the
other hand). Both responses carry `handState` (`{ left, right }`, each `free`/`holding`).

## Contents

| File | Role |
|------|------|
| `AgentInteractScript.ts` | `@component` entry point — finds Inspect, builds the interaction handler |
| `InteractionHandler.ts` | Routes interaction commands to the active interactor |
| `interactor/HandInteractor.ts` | Synthesizes hand input against SIK |
| `interactor/Hand.ts` / `TrackedHandWrapper.ts` | Hand state + tracked-hand wrapping |
| `interactor/BaseInteractor.ts` | Shared interactor base |
| `interactor/InteractableValidator.ts` | Validates a target is reachable/interactable before acting |
| `AgentMessages.ts` | Interaction command/response type unions |

## Dependencies

- `AiPreviewAgentInspect` (required — provides the broker)
- SpectaclesInteractionKit `0.16.4`
- SpectaclesUIKit `0.1.4`

## Manual usage (advanced)

Add `AgentInspectScript` to a SceneObject first, then add `AgentInteractScript` to the
**same object** (or a descendant). On `onAwake` Interact locates Inspect's `publisher` and
begins handling the hand-action commands above over the preview `postMessage` channel.
Specs only.



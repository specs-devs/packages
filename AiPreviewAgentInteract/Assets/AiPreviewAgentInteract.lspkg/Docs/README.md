# AI Preview Agent – Interact

## What it is
The hand-interaction half of the AI Preview Agent tooling: a package that lets an external AI agent drive a
running Lens in the Lens Studio Preview. It synthesizes pinch, poke, hover, drag and rotate hand actions against
Interaction Kit (SIK) `Interactable` objects, so agent-driven verification can exercise UI and gestures end to end
instead of only observing them. It is for people building or debugging the agent pipeline; the editor-side agent
tools normally attach it for you.

## What it does
1. `AgentInteractScript` sits on the same SceneObject as `AgentInspectScript` (below it) or on a descendant.
2. In `onAwake` it returns immediately unless running in the editor, warms the hand rigs, then walks up the
   hierarchy to find `AgentInspectScript` and borrows its message `publisher`.
3. `InteractionHandler` subscribes the hand commands `Pinch`, `Hover`, `Poke`, `Drag`, `Gesture`, `Release`,
   `Rotate` and `Wait` to that broker, over the Preview `postMessage` channel.
4. Each command resolves its target by `uniqueId`, by `name` (+ `parentName`) or by world position, checks it,
   moves a puppet hand through the real Interaction Kit (SIK) hand pipeline and waits for the interaction events.
5. It replies `CommandSuccess` or Inspect's `CommandError` with a typed `reason` (`not_found`, `disabled`,
   `clipped`, `obstructed`, `interactor_busy`, `invalid_params`, `internal_error`), plus `handState` for both hands.

The demo prefab adds a guide panel, an example carousel and two demo targets (pinch / poke / hover and drag)
with live event counts.

## Highlights
- Drives the real Interaction Kit (SIK) hand input, so targets react through their normal `Interactable` events.
- No broker of its own: it reuses the `AiPreviewAgentInspect` publisher, and keeps one subscriber per command type.
- Checks targets before acting: clipped outside a scroll view, or obstructed by another collider.
- Tracks held objects per hand: `hold: true` keeps a pinch or drag held for a later `Rotate` or `Release`.
- Editor only: on device nothing is subscribed.

## Core scripts
| Script | What it does |
|---|---|
| `AgentInteractScript.ts` | `@component` entry point: finds Inspect, borrows its publisher, builds the handler. |
| `InteractionHandler.ts` | Validates commands, resolves targets, tracks held objects and replies. |
| `AgentMessages.ts` | Interaction command and response types (the wire contract). |
| `interactor/HandInteractor.ts` | Hand puppet that drives the SIK hand pipeline for each action. |
| `interactor/TrackedHandWrapper.ts` | `TrackedHand` overrides and the hand-rig warm-up. |
| `interactor/Hand.ts` | Leaf hand rig with instant world-space setters. |
| `interactor/BaseInteractor.ts` | Shared interactor base (event waits with timeouts). |
| `interactor/InteractableValidator.ts` | Clipping and obstruction checks before acting. |
| `Example/InteractDemoTarget/InteractDemoTarget.ts` | Demo target that shows live interaction event counts. |

## Extra info
- **Requires:** AiPreviewAgentInspect, InteractionKit and Leaf; UIKit, Motion and Icons are used by the demo
  scaffolding. Specs projects only (it needs Interaction Kit (SIK) hands). Lens Studio Preview only: it does
  nothing on device, so remove the Inspect + Interact object before you publish.
- **Get started:** `AiPreviewAgentInteract__PLACE_IN_SCENE.prefab` (Inspect + Interact on one object plus the
  demo targets). For a manual setup, add `AgentInspectScript` first, then `AgentInteractScript` on the same object.
- **More docs:**
  - [cheat-sheet.md](cheat-sheet.md) - load-bearing rules; read first
  - [components.md](components.md) - `AgentInteractScript`, targeting, every command and reply
  - [api-status.md](api-status.md) - current commands, internal classes and known limits
  - [examples.md](examples.md) - manual install, typed command payloads, a target that reacts
  - [troubleshooting.md](troubleshooting.md) - timeouts, error reasons, hover-pokes, missing replies

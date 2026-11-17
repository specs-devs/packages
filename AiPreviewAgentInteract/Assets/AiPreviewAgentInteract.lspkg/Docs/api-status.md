# AiPreviewAgentInteract API status

[← Agent usage index](../README.md)

## Use when

Read when you check whether a command, field or class is supported in this revision
(the version is in `package.native`), or what its known limits are.

## Current

| API | Where | Notes |
|---|---|---|
| `AgentInteractScript` component | `AgentInteractScript.ts` | Entry point; no inputs or public members. Editor only. |
| `Pinch`, `Hover`, `Poke`, `Drag`, `Gesture`, `Release`, `Rotate`, `Wait` | `AgentMessages.ts` | Fields and defaults in [components](components.md#commands-aipreviewagentinteractlspkgagentmessages). |
| `InteractionCommand` / `InteractionResponse` unions | `AgentMessages.ts` | Sent on Inspect's publisher, next to Inspect's own commands. |
| `CommandSuccessResponse` | `AgentMessages.ts` | `handState?: HandState` is optional in the type, but every reply the handler sends sets it. |
| `name` / `parentName` targeting | `AgentMessages.ts` | Alternative to `uniqueId` for objects whose ids change. |
| `releaseMidDrag` | `DragCommand` | Throw: release at 80 % of the path. |
| Available names on `not_found` | `InteractionHandler.ts` | Up to 40 names, then `(+N more)`. |

## Internal (no stable API)

`InteractionHandler`, `AiHandInteractor` (`interactor/HandInteractor.ts`), `AiBaseInteractor`,
`Hand` (extends Leaf's `Hand`), `TrackedHandWrapper`, `requestHandRig` and
`validateInteractable` (with its exported `ValidationReason` / `ValidationResult` types). Their names and signatures can change between revisions. They also
reach into SIK internals (`TrackedHand.keypoints`, `pinchDetector`, `_enabled`), so they are
tied to the InteractionKit revision listed in `package_dependencies.json`.

## Limitations of this revision

- **Session-wide hand overrides.** The first command for a hand makes its SIK `TrackedHand`
  report tracked and enabled, hides its hand mesh, and makes the SIK `HandInteractor` report
  active. That lasts until the Lens resets.
- **Hover on poke-enabled targets also pokes them.** The fingertip is aimed at the target's
  center (see [troubleshooting](troubleshooting.md#hover-also-triggers)).
- **Poke waits for start only.** `Poke` doesn't wait for `onTriggerEnd`; it retracts and
  replies after the 250 ms settle.
- **Approach direction is the target's `forward`.** Pinch, Hover and Poke stage the fingertip
  4 cm along `transform.forward`. A target whose front face points away from `forward` is
  approached from behind.
- **Free-space actions are not validated.** `worldPosition` Pinch / Hover / Poke / Drag skip
  the clipping and obstruction checks and don't wait for SIK events.
- **`unreachable` is never returned**, although Inspect's union declares it.

## Deprecated / Removed / Experimental

None in this revision.

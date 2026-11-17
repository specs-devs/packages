# AiPreviewAgentInteract troubleshooting

[← Agent usage index](../README.md)

## Use when

Read when a hand command times out, returns an error you didn't expect, fires the wrong
event, or gets no reply at all.

## No reply or `unknown_command`

- **`unknown_command` for Pinch / Drag / …** Inspect answered, but no `AgentInteractScript`
  subscribed. Check that it exists, is enabled, and sits on the Inspect object (below it)
  or on a descendant. Look for `AgentInspectScript not found on this SceneObject or any
  ancestor` in the log.
- **No reply at all.** The Preview is paused ("Paused by Creator"), stuck after many resets,
  or failed to compile. Without Inspect even `unknown_command` never comes back. Resume or
  refresh the Preview, then send `Wait` with `durationMs: 0`.
- **A reply for a command you thought had failed.** A command can still run after the caller
  timed out. Query the scene before resending anything that moves or toggles objects.

## `internal_error: Timed out waiting for …`

Every targeted action waits up to 5 s for a SIK event. The message names the event and the
object SIK targeted instead (`SIK target at failure: "<name>"`). `handState` stays `free`.
After a Pinch timeout the puppet is also reset (pinch cancelled, hand hidden); after a Poke
or Hover timeout it is not retracted, so the next command starts from where it stopped.

| Message | Likely cause | Fix |
|---|---|---|
| `onTriggerStart … (poke)` | Target doesn't accept Poke | See [Poke times out](#poke-times-out). |
| `onTriggerStart` with another object as SIK target | A neighbour or a front collider caught the fingertip | Move the targets apart, or check for `obstructed` blockers in front. |
| `onHoverEnter` / `onHoverExit` | The fingertip never crossed the hover zone (very large or very thin collider) | Use Pinch, or adjust the collider. |
| `SIK right HandInteractor not yet registered …` / `hand rig not loaded yet` | SIK prefab missing, or the rig never loaded within 120 frames | Add the SIK prefab, keep `HandVisuals` in it, refresh the Preview. |

The first pinch right after a Preview reset can time out once while SIK settles. Retry it
once before you investigate.

## Poke times out

SIK's `Interactable.targetingMode` defaults to Direct/Indirect (3), which ignores the poke
trigger. A Poke on such a target ends with `internal_error` after 5 s. Found in this
package's demo, 2026-10-01: the same cube answered Pinch at once. Use Pinch, or set the
target's Targeting Mode to Poke (4) or All (7). The UIKit button of the demo's guide
answered Poke without changes.

## Hover also triggers

`Hover` aims the index fingertip at the target's center. On a target that accepts Poke, the
fingertip passes the front face and SIK fires `onTriggerStart` (and the drag events that
follow) as well as `onHoverEnter`. Seen in this package's demo: each Hover raised the
trigger count by one. To check hover-only behavior, use a target without Poke targeting, or
`Hover` at a `worldPosition` just in front of the target.

## Error replies

| `reason` | Cause | Fix |
|---|---|---|
| `not_found` | No Interactable with that `uniqueId` / `name`. | The message lists the available names; uniqueIds change on every Preview reset. |
| `disabled` | The Interactable (or its object) is disabled. | Enable it, or step the UI to the state where it is active. |
| `clipped` | Outside a scroll view's visible area. | Scroll first (Drag the scroll view), then retry. |
| `obstructed` | Another collider is between the camera and the target. | Close or move the blocker; the message names it. |
| `interactor_busy` | The hand's held state doesn't allow the action. | Read `handState`; Release, or use the other hand. |
| `invalid_params` | Missing target, non-finite vector, unknown gesture, Wait > 60000 ms. | Fix the payload. |

## Hand state looks wrong

- **SIK hand input stays overridden.** Once a hand has been driven, SIK keeps reporting it
  as tracked, and its mesh stays hidden, until the Lens resets. Refresh the Preview to
  get normal hand input back.
- **The agent's hand is invisible.** By design: the puppet hides SIK's hand mesh. Judge
  actions by their effect (events, moved objects), not by a visible hand.

## On device

The component does nothing on device (`isEditor()` gate). That is by design.

# AiPreviewAgentInteract cheat sheet

[← Agent usage index](../README.md)

## Use when

Read first, before installing, wiring, driving or debugging the AI Preview hand
interactions.

## Rules

1. **Preview only, SPECS only.** `AgentInteractScript.onAwake` returns at once when
   `global.deviceInfoSystem.isEditor()` is false. On device nothing is subscribed.
   It needs SIK hands, so it does nothing useful in a Snapchat lens.
   → [components](components.md#agentinteractscript)
2. **Inspect first, on the same object or a parent.** Interact borrows
   `AgentInspectScript.publisher` in its own `onAwake`. Put Inspect above Interact on the
   same object, or Interact on a descendant. Otherwise it logs
   `AgentInspectScript not found …` and no hand command gets a reply.
   → [troubleshooting](troubleshooting.md#no-reply-or-unknown_command)
3. **One Interact per scene.** Each command `type` keeps only its first subscriber;
   a second `AgentInteractScript` is ignored with a `Duplicate subscribe()` warning.
4. **Targets are SIK `Interactable`s with colliders.** Commands resolve `uniqueId`
   first, then `name` (+ `parentName`, the direct parent) among the scene's Interactables.
   uniqueIds change on every Preview reset; prefer `name` in scripted sequences.
   → [components](components.md#targeting)
5. **Poke needs `targetingMode` with Poke.** The SIK default is Direct/Indirect (3).
   A Poke on such a target waits 5 s and fails with `internal_error`. Use Pinch, or set
   the target to Poke (4) or All (7).
   → [troubleshooting](troubleshooting.md#poke-times-out)
6. **Hover on a poke-enabled target also pokes it.** The fingertip is aimed at the
   target's center, so it crosses the front face and fires `onTriggerStart`.
   → [troubleshooting](troubleshooting.md#hover-also-triggers)
7. **Track hand state.** `hold: true` keeps a hand busy. Pinch / Hover / Poke / Gesture
   on a holding hand, or Release / Rotate on a free one, return `interactor_busy`.
   Read `handState` in every reply; Release before you retry.
8. **A timeout is not a "no".** Event waits time out after 5 s (`internal_error`), but a
   late command can still run. Query the scene before resending a mutation.
9. **Remove the tooling before you ship.** Delete the Inspect + Interact object and keep
   both packages out of a published experience.

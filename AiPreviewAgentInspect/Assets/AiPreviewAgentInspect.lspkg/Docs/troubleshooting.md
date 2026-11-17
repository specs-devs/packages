# AiPreviewAgentInspect troubleshooting

[← Agent usage index](../README.md)

## Use when

Read when a Preview query or capture times out, returns an error you didn't
expect, or the handler object changes on its own.

## No response / timeout

- **Preview paused or not running.** Only a running Lens answers. The
  "Paused by Creator" state, a failed compile, or a Preview stuck after many
  resets all look like a timeout. Resume or refresh the Preview, then send a `Ping`.
- **No `AgentInspectScript` in the scene.** Without it nothing answers, not even
  with `unknown_command`. Check that a ScriptComponent with
  `AiPreviewAgentInspect.lspkg/AgentInspectScript.ts` exists and is enabled.
  A disabled object receives no `MessageEvent`.
- **A timeout doesn't mean the command never ran.** A late command can still
  run after the caller gave up. Query the state again before you resend
  anything that changes the scene.

## Duplicate or vanished handler

- **Two `AgentInspectScript`s.** Each one answers every command, so the editor
  gets two replies for one `commandId`. Keep exactly one.
- **Your own `AgentInspectScript` object disappeared.** When the CLAD
  interaction tools install `AiPreviewAgent Handler` (Inspect + Interact), they
  delete other objects that carry `AgentInspectScript`. Seen in this package's
  demo, 2026-10-01. Don't point other inputs at that object. The demo carousel
  points at the `AgentInspectDemo` parent instead, so it survives. Re-add the
  object after QA if you need it.
- **Old tooling auto-installed.** The tools can pull in an older
  `AiPreviewAgentInteract`, whose pinch failed with
  `TypeError: Cannot read property 'getTransform' of undefined`. Use matching
  builds of Inspect and Interact (from the same release) together.
- **`[MessagePublisher] W Duplicate subscribe()`.** Two handlers subscribed the
  same `type`, or a companion component exists twice. Only the first one
  stays active.

## Error replies

| `reason` | Cause | Fix |
|---|---|---|
| `unknown_command` | No subscriber for the `type`. This includes hand commands when `AgentInteractScript` is missing (always the case on Snapchat lenses), and removed command names. | Check the `type` against `AgentMessages.ts`; add Interact for hand actions. |
| `invalid_params` | Bad `sortBy` or `operator`, or `sortBy: "DISTANCE"` without `nearPoint`. | Fix the request; `context` names the field. |
| `unknown_component` | `property` filter on a type with no reader. | Use one of the readers in [components](components.md#componentreaderregistry); `hasComponents` works for any type. |
| `unknown_property` | That reader doesn't expose the property. | `context.availableProperties` lists the valid names. |
| `not_found` | `descendantOf` id, or none of a capture's `uniqueIds`, resolved. | Look up the ids again: they belong to the running Lens and change on every Preview reset. |
| `internal_error` | Exception inside a handler. | Not retryable as is. Read the Lens log. |

`single` with an unknown `uniqueId` returns `object: null`, not an error.

## Captures

- **The image only shows a dark background.** The region is empty, or the
  objects have no visible mesh or text (the AABB comes from their visuals and
  colliders). Pass `uniqueIds` or a `center` near the content, and widen `distance`.
- **Something else is in front of the target.** Use `isolate: true` with
  `uniqueIds`. The targets go to layer 31 for the capture and get their layers back afterwards.
- **A capture isn't what the user sees.** It is an orthographic render from a
  temporary camera, not the user's perspective view. Use a Preview panel
  screenshot to check layout, framing and field of view.

## On device

The component does nothing on device. That is by design (`isEditor()` gate).

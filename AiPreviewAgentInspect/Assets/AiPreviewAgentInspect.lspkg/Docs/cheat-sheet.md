# AiPreviewAgentInspect cheat sheet

[← Agent usage index](../README.md)

## Use when

Read first, before installing, wiring or debugging the AI Preview Agent bridge.

## Rules

1. **Preview only.** `AgentInspectScript.onAwake` returns at once when
   `global.deviceInfoSystem.isEditor()` is false. On device there is no broker
   and `publisher` stays undefined. Never build Lens logic on it.
   → [components](components.md#agentinspectscript)
2. **One `AgentInspectScript` per scene.** Each instance has its own broker on the
   same Preview channel, so two instances both answer every command. The CLAD
   tools put their own copy on an `AiPreviewAgent Handler` object, and they
   delete other `AgentInspectScript` objects when they install it.
   → [troubleshooting](troubleshooting.md#duplicate-or-vanished-handler)
3. **Use `publisher` only after `onAwake`.** Companion components (Interact) read
   `publisher` in their own `onAwake`. They must sit on the same object or a
   descendant, below it in the hierarchy, so Inspect wakes first.
   → [examples](examples.md#a-companion-command-handler)
4. **One subscriber per command type.** `MessagePublisher.subscribe` ignores a
   second subscriber for a type and prints a `Duplicate subscribe()` warning.
   Pick new `type` strings for new commands.
   → [components](components.md#messagepublisher)
5. **Every handled command answers with the same `commandId`.** Unknown types get
   `CommandError` / `unknown_command`; handler exceptions get `internal_error`.
   If no reply comes at all, the Preview is paused or not running, or the
   handler is missing.
   → [troubleshooting](troubleshooting.md#no-response--timeout)
6. **Property filters only work on registered readers.** Unregistered
   component types give `unknown_component`; unknown property names give
   `unknown_property`. Both list the valid names in `context`.
   → [components](components.md#componentreaderregistry)
7. **Remove the tooling before you ship.** Delete the `AiPreviewAgent Handler`
   object, and leave this package out of any experience you publish.

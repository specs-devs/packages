# AiPreviewAgentInspect API status

[← Agent usage index](../README.md)

## Use when

Read when you check whether a command, type or helper is supported in this
package (`RuntimeQuery` schema version "1.0").

## Current

| API | Where | Notes |
|---|---|---|
| `AgentInspectScript` component | `AgentInspectScript.ts` | Entry point. Its public `publisher` field is the handle companion packages use. |
| `Ping` → `PingResponse` | `AgentMessages.ts` | Heartbeat. |
| `RuntimeQuery` → `RuntimeQueryResponse` | `AgentMessages.ts`, `RuntimeQueryHandler.ts` | Scopes `capabilities`, `single`, `roots`, `filter`, plus a `ProjectionSpec`. |
| `CaptureView` → `CaptureViewResponse` | `AgentMessages.ts`, `CaptureHandler.ts` | Orthographic capture, returned as base64. |
| `CommandError` | `AgentMessages.ts` | Typed `reason`, optional `context` and `handState`. |
| `AgentCommand` / `AgentResponse` unions | `AgentMessages.ts` | Inspect's own commands only. Interact adds its own types on the same publisher. |
| `MessagePublisher.subscribe` / `notify` / `setUnknownHandler` | `messaging/MessagePublisher.ts` | Used by companion handlers. |

## Removed

| Removed | Replacement |
|---|---|
| `FindByComponent`, `FindByProperty`, `GetObjectsNearPoint`, `GetSceneOverview`, `InspectObject` commands | `RuntimeQuery`: a `filter` scope with `hasComponents` / `property` / `nearPoint`, or the `roots` / `single` scopes. An old editor that still sends them gets `unknown_command`. |

## Internal (no stable API)

`RuntimeQueryHandler`, `CaptureHandler`, `OrthoCapture`, `AABBComputer`,
`SceneHelpers`, `LensMessageBroker`, `Messaging` (`Event`) and the
serialization helpers in `ComponentReaderRegistry.ts`. Their names and
signatures can change between revisions. `createDefaultRegistry()` builds a new
registry, but the handler's own registry is private, so you cannot add readers
from outside the package without editing it.

## Deprecated / Experimental

None in this revision.

# AiPreviewAgentInspect examples

[← Agent usage index](../README.md)

## Use when

Read when you install the bridge by hand, or extend it with your own Preview-only
command. Normally the CLAD tools install it for you (see the README).

## Manual install

1. Create a SceneObject (for example `AiPreviewAgent Handler`) and add a
   ScriptComponent with `AiPreviewAgentInspect.lspkg/AgentInspectScript.ts`.
   There are no inputs to set.
2. For SPECS hand actions, add `AgentInteractScript` (package
   `AiPreviewAgentInteract`) **after** it on the same object, or on a child object.
3. Run the Preview and send a `Ping`. The reply is a `PingResponse` with the same `commandId`.
4. Delete the object before you publish.

## A typed command payload

```ts
import {RuntimeQueryCommand} from "AiPreviewAgentInspect.lspkg/AgentMessages"

const query: RuntimeQueryCommand = {
  type: "RuntimeQuery",
  commandId: "find-texts",
  scope: {kind: "filter", predicate: {hasComponents: ["Text"], enabledOnly: true}, limit: 10, sortBy: "NAME"},
  projection: {transform: true, components: {filter: ["Text"]}}
}
```

Building this value does not send it. The editor tools send commands; the
package has no device transport.

## A companion command handler

Put this component on the same object as `AgentInspectScript` (below it) or on
a child. It follows the same pattern as `AgentInteractScript`: find the
publisher, widen its types, and subscribe to a new `type`.

```ts
import {AgentInspectScript} from "AiPreviewAgentInspect.lspkg/AgentInspectScript"
import {MessagePublisher} from "AiPreviewAgentInspect.lspkg/messaging/MessagePublisher"
import {BaseMessage} from "AiPreviewAgentInspect.lspkg/messaging/Messaging"

interface EchoCommand extends BaseMessage {
  type: "Echo"
  commandId: string
  text: string
}
interface EchoResponse extends BaseMessage {
  type: "EchoResponse"
  commandId: string
  text: string
}

@component
export class EchoHandler extends BaseScriptComponent {
  onAwake() {
    if (!global.deviceInfoSystem.isEditor()) return
    let cursor: SceneObject | null = this.sceneObject
    let inspect: AgentInspectScript | null = null
    while (cursor && !inspect) {
      inspect = cursor.getComponent(AgentInspectScript.getTypeName()) as AgentInspectScript | null
      cursor = cursor.getParent()
    }
    if (!inspect || !inspect.publisher) {
      print("EchoHandler: AgentInspectScript not found (or not awake yet) on this object or its parents")
      return
    }
    const publisher = inspect.publisher as unknown as MessagePublisher<EchoCommand, EchoResponse>
    publisher.subscribe("Echo", (cmd: EchoCommand) => {
      publisher.notify({type: "EchoResponse", commandId: cmd.commandId, text: cmd.text})
    })
  }
}
```

Choose a `type` that Inspect and Interact don't already use. A duplicate
subscribe is ignored (see [components](components.md#messagepublisher)).

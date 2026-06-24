import {AgentCommand, AgentResponse} from "../AgentMessages"
import {MessageObject} from "./MessagePublisher"
import Event, {MessageBroker} from "./Messaging"

export class LensMessageBroker implements MessageBroker<AgentCommand, AgentResponse> {
  private onMessageReceiveEvent: Event<AgentCommand> = new Event<AgentCommand>()
  onMessageReceived = this.onMessageReceiveEvent.publicApi()

  constructor(messageEvent: SceneEvent) {
    messageEvent.bind((event: SceneEvent & MessageObject<AgentCommand>) => {
      this.onMessageReceiveEvent.invoke(event.data)
    })
  }

  notify(message: AgentResponse): void {
    // Defense-in-depth: `Editor` is an editor-only global, undefined in the
    // device runtime. Callers are already gated behind isEditor() at onAwake,
    // but guard here too so a stray off-editor call no-ops instead of crashing.
    if (!global.deviceInfoSystem.isEditor()) return
    // @ts-expect-error - MessageObject is the correct event type for postMessage bridge
    Editor.context.postMessage(message)
  }
}

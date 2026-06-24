import {AgentCommand, AgentResponse, PingCommand} from "./AgentMessages"
import {CaptureHandler} from "./CaptureHandler"
import {createDefaultRegistry} from "./ComponentReaderRegistry"
import {LensMessageBroker} from "./messaging/LensMessageBroker"
import {MessagePublisher} from "./messaging/MessagePublisher"
import {RuntimeQueryHandler} from "./RuntimeQueryHandler"

/**
 * Universal AI preview agent — runtime scene query + orthographic capture.
 *
 * Runs on any Lens Studio lens (Spectacles or Snapchat). Owns the postMessage
 * broker and publisher. Sibling AgentInteractScript (Spectacles only) reads
 * `publisher` to attach its own handlers — see AiPreviewAgentInteract.lspkg.
 */
@component
export class AgentInspectScript extends BaseScriptComponent {
  /**
   * Exposed for sibling @components (e.g. AgentInteractScript) to register
   * additional command handlers. Typed against this package's narrow command
   * union; subscribers for other command types cast at the boundary.
   */
  publisher!: MessagePublisher<AgentCommand, AgentResponse>

  private runtimeQueryHandler!: RuntimeQueryHandler
  private captureHandler!: CaptureHandler

  onAwake() {
    // Preview-only tooling: this agent talks to Lens Studio over a postMessage
    // bridge — createEvent("MessageEvent") below and Editor.context.postMessage
    // in LensMessageBroker. Neither the "MessageEvent" bridge event nor the
    // `Editor` global exists in the lens runtime on a device, so leaving any of
    // this wired up off-editor crashes the lens. Stay fully inert on device.
    if (!global.deviceInfoSystem.isEditor()) return

    const broker = new LensMessageBroker(
      // @ts-expect-error — MessageEvent is the correct event type for postMessage bridge
      this.createEvent("MessageEvent")
    )
    this.publisher = new MessagePublisher<AgentCommand, AgentResponse>(broker)

    const registry = createDefaultRegistry()
    this.runtimeQueryHandler = new RuntimeQueryHandler(this.publisher, registry)
    this.captureHandler = new CaptureHandler(this.publisher)

    this.publisher.subscribe("Ping", (cmd: PingCommand) => {
      this.publisher.notify({type: "PingResponse", commandId: cmd.commandId})
    })

    // Catch-all: if an incoming command has no registered subscriber (typo,
    // version mismatch between editor and lens, or AgentInteractScript not
    // installed on a Snapchat lens), reply with a deterministic CommandError
    // instead of letting the caller wait forever.
    this.publisher.setUnknownHandler((message) => {
      const commandId = (message as {commandId?: string}).commandId ?? "unknown"
      this.publisher.notify({
        type: "CommandError",
        commandId,
        message: `Unknown command type: "${message.type}"`,
        reason: "unknown_command"
      })
    })
  }
}

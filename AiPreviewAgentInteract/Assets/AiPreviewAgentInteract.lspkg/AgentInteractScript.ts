import {AgentInspectScript} from "AiPreviewAgentInspect.lspkg/AgentInspectScript"
import {MessagePublisher} from "AiPreviewAgentInspect.lspkg/messaging/MessagePublisher"
import {Logger} from "Leaf.lspkg/Utils/common/Logger"
import {BaseMessage} from "Leaf.lspkg/Utils/common/MessagingSystem/MessageTypes/BaseMessage"
import {InteractionCommand, InteractionResponse} from "./AgentMessages"
import {InteractionHandler} from "./InteractionHandler"

const LOG = new Logger("AgentInteractScript")

/**
 * Look for AgentInspectScript on `obj`, then on each ancestor up to the scene
 * root. Returns the first match. Lets the user place AgentInteractScript on
 * the same SceneObject as AgentInspectScript, or as a descendant of it.
 */
function findAgentInspectScript(obj: SceneObject): AgentInspectScript | null {
  let cursor: SceneObject | null = obj
  while (cursor && !isNull(cursor)) {
    const hit = cursor.getComponent(AgentInspectScript.getTypeName()) as AgentInspectScript | null
    if (hit) return hit
    cursor = cursor.getParent()
  }
  return null
}

/**
 * Spectacles-only AI preview interaction agent (Pinch / Hover / Poke / Drag /
 * Gesture / Release / Rotate / Wait).
 *
 * Requires AgentInspectScript on this SceneObject or any ancestor — that
 * script owns the broker and publisher; this one only adds interaction
 * handlers. Lens Studio's component-onAwake order is stable, so by the time
 * this script awakes the ancestor's publisher is initialized.
 */
@component
export class AgentInteractScript extends BaseScriptComponent {
  private interactionHandler?: InteractionHandler

  onAwake() {
    // Preview-only tooling — inert on device (see AgentInspectScript). Off-editor
    // the sibling AgentInspectScript never creates its publisher, and these
    // interaction handlers have no agent to drive them, so bail before touching it.
    if (!global.deviceInfoSystem.isEditor()) return

    // Walk up the scene-object chain looking for the sibling/ancestor that
    // owns the publisher. Lets users place AgentInteractScript on the same
    // SceneObject as AgentInspectScript OR as a child of it — both work.
    const inspect = findAgentInspectScript(this.sceneObject)
    if (!inspect || !inspect.publisher) {
      LOG.error(
        "AgentInspectScript not found on this SceneObject or any ancestor. " +
          "Add it on this SceneObject or on a parent before AgentInteractScript so the publisher is initialized."
      )
      return
    }

    // The publisher is typed against Inspect's narrow command/response union;
    // InteractionHandler subscribes to interaction-only types. The underlying
    // broker dispatches by `type` string at runtime, so widening the generics
    // at this boundary is safe.
    const widened = inspect.publisher as unknown as MessagePublisher<
      BaseMessage & InteractionCommand,
      BaseMessage & InteractionResponse
    >
    this.interactionHandler = new InteractionHandler(widened)
  }
}

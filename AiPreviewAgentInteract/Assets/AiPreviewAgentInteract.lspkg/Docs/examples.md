# AiPreviewAgentInteract examples

[← Agent usage index](../README.md)

## Use when

Read when you install the hand bridge by hand, build command payloads, or set up a scene
object for the agent to act on. Normally the CLAD tools install the bridge for you (see the
README).

## Manual install

1. Create a SceneObject (for example `AiPreviewAgent Handler`). Add a ScriptComponent with
   `AiPreviewAgentInspect.lspkg/AgentInspectScript.ts`, then a second one **below it** with
   `AiPreviewAgentInteract.lspkg/AgentInteractScript.ts`. There are no inputs to set.
2. Make sure the scene has the InteractionKit prefab (its `HandInteractor`s and
   `HandVisuals`), and that the Preview runs the SPECS device in Interactive mode.
3. Run the Preview and send a `Wait` with `durationMs: 0`. The reply is a `CommandSuccess`
   with the same `commandId` and `handState` both `free`.
4. Delete the object before you publish.

The CLAD tools reuse an existing Inspect + Interact pair on one object. In this package's
demo they drove the scene through it and added nothing.

## Typed command payloads

```ts
import {DragCommand, PinchCommand, WaitCommand} from "AiPreviewAgentInteract.lspkg/AgentMessages"

const pinch: PinchCommand = {type: "Pinch", commandId: "pinch-1", name: "Pinch target", hold: false}

const drag: DragCommand = {
  type: "Drag",
  commandId: "drag-1",
  name: "Drag target",
  worldPosition: {x: 22, y: 33, z: -125},
  durationMs: 800,
  hold: true
}

const settle: WaitCommand = {type: "Wait", commandId: "wait-1", durationMs: 300}
```

Building these values does not send them. The editor tools send commands over the Preview
bridge; the package has no device transport. After `drag` (hold) send a `Release` for
`"right"` before any other action with that hand.

## A target the agent can act on

Any SIK `Interactable` with a collider works. For a draggable object add
`InteractableManipulation` too. The package ships `InteractDemoTarget`
(`AiPreviewAgentInteract.lspkg/Example/InteractDemoTarget/InteractDemoTarget`), which the demo
prefab puts on its Pinch and Drag targets. It counts the triggers, hovers and drags that reach
the target, so the agent's actions are visible. Add it next to the `Interactable` and assign
`label`, or copy it. The shipped file:

```ts
import {Interactable} from "InteractionKit.lspkg/Components/Interaction/Interactable/Interactable"

/**
 * Demo target for AiPreviewAgentInteract: counts the SIK events that reach the
 * Interactable on this SceneObject and shows them on a label, so a Preview
 * agent's Pinch / Poke / Hover / Drag commands are visible in the scene.
 */
@component
export class InteractDemoTarget extends BaseScriptComponent {
  @input
  @hint("Text that shows the event counts")
  label: Text

  @input
  @hint("First line of the label, e.g. what to try on this target")
  title: string = "Pinch me"

  private triggers = 0
  private hovers = 0
  private drags = 0

  onAwake() {
    // SIK subscriptions bind in OnStartEvent, after the Interactable has awoken.
    this.createEvent("OnStartEvent").bind(() => this.subscribe())
  }

  private subscribe() {
    const interactable = this.sceneObject.getComponent(Interactable.getTypeName()) as Interactable | null
    if (!interactable) {
      print("InteractDemoTarget: no Interactable on " + this.sceneObject.name)
      return
    }
    interactable.onTriggerStart.add(() => {
      this.triggers++
      this.refresh()
    })
    interactable.onHoverEnter.add(() => {
      this.hovers++
      this.refresh()
    })
    interactable.onDragStart.add(() => {
      this.drags++
      this.refresh()
    })
    this.refresh()
  }

  private refresh() {
    if (!this.label) return
    this.label.text = `${this.title}\ntriggers ${this.triggers} · hovers ${this.hovers} · drags ${this.drags}`
  }
}
```

Set the Interactable's `targetingMode` to All (7) if the agent should Poke it (see
[troubleshooting](troubleshooting.md#poke-times-out)). Keep the object's `forward` (+Z)
pointing at the user: Pinch, Hover and Poke approach from that side.

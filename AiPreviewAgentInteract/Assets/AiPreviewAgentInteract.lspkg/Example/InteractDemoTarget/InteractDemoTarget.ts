import {Interactable} from "SpectaclesInteractionKit.lspkg/Components/Interaction/Interactable/Interactable"

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

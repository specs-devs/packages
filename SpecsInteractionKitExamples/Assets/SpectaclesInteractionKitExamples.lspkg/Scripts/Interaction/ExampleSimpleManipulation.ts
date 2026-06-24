/**
 * ExampleSimpleManipulation – wires hover / trigger events from up to 4
 * InteractableManipulation objects to a status text in an existing scene Frame.
 * On start the text reads "Try grabbing one object, or this bar".
 * Events update the text to:
 *   "Hover on [object name]"
 *   "Selected [object name]"
 *   "Release [object name]"
 */
import { Interactable } from "SpectaclesInteractionKit.lspkg/Components/Interaction/Interactable/Interactable"
import { Logger } from "Utilities.lspkg/Scripts/Utils/Logger"
import { bindStartEvent } from "SnapDecorators.lspkg/decorators"

const IDLE_MESSAGE = "Try grabbing one object, or this bar"

@component
export class ExampleSimpleManipulation extends BaseScriptComponent {

  @ui.label('<span style="color: #60A5FA;">ExampleSimpleManipulation – manipulation event display</span><br/><span style="color: #94A3B8; font-size: 11px;">Assign up to 4 scene objects that have InteractableManipulation, and drag the existing Text scene object into Status Text. On hover / grab / release the text updates with the event and object name.</span>')
  @ui.separator

  // ── Status Text ────────────────────────────────────────────────────────────
  @input("SceneObject")
  @hint("Scene object that has the Text component to update (inside the existing Frame)")
  statusTextObject: SceneObject

  // ── Manipulatable Objects ─────────────────────────────────────────────────
  @ui.separator
  @ui.group_start("Manipulatable Objects")
  @input("SceneObject")
  @hint("First scene object with InteractableManipulation + Interactable")
  @allowUndefined
  object0: SceneObject | null = null

  @input("SceneObject")
  @hint("Second scene object with InteractableManipulation + Interactable")
  @allowUndefined
  object1: SceneObject | null = null

  @input("SceneObject")
  @hint("Third scene object with InteractableManipulation + Interactable")
  @allowUndefined
  object2: SceneObject | null = null

  @input("SceneObject")
  @hint("Fourth scene object with InteractableManipulation + Interactable")
  @allowUndefined
  object3: SceneObject | null = null
  @ui.group_end

  // ── Logging ───────────────────────────────────────────────────────────────
  @ui.separator
  @ui.group_start("Logging")
  @input
  @hint("Enable event logging (hover, select, release)")
  enableLogging: boolean = false

  @input
  @hint("Enable lifecycle logging (onStart)")
  enableLoggingLifecycle: boolean = false
  @ui.group_end

  // ── Private state ─────────────────────────────────────────────────────────
  private statusText:  Text | null = null
  private logger:      Logger

  private hoveredSet  = new Set<string>()
  private grabbedName: string | null = null

  onAwake(): void {
    this.logger = new Logger("ExampleSimpleManipulation", this.enableLogging || this.enableLoggingLifecycle, true)
  }

  @bindStartEvent
  onStart(): void {
    if (this.enableLoggingLifecycle) this.logger.debug("LIFECYCLE: onStart()")

    if (this.statusTextObject) {
      this.statusText = this.statusTextObject.getComponent("Component.Text") as Text | null
      if (!this.statusText) this.logger.debug("No Text component found on statusTextObject")
    }

    this.setStatus(IDLE_MESSAGE)
    this.subscribeAll()
  }

  // ── Event wiring ──────────────────────────────────────────────────────────

  private subscribeAll(): void {
    const objects = [this.object0, this.object1, this.object2, this.object3]
    for (const so of objects) {
      if (!so) continue
      const interactable = so.getComponent(Interactable.getTypeName()) as Interactable | null
      if (!interactable) {
        this.logger.debug("No Interactable on: " + so.name)
        continue
      }
      this.wire(so.name, interactable)
    }
  }

  private wire(name: string, interactable: Interactable): void {
    interactable.onHoverEnter.add(() => {
      this.hoveredSet.add(name)
      if (!this.grabbedName) this.setStatus("Hover on " + name)
    })

    interactable.onHoverExit.add(() => {
      this.hoveredSet.delete(name)
      if (!this.grabbedName) {
        if (this.hoveredSet.size > 0) {
          const first = this.hoveredSet.values().next().value as string
          this.setStatus("Hover on " + first)
        } else {
          this.setStatus(IDLE_MESSAGE)
        }
      }
    })

    interactable.onTriggerStart.add(() => {
      this.grabbedName = name
      this.setStatus("Selected " + name)
    })

    interactable.onTriggerEnd.add(() => {
      if (this.grabbedName === name) this.grabbedName = null
      this.setStatus("Release " + name)
    })
  }

  private setStatus(text: string): void {
    if (this.statusText) this.statusText.text = text
    if (this.enableLogging) this.logger.debug("Status: " + text)
  }
}

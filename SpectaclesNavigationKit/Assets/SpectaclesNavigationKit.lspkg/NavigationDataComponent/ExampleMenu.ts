import {Interactable} from "SpectaclesInteractionKit.lspkg/Components/Interaction/Interactable/Interactable"
import {PinchButton} from "SpectaclesInteractionKit.lspkg/Components/UI/PinchButton/PinchButton"
import {NavigationDataComponent} from "./NavigationDataComponent"
import {Place} from "./Place"

/**
 * A very simple menu used to populate the example prefab.
 *
 * @version 1.0.0
 */
@component
export class ExampleMenu extends BaseScriptComponent {
  @input navigationComponent: NavigationDataComponent

  @input buttonA: PinchButton
  @input buttonAText: Text
  @input buttonB: PinchButton
  @input buttonBText: Text
  @input buttonC: PinchButton
  @input buttonCText: Text

  private onAwake(): void {
    this.createEvent("OnStartEvent").bind(() => this.start())
  }

  private start(): void {
    if (this.navigationComponent === null) {
      throw new Error("ExampleMenu: NavigationDataComponent input is not set.")
    }
    if (this.navigationComponent.places.length < 3) {
      throw new Error("The example scene has been modified, please remove this menu.")
    }

    const placeA = this.navigationComponent.places[0]
    this.buttonAText.text = placeA.name
    this.bindNavigateInput(this.buttonA, placeA, "A")

    const placeB = this.navigationComponent.places[1]
    this.buttonBText.text = placeB.name
    this.bindNavigateInput(this.buttonB, placeB, "B")

    const placeC = this.navigationComponent.places[2]
    this.buttonCText.text = placeC.name
    this.bindNavigateInput(this.buttonC, placeC, "C")
  }

  /**
   * Prefer PinchButton.onButtonPinched; fall back to Interactable.onTriggerEnd on the same object
   * (PinchButton relies on that path internally) when inputs are missing or API differs at runtime.
   */
  private bindNavigateInput(button: PinchButton, place: Place, label: string): void {
    if (button === null) {
      print(`ExampleMenu: PinchButton ${label} is not assigned in the Inspector.`)
      return
    }

    const go = () => {
      this.navigationComponent.navigateToPlace(place)
    }

    const pinched = (button as unknown as {onButtonPinched?: {add?: (cb: () => void) => unknown}}).onButtonPinched
    if (pinched !== undefined && typeof pinched.add === "function") {
      pinched.add(go)
      return
    }

    const interactable = button
      .getSceneObject()
      .getComponent(Interactable.getTypeName()) as Interactable | null
    if (interactable !== null && interactable.onTriggerEnd !== undefined) {
      const te = interactable.onTriggerEnd as {add?: (cb: () => void) => unknown}
      if (typeof te.add === "function") {
        te.add(go)
        return
      }
    }

    print(
      `ExampleMenu: could not subscribe to button ${label} (no onButtonPinched.add and no Interactable.onTriggerEnd). Assign PinchButton components wired in the example prefab.`,
    )
  }
}

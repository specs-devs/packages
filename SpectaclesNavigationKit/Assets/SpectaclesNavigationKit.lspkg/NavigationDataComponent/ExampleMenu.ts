import {PinchButton} from "SpectaclesInteractionKit.lspkg/Components/UI/PinchButton/PinchButton"
import {NavigationDataComponent} from "./NavigationDataComponent"

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
    if (this.navigationComponent.places.length < 3) {
      throw new Error("The example scene has been modified, please remove this menu.")
    }

    const placeA = this.navigationComponent.places[0]
    this.buttonAText.text = placeA.name
    this.buttonA.onButtonPinched.add(() => {
      this.navigationComponent.navigateToPlace(placeA)
    })

    const placeB = this.navigationComponent.places[1]
    this.buttonBText.text = placeB.name
    this.buttonB.onButtonPinched.add(() => {
      this.navigationComponent.navigateToPlace(placeB)
    })

    const placeC = this.navigationComponent.places[2]
    this.buttonCText.text = placeC.name
    this.buttonC.onButtonPinched.add(() => {
      this.navigationComponent.navigateToPlace(placeC)
    })
  }
}

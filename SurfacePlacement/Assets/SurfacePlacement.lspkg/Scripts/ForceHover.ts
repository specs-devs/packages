import { RoundButton } from "SpectaclesUIKit.lspkg/Scripts/Components/Button/RoundButton";
import { StateName } from "SpectaclesUIKit.lspkg/Scripts/Components/Element";
@component
export class ForceHover extends BaseScriptComponent {
  private roundButton: RoundButton = null;

  onAwake() {
    this.createEvent("OnStartEvent").bind(this.onStart.bind(this));
  }

  private onStart() {
    this.roundButton = this.getSceneObject().getComponent(
      RoundButton.getTypeName()
    );
  }

  onHoverEnter() {
    print("ForceHover onHoverEnter");
    this.roundButton.visual.setState(StateName.hovered);
  }

  onHoverExit() {
    print("ForceHover onHoverExit");
    this.roundButton.visual.setState(StateName.default);
  }
}

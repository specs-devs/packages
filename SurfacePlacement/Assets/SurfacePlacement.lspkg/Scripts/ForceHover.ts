/**
 * Specs Inc. 2026
 * Manual hover state controller for RoundButton components. Programmatically triggers hover enter/exit
 * states on button visual elements, bypasses normal interaction flow for forced state changes, enables
 * custom hover effects, and provides debug logging for hover event tracking during development.
 */
// Preload ThemeService before any UIKit visual to break a circular-import init-order
// crash in the package (Visual.ts imports ThemeService before defining COLORS, and the
// theme chain reads COLORS at module-load). Loading ThemeService first lets Visual.ts
// finish initializing COLORS before the visual chain reads it.
import "SpectaclesUIKit.lspkg/Scripts/Themes/ThemeService";
import { RoundButton } from "SpectaclesUIKit.lspkg/Scripts/Components/Button/RoundButton";
import { StateName } from "SpectaclesUIKit.lspkg/Scripts/Components/Element";
import { Logger } from "Utilities.lspkg/Scripts/Utils/Logger";
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

import "UIKit.lspkg/Scripts/Themes/ThemeService"
import {Button} from "UIKit.lspkg/Scripts/Components/Button/Button"
import {Slider} from "UIKit.lspkg/Scripts/Components/Slider/Slider"
import {Switch} from "UIKit.lspkg/Scripts/Components/Switch/Switch"
import {CrystalChain} from "./CrystalChain"

/**
 * Far-panel controls for the crystal chain showcase.
 *
 *   Follow speed slider  how tightly each crystal follows the one in front: full
 *                        speed keeps the line tight, low speed shows a clear lag
 *   Spacing slider       distance between crystals; the line re-forms as you slide
 *   Depth pull switch    InteractableManipulation's far-field "stretch": moving the
 *                        hand toward or away from you pulls the crystal in or pushes it out
 *   Regroup button       sends every crystal home; inactive until the chain has moved
 *
 * Sliders are followed through onKnobMoved, which fires on every frame the knob
 * moves, so changes show while you drag. (onValueChange only fires on release.)
 */
@component
export class ChainControls extends BaseScriptComponent {
  @input
  chain: CrystalChain

  @input
  followSpeedSlider: Slider

  @input
  spacingSlider: Slider

  @input
  depthPullSwitch: Switch

  @input
  regroupButton: Button

  onAwake(): void {
    this.createEvent("OnStartEvent").bind(() => this.onStart())
  }

  private onStart(): void {
    this.followSpeedSlider.onInitialized.add(() => this.applyFollowSpeed(this.followSpeedSlider.currentValue))
    this.followSpeedSlider.onKnobMoved.add((value) => this.applyFollowSpeed(value))

    this.spacingSlider.onInitialized.add(() => this.applySpacing(this.spacingSlider.currentValue))
    this.spacingSlider.onKnobMoved.add((value) => this.applySpacing(value))

    this.depthPullSwitch.onInitialized.add(() => this.applyDepthPull())
    this.depthPullSwitch.onFinished.add(() => this.applyDepthPull())

    // The Regroup button starts Inactive (set in the Inspector): nothing to regroup until
    // a crystal has been moved. Waking on the end of a grab too means a Regroup pressed
    // mid-grab (which the hand then undoes) can be pressed again.
    for (const crystal of this.chain.crystals) {
      crystal.onManipulationStart.add(() => (this.regroupButton.inactive = false))
      crystal.onManipulationEnd.add(() => (this.regroupButton.inactive = false))
    }
    this.regroupButton.onTriggerUp.add(() => this.regroup())
  }

  /** Sends every crystal home. */
  regroup(): void {
    this.chain.regroup()
    this.regroupButton.inactive = true
  }

  // Spring duration per crystal: 0.6 s at the slowest, 0.1 s (barely any spring) at full
  // speed. SpringAnimate steps at a fixed 1/120 s, and much shorter springs go unstable.
  private applyFollowSpeed(value: number): void {
    this.chain.setSpringDuration(MathUtils.lerp(0.6, 0.1, value))
  }

  private applySpacing(value: number): void {
    this.chain.spacing = MathUtils.lerp(4, 8, value)
    this.chain.layOut()
  }

  private applyDepthPull(): void {
    for (const crystal of this.chain.crystals) {
      crystal.enableStretchZ = this.depthPullSwitch.isOn
    }
  }
}

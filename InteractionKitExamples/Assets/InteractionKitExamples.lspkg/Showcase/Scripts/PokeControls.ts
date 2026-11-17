import "UIKit.lspkg/Scripts/Themes/ThemeService"
import {Interactable} from "InteractionKit.lspkg/Components/Interaction/Interactable/Interactable"
import {Slider} from "UIKit.lspkg/Scripts/Components/Slider/Slider"
import {Switch} from "UIKit.lspkg/Scripts/Components/Switch/Switch"
import {PokeShrink} from "./PokeShrink"

/**
 * Far-panel controls for the poke crystal showcase.
 *
 *   Shrink amount slider  how small the crystal gets while pressed
 *   Shrink speed slider   how quickly it shrinks and grows back
 *   Front only switch     on: only a poke from the front counts (poke directionality)
 *
 * Sliders are followed through onKnobMoved, which fires on every frame the knob
 * moves, so changes apply while you drag. (onValueChange only fires on release.)
 */
@component
export class PokeControls extends BaseScriptComponent {
  @input
  pokeShrink: PokeShrink

  @input
  crystal: Interactable

  @input
  shrinkAmountSlider: Slider

  @input
  shrinkSpeedSlider: Slider

  @input
  frontOnlySwitch: Switch

  onAwake(): void {
    this.createEvent("OnStartEvent").bind(() => this.onStart())
  }

  private onStart(): void {
    this.shrinkAmountSlider.onInitialized.add(() => this.applyShrinkAmount(this.shrinkAmountSlider.currentValue))
    this.shrinkAmountSlider.onKnobMoved.add((value) => this.applyShrinkAmount(value))

    this.shrinkSpeedSlider.onInitialized.add(() => this.applyShrinkSpeed(this.shrinkSpeedSlider.currentValue))
    this.shrinkSpeedSlider.onKnobMoved.add((value) => this.applyShrinkSpeed(value))

    this.frontOnlySwitch.onInitialized.add(() => this.applyFrontOnly())
    this.frontOnlySwitch.onFinished.add(() => this.applyFrontOnly())
  }

  // More shrink means a smaller pressed scale: 0 → 90% size, 1 → 30% size.
  private applyShrinkAmount(value: number): void {
    this.pokeShrink.pressedScale = MathUtils.lerp(0.9, 0.3, value)
  }

  // 0 → slow and soft (0.4 s spring), 1 → snappy (0.1 s; much shorter goes unstable).
  private applyShrinkSpeed(value: number): void {
    this.pokeShrink.setSpringDuration(MathUtils.lerp(0.4, 0.1, value))
  }

  private applyFrontOnly(): void {
    this.crystal.enablePokeDirectionality = this.frontOnlySwitch.isOn
  }
}

import "UIKit.lspkg/Scripts/Themes/ThemeService"
import {Button} from "UIKit.lspkg/Scripts/Components/Button/Button"
import {ColorSlider} from "UIKit.lspkg/Scripts/Components/Slider/ColorSlider"

/**
 * Near-panel colour controls for the showcases.
 *
 *   Hue slider     tints the crystals and the jellyfish
 *   Hold to reset  holding the button slides the hue back to where it started
 *
 * Each material's shader multiplies its final colour by a `tintColor` parameter.
 * The tint is the slider's colour, softened toward white so each material's own
 * shading still shows through. It fades in as the knob leaves its starting value,
 * so at the start everything keeps its own colours.
 *
 * The hue follows the knob (onKnobMoved and knobValue), so colours change while
 * you drag and glide back during a reset. onValueChange and currentValue only
 * update once the value is committed, on release.
 *
 * The hold is IK's own long press: the Interactable's secondary trigger, which
 * IK fires after a pinch or poke is held, and its cursor shows the hold filling
 * up. (IK only times the hold on an Interactable that has a listener on
 * onSecondaryTriggerStart.) The button is inactive while the hue is still at its
 * starting value, because there is nothing to reset.
 */

// How far the tint is blended toward white (0 = full slider colour).
const TINT_SOFTEN = 0.4
// How quickly the tint fades in as the hue leaves its start (1 / slider distance).
const TINT_FADE_IN = 8
// Hue span across the slider. A full 360 degrees would make both ends red, so the far
// end would look like the start. 330 keeps the ends distinct (red to rose pink).
const HUE_RANGE_DEGREES = 330

@component
export class ColorPanel extends BaseScriptComponent {
  @input
  hueSlider: ColorSlider

  @input
  resetButton: Button

  // Each material's shader needs a `tintColor` color parameter.
  @input
  materials: Material[] = []

  private startValue: number = 0

  onAwake(): void {
    this.createEvent("OnStartEvent").bind(() => this.onStart())
  }

  private onStart(): void {
    this.hueSlider.hueRangeDegrees = HUE_RANGE_DEGREES
    this.hueSlider.knobOverflow = false

    this.hueSlider.onInitialized.add(() => {
      this.startValue = this.hueSlider.currentValue
      this.applyHue()
    })
    this.hueSlider.onKnobMoved.add(() => this.applyHue())

    // The button's Interactable is created when the button initializes.
    this.resetButton.onInitialized.add(() => {
      this.resetButton.interactable.onSecondaryTriggerStart.add(() => {
        this.hueSlider.updateCurrentValue(this.startValue, true)
      })
    })
  }

  private applyHue(): void {
    const offset = this.hueSlider.knobValue - this.startValue
    const moved = Math.min(1, Math.abs(offset) * TINT_FADE_IN)
    const softened = vec4.lerp(this.hueSlider.selectedColor, vec4.one(), TINT_SOFTEN)
    const tint = vec4.lerp(vec4.one(), softened, moved)
    this.materials.forEach((material) => (material.mainPass.tintColor = tint))

    this.resetButton.inactive = Math.abs(offset) < 0.001
  }
}

import "UIKit.lspkg/Scripts/Themes/ThemeService"
import {Slider} from "UIKit.lspkg/Scripts/Components/Slider/Slider"
import {Switch} from "UIKit.lspkg/Scripts/Components/Switch/Switch"
import {PinchSpin} from "./PinchSpin"

/**
 * Far-panel controls for the pinch crystal showcase.
 *
 *   Pinch spin slider  how hard each pinch spins the crystal
 *   Idle turn switch   the slow turn between pinches
 *
 * The slider is followed through onKnobMoved, which fires on every frame the
 * knob moves, so changes apply while you drag. (onValueChange only fires on release.)
 */
@component
export class PinchControls extends BaseScriptComponent {
  @input
  pinchSpin: PinchSpin

  @input
  pinchSpinSlider: Slider

  @input
  idleTurnSwitch: Switch

  // PinchSpin's own idle speed, remembered so the switch can turn it back on.
  private idleSpeed: number = 0

  onAwake(): void {
    this.createEvent("OnStartEvent").bind(() => this.onStart())
  }

  private onStart(): void {
    this.idleSpeed = this.pinchSpin.idleSpeed

    this.pinchSpinSlider.onInitialized.add(() => this.applyPinchSpin(this.pinchSpinSlider.currentValue))
    this.pinchSpinSlider.onKnobMoved.add((value) => this.applyPinchSpin(value))

    this.idleTurnSwitch.onInitialized.add(() => this.applyIdleTurn())
    this.idleTurnSwitch.onFinished.add(() => this.applyIdleTurn())
  }

  // Each pinch adds 120 to 600 degrees per second: about half a turn to two and a half
  // turns before it dies away, at PinchSpin's default damping.
  private applyPinchSpin(value: number): void {
    this.pinchSpin.pinchBoost = MathUtils.lerp(120, 600, value)
  }

  private applyIdleTurn(): void {
    this.pinchSpin.idleSpeed = this.idleTurnSwitch.isOn ? this.idleSpeed : 0
  }
}

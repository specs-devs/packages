import "UIKit.lspkg/Scripts/Themes/ThemeService"
import {Button} from "UIKit.lspkg/Scripts/Components/Button/Button"
import {Slider} from "UIKit.lspkg/Scripts/Components/Slider/Slider"
import {Switch} from "UIKit.lspkg/Scripts/Components/Switch/Switch"
import {clamp, inverseLerp} from "InteractionKit.lspkg/Utils/mathUtils"
import {Physics as JellyPhysics} from "../Jellyfish/Scripts/physics"
import {ThrowOnRelease} from "./ThrowOnRelease"

/**
 * Far-panel controls for the jellyfish showcase.
 *
 *   Size slider     scales the jellyfish. Grabbing it with both hands scales it
 *                   too (Enable Scale on its InteractableManipulation), within
 *                   the same limits, and the slider follows along
 *   Throw switch    turns ThrowOnRelease on and off
 *   Reset button    puts the jellyfish back where it started; inactive until it has moved
 *
 * Each control is applied once when it finishes initializing (onInitialized
 * replays for late listeners), so the scene matches the panel from the start.
 * The slider is followed through onKnobMoved, which fires on every frame the
 * knob moves, so the jellyfish resizes while you drag. (onValueChange only
 * fires once the value is committed, on release.)
 */
@component
export class JellyfishControls extends BaseScriptComponent {
  @input
  jellyfish: SceneObject

  @input
  throwOnRelease: ThrowOnRelease

  // The tentacle simulation. Aliased as JellyPhysics because Physics is a Lens Studio global.
  @input
  tentaclePhysics: JellyPhysics

  @input
  sizeSlider: Slider

  @input
  throwSwitch: Switch

  @input
  resetButton: Button

  // The slider's 0..1 range maps onto these scales. 0.35 is the connected
  // tutorial's full-size jellyfish, so the slider starts there.
  @input
  minScale: number = 0.2

  @input
  maxScale: number = 0.6

  private homePosition: vec3 = vec3.zero()
  private homeRotation: quat = quat.quatIdentity()

  onAwake(): void {
    this.createEvent("OnStartEvent").bind(() => this.onStart())
  }

  private onStart(): void {
    const transform = this.jellyfish.getTransform()
    this.homePosition = transform.getLocalPosition()
    this.homeRotation = transform.getLocalRotation()
    // Read before the slider applies its first size.
    const authoredScale = transform.getLocalScale().x

    this.sizeSlider.onInitialized.add(() => this.applySize(this.sizeSlider.currentValue))
    this.sizeSlider.onKnobMoved.add((value) => this.applySize(value))

    // Two-handed scaling gets the slider's limits. IK sets its limits as factors of the
    // scale the jellyfish was authored at, so convert them.
    const manipulation = this.throwOnRelease.manipulation
    manipulation.minimumScaleFactor = this.minScale / authoredScale
    manipulation.maximumScaleFactor = this.maxScale / authoredScale
    manipulation.onScaleUpdate.add(() => {
      const value = inverseLerp(this.minScale, this.maxScale, transform.getLocalScale().x)
      this.sizeSlider.currentValue = clamp(value, 0, 1)
    })

    this.throwSwitch.onInitialized.add(() => this.applyThrow())
    this.throwSwitch.onFinished.add(() => this.applyThrow())

    // The Reset button starts Inactive (set in the Inspector): nothing to reset until the
    // jellyfish has been grabbed. Waking on the end of a grab too means a Reset pressed
    // mid-grab (which the hand then undoes) can be pressed again.
    manipulation.onManipulationStart.add(() => (this.resetButton.inactive = false))
    manipulation.onManipulationEnd.add(() => (this.resetButton.inactive = false))
    this.resetButton.onTriggerUp.add(() => this.reset())
  }

  /** Puts the jellyfish back where it started. */
  reset(): void {
    // Stop any throw still gliding, or it would carry the jellyfish off again.
    this.throwOnRelease.stop()
    const transform = this.jellyfish.getTransform()
    transform.setLocalPosition(this.homePosition)
    transform.setLocalRotation(this.homeRotation)
    // Without this the tentacles swing across to catch up with the jump.
    this.tentaclePhysics.reset()
    this.resetButton.inactive = true
  }

  private applySize(value: number): void {
    const scale = MathUtils.lerp(this.minScale, this.maxScale, value)
    this.jellyfish.getTransform().setLocalScale(vec3.one().uniformScale(scale))
  }

  private applyThrow(): void {
    // Turning throwing off also ends a glide in progress, so it can't resume later.
    if (!this.throwSwitch.isOn) {
      this.throwOnRelease.stop()
    }
    this.throwOnRelease.enabled = this.throwSwitch.isOn
  }
}

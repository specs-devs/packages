import {Interactable} from "InteractionKit.lspkg/Components/Interaction/Interactable/Interactable"
import {SpringAnimate1D} from "InteractionKit.lspkg/Utils/springAnimate"

// When the scale factor counts as settled. The factor is a fraction of the resting scale,
// and IK's default thresholds (0.1) would stop the spring 10% short of its target.
const SETTLED_DISTANCE = 0.001
const SETTLED_SPEED = 0.01

/**
 * Shrinks an object while it is poked and lets it grow back when the finger leaves.
 *
 * Set the Interactable's Targeting Mode to Poke so only a fingertip press
 * triggers it. Only the visual shrinks: the collider stays full size, so the
 * press doesn't end just because the object got smaller under the finger.
 * Trigger start begins the press; trigger end, end-outside and cancel all
 * release it, so the object never gets stuck small. The scale follows on IK's
 * SpringAnimate1D, and the update only runs while the scale is still moving.
 */
@component
export class PokeShrink extends BaseScriptComponent {
  @input
  interactable: Interactable

  // The mesh object to shrink (a child of the Interactable, not the Interactable itself).
  @input
  visual: SceneObject

  // Scale while pressed, as a fraction of the resting scale.
  @input
  @widget(new SliderWidget(0.1, 1, 0.01))
  pressedScale: number = 0.6

  // How long the scale's spring takes to settle, in seconds.
  @input
  springDuration: number = 0.2

  private restScale: vec3 = vec3.one()
  private targetFactor: number = 1
  private currentFactor: number = 1
  // Created up front: PokeControls can set the duration before this object wakes,
  // when its showcase starts disabled.
  private spring = SpringAnimate1D.smooth()
  private updateEvent: UpdateEvent

  onAwake(): void {
    this.spring.setDurationSmooth(this.springDuration)
    this.createEvent("OnStartEvent").bind(() => this.onStart())
    this.updateEvent = this.createEvent("UpdateEvent")
    this.updateEvent.bind(() => this.onUpdate())
    this.updateEvent.enabled = false
  }

  private onStart(): void {
    this.restScale = this.visual.getTransform().getLocalScale()

    this.interactable.onTriggerStart.add(() => this.shrinkTo(this.pressedScale))
    this.interactable.onTriggerEnd.add(() => this.shrinkTo(1))
    this.interactable.onTriggerEndOutside.add(() => this.shrinkTo(1))
    this.interactable.onTriggerCanceled.add(() => this.shrinkTo(1))
  }

  /** Changes how long the shrink and grow take to settle, in seconds. */
  setSpringDuration(duration: number): void {
    this.springDuration = duration
    this.spring.setDurationSmooth(duration)
  }

  private shrinkTo(factor: number): void {
    this.targetFactor = factor
    this.updateEvent.enabled = true
  }

  private onUpdate(): void {
    this.currentFactor = this.spring.evaluate(this.currentFactor, this.targetFactor)
    if (this.spring.isSettled(this.currentFactor, this.targetFactor, SETTLED_DISTANCE, SETTLED_SPEED)) {
      this.currentFactor = this.targetFactor
      this.updateEvent.enabled = false
    }
    this.visual.getTransform().setLocalScale(this.restScale.uniformScale(this.currentFactor))
  }
}

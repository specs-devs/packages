import {Interactable} from "InteractionKit.lspkg/Components/Interaction/Interactable/Interactable"
import {SpringAnimate1D} from "InteractionKit.lspkg/Utils/springAnimate"

// When the scale factor counts as settled. The factor is a fraction of the resting scale,
// so IK's default thresholds (0.1) would stop the spring 10% short of its target.
const SETTLED_DISTANCE = 0.001
const SETTLED_SPEED = 0.01

/**
 * Grows an object slightly while a hand is within pinching reach, so you can tell
 * it is ready before you commit to the pinch.
 *
 * Set the Interactable's Targeting Mode to Direct, so that hover means a hand is
 * within pinching reach. The object stays grown through the pinch and settles back
 * once the hand has left and the pinch is released.
 *
 * The scale follows IK's SpringAnimate1D, and the update only runs while it is still
 * moving. The collider scales with the object, which widens the hover zone and stops
 * the object flickering when a hand hovers at its edge.
 */
@component
export class PinchGrow extends BaseScriptComponent {
  @input
  interactable: Interactable

  // Scale while hovered or pinched, as a fraction of the resting scale.
  @input
  @widget(new SliderWidget(1, 1.5, 0.01))
  hoverScale: number = 1.1

  // How long the scale's spring takes to settle, in seconds.
  @input
  springDuration: number = 0.15

  private restScale: vec3 = vec3.one()
  private targetFactor: number = 1
  private currentFactor: number = 1
  private hovered: boolean = false
  private pinched: boolean = false
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
    this.restScale = this.getTransform().getLocalScale()

    this.interactable.onHoverEnter.add(() => this.setState({hovered: true}))
    this.interactable.onHoverExit.add(() => this.setState({hovered: false}))
    this.interactable.onTriggerStart.add(() => this.setState({pinched: true}))
    this.interactable.onTriggerEnd.add(() => this.setState({pinched: false}))
    this.interactable.onTriggerEndOutside.add(() => this.setState({pinched: false}))
    this.interactable.onTriggerCanceled.add(() => this.setState({pinched: false}))
  }

  // Hover can end while the pinch is still held, so grown means hovered or pinched.
  private setState(state: {hovered?: boolean; pinched?: boolean}): void {
    this.hovered = state.hovered ?? this.hovered
    this.pinched = state.pinched ?? this.pinched
    this.targetFactor = this.hovered || this.pinched ? this.hoverScale : 1
    this.updateEvent.enabled = true
  }

  private onUpdate(): void {
    this.currentFactor = this.spring.evaluate(this.currentFactor, this.targetFactor)
    if (this.spring.isSettled(this.currentFactor, this.targetFactor, SETTLED_DISTANCE, SETTLED_SPEED)) {
      this.currentFactor = this.targetFactor
      this.updateEvent.enabled = false
    }
    this.getTransform().setLocalScale(this.restScale.uniformScale(this.currentFactor))
  }
}

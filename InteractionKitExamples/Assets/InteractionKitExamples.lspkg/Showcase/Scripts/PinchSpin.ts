import {Interactable} from "InteractionKit.lspkg/Components/Interaction/Interactable/Interactable"

// How many pinches' worth of spin can stack up.
const MAX_BURSTS = 2

/**
 * Turns slowly on its own and spins up each time it is pinched.
 *
 * Every pinch adds a burst of spin that dies away exponentially, the way a
 * flicked object coasts to a stop:
 *   extra speed = pinchBoost * e^(-spinDamping * t)
 * Pinch again while it is still spinning and the bursts add up, to at most
 * MAX_BURSTS pinches' worth.
 */

@component
export class PinchSpin extends BaseScriptComponent {
  @input
  interactable: Interactable

  // Resting turn speed, degrees per second.
  @input
  idleSpeed: number = 20

  // Extra degrees per second added by each pinch.
  @input
  pinchBoost: number = 120

  // How quickly the extra spin dies away, per second.
  @input
  spinDamping: number = 0.7

  private baseRotation: quat = quat.quatIdentity()
  private angle: number = 0
  private boost: number = 0

  onAwake(): void {
    this.createEvent("OnStartEvent").bind(() => this.onStart())
    this.createEvent("UpdateEvent").bind(() => this.onUpdate())
  }

  private onStart(): void {
    this.baseRotation = this.getTransform().getLocalRotation()
    this.interactable.onTriggerStart.add(() => {
      this.boost = Math.min(this.boost + this.pinchBoost, MAX_BURSTS * this.pinchBoost)
    })
  }

  private onUpdate(): void {
    const dt = getDeltaTime()
    this.boost *= Math.exp(-this.spinDamping * dt)

    this.angle = (this.angle + (this.idleSpeed + this.boost) * dt) % 360

    const spin = quat.angleAxis(this.angle * MathUtils.DegToRad, vec3.up())
    this.getTransform().setLocalRotation(this.baseRotation.multiply(spin))
  }
}

import {InteractableManipulation} from "InteractionKit.lspkg/Components/Interaction/InteractableManipulation/InteractableManipulation"

// Seconds of motion before the release that give the throw velocity.
const VELOCITY_WINDOW = 0.1
// Speeds in cm/s. Slower than MIN is a plain let-go; faster than MAX is capped.
const MIN_THROW_SPEED = 8
const MAX_THROW_SPEED = 120
// Below this speed (cm/s) the glide is finished.
const STOP_SPEED = 0.5

type Sample = {position: vec3; time: number}

/**
 * Lets go of a manipulated object with a throw: the object glides on in the direction
 * of the hand and eases to a stop.
 *
 * Not physics. It works in three steps:
 *  1. While held, remember where the object has been for the last VELOCITY_WINDOW seconds.
 *  2. On release, turn that into a velocity.
 *  3. Each frame after, move along it, slowing exponentially:
 *       position = start + velocity * (1 - e^(-damping * t)) / damping
 *     so the object travels about (speed / damping) cm in total.
 *
 * It listens to InteractableManipulation rather than the Interactable's triggers:
 * manipulation start and end cover every way a grab can begin and finish
 * (released on the object, released off it, or interrupted).
 * InteractableManipulation moves the object while it is held; this script only
 * moves it after release, and stops as soon as the object is grabbed again.
 */
@component
export class ThrowOnRelease extends BaseScriptComponent {
  @input
  manipulation: InteractableManipulation

  // The object InteractableManipulation moves (its own object by default).
  @input
  throwRoot: SceneObject

  // How quickly the glide slows, per second. Higher stops sooner.
  @input
  damping: number = 2

  private samples: Sample[] = []
  private isHeld: boolean = false
  private isGliding: boolean = false
  private glideStart: vec3 = vec3.zero()
  private glideVelocity: vec3 = vec3.zero()
  private glideTime: number = 0

  onAwake(): void {
    this.createEvent("OnStartEvent").bind(() => this.onStart())
    this.createEvent("UpdateEvent").bind(() => this.onUpdate())
  }

  /** Cancels a glide in progress, e.g. before the object is moved back home. */
  stop(): void {
    this.isGliding = false
  }

  private onStart(): void {
    this.manipulation.onManipulationStart.add(() => {
      this.isHeld = true
      this.isGliding = false
      this.samples = []
    })
    this.manipulation.onManipulationEnd.add(() => this.release())
  }

  private onUpdate(): void {
    if (this.isHeld) {
      this.recordPosition()
    } else if (this.isGliding) {
      this.glide()
    }
  }

  private recordPosition(): void {
    const now = getTime()
    this.samples.push({position: this.throwRoot.getTransform().getWorldPosition(), time: now})
    // Keep one sample from before the window so the window is always fully covered.
    while (this.samples.length > 2 && now - this.samples[1].time >= VELOCITY_WINDOW) {
      this.samples.shift()
    }
  }

  private release(): void {
    this.isHeld = false
    // With throwing switched off, letting go just leaves the object where it is.
    if (!this.enabled) {
      return
    }

    const velocity = this.releaseVelocity()
    if (velocity.length === 0) {
      return
    }
    this.glideStart = this.throwRoot.getTransform().getWorldPosition()
    this.glideVelocity = velocity
    this.glideTime = 0
    this.isGliding = true
  }

  private releaseVelocity(): vec3 {
    if (this.samples.length < 2) {
      return vec3.zero()
    }
    const first = this.samples[0]
    const last = this.samples[this.samples.length - 1]
    const elapsed = last.time - first.time
    if (elapsed < 0.0001) {
      return vec3.zero()
    }

    const velocity = last.position.sub(first.position).uniformScale(1 / elapsed)
    const speed = velocity.length
    if (speed < MIN_THROW_SPEED) {
      return vec3.zero()
    }
    return speed > MAX_THROW_SPEED ? velocity.uniformScale(MAX_THROW_SPEED / speed) : velocity
  }

  private glide(): void {
    this.glideTime += getDeltaTime()

    const travelled = (1 - Math.exp(-this.damping * this.glideTime)) / this.damping
    this.throwRoot.getTransform().setWorldPosition(this.glideStart.add(this.glideVelocity.uniformScale(travelled)))

    const currentSpeed = this.glideVelocity.length * Math.exp(-this.damping * this.glideTime)
    if (currentSpeed < STOP_SPEED) {
      this.isGliding = false
    }
  }
}

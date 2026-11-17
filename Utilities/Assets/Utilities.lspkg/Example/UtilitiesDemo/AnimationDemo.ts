import {AnimationUtils} from "Utilities.lspkg/Scripts/Utils/AnimationUtils"
import {MathUtils} from "Utilities.lspkg/Scripts/Utils/MathUtils"
import {MeshUtils} from "Utilities.lspkg/Scripts/Utils/MeshUtils"
import {ACCENT_COLOR, createChild, createPanelText, GREEN_COLOR, WARM_COLOR} from "./DemoText"

const TWEEN_DURATION = 1.5
const PULSE_DURATION = 0.6

/**
 * Utilities demo 3: AnimationUtils. A disc slides with makeTween + easeOutElastic, a second one
 * pulses with animateVisualFeedback (fade = scale 0 ↔ 1), a third scales with pingPong.
 * Every animation restarts when it ends.
 */
@component
export class AnimationDemo extends BaseScriptComponent {
  @input
  @hint("Unlit material the discs are drawn with (cloned per disc)")
  material: Material

  private slider: SceneObject | null = null
  private pulse: SceneObject | null = null
  private breathing: SceneObject | null = null
  private status: Text | null = null
  private tweens = 0
  private pulses = 0
  private cancelTween: (() => void) | null = null
  private running = false
  // Bumped on every start so callbacks of animations from an earlier run don't chain again.
  private run = 0

  onAwake(): void {
    this.createEvent("OnStartEvent").bind(() => this.build())
    this.createEvent("UpdateEvent").bind(() => this.updateBreathing())
    this.createEvent("OnEnableEvent").bind(() => this.start())
    this.createEvent("OnDisableEvent").bind(() => this.stop())
  }

  private build(): void {
    this.slider = this.disc("Slider", new vec3(0, 9, 0), ACCENT_COLOR)
    this.pulse = this.disc("Pulse", new vec3(-12, -3, 0), WARM_COLOR)
    this.breathing = this.disc("PingPong", new vec3(12, -3, 0), GREEN_COLOR)

    const easings = AnimationUtils.getAllEasings()
    const info = createPanelText(this.sceneObject, "Info", new vec3(0, -13, 0), 44, 44, 4)
    info.text =
      `${easings.length} easings · getEasingId("Cubic Out") = ${AnimationUtils.getEasingId("Cubic Out")} · ` +
      `getEasingName(29) = "${AnimationUtils.getEasingName(29)}"`
    this.status = createPanelText(this.sceneObject, "Status", new vec3(0, -18.5, 0), 46, 44, 3)
    this.status.textFill.color = ACCENT_COLOR
    this.start()
  }

  private disc(name: string, position: vec3, color: vec4): SceneObject {
    const object = createChild(this.sceneObject, name, position)
    const material = this.material.clone()
    material.mainPass.baseColor = color
    MeshUtils.addRenderMeshVisual(object, MeshUtils.makeCircle2DMesh(vec3.zero(), 3), material, 0)
    return object
  }

  private start(): void {
    if (this.running || !this.slider) {
      return
    }
    this.running = true
    this.run++
    this.slide()
    this.pulseOnce(true, this.run)
  }

  private stop(): void {
    this.running = false
    this.cancelTween?.()
    this.cancelTween = null
  }

  private slide(): void {
    if (!this.running) {
      return
    }
    const slider = this.slider.getTransform()
    this.cancelTween = AnimationUtils.makeTween((t) => {
      slider.setLocalPosition(new vec3(MathUtils.lerp(-15, 15, MathUtils.easeOutElastic(t)), 9, 0))
      if (t >= 1) {
        this.tweens++
        this.updateStatus()
        this.slide()
      }
    }, TWEEN_DURATION)
  }

  private pulseOnce(fadeIn: boolean, run: number): void {
    if (!this.running || run !== this.run) {
      return
    }
    AnimationUtils.animateVisualFeedback(this.pulse, fadeIn, PULSE_DURATION, () => {
      this.pulses++
      this.updateStatus()
      this.pulseOnce(!fadeIn, run)
    })
  }

  private updateBreathing(): void {
    if (!this.breathing) {
      return
    }
    const t = (getTime() % 2) / 2
    this.breathing.getTransform().setLocalScale(vec3.one().uniformScale(AnimationUtils.pingPong(0.4, 1.2, t)))
  }

  private updateStatus(): void {
    if (this.status) {
      this.status.text = `Tweens finished: ${this.tweens} · feedback animations finished: ${this.pulses}`
    }
  }
}

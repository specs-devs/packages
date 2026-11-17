/**
 * Example only: an AI-assistant style orb — a core ball and two satellites that breathe together when idle
 * and fly apart, faster, as the intensity rises (thinking / talking). Port of the Specs AI assistant orb
 * (SnapLab/specs-ai-proto-staging, Blob.lspkg HandOrbs.ts) onto MetaballField. Drag the slider, or press
 * Excite for a two-second burst.
 */
import {MetaballField} from "../../Scripts/MetaballField"
import {MetaballSource} from "../../Scripts/MetaballSource"
import {BODY_SIZE, createButton, createPanel, createSlider, createText, TITLE_SIZE} from "../Shared/DemoUI"

@component
export class AssistantOrb extends BaseScriptComponent {
  @input
  @hint("Field the orb belongs to")
  field: MetaballField

  @input
  @hint("Overall orb size (cm per orb unit; 90 gives a ~13 cm core)")
  orbSize: number = 90

  @input
  @hint("1 = calm idle, higher = more chaotic")
  @widget(new SliderWidget(0, 5, 0.01))
  intensity: number = 1

  @input
  @hint("Base animation speed")
  animationSpeed: number = 1.5

  @input
  @hint("Show the control panel")
  showPanel: boolean = true

  @input
  @hint("Panel position relative to this object (cm)")
  panelOffset: vec3 = new vec3(24, 0, 0)

  private core: MetaballSource
  private a: MetaballSource
  private b: MetaballSource
  private current = 1
  private burstUntil = -1
  private timeAccumulator = 0
  private turbo = 0
  private seed = Math.random() * 456

  onAwake(): void {
    this.core = this.createBall("Core")
    this.a = this.createBall("SatelliteA")
    this.b = this.createBall("SatelliteB")
    this.current = this.intensity
    this.createEvent("OnStartEvent").bind(() => {
      if (this.showPanel) {
        this.buildPanel()
      }
    })
    this.createEvent("UpdateEvent").bind(() => this.update())
  }

  /** Short excited burst, like the orb reacting to speech. */
  excite(seconds: number = 2): void {
    this.burstUntil = getTime() + seconds
  }

  private createBall(name: string): MetaballSource {
    const o = global.scene.createSceneObject(name)
    o.setParent(this.sceneObject)
    const source = o.createComponent(MetaballSource.getTypeName()) as MetaballSource
    source.field = this.field
    return source
  }

  private buildPanel(): void {
    createPanel(this.sceneObject, "OrbPanel", this.panelOffset, new vec2(26, 17), (content) => {
      createText(content, "Title", new vec3(0, 6, 0.5), TITLE_SIZE, 24, 3.5, "Assistant Orb")
      createText(content, "Hint", new vec3(0, 2.6, 0.5), BODY_SIZE * 0.8, 24, 3, "1 = idle · 3+ = thinking · 5 = chaos")
      createSlider(content, "Intensity", new vec3(0, -2, 0.5), 22, "Intensity", 0, 5, this.intensity, (v) => (this.intensity = v))
      createButton(content, "Excite", new vec3(0, -6.2, 0.5), 12, "Excite", () => this.excite())
    })
  }

  private update(): void {
    const dt = Math.min(getDeltaTime(), 0.05)
    const target = getTime() < this.burstUntil ? Math.max(this.intensity, 4) : this.intensity
    this.current = MathUtils.lerp(this.current, target, Math.min(1, dt * 5))
    const f = this.current
    const speed = this.animationSpeed * (1 + Math.max(0, f - 1) * 0.5)
    this.timeAccumulator += dt * speed
    if (f > 0.95) {
      this.turbo += dt * 2 * MathUtils.clamp((f - 0.95) / (3 - 0.95), 0, 1)
    }
    const t = this.timeAccumulator + this.turbo
    const s = this.orbSize
    const seed = this.seed

    // Satellite paths from the original orb (units are orb units, scaled by orbSize).
    const ax = Math.sin(t * 0.5 + seed * 0.23) * 0.1 * f
    const ay = Math.sin(t * 0.4 + seed * 0.12) * 0.17 * f
    const az = Math.sin(t * 0.3 + seed * 0.43) * 0.14 * f
    const bx = Math.sin(t * -0.4 + seed * 0.23) * 0.19 * f
    const by = Math.sin(t * 0.7 + seed * 0.12) * 0.14 * f
    const bz = Math.sin(t * -0.33 + seed * 0.43) * 0.1 * f
    // Calm: the pair is pulled to the centre (as in the original orb); excited: they roam freely.
    const centering = MathUtils.clamp(1 - (f - 1) / 2, 0, 1)
    const cx = (ax + bx) * 0.5 * centering
    const cy = (ay + by) * 0.5 * centering
    const cz = (az + bz) * 0.5 * centering

    const pulse = 0.025 * Math.sin(getTime() * 0.1 + seed)
    this.core.getTransform().setLocalPosition(vec3.zero())
    this.core.radius = (0.07 + pulse) * s
    this.a.getTransform().setLocalPosition(new vec3(ax - cx, ay - cy, az - cz).uniformScale(s))
    this.a.radius = 0.05 * s
    this.b.getTransform().setLocalPosition(new vec3(-(bx - cx), -(by - cy), -(bz - cz)).uniformScale(s))
    this.b.radius = 0.04 * s

    if (this.field) {
      // Brighter and gooier as it gets excited.
      this.field.intensity = 0.85 + 0.12 * Math.min(f, 4)
      this.field.smoothness = 0.35 + 0.05 * Math.min(f, 4)
    }
  }
}

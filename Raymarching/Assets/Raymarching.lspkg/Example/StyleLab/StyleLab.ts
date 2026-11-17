/**
 * Example only: four balls slowly orbiting each other, with a panel to try every look — Previous / Next
 * preset, and sliders for smoothness, wobble and intensity. Changing preset moves the sliders to the
 * preset's values; the sliders then override it live.
 */
import {MetaballField} from "../../Scripts/MetaballField"
import {findPreset, PRESET_NAMES} from "../../Scripts/MetaballPresets"
import {MetaballSource} from "../../Scripts/MetaballSource"
import {BODY_SIZE, createButton, createPanel, createSlider, createText, TITLE_SIZE} from "../Shared/DemoUI"

@component
export class StyleLab extends BaseScriptComponent {
  @input
  @hint("Field to style")
  field: MetaballField

  @input
  @hint("Ball radius (cm)")
  radius: number = 3.4

  @input
  @hint("Orbit radius (cm)")
  orbitRadius: number = 6

  @input
  @hint("Panel position relative to this object (cm)")
  panelOffset: vec3 = new vec3(26, 0, 0)

  private balls: MetaballSource[] = []
  private presetIndex = 0
  private presetLabel: Text | null = null
  private setSmoothness: ((v: number) => void) | null = null
  private setWobble: ((v: number) => void) | null = null
  private setIntensity: ((v: number) => void) | null = null

  onAwake(): void {
    for (let i = 0; i < 4; i++) {
      const o = global.scene.createSceneObject("Ball" + i)
      o.setParent(this.sceneObject)
      const source = o.createComponent(MetaballSource.getTypeName()) as MetaballSource
      source.field = this.field
      source.radius = this.radius * (i === 0 ? 1.2 : 0.85)
      this.balls.push(source)
    }
    this.createEvent("OnStartEvent").bind(() => {
      if (this.field) {
        const i = PRESET_NAMES.indexOf(this.field.preset)
        this.presetIndex = i >= 0 ? i : 0
      }
      this.buildPanel()
    })
    this.createEvent("UpdateEvent").bind(() => this.update())
  }

  private buildPanel(): void {
    createPanel(this.sceneObject, "StylePanel", this.panelOffset, new vec2(28, 27), (content) => {
      createText(content, "Title", new vec3(0, 11, 0.5), TITLE_SIZE, 26, 3.5, "Style Lab")
      createButton(content, "Previous", new vec3(-9.5, 6.5, 0.5), 7, "Prev", () => this.step(-1))
      this.presetLabel = createText(content, "Preset", new vec3(0, 6.5, 0.5), BODY_SIZE, 11, 4, PRESET_NAMES[this.presetIndex])
      createButton(content, "Next", new vec3(9.5, 6.5, 0.5), 7, "Next", () => this.step(1))
      const p = findPreset(PRESET_NAMES[this.presetIndex])
      this.setSmoothness = createSlider(content, "Smoothness", new vec3(0, 1, 0.5), 24, "Smoothness", 0, 1, p.smoothness, (v) => {
        if (this.field) this.field.smoothness = v
      })
      this.setWobble = createSlider(content, "Wobble", new vec3(0, -5, 0.5), 24, "Wobble", 0, 2, p.wobble, (v) => {
        if (this.field) this.field.wobble = v
      })
      this.setIntensity = createSlider(content, "Intensity", new vec3(0, -11, 0.5), 24, "Intensity", 0, 2, p.intensity, (v) => {
        if (this.field) this.field.intensity = v
      })
    })
  }

  private step(delta: number): void {
    this.presetIndex = (this.presetIndex + delta + PRESET_NAMES.length) % PRESET_NAMES.length
    if (!this.field) {
      return
    }
    const p = this.field.setPreset(PRESET_NAMES[this.presetIndex])
    if (this.presetLabel) this.presetLabel.text = p.name
    if (this.setSmoothness) this.setSmoothness(p.smoothness)
    if (this.setWobble) this.setWobble(p.wobble)
    if (this.setIntensity) this.setIntensity(p.intensity)
  }

  private update(): void {
    const t = getTime()
    for (let i = 0; i < this.balls.length; i++) {
      if (i === 0) {
        this.balls[i].getTransform().setLocalPosition(new vec3(0, Math.sin(t * 0.8) * 1.2, 0))
        continue
      }
      const a = t * (0.35 + 0.12 * i) + (i * Math.PI * 2) / 3
      const r = this.orbitRadius * (0.85 + 0.25 * Math.sin(t * 0.5 + i))
      this.balls[i].getTransform().setLocalPosition(new vec3(Math.cos(a) * r, Math.sin(a * 1.4 + i) * r * 0.45, Math.sin(a) * r * 0.6))
    }
  }
}

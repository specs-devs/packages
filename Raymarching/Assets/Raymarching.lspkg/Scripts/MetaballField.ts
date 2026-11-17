/**
 * MetaballField renders up to 8 MetaballSources as one raymarched, smoothly merging surface.
 *
 * It owns a child "MetaballVolume" with a proxy sphere mesh and its own copy of the MetaballField material.
 * Every frame (LateUpdate, after the sources moved) it fits the volume around the active balls, converts
 * each ball to the volume's object space and writes the material parameters. The shader only marches inside
 * that volume, so a tight fit keeps the cost low.
 *
 * Sizes are in cm. `smoothness` is relative to the mean ball radius (0 = hard spheres, 1 = very gooey), so
 * the look doesn't change when the balls spread out and the volume grows.
 */
import {findPreset, MetaballPreset, PRESET_NAMES} from "./MetaballPresets"
import {MetaballSource} from "./MetaballSource"

export const MAX_BALLS = 8

/** Fraction of the proxy mesh radius that the content is fitted into (the mesh is a polygon). */
const MESH_FILL = 0.95

@component
export class MetaballField extends BaseScriptComponent {
  private static readonly fields: MetaballField[] = []

  @input
  @allowUndefined
  @hint("The MetaballField material (Shaders/MetaballField.graphShader). Each field uses its own copy")
  material: Material

  @input
  @allowUndefined
  @hint("Proxy sphere mesh the field is raymarched inside (Meshes/UnitSphere)")
  proxyMesh: RenderMesh

  @input
  @hint("Look applied on start")
  @widget(
    new ComboBoxWidget([
      new ComboBoxItem("Bubblegum", "Bubblegum"),
      new ComboBoxItem("Liquid Chrome", "Liquid Chrome"),
      new ComboBoxItem("Neon Plasma", "Neon Plasma"),
      new ComboBoxItem("Lava", "Lava")
    ])
  )
  preset: string = "Bubblegum"

  @input
  @hint("Override the preset's smoothness with the value below")
  overrideSmoothness: boolean = false

  @input
  @showIf("overrideSmoothness")
  @widget(new SliderWidget(0, 1, 0.01))
  smoothnessOverride: number = 0.35

  @input
  @hint("Extra room around the balls, in cm, so the gooey bridges are never clipped")
  fitMargin: number = 1.5

  @input
  @hint("Render order of the volume")
  renderOrder: number = 0

  private sources: MetaballSource[] = []
  private volume: SceneObject
  private volumeTransform: Transform
  private visual: RenderMeshVisual
  private pass: Pass
  private meshRadius = 1
  private warnedOverflow = false
  private initialized = false

  private _smoothness = 0.35
  private _wobble = 0
  private _intensity = 1

  onAwake(): void {
    MetaballField.fields.push(this)
    this.volume = global.scene.createSceneObject("MetaballVolume")
    this.volume.setParent(this.sceneObject)
    this.volumeTransform = this.volume.getTransform()
    this.volume.enabled = false
    this.createEvent("OnStartEvent").bind(() => {
      if (!this.initialized && (!this.material || !this.proxyMesh)) {
        print("MetaballField: set `material` and `proxyMesh` on " + this.sceneObject.name + " (or call configure())")
      }
    })
    this.createEvent("LateUpdateEvent").bind(() => this.updateField())
    this.createEvent("OnDestroyEvent").bind(() => {
      const i = MetaballField.fields.indexOf(this)
      if (i >= 0) {
        MetaballField.fields.splice(i, 1)
      }
    })
    this.init()
  }

  /**
   * Set the material and proxy mesh from code (for fields created with createComponent, whose inputs are
   * still empty in onAwake). Optional preset name.
   */
  configure(material: Material, proxyMesh: RenderMesh, preset?: string): void {
    this.material = material
    this.proxyMesh = proxyMesh
    if (preset) {
      this.preset = preset
    }
    this.init()
  }

  private init(): void {
    if (this.initialized || !this.material || !this.proxyMesh) {
      return
    }
    this.initialized = true
    this.visual = this.volume.createComponent("Component.RenderMeshVisual") as RenderMeshVisual
    this.visual.mesh = this.proxyMesh
    const min = this.proxyMesh.aabbMin
    const max = this.proxyMesh.aabbMax
    this.meshRadius = Math.max(0.0001, Math.min(max.x - min.x, max.y - min.y, max.z - min.z) * 0.5)
    this.visual.mainMaterial = this.material.clone()
    this.pass = this.visual.mainMaterial.mainPass
    // Back faces only: the ray is clipped to the volume analytically, so this also works with the eye inside.
    this.pass.cullMode = CullMode.Front
    this.pass.twoSided = false
    this.pass.depthTest = true
    this.pass.depthWrite = false
    this.pass["boundRadius"] = this.meshRadius * MESH_FILL
    this.visual.setRenderOrder(this.renderOrder)
    this.setPreset(this.preset)
    if (this.overrideSmoothness) {
      this.smoothness = this.smoothnessOverride
    }
  }

  /** The field a source on `sceneObject` should join: the nearest one up the hierarchy, else the first one. */
  static findFor(sceneObject: SceneObject): MetaballField | null {
    let o: SceneObject | null = sceneObject
    while (o) {
      const f = o.getComponent(MetaballField.getTypeName()) as MetaballField
      if (f) {
        return f
      }
      o = o.getParent()
    }
    return MetaballField.fields.length > 0 ? MetaballField.fields[0] : null
  }

  /** Register a ball. MetaballSource does this on start; call it yourself only for sources you manage. */
  addSource(source: MetaballSource): void {
    if (this.sources.indexOf(source) < 0) {
      this.sources.push(source)
    }
  }

  removeSource(source: MetaballSource): void {
    const i = this.sources.indexOf(source)
    if (i >= 0) {
      this.sources.splice(i, 1)
    }
  }

  getSources(): MetaballSource[] {
    return this.sources.slice()
  }

  /** Names accepted by setPreset(). */
  static get presetNames(): string[] {
    return PRESET_NAMES.slice()
  }

  /** Apply a look from MetaballPresets (colours, gloss, iridescence, intensity, smoothness, wobble). */
  setPreset(name: string): MetaballPreset {
    const p = findPreset(name)
    this.preset = p.name
    this.setColors(p.colorA, p.colorB, p.rimColor)
    this.gloss = p.gloss
    this.iridescence = p.iridescence
    this.intensity = p.intensity
    this.smoothness = p.smoothness
    this.wobble = p.wobble
    return p
  }

  /** 0 = hard spheres, 1 = very gooey (relative to the mean ball radius). */
  get smoothness(): number {
    return this._smoothness
  }
  set smoothness(value: number) {
    this._smoothness = MathUtils.clamp(value, 0, 1.5)
  }

  /** Surface ripples, 0 = smooth. */
  get wobble(): number {
    return this._wobble
  }
  set wobble(value: number) {
    this._wobble = Math.max(0, value)
  }

  /** Overall brightness (on SPECS also how solid the goo looks). */
  get intensity(): number {
    return this._intensity
  }
  set intensity(value: number) {
    this._intensity = Math.max(0, value)
    this.setParam("intensity", this._intensity)
  }

  set gloss(value: number) {
    this.setParam("gloss", MathUtils.clamp(value, 0, 1))
  }

  set iridescence(value: number) {
    this.setParam("iridescence", MathUtils.clamp(value, 0, 1))
  }

  setColors(colorA: vec3, colorB: vec3, rimColor: vec3): void {
    this.setParam("colorA", colorA)
    this.setParam("colorB", colorB)
    this.setParam("rimColor", rimColor)
  }

  /** The RenderMeshVisual that draws the field (e.g. to change its render order or material at runtime). */
  getVisual(): RenderMeshVisual | null {
    return this.visual ?? null
  }

  private setParam(name: string, value: number | vec3 | vec4): void {
    if (this.pass) {
      this.pass[name] = value
    }
  }

  private updateField(): void {
    if (!this.initialized) {
      return
    }
    // Active balls, in world space.
    const centres: vec3[] = []
    const radii: number[] = []
    for (const s of this.sources) {
      const r = s.getWorldRadius()
      if (r <= 0) {
        continue
      }
      if (centres.length === MAX_BALLS) {
        if (!this.warnedOverflow) {
          print("MetaballField: more than " + MAX_BALLS + " active balls on " + this.sceneObject.name + "; extra balls are ignored")
          this.warnedOverflow = true
        }
        break
      }
      centres.push(s.getWorldPosition())
      radii.push(r)
    }
    if (centres.length === 0) {
      this.volume.enabled = false
      return
    }
    this.volume.enabled = true

    // Bounding sphere: centre of the balls' box, radius to the farthest ball surface + the blend band + margin.
    let min = new vec3(1e9, 1e9, 1e9)
    let max = new vec3(-1e9, -1e9, -1e9)
    let meanRadius = 0
    for (let i = 0; i < centres.length; i++) {
      const c = centres[i]
      const r = radii[i]
      min = new vec3(Math.min(min.x, c.x - r), Math.min(min.y, c.y - r), Math.min(min.z, c.z - r))
      max = new vec3(Math.max(max.x, c.x + r), Math.max(max.y, c.y + r), Math.max(max.z, c.z + r))
      meanRadius += r
    }
    meanRadius /= centres.length
    const centre = min.add(max).uniformScale(0.5)
    const blendWorld = this._smoothness * 2 * meanRadius
    let reach = 0
    for (let i = 0; i < centres.length; i++) {
      reach = Math.max(reach, centres[i].distance(centre) + radii[i])
    }
    reach += blendWorld * 0.25 + this.fitMargin

    // Volume transform: world-aligned, uniform scale so `reach` maps onto the usable mesh radius.
    const usable = this.meshRadius * MESH_FILL
    const scale = reach / usable
    this.volumeTransform.setWorldPosition(centre)
    this.volumeTransform.setWorldRotation(quat.quatIdentity())
    this.volumeTransform.setWorldScale(new vec3(scale, scale, scale))

    // Balls in the volume's object space.
    for (let i = 0; i < MAX_BALLS; i++) {
      if (i < centres.length) {
        const local = centres[i].sub(centre).uniformScale(1 / scale)
        this.pass["ball" + i] = new vec4(local.x, local.y, local.z, radii[i] / scale)
      } else {
        this.pass["ball" + i] = new vec4(0, 0, 0, 0)
      }
    }
    this.pass["smoothness"] = blendWorld / scale
    this.pass["rippleScale"] = meanRadius / scale
    this.pass["wobble"] = this._wobble
  }
}

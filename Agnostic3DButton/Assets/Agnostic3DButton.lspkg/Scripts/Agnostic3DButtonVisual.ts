/**
 * Agnostic3DButtonVisual — a beautiful look for an Agnostic3DButton, driven only by its state.
 *
 * Builds (at OnStart, in code) a holed base (a bezel around a well), a bevelled cap that sinks into the
 * well by pressValue × travel and
 * squashes a little at full press, and a glow ring under the cap edge that blooms on hover and
 * flashes on click. Colours ease between idle / hover / pressed / on (toggle) from a theme.
 * Optional label on the cap and optional click sound. The core button never depends on this.
 *
 * `style` UIKit swaps the look for one copied from UIKit's System 3.0 buttons (no UIKit
 * components): a thin rounded-rect / pill / round slab with UIKit's 0.5 corner radius, an inset border,
 * a left → right gradient fill, the label just in front, an optional icon, and UIKit's state tints.
 */
import {Agnostic3DButton} from "./Agnostic3DButton"
import {buildRing, buildSlab, buildWell} from "./ButtonMeshes"
import {ButtonStateColors, ButtonTheme, findTheme, mixColor} from "./ButtonThemes"
import {ButtonShape, VolumeSpec} from "./ButtonVolume"

const CAP_RENDER_ORDER = 20

/** Look of the visual. */
export enum ButtonStyle {
  Classic = 0,
  UIKit = 1,
}

// UIKit style (values from UIKit System 3.0: Button.ts, ElementContent.ts, Visual.ts).
const UIKIT_DEPTH = 0.5
const UIKIT_BEVEL = 0.08
const UIKIT_CORNER_RADIUS = 0.5
const UIKIT_PADDING = 0.8
const UIKIT_GAP = 0.5
const UIKIT_CONTENT_OFFSET = 0.05
// Colour cross-fade rate (1/s): UIKit tweens state colours over about 0.2 s.
const UIKIT_FADE_RATE = 15
const GRADIENT_WIDTH = 64
// Space between the bottom of the fully pressed cap and the floor of the well.
const WELL_FLOOR_GAP = 0.15
// Finger shadow: how far outside the footprint a finger is still looked up, and the texture size.
const SHADOW_MARGIN = 0.5
const SHADOW_PIXELS = 128

let shadowTexture: Texture | null = null

/** A white disc with a crisp edge (one pixel of anti-aliasing), generated once and shared by every button. */
function getShadowTexture(): Texture {
  if (shadowTexture) return shadowTexture
  const texture = ProceduralTextureProvider.createWithFormat(SHADOW_PIXELS, SHADOW_PIXELS, TextureFormat.RGBA8Unorm)
  const data = new Uint8Array(SHADOW_PIXELS * SHADOW_PIXELS * 4)
  for (let y = 0; y < SHADOW_PIXELS; y++) {
    for (let x = 0; x < SHADOW_PIXELS; x++) {
      const u = ((x + 0.5) / SHADOW_PIXELS) * 2 - 1
      const v = ((y + 0.5) / SHADOW_PIXELS) * 2 - 1
      const r = Math.sqrt(u * u + v * v)
      const aa = 2 / SHADOW_PIXELS
      const coverage = 1 - MathUtils.clamp((r - (1 - aa)) / aa, 0, 1)
      const i = (y * SHADOW_PIXELS + x) * 4
      data[i] = data[i + 1] = data[i + 2] = 255
      data[i + 3] = Math.round(255 * coverage)
    }
  }
  ;(texture.control as ProceduralTextureProvider).setPixels(0, 0, SHADOW_PIXELS, SHADOW_PIXELS, data)
  shadowTexture = texture
  return texture
}

@component
export class Agnostic3DButtonVisual extends BaseScriptComponent {
  @input
  @allowUndefined
  @hint("The button to visualize (usually on the same SceneObject)")
  button: Agnostic3DButton

  @input
  @widget(new ComboBoxWidget([new ComboBoxItem("Specs Glass", 0), new ComboBoxItem("Neon", 1), new ComboBoxItem("Candy", 2), new ComboBoxItem("Metal", 3), new ComboBoxItem("UIKit Primary", 4), new ComboBoxItem("UIKit Secondary", 5), new ComboBoxItem("UIKit Ghost", 6)]))
  theme: number = 0

  @input
  @widget(new ComboBoxWidget([new ComboBoxItem("Classic", 0), new ComboBoxItem("UIKit", 1)]))
  @hint("Classic: bevelled cap on a plate with a glow ring. UIKit: a thin slab with a border and gradient, like the UIKit System 3.0 buttons (use a UIKit theme)")
  style: number = 0

  @input
  @allowUndefined
  @hint("Lit material for the cap and the plate (Example/Materials/ButtonCap.mat)")
  capMaterial: Material

  @input
  @allowUndefined
  @hint("Unlit material for the glow ring (Example/Materials/ButtonGlow.mat)")
  glowMaterial: Material

  @ui.separator
  @input
  @hint("Cap height above the plate (local units)")
  capHeight: number = 1.2

  @input
  @hint("Rounded top edge radius")
  bevel: number = 0.5

  @input
  @hint("Box shapes: footprint corner radius")
  cornerRadius: number = 1.5

  @input
  @hint("Deprecated, unused: the base is now a bezel, see bezelWidth (kept so existing scenes load)")
  plateMargin: number = 0.9

  @input
  @widget(new SliderWidget(0, 1, 0.01))
  @hint("Gap between the cap and the edge of the hole in the base")
  clearance: number = 0.15

  @input
  @hint("Width of the bezel (the frame of the base around the hole)")
  bezelWidth: number = 0.75

  @input
  @hint("Depth of the well below the bezel. 0 = auto (travel × 1.2, deeper if the cap needs it); never shallower than the pressed cap")
  wellDepth: number = 0

  @input
  @widget(new SliderWidget(0, 0.4, 0.01))
  @hint("Vertical squash of the cap at full press")
  squash: number = 0.12

  @ui.separator
  @input
  label: string = ""

  @input
  labelSize: number = 48

  @input
  @allowUndefined
  @hint("Plays on every click")
  clickAudio: AudioComponent

  @ui.separator
  @input
  @hint("UIKit style, box shape: capsule ends (corner radius = half the short side)")
  pill: boolean = false

  @input
  @allowUndefined
  @hint("Optional icon on the cap (left of the label, or centred without one), tinted like the label")
  icon: Texture

  @input
  @hint("Icon size (local units)")
  iconSize: number = 1.25

  @ui.separator
  @input
  @hint("Flat circular shadow of the nearest finger, projected on the cap along the press direction")
  showShadow: boolean = true

  @input
  @hint("Height above the top face (local units) where the shadow appears")
  shadowRange: number = 6

  @input
  @hint("Shadow radius when the finger touches the cap")
  shadowMinRadius: number = 0.8

  @input
  @hint("Shadow radius at the top of the range")
  shadowMaxRadius: number = 2.5

  @input
  @widget(new SliderWidget(0, 1, 0.01))
  @hint("Shadow opacity (it fades in at the top of the range)")
  shadowMaxOpacity: number = 0.9

  @input
  @hint("Shadow colour = the cap's current colour times this (0 = black, 1 = same colour). Black is transparent on SPECS, so keep it above ~0.3")
  @widget(new SliderWidget(0, 1, 0.01))
  shadowDarkness: number = 0.55

  private cap: SceneObject
  private capPass: Pass
  private platePass: Pass
  private glowPass: Pass
  private glowObject: SceneObject
  private labelText: Text | null = null
  private colors: ButtonTheme
  private capColor: vec4
  private glow = 0
  private flash = 0
  // Largest sideways squash spread that keeps the cap inside the hole.
  private maxSpread = 1
  // UIKit style state.
  private gradientTexture: Texture | null = null
  private stops: vec4[] = []
  private borderPass: Pass | null = null
  private borderColor: vec4
  private iconPass: Pass | null = null
  private labelColor: vec4
  // Finger shadow.
  private shadowObject: SceneObject | null = null
  private shadowPass: Pass | null = null
  private capInset = 0

  onAwake(): void {
    this.colors = findTheme(this.theme)
    this.createEvent("OnStartEvent").bind(() => this.build())
    // After every UpdateEvent, so the cap shows this frame's pressValue whatever the component order.
    this.createEvent("LateUpdateEvent").bind(() => this.animate())
  }

  /** Switch theme at runtime (name or index into BUTTON_THEMES). */
  setTheme(nameOrIndex: string | number): void {
    this.colors = findTheme(nameOrIndex)
    if (this.platePass) this.applyStatic()
  }

  setLabel(text: string): void {
    this.label = text
    if (this.labelText) this.labelText.text = text
  }

  /** The generated cap object (e.g. to parent an icon onto it). */
  getCap(): SceneObject {
    return this.cap
  }

  /**
   * Set everything from code (for buttons created with createComponent, whose onAwake runs before
   * inputs can be assigned). Builds immediately.
   */
  configure(button: Agnostic3DButton, capMaterial: Material, glowMaterial: Material, theme: string | number = 0, label: string = ""): void {
    this.button = button
    this.capMaterial = capMaterial
    this.glowMaterial = glowMaterial
    this.colors = findTheme(theme)
    this.label = label
    this.build()
  }

  private built = false

  private build(): void {
    if (this.built) return
    if (!this.button || !this.capMaterial || !this.glowMaterial) {
      return
    }
    this.built = true
    const spec = this.button.volume
    if (this.style === ButtonStyle.UIKit) this.buildUIKit(spec)
    else this.buildClassic(spec)
    if (this.icon) this.buildIcon(spec)
    if (this.showShadow) this.buildShadow()
    this.button.onClick.add(() => {
      this.flash = 1
      if (this.clickAudio) this.clickAudio.play(1)
    })
  }

  /**
   * The holed base: bezel top `protrusion` below the cap's resting top, well deep enough that the cap
   * (height `capHeight`) at full travel stays above the floor. Returns the bezel's height.
   */
  private buildBase(spec: VolumeSpec, capHeight: number, protrusion: number, corner: number): number {
    const bezelTop = -protrusion
    const needed = spec.travel + capHeight - protrusion + WELL_FLOOR_GAP
    const depth = Math.max(this.wellDepth > 0 ? this.wellDepth : spec.travel * 1.2, needed)
    const base = this.child("Base", this.sceneObject)
    base.getTransform().setLocalPosition(new vec3(0, bezelTop, 0))
    this.platePass = this.addVisual(base, buildWell(spec.shape, spec.size, this.clearance, this.bezelWidth, depth, corner), this.capMaterial, CAP_RENDER_ORDER - 2)
    return bezelTop
  }

  private buildClassic(spec: VolumeSpec): void {
    // The cap rests a little above the bezel and sinks below it at full press.
    const bezelTop = this.buildBase(spec, this.capHeight, Math.min(spec.travel * 0.5, 0.6), this.cornerRadius)

    // Glow ring on the bezel, around the hole (inside the bezel, so neighbouring buttons never overlap).
    this.glowObject = this.child("Glow", this.sceneObject)
    this.glowObject.getTransform().setLocalPosition(new vec3(0, bezelTop + 0.02, 0))
    const glowMesh = buildRing(spec.shape, spec.size, 0, -this.clearance, this.clearance + this.bezelWidth * 0.6, this.cornerRadius)
    this.glowPass = this.addVisual(this.glowObject, glowMesh, this.glowMaterial, CAP_RENDER_ORDER - 1)
    this.glowPass.blendMode = BlendMode.Add
    this.glowPass.depthWrite = false
    this.maxSpread = 1 + (this.clearance * 1.6) / Math.max(spec.size.x, spec.size.y, 0.01)

    this.cap = this.child("Cap", this.sceneObject)
    this.capPass = this.addVisual(this.cap, buildSlab(spec.shape, spec.size, this.capHeight, this.bevel, this.cornerRadius), this.capMaterial, CAP_RENDER_ORDER)

    if (this.label) this.buildLabel(0.03, 0)
    this.capColor = this.colors.idle
    this.applyStatic()
  }

  /** UIKit style: a thin slab with planar UVs (gradient texture), an inset border, the content in front. */
  private buildUIKit(spec: VolumeSpec): void {
    const corner = this.uikitCorner(spec)
    // A shallower well: the thin slab rests just above the bezel.
    this.buildBase(spec, UIKIT_DEPTH, Math.min(spec.travel * 0.4, 0.3), corner)
    this.platePass.baseColor = this.colors.plate
    this.platePass.roughness = 0.7
    this.cap = this.child("Cap", this.sceneObject)
    const mesh = buildSlab(spec.shape, spec.size, UIKIT_DEPTH, UIKIT_BEVEL, corner, true)
    this.capPass = this.addVisual(this.cap, mesh, this.capMaterial, CAP_RENDER_ORDER)
    this.capPass.blendMode = BlendMode.Normal
    this.capPass.baseColor = new vec4(1, 1, 1, 1)
    this.capPass.roughness = this.colors.roughness
    this.capPass.metallic = this.colors.metallic
    this.gradientTexture = ProceduralTextureProvider.createWithFormat(GRADIENT_WIDTH, 1, TextureFormat.RGBA8Unorm)
    this.capPass.baseTex = this.gradientTexture
    this.stops = this.gradients().idle.slice()
    this.writeGradient()

    const border = this.borders()
    const borderObject = this.child("Border", this.cap)
    borderObject.getTransform().setLocalPosition(new vec3(0, 0.01, 0))
    this.borderPass = this.addVisual(borderObject, buildRing(spec.shape, spec.size, 0, border.width, 0, corner), this.glowMaterial, CAP_RENDER_ORDER + 1)
    this.borderPass.blendMode = BlendMode.Normal
    this.borderPass.depthWrite = false
    this.borderColor = border.idle
    this.borderPass.baseColor = this.borderColor

    this.labelColor = this.colors.label
    if (this.label) this.buildLabel(UIKIT_CONTENT_OFFSET, this.icon ? (this.iconSize + UIKIT_GAP) / 2 : 0)
  }

  private uikitCorner(spec: VolumeSpec): number {
    if (spec.shape === ButtonShape.Cylinder) return spec.size.x / 2
    return this.pill ? Math.min(spec.size.x, spec.size.y) / 2 : UIKIT_CORNER_RADIUS
  }

  /** The theme's UIKit gradient, or its flat state colours. */
  private gradients(): ButtonStateColors<vec4[]> {
    const c = this.colors
    return c.gradient ?? {idle: [c.idle, c.idle, c.idle], hover: [c.hover, c.hover, c.hover], pressed: [c.pressed, c.pressed, c.pressed], on: [c.on, c.on, c.on]}
  }

  private borders(): ButtonStateColors<vec4> & {width: number} {
    const c = this.colors
    return c.border ?? {idle: c.glow, hover: c.glow, pressed: c.glow, on: c.glow, width: 0.15}
  }

  private writeGradient(): void {
    if (!this.gradientTexture) return
    const data = new Uint8Array(GRADIENT_WIDTH * 4)
    for (let x = 0; x < GRADIENT_WIDTH; x++) {
      const t = x / (GRADIENT_WIDTH - 1)
      const c = t < 0.5 ? mixColor(this.stops[0], this.stops[1], t * 2) : mixColor(this.stops[1], this.stops[2], (t - 0.5) * 2)
      data[x * 4] = MathUtils.clamp(c.x, 0, 1) * 255
      data[x * 4 + 1] = MathUtils.clamp(c.y, 0, 1) * 255
      data[x * 4 + 2] = MathUtils.clamp(c.z, 0, 1) * 255
      data[x * 4 + 3] = MathUtils.clamp(c.w, 0, 1) * 255
    }
    ;(this.gradientTexture.control as ProceduralTextureProvider).setPixels(0, 0, GRADIENT_WIDTH, 1, data)
  }

  /** The finger shadow: a 2 × 2 quad (scaled to the radius) on the cap top, hidden until a finger is in range. */
  private buildShadow(): void {
    this.capInset = this.style === ButtonStyle.UIKit ? UIKIT_BEVEL : this.bevel
    const o = this.child("FingerShadow", this.cap)
    o.getTransform().setLocalPosition(new vec3(0, 0.02, 0))
    const mesh = buildSlab(ButtonShape.Box, new vec2(2, 2), 0.005, 0, 0, true)
    const pass = this.addVisual(o, mesh, this.capMaterial, CAP_RENDER_ORDER + 2)
    pass.baseTex = getShadowTexture()
    pass.blendMode = BlendMode.Normal
    pass.depthWrite = false
    pass.roughness = 1
    pass.metallic = 0
    o.enabled = false
    this.shadowObject = o
    this.shadowPass = pass
  }

  /** Distance from a local point to the edge of the footprint (negative outside). */
  private edgeDistance(spec: VolumeSpec, p: vec3): number {
    if (spec.shape === ButtonShape.Cylinder) return spec.size.x / 2 - Math.sqrt(p.x * p.x + p.z * p.z)
    return Math.min(spec.size.x / 2 - Math.abs(p.x), spec.size.y / 2 - Math.abs(p.z))
  }

  /**
   * Places the finger shadow under the nearest finger: far = large, soft and faint; near = small and
   * dark; pressing = small, dark, slightly squashed. Clipped to the cap's flat top. Same frame as the press.
   */
  private animateShadow(b: Agnostic3DButton): void {
    if (!this.shadowObject || !this.shadowPass) return
    const spec = b.volume
    const f = b.closestFinger(this.shadowRange, SHADOW_MARGIN)
    const range = Math.max(this.shadowRange, 0.01)
    const d = f ? MathUtils.clamp(f.y / range, 0, 1) : 1
    let r = this.shadowMinRadius + (this.shadowMaxRadius - this.shadowMinRadius) * d
    if (f) r = Math.min(r, this.edgeDistance(spec, f) - this.capInset)
    if (!f || r < 0.15 || d >= 1) {
      this.shadowObject.enabled = false
      return
    }
    this.shadowObject.enabled = true
    const t = this.shadowObject.getTransform()
    t.setLocalPosition(new vec3(f.x, 0.02, f.z))
    t.setLocalScale(f.y < 0 ? new vec3(r * 1.12, 1, r * 0.9) : new vec3(r, 1, r))
    // A flat, darker shade of the cap colour; it only fades in over the top quarter of the range.
    const fade = MathUtils.clamp((1 - d) / 0.25, 0, 1)
    const c = this.capColor || this.colors.idle
    const k = this.shadowDarkness
    this.shadowPass.baseColor = new vec4(c.x * k, c.y * k, c.z * k, this.shadowMaxOpacity * fade)
  }

  private buildIcon(spec: VolumeSpec): void {
    const o = this.child("Icon", this.cap)
    const x = this.label ? -spec.size.x / 2 + UIKIT_PADDING + this.iconSize / 2 : 0
    o.getTransform().setLocalPosition(new vec3(x, UIKIT_CONTENT_OFFSET, 0))
    const mesh = buildSlab(ButtonShape.Box, new vec2(this.iconSize, this.iconSize), 0.01, 0, 0, true)
    this.iconPass = this.addVisual(o, mesh, this.capMaterial, CAP_RENDER_ORDER + 3)
    this.iconPass.baseTex = this.icon
    this.iconPass.blendMode = BlendMode.Normal
    this.iconPass.depthWrite = false
    this.iconPass.roughness = 1
    this.iconPass.metallic = 0
    this.iconPass.baseColor = this.colors.label
  }

  private child(name: string, parent: SceneObject): SceneObject {
    const o = global.scene.createSceneObject(name)
    o.setParent(parent)
    return o
  }

  private addVisual(o: SceneObject, mesh: RenderMesh, material: Material, order: number): Pass {
    const visual = o.createComponent("Component.RenderMeshVisual") as RenderMeshVisual
    visual.mesh = mesh
    visual.mainMaterial = material.clone()
    visual.setRenderOrder(order)
    const pass = visual.mainMaterial.mainPass
    pass.twoSided = true
    return pass
  }

  private buildLabel(height: number, x: number): void {
    const o = this.child("Label", this.cap)
    o.getTransform().setLocalPosition(new vec3(x, height, 0))
    o.getTransform().setLocalRotation(quat.fromEulerAngles(-Math.PI / 2, 0, 0))
    const t = o.createComponent("Component.Text") as Text
    t.text = this.label
    t.size = this.labelSize
    t.horizontalAlignment = HorizontalAlignment.Center
    t.verticalAlignment = VerticalAlignment.Center
    t.setRenderOrder(CAP_RENDER_ORDER + 3)
    this.labelText = t
  }

  private applyStatic(): void {
    if (!this.platePass) return
    this.platePass.baseColor = this.colors.plate
    this.capPass.roughness = this.colors.roughness
    this.capPass.metallic = this.colors.metallic
    this.platePass.roughness = 0.6
    this.platePass.metallic = this.colors.metallic * 0.5
    if (this.labelText) this.labelText.textFill.color = this.colors.label
  }

  private animate(): void {
    if (!this.built) this.build()
    if (!this.cap || !this.button) return
    const dt = Math.min(getDeltaTime(), 0.1)
    const b = this.button
    const p = b.pressValue
    const travel = b.volume.travel
    this.animateShadow(b)
    if (this.style === ButtonStyle.UIKit) {
      this.animateUIKit(dt, b, p, travel)
      return
    }

    // Cap: sinks with the finger, squashes softly near the bottom.
    const squashT = MathUtils.clamp((p - 0.8) / 0.2, 0, 1)
    const sy = 1 - this.squash * squashT * squashT
    const spread = Math.min(1 + this.squash * 0.35 * squashT, this.maxSpread)
    this.cap.getTransform().setLocalPosition(new vec3(0, -p * travel, 0))
    this.cap.getTransform().setLocalScale(new vec3(spread, sy, spread))

    // Colour: idle → hover → pressed, or the "on" colour for a latched toggle.
    const rest = b.isOn ? this.colors.on : this.colors.idle
    const target = b.isPressed ? this.colors.pressed : b.isHovered ? mixColor(rest, this.colors.hover, 0.7) : rest
    const k = 1 - Math.exp(-12 * dt)
    this.capColor = mixColor(this.capColor, mixColor(target, this.colors.pressed, p * 0.5), k)
    this.capPass.baseColor = this.capColor

    // Glow: soft when idle, blooms on hover / press, flashes on click; brighter when on.
    const glowTarget = (b.isOn ? 0.55 : 0.12) + (b.isHovered ? 0.45 : 0) + p * 0.4
    this.glow += (glowTarget - this.glow) * (1 - Math.exp(-8 * dt))
    this.flash = Math.max(0, this.flash - dt * 2.5)
    const g = MathUtils.clamp(this.glow + this.flash, 0, 1.4)
    const c = this.colors.glow
    this.glowPass.baseColor = new vec4(c.x * g, c.y * g, c.z * g, 1)
    const s = 1 + 0.02 * this.flash + 0.01 * (b.isHovered ? 1 : 0)
    this.glowObject.getTransform().setLocalScale(new vec3(s, 1, s))
  }

  /** UIKit style: the cap sinks with the finger; fill, border and label cross-fade between UIKit's state colours. */
  private animateUIKit(dt: number, b: Agnostic3DButton, p: number, travel: number): void {
    if (!this.borderPass) return
    this.cap.getTransform().setLocalPosition(new vec3(0, -p * travel, 0))
    const state: keyof ButtonStateColors<vec4> = b.isPressed ? "pressed" : b.isHovered ? (b.isOn ? "on" : "hover") : b.isOn ? "on" : "idle"
    const k = 1 - Math.exp(-UIKIT_FADE_RATE * dt)
    const target = this.gradients()[state]
    let changed = false
    for (let i = 0; i < 3; i++) {
      const next = mixColor(this.stops[i], target[i], k)
      if (next.sub(this.stops[i]).length > 0.001) changed = true
      this.stops[i] = next
    }
    if (changed) this.writeGradient()
    this.borderColor = mixColor(this.borderColor, this.borders()[state], k)
    this.borderPass.baseColor = this.borderColor
    const c = this.colors
    const labelTarget = b.isPressed ? (c.labelPressed ?? c.label) : b.isHovered || b.isOn ? (c.labelHover ?? c.label) : c.label
    this.labelColor = mixColor(this.labelColor, labelTarget, k)
    if (this.labelText) this.labelText.textFill.color = this.labelColor
    if (this.iconPass) this.iconPass.baseColor = this.labelColor
  }
}

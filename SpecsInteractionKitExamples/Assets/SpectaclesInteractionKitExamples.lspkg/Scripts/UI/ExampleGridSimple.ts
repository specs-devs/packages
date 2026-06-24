// Preload ThemeService before any UIKit visual to break a circular-import init-order
// crash in the package (Visual.ts imports ThemeService before defining COLORS, and the
// theme chain reads COLORS at module-load). Entering the import cycle via ThemeService
// lets Visual.ts finish defining COLORS first. Must remain the FIRST import.
import "SpectaclesUIKit.lspkg/Scripts/Themes/ThemeService"
/**
 * ExampleGridSimple – adaptable grid of tappable buttons.
 * No pagination, no drag. Rows × columns laid out at runtime and auto-sized.
 * API: populate items[] before Play, or call addItem() / updateButtonText() etc. at any time.
 */
import { Frame } from "SpectaclesUIKit.lspkg/Scripts/Components/Frame/Frame";
import { RectangleButton } from "SpectaclesUIKit.lspkg/Scripts/Components/Button/RectangleButton";
import {
  RoundedRectangleVisual,
  RoundedRectangleVisualState,
} from "SpectaclesUIKit.lspkg/Scripts/Visuals/RoundedRectangle/RoundedRectangleVisual";
import {
  RoundedRectangle,
  GradientParameters,
} from "SpectaclesUIKit.lspkg/Scripts/Visuals/RoundedRectangle/RoundedRectangle";
import { StateName } from "SpectaclesUIKit.lspkg/Scripts/Components/Element";
import { IMAGE_MATERIAL_ASSET } from "SpectaclesUIKit.lspkg/Scripts/Utility/Assets";
import { Logger } from "Utilities.lspkg/Scripts/Utils/Logger";
import { bindStartEvent } from "SnapDecorators.lspkg/decorators";

const FONT_LIGHT: Font   = requireAsset("../../Fonts/SpecsSans-Light.otf")   as Font
const FONT_REGULAR: Font = requireAsset("../../Fonts/SpecsSans-Regular.otf") as Font
const FONT_MEDIUM: Font  = requireAsset("../../Fonts/SpecsSans-Medium.otf")  as Font
const FONT_BOLD: Font    = requireAsset("../../Fonts/SpecsSans-Bold.otf")    as Font

type FontWeight = "light" | "regular" | "medium" | "bold"

// ─── Item type ────────────────────────────────────────────────────────────────
export type GridSimpleItem = {
  label: string
  subtitle?: string
  image?: Texture
  callback?: () => void
}

// ─── Gradient helpers ─────────────────────────────────────────────────────────

function solid(c: vec4): GradientParameters {
  return {
    enabled: true, type: "Rectangle" as const,
    start: new vec2(0, 1), end: new vec2(0, -1),
    stop0: {enabled: true, percent: 0,   color: c},
    stop1: {enabled: true, percent: 0.5, color: c},
    stop2: {enabled: true, percent: 1,   color: c},
    stop3: {enabled: true, percent: 1,   color: c},
  }
}

// ─── Theme definitions ────────────────────────────────────────────────────────

type ThemeSpec = {
  /** Button visual style for each interaction state */
  button: Partial<Record<StateName, RoundedRectangleVisualState>>
  /** Frame overlay: gradient fill + border. null = no overlay (Default). */
  frame: {gradient: GradientParameters; border: vec4} | null
}

// ── Dark ──────────────────────────────────────────────────────────────────────
// Near-black, subtle slate border — clean and minimal.
const DARK_BASE  = new vec4(0.10, 0.10, 0.12, 1)
const DARK_HOV   = new vec4(0.18, 0.18, 0.22, 1)
const DARK_TRIG  = new vec4(0.06, 0.06, 0.08, 1)
const DARK_BORD  = new vec4(0.30, 0.30, 0.38, 0.85)

const THEME_DARK: ThemeSpec = {
  button: {
    default:   {baseType: "Gradient", hasBorder: true, borderSize: 0.10, borderType: "Color", borderColor: DARK_BORD, baseGradient: solid(DARK_BASE)},
    hovered:   {baseType: "Gradient", hasBorder: true, borderSize: 0.10, borderType: "Color", borderColor: new vec4(0.42, 0.42, 0.52, 0.95), baseGradient: solid(DARK_HOV)},
    triggered: {baseType: "Gradient", hasBorder: true, borderSize: 0.12, borderType: "Color", borderColor: DARK_BORD, baseGradient: solid(DARK_TRIG)},
  },
  frame: {gradient: solid(DARK_BASE), border: DARK_BORD},
}

// ── Bright ────────────────────────────────────────────────────────────────────
// Electric cobalt blue — vivid and high-energy, white text pops on it.
const BR_BASE  = new vec4(0.12, 0.35, 0.92, 1)
const BR_HOV   = new vec4(0.25, 0.52, 1.00, 1)
const BR_TRIG  = new vec4(0.06, 0.22, 0.70, 1)
const BR_BORD  = new vec4(0.55, 0.78, 1.00, 0.75)
const BR_BORD_H = new vec4(0.75, 0.92, 1.00, 0.95)

const THEME_BRIGHT: ThemeSpec = {
  button: {
    default:   {baseType: "Gradient", hasBorder: true, borderSize: 0.08, borderType: "Color", borderColor: BR_BORD,   baseGradient: solid(BR_BASE)},
    hovered:   {baseType: "Gradient", hasBorder: true, borderSize: 0.08, borderType: "Color", borderColor: BR_BORD_H, baseGradient: solid(BR_HOV)},
    triggered: {baseType: "Gradient", hasBorder: true, borderSize: 0.10, borderType: "Color", borderColor: BR_BORD,   baseGradient: solid(BR_TRIG)},
  },
  frame: {gradient: solid(new vec4(0.08, 0.25, 0.72, 1)), border: BR_BORD},
}

// ── Focus ─────────────────────────────────────────────────────────────────────
// Near-pure black with a crisp cyan accent ring — like a selection / focus state.
const FO_BASE  = new vec4(0.05, 0.05, 0.07, 1)
const FO_HOV   = new vec4(0.10, 0.10, 0.14, 1)
const FO_TRIG  = new vec4(0.02, 0.02, 0.04, 1)
const FO_BORD  = new vec4(0.18, 0.85, 0.78, 0.88)   // cyan accent
const FO_BORD_H = new vec4(0.35, 1.00, 0.92, 1.00)

const THEME_FOCUS: ThemeSpec = {
  button: {
    default:   {baseType: "Gradient", hasBorder: true, borderSize: 0.12, borderType: "Color", borderColor: FO_BORD,   baseGradient: solid(FO_BASE)},
    hovered:   {baseType: "Gradient", hasBorder: true, borderSize: 0.12, borderType: "Color", borderColor: FO_BORD_H, baseGradient: solid(FO_HOV)},
    triggered: {baseType: "Gradient", hasBorder: true, borderSize: 0.14, borderType: "Color", borderColor: FO_BORD,   baseGradient: solid(FO_TRIG)},
  },
  frame: {gradient: solid(FO_BASE), border: FO_BORD},
}

function resolveTheme(name: string): ThemeSpec | null {
  switch (name) {
    case "Dark":   return THEME_DARK
    case "Bright": return THEME_BRIGHT
    case "Focus":  return THEME_FOCUS
    default:       return null   // "Default" — use _style input, no frame override
  }
}

// ─── ExampleGridSimple ────────────────────────────────────────────────────────
@component
export class ExampleGridSimple extends BaseScriptComponent {

  @ui.label('<span style="color: #60A5FA; font-size: 13px;">Programmatic UI Component</span><br/><span style="color: #94A3B8; font-size: 11px;">Simple adaptable grid — no pagination, no drag.<br/>Populate <code>items[]</code> before Play, or use <code>addItem()</code> at runtime.</span>')
  @ui.separator

  // ── Grid ───────────────────────────────────────────────────────────────
  @ui.group_start("Grid")
  @input
  @hint("Number of rows")
  rows: number = 2

  @input
  @hint("Number of columns")
  columns: number = 4

  @input
  @hint("Button width in cm")
  buttonWidth: number = 10

  @input
  @hint("Button height in cm")
  buttonHeight: number = 10

  @input
  @hint("Gap between buttons in cm")
  spacing: number = 0.5
  @ui.group_end

  // ── Theme ──────────────────────────────────────────────────────────────
  @ui.separator
  @ui.group_start("Theme")
  @input
  @widget(new ComboBoxWidget([
    new ComboBoxItem("Default", "Default"),
    new ComboBoxItem("Dark",    "Dark"),
    new ComboBoxItem("Bright",  "Bright"),
    new ComboBoxItem("Focus",   "Focus"),
  ]))
  @hint("Visual theme applied to buttons and frame. Default uses the buttonStyle field; others override it.")
  theme: string = "Dark"

  @input
  @hint("Button style when theme is Default — PrimaryNeutral, Primary, Secondary, Ghost")
  buttonStyle: string = "PrimaryNeutral"
  @ui.group_end

  // ── Test Mode ─────────────────────────────────────────────────────────
  @ui.separator
  @ui.group_start("Test Mode")
  @input
  @hint("Fill the grid with mock items automatically. Uncheck to start empty — populate via items[] or addItem().")
  testMode: boolean = true

  @input
  @hint("Image pool for test mode — sparsely distributed across items. Leave empty for text-only items.")
  buttonImages: Texture[] = []
  @ui.group_end

  // ── Position ───────────────────────────────────────────────────────────
  @ui.separator
  @ui.group_start("Position")
  @input
  @hint("World X position (0 = horizontal centre)")
  positionX: number = 0

  @input
  @hint("World Y position (0 = camera height)")
  positionY: number = 0

  @input
  @hint("Distance from camera in cm (negative = in front)")
  positionZ: number = -110
  @ui.group_end

  // ── Frame ──────────────────────────────────────────────────────────────
  @ui.separator
  @ui.group_start("Frame")
  @input
  @hint("Frame appearance style — Small, Medium, or Large")
  frameAppearance: string = "Small"

  @input
  @hint("Show the × close button on the frame")
  showCloseButton: boolean = true

  @input
  @hint("Show the follow / grip button on the frame")
  showFollowButton: boolean = true
  @ui.group_end

  // ── Logging ────────────────────────────────────────────────────────────
  @ui.separator
  @ui.group_start("Logging")
  @input
  @hint("Enable general logging")
  enableLogging: boolean = false
  @ui.group_end

  // ─── Public data ──────────────────────────────────────────────────────
  public items: GridSimpleItem[] = []

  // ─── Private state ────────────────────────────────────────────────────
  private buttons:     RectangleButton[] = []
  private frameObject: SceneObject       = null
  private frame:       Frame             = null
  private logger:      Logger

  private readonly TITLE_SIZE    = 38
  private readonly SUBTITLE_SIZE = 28
  private readonly IMAGE_FRAC    = 0.45
  private readonly PAD           = 0.8
  private readonly TEXT_Z        = 0.12
  private readonly GRID_PAD      = new vec2(2, 2)

  onAwake(): void {
    this.logger = new Logger("ExampleGridSimple", this.enableLogging, true)
  }

  @bindStartEvent
  onStart(): void {
    if (this.testMode && this.items.length === 0) this.fillTestItems()
    this.build()
  }

  // ─── Test data ────────────────────────────────────────────────────────
  private fillTestItems(): void {
    const total = this.rows * this.columns
    const pool  = this.buttonImages
    const img   = (i: number) =>
      pool.length > 0 && (i % 2 === 0 || i === 1) ? pool[i % pool.length] : undefined

    for (let i = 0; i < total; i++) {
      this.items.push({
        label:    `Item ${i + 1}`,
        subtitle: `Subtitle ${i + 1}`,
        image:    img(i),
        callback: () => print(`GridSimple: tapped "Item ${i + 1}"`),
      })
    }
  }

  // ─── Build ────────────────────────────────────────────────────────────
  private build(): void {
    // Frame
    this.frameObject = global.scene.createSceneObject("GridSimpleFrame")
    this.frameObject.setParent(this.sceneObject)
    this.frameObject.getTransform().setWorldPosition(
      new vec3(this.positionX, this.positionY, this.positionZ)
    )
    this.frame = this.frameObject.createComponent(Frame.getTypeName()) as Frame;
    (this.frame as any)._appearance       = this.frameAppearance;
    (this.frame as any)._showCloseButton  = this.showCloseButton;
    (this.frame as any)._showFollowButton = this.showFollowButton;
    (this.frame as any).useFollowBehavior = this.showFollowButton;
    (this.frame as any)._following        = false
    this.frame.autoShowHide    = false
    // Frame self-initializes on its OnStartEvent (no public initialize() in the
    // current SpectaclesUIKit). Apply post-init config once ready.
    this.frame.onInitialized.add(() => {
      this.frame.allowScaling    = false
      this.frame.autoScaleContent = false
      if (this.frame.showVisual) this.frame.showVisual()
    })

    // Buttons
    const spec  = resolveTheme(this.theme)
    const cellW = this.buttonWidth  + this.spacing
    const cellH = this.buttonHeight + this.spacing
    const cols  = this.columns
    const rows  = Math.ceil(this.items.length / cols) || this.rows
    const xOff  = -(cols - 1) * cellW * 0.5
    const yOff  =  (rows - 1) * cellH * 0.5

    this.buttons = []
    this.items.forEach((item, i) => {
      const col = i % cols
      const row = Math.floor(i / cols)

      const btnObj = global.scene.createSceneObject(`GS_Button_${i + 1}`)
      btnObj.setParent(this.frameObject)
      btnObj.getTransform().setLocalPosition(
        new vec3(xOff + col * cellW, yOff - row * cellH, 0.5)
      )

      const btn = btnObj.createComponent(RectangleButton.getTypeName()) as RectangleButton
      if (spec) {
        btn.visual = new RoundedRectangleVisual({sceneObject: btnObj, style: spec.button})
      } else {
        (btn as any)._style = this.buttonStyle
      }
      btn.size = new vec3(this.buttonWidth, this.buttonHeight, 1)
      btn.initialize()

      const idx = i
      if (item.callback) btn.onTriggerUp.add(item.callback)
      else btn.onTriggerUp.add(() => this.logger.debug(`Button ${idx + 1} tapped`))

      this.buildContent(btnObj, item)
      this.buttons.push(btn)
    })

    // Frame size — defer until the Frame is initialized. Its internal visual is created
    // on OnStartEvent; setting innerSize before that throws "setSize of undefined".
    const applyFrameSize = () => {
      this.frame.innerSize = new vec2(
        cols * cellW - this.spacing + this.GRID_PAD.x,
        rows * cellH - this.spacing + this.GRID_PAD.y
      )
    }
    if (this.frame.initialized) applyFrameSize()
    else this.frame.onInitialized.add(applyFrameSize)

    // Frame theme overlay (applied once roundedRectangle is available)
    if (spec && spec.frame) {
      const applyFrameTheme = () => this.applyFrameOverlay(spec.frame!)
      if (this.frame.roundedRectangle) applyFrameTheme()
      else this.frame.onInitialized.add(applyFrameTheme)
    }

    this.logger.debug(`GridSimple built: ${this.items.length} items, theme="${this.theme}", ${cols}×${rows}`)
  }

  private applyFrameOverlay(frameDef: {gradient: GradientParameters; border: vec4}): void {
    const baseRR = this.frame.roundedRectangle
    if (!baseRR) return

    const overlayObj = global.scene.createSceneObject("ThemeOverlay")
    overlayObj.setParent(this.frame.sceneObject)
    overlayObj.layer = this.frame.sceneObject.layer
    overlayObj.getTransform().setLocalPosition(vec3.zero())

    const rr = overlayObj.createComponent(RoundedRectangle.getTypeName()) as RoundedRectangle
    rr.cornerRadius = baseRR.cornerRadius
    rr.initialize()
    rr.size        = this.frame.totalSize
    rr.setBackgroundGradient(frameDef.gradient)
    rr.border      = true
    rr.borderColor = frameDef.border

    const baseOrder = baseRR.renderMeshVisual.getRenderOrder()
    rr.renderMeshVisual.setRenderOrder(baseOrder + 1)

    // Keep overlay sized if the frame is ever resized
    this.frame.onScalingUpdate.add(() => { rr.size = this.frame.totalSize })
  }

  // ─── Button content ───────────────────────────────────────────────────
  private buildContent(btnObj: SceneObject, item: GridSimpleItem): void {
    const bW = this.buttonWidth
    const bH = this.buttonHeight
    const hasImage = !!item.image

    const imageH  = bH * this.IMAGE_FRAC
    const imageY  = bH * 0.5 - imageH * 0.5 - this.PAD
    const textTop = hasImage ? imageY - imageH * 0.5 - 0.3 : bH * 0.5 - this.PAD
    const textBot = -bH * 0.5 + this.PAD

    if (hasImage) {
      const imgObj = global.scene.createSceneObject("Image")
      imgObj.setParent(btnObj)
      imgObj.getTransform().setLocalPosition(new vec3(0, imageY, this.TEXT_Z + 0.02))
      imgObj.getTransform().setLocalScale(new vec3(imageH, imageH, 1))
      const imgComp = imgObj.createComponent("Component.Image") as Image
      imgComp.mainMaterial     = IMAGE_MATERIAL_ASSET.clone()
      imgComp.mainPass.baseTex = item.image!
      imgComp.renderOrder      = 12
    }

    const labelObj  = global.scene.createSceneObject("Label")
    labelObj.setParent(btnObj)
    labelObj.getTransform().setLocalPosition(new vec3(0, 0, this.TEXT_Z))
    const labelComp = labelObj.createComponent("Component.Text") as Text
    labelComp.text               = item.label
    labelComp.size               = this.TITLE_SIZE
    labelComp.layoutRect     = Rect.create(-bW * 0.5 + this.PAD, bW * 0.5 - this.PAD, textBot, textTop)
    labelComp.horizontalOverflow = HorizontalOverflow.Wrap
    labelComp.verticalOverflow   = VerticalOverflow.Overflow
    labelComp.horizontalAlignment = HorizontalAlignment.Center
    labelComp.verticalAlignment  = hasImage ? VerticalAlignment.Top : VerticalAlignment.Center
    labelComp.textFill.mode      = TextFillMode.Solid
    labelComp.textFill.color     = new vec4(1, 1, 1, 1)
    labelComp.renderOrder        = 12
    labelComp.font               = this.fontForWeight("medium")

    if (item.subtitle) {
      const subTop  = textTop - (this.TITLE_SIZE / 100) * bH * 0.55
      const subObj  = global.scene.createSceneObject("Subtitle")
      subObj.setParent(btnObj)
      subObj.getTransform().setLocalPosition(new vec3(0, 0, this.TEXT_Z))
      const subComp = subObj.createComponent("Component.Text") as Text
      subComp.text               = item.subtitle
      subComp.size               = this.SUBTITLE_SIZE
      subComp.layoutRect     = Rect.create(-bW * 0.5 + this.PAD, bW * 0.5 - this.PAD, textBot, subTop)
      subComp.horizontalOverflow = HorizontalOverflow.Wrap
      subComp.verticalOverflow   = VerticalOverflow.Overflow
      subComp.horizontalAlignment = HorizontalAlignment.Center
      subComp.verticalAlignment  = VerticalAlignment.Top
      subComp.textFill.mode      = TextFillMode.Solid
      subComp.textFill.color     = new vec4(0.88, 0.88, 0.90, 1)
      subComp.renderOrder        = 12
      subComp.font               = this.fontForWeight("regular")
    }
  }

  private fontForWeight(w: FontWeight): Font {
    switch (w) {
      case "light":  return FONT_LIGHT
      case "medium": return FONT_MEDIUM
      case "bold":   return FONT_BOLD
      default:       return FONT_REGULAR
    }
  }

  // ─── Public API ───────────────────────────────────────────────────────

  public addItem(item: GridSimpleItem): void {
    this.items.push(item)
    if (this.frameObject) { this.clearGrid(); this.build() }
  }

  public getItemCount(): number { return this.items.length }

  public getButton(index: number): RectangleButton | null {
    return (index >= 1 && index <= this.buttons.length) ? this.buttons[index - 1] : null
  }

  public getButtons(): RectangleButton[] { return this.buttons }

  public setButtonCallback(index: number, callback: () => void): void {
    const btn = this.getButton(index)
    if (btn) btn.onTriggerUp.add(callback)
  }

  public updateButtonText(index: number, label?: string, subtitle?: string): void {
    const btn = this.getButton(index)
    if (!btn) return
    const obj = btn.getSceneObject()
    for (let i = 0; i < obj.getChildrenCount(); i++) {
      const child = obj.getChild(i)
      const tc = child.getComponent("Component.Text") as Text | null
      if (!tc) continue
      if (child.name === "Label"    && label    !== undefined) tc.text = label
      if (child.name === "Subtitle" && subtitle !== undefined) tc.text = subtitle
    }
  }

  public updateButtonImage(index: number, texture: Texture): void {
    const btn = this.getButton(index)
    if (!btn) return
    const obj = btn.getSceneObject()
    for (let i = 0; i < obj.getChildrenCount(); i++) {
      const child = obj.getChild(i)
      if (child.name !== "Image") continue
      const imgComp = child.getComponent("Component.Image") as Image | null
      if (imgComp && imgComp.mainPass) imgComp.mainPass.baseTex = texture
      break
    }
  }

  public getFrame(): Frame { return this.frame }

  public clearGrid(): void {
    if (this.frameObject) { this.frameObject.destroy(); this.frameObject = null; this.frame = null }
    this.buttons = []
  }
}

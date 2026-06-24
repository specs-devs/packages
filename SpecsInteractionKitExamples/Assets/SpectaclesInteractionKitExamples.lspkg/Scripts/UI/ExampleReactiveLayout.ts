// Preload ThemeService before any UIKit visual to break a circular-import init-order
// crash in the package (Visual.ts imports ThemeService before defining COLORS, and the
// theme chain reads COLORS at module-load). Entering the import cycle via ThemeService
// lets Visual.ts finish defining COLORS first. Must remain the FIRST import.
import "SpectaclesUIKit.lspkg/Scripts/Themes/ThemeService"
import {Button} from "SpectaclesUIKit.lspkg/Scripts/Components/Button/Button"
import {BackPlate, BackPlateStyle} from "SpectaclesUIKit.lspkg/Scripts/BackPlate"
import {ElementContent} from "SpectaclesUIKit.lspkg/Scripts/Components/Content/ElementContent"
import {Frame} from "SpectaclesUIKit.lspkg/Scripts/Components/Frame/Frame"
import {FlexItem} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexItem"
import {FlexLayout} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexLayout"
import {FlexAlign, FlexDirection, FlexJustify} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexTypes"
import {Billboard} from "SpectaclesInteractionKit.lspkg/Components/Interaction/Billboard/Billboard"
import animate, {CancelSet} from "SpectaclesInteractionKit.lspkg/Utils/animate"

const FONT_LIGHT: Font = requireAsset("../../Fonts/SpecsSans-Light.otf") as Font
const FONT_REGULAR: Font = requireAsset("../../Fonts/SpecsSans-Regular.otf") as Font
const FONT_MEDIUM: Font = requireAsset("../../Fonts/SpecsSans-Medium.otf") as Font
const FONT_BOLD: Font = requireAsset("../../Fonts/SpecsSans-Bold.otf") as Font

type FontWeight = "light" | "regular" | "medium" | "bold"

const CONTENT_Z_OFFSET = 0.08
const CONTENT_RENDER_ORDER_OFFSET = 8
const LAYOUT_Z_LIFT = 0.02
const DYNAMIC_TEXT_Z_OFFSET = 0.15
const LABEL_EDGE_INSET = 0.75
const PANEL_CONTENT_Z_LIFT = 0.01
const FRAME_PADDING = new vec2(2.2, 2.2)

/**
 * Programmatic example: Reactive Layout
 *
 * Demonstrates a Frame that animates its size when the user navigates between views.
 * Three modes with different panel heights — clicking a button expands/contracts the frame.
 * No @input wiring — the full UI hierarchy is created in buildUI().
 */
@component
export class ExampleReactiveLayout extends BaseScriptComponent {
  private frame: Frame | null = null
  private contentPanels: SceneObject[] = []
  private resizeCancel: CancelSet = new CancelSet()

  private readonly SIZES: vec2[] = [
    new vec2(30, 16),
    new vec2(30, 26),
    new vec2(30, 34)
  ]

  onAwake(): void {
    this.createEvent("OnStartEvent").bind(() => this.buildUI())
  }

  private buildUI(): void {
    const root = this.getSceneObject()
    root.createComponent(Billboard.getTypeName())
    root.getTransform().setWorldPosition(new vec3(0, 0, -110))

    // Frame — we store a reference so we can animate its size
    const frameObj = this.obj(root, "ReactivePanel")
    const frame = frameObj.createComponent(Frame.getTypeName()) as Frame
    frame.autoShowHide = false
    frame.allowTranslation = true
    frame.autoScaleContent = true
    ;(frame as any)._innerSize = this.SIZES[0]
    ;(frame as any)._padding = FRAME_PADDING
    this.frame = frame

    const panelContent = this.obj(frameObj, "FrameContent", new vec3(0, 0, PANEL_CONTENT_Z_LIFT))

    // Nav buttons at top
    const navRow = this.flexRow(panelContent, 28, 4, {
      gap: 0.6, padX: 1, padY: 0.5,
      justify: FlexJustify.Start, align: FlexAlign.Center
    })

    const views = ["Compact", "Normal", "Expanded"]
    views.forEach((viewName, index) => {
      this.flexChild(navRow, {w: 8.5, h: 3.5}, (btnObj) => {
        const btn = this.btn(btnObj, index === 0 ? "Primary" : "PrimaryNeutral", "Capsule", 8.5, 3.5)
        this.content(btnObj, {text: viewName, textSize: 22, fontWeight: "medium"})
        btn.onTriggerUp.add(() => this.switchToView(index))
      })
    })

    // Content panels (initially only first is visible)
    const contentArea = this.obj(panelContent, "ContentArea", new vec3(0, -3, 0))

    views.forEach((viewName, index) => {
      const panel = this.obj(contentArea, `${viewName}Panel`)
      panel.enabled = index === 0
      this.contentPanels.push(panel)

      const height = this.SIZES[index].y - 7
      const bp = panel.createComponent(BackPlate.getTypeName()) as BackPlate
      bp.style = "dark"
      bp.size = new vec2(28, height)

      const labelContainer = this.obj(panel, "Label", new vec3(0, 0, PANEL_CONTENT_Z_LIFT))
      this.label(labelContainer, `${viewName} View`, 26, 3, {
        textSize: 30, align: "center", fontWeight: "bold"
      })

      if (index > 0) {
        const descContainer = this.obj(panel, "Desc", new vec3(0, -3.5, PANEL_CONTENT_Z_LIFT))
        this.label(descContainer, `${index * 8} cm taller than compact`, 26, 2.5, {
          textSize: 22, align: "center", fontWeight: "light",
          color: new vec4(1, 1, 1, 0.6)
        })
      }
    })
  }

  private switchToView(index: number): void {
    this.contentPanels.forEach((p, i) => { p.enabled = i === index })

    if (!this.frame) return
    this.resizeCancel.cancel()
    const startSize = this.frame.innerSize
    const endSize = this.SIZES[index]
    animate({
      duration: 0.4,
      cancelSet: this.resizeCancel,
      easing: "ease-in-out-cubic",
      update: (t: number) => {
        if (this.frame) this.frame.innerSize = vec2.lerp(startSize, endSize, t)
      }
    })
    print(`ReactiveLayout: switched to "${["Compact", "Normal", "Expanded"][index]}"`)
  }

  // ─── Composition helpers ───────────────────────────────────────────────

  private fontForWeight(weight: FontWeight): Font {
    switch (weight) {
      case "light": return FONT_LIGHT
      case "medium": return FONT_MEDIUM
      case "bold": return FONT_BOLD
      default: return FONT_REGULAR
    }
  }

  private obj(parent: SceneObject, name: string, position?: vec3): SceneObject {
    const so = global.scene.createSceneObject(name)
    so.setParent(parent)
    if (position) so.getTransform().setLocalPosition(position)
    return so
  }

  private liftInZ(so: SceneObject, z: number): void {
    const t = so.getTransform()
    const p = t.getLocalPosition()
    t.setLocalPosition(new vec3(p.x, p.y, p.z + z))
  }

  private btn(so: SceneObject, style: string, shape: string, width: number, height: number): Button {
    const button = so.createComponent(Button.getTypeName()) as Button
    ;(button as any)._themeOverride = "SnapOS2"
    ;(button as any)._shapeSnapOS2 = shape
    ;(button as any)._styleSnapOS2 = style
    ;(button as any)._size = new vec3(width, height, 1)
    button.initialize()
    return button
  }

  private content(
    so: SceneObject,
    opts: {
      text?: string; contentAlignment?: string; textSize?: number;
      paddingLeft?: number; paddingRight?: number; sizeOverride?: vec2
      useThemeColors?: boolean; textColorOverride?: vec4; fontWeight?: FontWeight
    }
  ): ElementContent {
    const ec = so.createComponent(ElementContent.getTypeName()) as ElementContent
    const a = ec as any
    a._zOffset = CONTENT_Z_OFFSET
    a._renderOrderOffset = CONTENT_RENDER_ORDER_OFFSET
    a._font = this.fontForWeight(opts.fontWeight ?? "regular")
    if (opts.text !== undefined) a._text = opts.text
    if (opts.contentAlignment) a._contentAlignment = opts.contentAlignment
    if (opts.textSize) a._textSize = opts.textSize
    if (opts.paddingLeft !== undefined) a._paddingLeft = opts.paddingLeft
    if (opts.paddingRight !== undefined) a._paddingRight = opts.paddingRight
    if (opts.sizeOverride) a._sizeOverride = opts.sizeOverride
    if (opts.useThemeColors !== undefined) a._useThemeColors = opts.useThemeColors
    if (opts.textColorOverride) { a._useTextColorOverride = true; a._textColorOverride = opts.textColorOverride }
    return ec
  }

  private label(
    so: SceneObject, text: string, width: number, height: number,
    opts?: {textSize?: number; align?: string; color?: vec4; fontWeight?: FontWeight}
  ): ElementContent {
    const align = opts?.align ?? "center"
    return this.content(so, {
      text, sizeOverride: new vec2(width, height), useThemeColors: false,
      textSize: opts?.textSize ?? 32, contentAlignment: align,
      textColorOverride: opts?.color, fontWeight: opts?.fontWeight ?? "regular",
      paddingLeft: align === "left" ? LABEL_EDGE_INSET : 0,
      paddingRight: align === "right" ? LABEL_EDGE_INSET : 0
    })
  }

  private flexRow(
    parent: SceneObject, width: number, height: number,
    opts?: {gap?: number; padY?: number; padX?: number; justify?: FlexJustify; align?: FlexAlign}
  ): SceneObject {
    return this.makeFlex(parent, FlexDirection.Row, width, height, opts)
  }

  private makeFlex(
    parent: SceneObject, direction: FlexDirection, width: number, height: number,
    opts?: {gap?: number; padY?: number; padX?: number; justify?: FlexJustify; align?: FlexAlign}
  ): SceneObject {
    const container = this.obj(parent, "Flex")
    this.liftInZ(container, LAYOUT_Z_LIFT)
    const fl = container.createComponent(FlexLayout.getTypeName()) as FlexLayout
    // Items are added manually via addItems() before init; disable
    // auto-discovery so addItems() doesn't throw on an uninitialized layout.
    fl.autoDiscoverItemsOnStart = false
    const fi = container.createComponent(FlexItem.getTypeName()) as FlexItem
    if (width > 0) fi.overrideWidth = width
    if (height > 0) fi.overrideHeight = height
    fl.onInitialized.add(() => {
      fl.width = width; fl.height = height; fl.direction = direction
      if (direction === FlexDirection.Row) fl.columnGap = opts?.gap ?? 0
      else fl.rowGap = opts?.gap ?? 0
      fl.paddingTop = opts?.padY ?? 0; fl.paddingBottom = opts?.padY ?? 0
      fl.paddingLeft = opts?.padX ?? 0; fl.paddingRight = opts?.padX ?? 0
      fl.justifyContent = opts?.justify ?? FlexJustify.Start
      fl.alignItems = opts?.align ?? FlexAlign.Stretch
    })
    return container
  }

  private flexChild(
    parent: SceneObject, size: {w?: number; h?: number; grow?: number},
    builder: (child: SceneObject) => void
  ): SceneObject {
    const child = this.obj(parent, "Item")
    this.liftInZ(child, LAYOUT_Z_LIFT)
    const fi = child.createComponent(FlexItem.getTypeName()) as FlexItem
    if (size.w !== undefined && size.w > 0) fi.overrideWidth = size.w
    if (size.h !== undefined && size.h > 0) fi.overrideHeight = size.h
    fi.flexGrow = size.grow ?? 0
    fi.flexShrink = 0
    builder(child)
    const parentFl = parent.getComponent(FlexLayout.getTypeName()) as FlexLayout | null
    if (parentFl) parentFl.addItems([fi])
    return child
  }
}

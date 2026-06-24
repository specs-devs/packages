// Preload ThemeService before any UIKit visual to break a circular-import init-order
// crash in the package (Visual.ts imports ThemeService before defining COLORS, and the
// theme chain reads COLORS at module-load). Entering the import cycle via ThemeService
// lets Visual.ts finish defining COLORS first. Must remain the FIRST import.
import "SpectaclesUIKit.lspkg/Scripts/Themes/ThemeService"
import {BackPlate, BackPlateStyle} from "SpectaclesUIKit.lspkg/Scripts/BackPlate"
import {ElementContent} from "SpectaclesUIKit.lspkg/Scripts/Components/Content/ElementContent"
import {Frame} from "SpectaclesUIKit.lspkg/Scripts/Components/Frame/Frame"
import {FlexItem} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexItem"
import {FlexLayout} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexLayout"
import {FlexAlign, FlexDirection, FlexJustify} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexTypes"
import {Slider} from "SpectaclesUIKit.lspkg/Scripts/Components/Slider/Slider"
import {Billboard} from "SpectaclesInteractionKit.lspkg/Components/Interaction/Billboard/Billboard"

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
// Lift interactive controls clear of the panel backing: their internal visuals
// depth-test against it and need a gap well above depth-buffer precision.
const CONTROL_Z_LIFT = 0.05
const FRAME_PADDING = new vec2(2.2, 2.2)

/**
 * Programmatic example: Sliders Layout
 *
 * Builds three labeled sliders with live value readout, entirely in code.
 * No @input wiring — the full UI hierarchy is created in buildUI().
 */
@component
export class ExampleSlidersLayout extends BaseScriptComponent {
  onAwake(): void {
    this.createEvent("OnStartEvent").bind(() => this.buildUI())
  }

  private buildUI(): void {
    const root = this.getSceneObject()
    root.createComponent(Billboard.getTypeName())
    root.getTransform().setWorldPosition(new vec3(0, 0, -110))

    const panelContent = this.scenePanel(root, "SlidersPanel", 30, 33)
    const outer = this.flexColumn(panelContent, 28, 31, {gap: 1.5, padX: 1, padY: 1})

    // Title
    this.flexChild(outer, {w: 26, h: 3}, (t) => {
      this.label(t, "Sliders", 26, 3, {textSize: 36, align: "left", fontWeight: "bold"})
    })

    const sliderDefs = [
      {label: "Volume", initial: 0.7},
      {label: "Brightness", initial: 0.5},
      {label: "Speed", initial: 0.3}
    ]

    sliderDefs.forEach(({label, initial}) => {
      this.flexChild(outer, {w: 26, h: 7}, (sliderGroup) => {
        const col = this.flexColumn(sliderGroup, 26, 7, {gap: 0.5})

        // Header row: label on left, value readout on right
        let valueText: Text
        this.flexChild(col, {w: 26, h: 2.2}, (headerObj) => {
          const row = this.flexRow(headerObj, 26, 2.2, {
            justify: FlexJustify.SpaceBetween,
            align: FlexAlign.Center
          })
          this.flexChild(row, {w: 18, h: 2.2, grow: 1}, (lObj) => {
            this.label(lObj, label, 18, 2.2, {textSize: 24, align: "left", fontWeight: "medium"})
          })
          this.flexChild(row, {w: 6, h: 2.2}, (vObj) => {
            valueText = this.dynamicText(
              vObj, "Value", `${Math.round(initial * 100)}%`,
              22, new vec3(0, 0, DYNAMIC_TEXT_Z_OFFSET),
              new vec4(1, 1, 1, 0.75), FONT_REGULAR, HorizontalAlignment.Right
            )
          })
        })

        // Slider row. The slider gets its own child object lifted clear of the
        // panel backing so its visuals depth-test against the panel with a gap
        // well above depth-buffer precision.
        this.flexChild(col, {w: 26, h: 4.2}, (sObj) => {
          const sliderObj = this.obj(sObj, "Slider", new vec3(0, 0, CONTROL_Z_LIFT))
          const slider = sliderObj.createComponent(Slider.getTypeName()) as Slider
          ;(slider as any)._themeOverride = "SnapOS2"
          ;(slider as any)._size = new vec3(26, 4, 1)
          slider.initialize()
          slider.updateCurrentValue(initial)
          slider.onValueChange.add((v: number) => {
            if (valueText) valueText.text = `${Math.round(v * 100)}%`
            print(`Slider "${label}": ${Math.round(v * 100)}%`)
          })
        })
      })
    })
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

  private dynamicText(
    parent: SceneObject, name: string, text: string, size: number,
    localPos: vec3, color: vec4, font: Font,
    hAlign: HorizontalAlignment = HorizontalAlignment.Center
  ): Text {
    const textObj = this.obj(parent, name, localPos)
    const tc = textObj.createComponent("Component.Text") as Text
    tc.text = text; tc.size = size; tc.textFill.color = color; tc.font = font
    tc.horizontalAlignment = hAlign
    tc.verticalAlignment = VerticalAlignment.Center
    tc.horizontalOverflow = HorizontalOverflow.Overflow
    tc.verticalOverflow = VerticalOverflow.Overflow
    const pass = (tc as any).getMaterial(0).mainPass
    pass.depthTest = true; pass.depthWrite = true
    return tc
  }

  private scenePanel(
    parent: SceneObject, name: string, width: number, height: number,
    mode: "frame" | "backplate" = "frame", style: BackPlateStyle = "dark"
  ): SceneObject {
    if (mode === "frame") {
      const frameObj = this.obj(parent, name)
      const frame = frameObj.createComponent(Frame.getTypeName()) as Frame
      frame.autoShowHide = false
      frame.allowTranslation = true
      frame.autoScaleContent = true
      ;(frame as any)._innerSize = new vec2(width, height)
      ;(frame as any)._padding = FRAME_PADDING
      return this.obj(frameObj, "FrameContent", new vec3(0, 0, PANEL_CONTENT_Z_LIFT))
    }
    const plateObj = this.obj(parent, name)
    const plate = plateObj.createComponent(BackPlate.getTypeName()) as BackPlate
    plate.style = style
    plate.size = new vec2(width, height)
    return this.obj(plateObj, "PanelContent", new vec3(0, 0, PANEL_CONTENT_Z_LIFT))
  }

  private content(
    so: SceneObject,
    opts: {
      text?: string; contentAlignment?: string; textSize?: number;
      paddingLeft?: number; paddingRight?: number; paddingTop?: number; paddingBottom?: number
      sizeOverride?: vec2; useThemeColors?: boolean; textColorOverride?: vec4; fontWeight?: FontWeight
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
    if (opts.paddingTop !== undefined) a._paddingTop = opts.paddingTop
    if (opts.paddingBottom !== undefined) a._paddingBottom = opts.paddingBottom
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
      paddingRight: align === "right" ? LABEL_EDGE_INSET : 0,
      paddingTop: 0, paddingBottom: 0
    })
  }

  private flexColumn(
    parent: SceneObject, width: number, height: number,
    opts?: {gap?: number; padY?: number; padX?: number; justify?: FlexJustify; align?: FlexAlign}
  ): SceneObject {
    return this.makeFlex(parent, FlexDirection.Column, width, height, opts)
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

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
import {ToggleGroup} from "SpectaclesUIKit.lspkg/Scripts/Components/Toggle/ToggleGroup"
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
const FRAME_PADDING = new vec2(2.2, 2.2)

/**
 * Programmatic example: Toggle Group Layout
 *
 * Builds a ToggleGroup of radio-style buttons — only one can be active at a time.
 * Buttons are created with _toggleable = true and registered via registerToggleable().
 * No @input wiring — the full UI hierarchy is created in buildUI().
 */
@component
export class ExampleToggleGroupLayout extends BaseScriptComponent {
  onAwake(): void {
    this.createEvent("OnStartEvent").bind(() => this.buildUI())
  }

  private buildUI(): void {
    const root = this.getSceneObject()
    root.createComponent(Billboard.getTypeName())
    root.getTransform().setWorldPosition(new vec3(0, 0, -110))

    const panelContent = this.scenePanel(root, "ToggleGroupPanel", 30, 28)
    const outer = this.flexColumn(panelContent, 28, 26, {gap: 1, padX: 1, padY: 1})

    // Title
    this.flexChild(outer, {w: 26, h: 3}, (t) => {
      this.label(t, "Toggle Group", 26, 3, {textSize: 36, align: "left", fontWeight: "bold"})
    })

    // Selection status
    let statusText: Text
    this.flexChild(outer, {w: 26, h: 2.5}, (statusObj) => {
      statusText = this.dynamicText(
        statusObj, "Status", "Selected: Option A",
        22, new vec3(0, 0, DYNAMIC_TEXT_Z_OFFSET),
        new vec4(1, 1, 1, 0.6), FONT_LIGHT, HorizontalAlignment.Left
      )
    })

    // ToggleGroup component lives on a container object
    const groupContainer = this.obj(panelContent, "ToggleGroupContainer")
    const toggleGroup = groupContainer.createComponent(ToggleGroup.getTypeName()) as ToggleGroup
    ;(toggleGroup as any)._allowAllTogglesOff = false

    // Toggle button list
    const list = this.flexColumn(panelContent, 28, 18, {gap: 0.7, padX: 1})
    const options = ["Option A", "Option B", "Option C", "Option D"]

    options.forEach((optLabel, index) => {
      this.flexChild(list, {w: 26, h: 4.4}, (rowObj) => {
        const btn = this.toggleBtn(rowObj, index === 0 ? "Primary" : "PrimaryNeutral", "Rectangle", 26, 4.4)
        this.content(rowObj, {
          text: optLabel,
          textSize: 26,
          fontWeight: "medium",
          contentAlignment: "left",
          paddingLeft: 1.5
        })
        // Register with ToggleGroup so only one can be on at a time
        toggleGroup.registerToggleable(btn, optLabel)
      })
    })

    // Listen for selection changes
    toggleGroup.onToggleSelected.add((args) => {
      const selected = args.value as string
      if (statusText) statusText.text = `Selected: ${selected}`
      print(`ToggleGroup: selected "${selected}"`)
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

  private btn(so: SceneObject, style: string, shape: string, width: number, height: number): Button {
    const button = so.createComponent(Button.getTypeName()) as Button
    ;(button as any)._themeOverride = "SnapOS2"
    ;(button as any)._shapeSnapOS2 = shape
    ;(button as any)._styleSnapOS2 = style
    ;(button as any)._size = new vec3(width, height, 1)
    button.initialize()
    return button
  }

  private toggleBtn(so: SceneObject, style: string, shape: string, width: number, height: number): Button {
    const button = so.createComponent(Button.getTypeName()) as Button
    ;(button as any)._themeOverride = "SnapOS2"
    ;(button as any)._shapeSnapOS2 = shape
    ;(button as any)._styleSnapOS2 = style
    ;(button as any)._size = new vec3(width, height, 1)
    ;(button as any)._toggleable = true
    button.initialize()
    return button
  }

  private content(
    so: SceneObject,
    opts: {
      text?: string; leadingIcon?: Texture; contentAlignment?: string; textSize?: number
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
    if (opts.leadingIcon) { a._useLeadingIcon = true; a._leadingIcon = opts.leadingIcon }
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

  private flexColumn(
    parent: SceneObject, width: number, height: number,
    opts?: {gap?: number; padY?: number; padX?: number; justify?: FlexJustify; align?: FlexAlign}
  ): SceneObject {
    return this.makeFlex(parent, FlexDirection.Column, width, height, opts)
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

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

const FONT_LIGHT: Font = requireAsset("../../Fonts/SpecsSans-Light.otf") as Font
const FONT_REGULAR: Font = requireAsset("../../Fonts/SpecsSans-Regular.otf") as Font
const FONT_MEDIUM: Font = requireAsset("../../Fonts/SpecsSans-Medium.otf") as Font
const FONT_BOLD: Font = requireAsset("../../Fonts/SpecsSans-Bold.otf") as Font

type FontWeight = "light" | "regular" | "medium" | "bold"

const CONTENT_Z_OFFSET = 0.08
const MODAL_CONTENT_Z_OFFSET = CONTENT_Z_OFFSET + 0.1
const LAYOUT_Z_LIFT = 0.005
const LABEL_EDGE_INSET = 0.75
const PANEL_CONTENT_Z_LIFT = 0.005
const MODAL_Z_OFFSET = 10

// Render order tiers — all must stay below the SIK cursor (DEFAULT_RENDER_ORDER = 100)
const PRIMARY_CONTENT_RO  = 8
const SCRIM_RENDER_ORDER   = 40
const MODAL_RENDER_ORDER   = 45   // modal plate
const MODAL_CONTENT_RO     = 55   // standalone labels (base RO = 0, text lands at 55)
const MODAL_BTN_CONTENT_RO = 3    // button ElementContent offset (base = button RO ~55, text lands at ~58)

/**
 * Programmatic example: Modal Layout
 *
 * Builds a primary panel with a "Show Modal" button that triggers a modal dialog.
 * The modal is a fixed BackPlate (non-movable) with Confirm / Cancel actions.
 * All inputs are configurable from the Inspector.
 */
@component
export class ExampleModalLayout extends BaseScriptComponent {

  // ── Test Mode ─────────────────────────────────────────────────────────
  @ui.label('<span style="color: #60A5FA; font-size: 13px;">Programmatic UI Component</span>')
  @ui.label('<span style="color: #94A3B8; font-size: 11px;">Builds the full layout at runtime. Adjust inputs and press Play to rebuild.</span>')
  @ui.label('<span style="color: #94A3B8; font-size: 11px;">Uncheck Test Mode to start with an empty panel — call component.showModal() from another script.</span>')
  @ui.separator
  @ui.group_start("Test Mode")
  @input
  @hint("Show demo title, description, and Show Modal button. Uncheck to start empty — call showModal() / hideModal() programmatically.")
  testMode: boolean = true
  @ui.group_end

  @ui.separator

  // ── Primary Frame ──────────────────────────────────────────────────────
  @ui.group_start("Primary Frame")
  @input
  @hint("Frame appearance style — 'Small', 'Medium', or 'Large'")
  frameAppearance: string = "Large"

  @input
  @hint("Content area size in cm (width × height). Matches the Frame 'Inner Size' property.")
  primaryInnerSize: vec2 = new vec2(30, 18)

  @input
  @hint("Border padding around the content area in cm. Matches the Frame 'Padding' property.")
  framePadding: vec2 = new vec2(0.8, 0.8)

  @input
  @hint("Auto-hide the frame handle bar when idle")
  frameAutoHide: boolean = false
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

  // ── Modal Dialog ───────────────────────────────────────────────────────
  @ui.separator
  @ui.group_start("Modal Dialog")
  @input
  @hint("Modal dialog size in cm (width × height)")
  modalInnerSize: vec2 = new vec2(28, 20)
  @ui.group_end

  // ── Primary Panel Text ─────────────────────────────────────────────────
  @ui.separator
  @ui.group_start("Primary Panel Text")
  @input
  @hint("Font size for the panel title")
  titleFontSize: number = 36

  @input
  @hint("Font size for the panel body description")
  bodyFontSize: number = 22

  @input
  @hint("Font size for the 'Show Modal' button")
  buttonFontSize: number = 26
  @ui.group_end

  // ── Modal Dialog Text ──────────────────────────────────────────────────
  @ui.separator
  @ui.group_start("Modal Dialog Text")
  @input
  @hint("Font size for the modal title")
  modalTitleFontSize: number = 32

  @input
  @hint("Font size for the modal body text")
  modalBodyFontSize: number = 22

  @input
  @hint("Font size for the Cancel / Confirm buttons")
  modalButtonFontSize: number = 24
  @ui.group_end

  private modalPanel: SceneObject | null = null
  private scrimPanel: SceneObject | null = null

  onAwake(): void {
    this.createEvent("OnStartEvent").bind(() => this.buildUI())
  }

  private buildUI(): void {
    const root = this.getSceneObject()
    root.createComponent(Billboard.getTypeName())
    root.getTransform().setWorldPosition(new vec3(this.positionX, this.positionY, this.positionZ))

    const pw = this.primaryInnerSize.x
    const ph = this.primaryInnerSize.y
    const mw = this.modalInnerSize.x
    const mh = this.modalInnerSize.y

    // ── Primary panel ──────────────────────────────────────────────────
    const primaryContent = this.scenePanel(root, "ModalDemoPanel", pw, ph, "frame", "dark",
      this.framePadding, this.frameAppearance, this.frameAutoHide, 0)
    const primaryLayout = this.flexColumn(primaryContent, pw - 2, ph - 2, {gap: 1.5, padX: 1, padY: 1})

    if (this.testMode) {
      this.flexChild(primaryLayout, {w: pw - 4, h: 3}, (t) => {
        this.label(t, "Modal Layout", pw - 4, 3, {
          textSize: this.titleFontSize, align: "left", fontWeight: "bold",
          renderOrderOffset: PRIMARY_CONTENT_RO
        })
      })

      this.flexChild(primaryLayout, {w: pw - 4, h: 2.5}, (d) => {
        this.label(d, "Tap the button below to show a confirmation modal.", pw - 4, 2.5, {
          textSize: this.bodyFontSize, align: "left", fontWeight: "light",
          color: new vec4(1, 1, 1, 0.65), renderOrderOffset: PRIMARY_CONTENT_RO
        })
      })
    }

    this.flexChild(primaryLayout, {w: pw - 4, h: 4.2}, (btnArea) => {
      const row = this.flexRow(btnArea, pw - 4, 4.2, {justify: FlexJustify.Center, align: FlexAlign.Center})
      this.flexChild(row, {w: 14, h: 4}, (btnObj) => {
        const btn = this.btn(btnObj, "Primary", "Capsule", 14, 4)
        this.content(btnObj, {text: "Show Modal", textSize: this.buttonFontSize, fontWeight: "medium",
          renderOrderOffset: 1})
        btn.onTriggerUp.add(() => this.showModal())
      })
    })

    // ── Scrim — darkens the primary panel while the modal is open ──────
    const scrimRoot = this.obj(root, "ModalScrim", new vec3(0, 0, MODAL_Z_OFFSET / 2))
    scrimRoot.enabled = false
    this.scrimPanel = scrimRoot
    const scrimPlate = scrimRoot.createComponent(BackPlate.getTypeName()) as BackPlate
    scrimPlate.style = "dark"
    scrimPlate.size = new vec2(pw, ph)
    ;(scrimPlate as any)._renderOrder = SCRIM_RENDER_ORDER

    // ── Modal panel — fixed BackPlate, initially hidden ────────────────
    const modalRoot = this.obj(root, "ModalRoot", new vec3(0, 0, MODAL_Z_OFFSET))
    modalRoot.enabled = false
    this.modalPanel = modalRoot

    const modalContent = this.scenePanel(modalRoot, "ModalDialog", mw, mh, "backplate", "dark",
      new vec2(0, 0), "Large", false, MODAL_RENDER_ORDER)
    const modalLayout = this.flexColumn(modalContent, mw - 2, mh - 2, {gap: 1.2, padX: 1, padY: 1.5})

    this.flexChild(modalLayout, {w: mw - 4, h: 3}, (t) => {
      this.label(t, "Confirm Action", mw - 4, 3, {
        textSize: this.modalTitleFontSize, align: "center", fontWeight: "bold",
        renderOrderOffset: MODAL_CONTENT_RO, zOffset: MODAL_CONTENT_Z_OFFSET
      })
    })

    this.flexChild(modalLayout, {w: mw - 4, h: 3.5}, (d) => {
      this.label(d, "Are you sure you want to proceed?\nThis action cannot be undone.", mw - 4, 3.5, {
        textSize: this.modalBodyFontSize, align: "center", fontWeight: "light",
        color: new vec4(1, 1, 1, 0.7), renderOrderOffset: MODAL_CONTENT_RO, zOffset: MODAL_CONTENT_Z_OFFSET
      })
    })

    this.flexChild(modalLayout, {w: mw - 4, h: 4.5}, (btnRow) => {
      const row = this.flexRow(btnRow, mw - 4, 4.5, {gap: 1, justify: FlexJustify.Center, align: FlexAlign.Center})

      this.flexChild(row, {w: 10, h: 4}, (cancelObj) => {
        const btn = this.btn(cancelObj, "Secondary", "Capsule", 10, 4, MODAL_RENDER_ORDER + 10)
        this.content(cancelObj, {text: "Cancel", textSize: this.modalButtonFontSize, fontWeight: "medium",
          renderOrderOffset: MODAL_BTN_CONTENT_RO, zOffset: MODAL_CONTENT_Z_OFFSET})
        btn.onTriggerUp.add(() => this.hideModal(false))
      })

      this.flexChild(row, {w: 10, h: 4}, (confirmObj) => {
        const btn = this.btn(confirmObj, "Primary", "Capsule", 10, 4, MODAL_RENDER_ORDER + 10)
        this.content(confirmObj, {text: "Confirm", textSize: this.modalButtonFontSize, fontWeight: "medium",
          renderOrderOffset: MODAL_BTN_CONTENT_RO, zOffset: MODAL_CONTENT_Z_OFFSET})
        btn.onTriggerUp.add(() => this.hideModal(true))
      })
    })
  }

  public showModal(): void {
    if (this.scrimPanel) this.scrimPanel.enabled = true
    if (this.modalPanel) this.modalPanel.enabled = true
    print("Modal: shown")
  }

  public hideModal(confirmed: boolean): void {
    if (this.modalPanel) this.modalPanel.enabled = false
    if (this.scrimPanel) this.scrimPanel.enabled = false
    print(`Modal: ${confirmed ? "confirmed" : "cancelled"}`)
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

  private scenePanel(
    parent: SceneObject, name: string, width: number, height: number,
    mode: "frame" | "backplate" = "frame", style: BackPlateStyle = "dark",
    framePad: vec2 = new vec2(0.8, 0.8),
    appearance: string = "Large",
    autoHide: boolean = false,
    renderOrder: number = 0
  ): SceneObject {
    if (mode === "frame") {
      const frameObj = this.obj(parent, name)
      const frame = frameObj.createComponent(Frame.getTypeName()) as Frame
      frame.autoShowHide = autoHide
      frame.allowTranslation = true
      frame.autoScaleContent = true
      ;(frame as any)._innerSize = new vec2(width, height)
      ;(frame as any)._padding = framePad
      ;(frame as any)._appearance = appearance
      ;(frame as any)._renderOrder = renderOrder
      return this.obj(frameObj, "FrameContent", new vec3(0, 0, PANEL_CONTENT_Z_LIFT))
    }
    const plateObj = this.obj(parent, name)
    const plate = plateObj.createComponent(BackPlate.getTypeName()) as BackPlate
    plate.style = style
    plate.size = new vec2(width, height)
    ;(plate as any)._renderOrder = renderOrder
    return this.obj(plateObj, "PanelContent", new vec3(0, 0, PANEL_CONTENT_Z_LIFT))
  }

  private btn(so: SceneObject, style: string, shape: string, width: number, height: number, renderOrder: number = 0): Button {
    const button = so.createComponent(Button.getTypeName()) as Button
    ;(button as any)._themeOverride = "SnapOS2"
    ;(button as any)._shapeSnapOS2 = shape
    ;(button as any)._styleSnapOS2 = style
    ;(button as any)._size = new vec3(width, height, 1)
    ;(button as any)._renderOrder = renderOrder
    button.initialize()
    return button
  }

  private content(
    so: SceneObject,
    opts: {
      text?: string; leadingIcon?: Texture; contentAlignment?: string; textSize?: number
      paddingLeft?: number; paddingRight?: number; sizeOverride?: vec2
      useThemeColors?: boolean; textColorOverride?: vec4; fontWeight?: FontWeight
      renderOrderOffset?: number; zOffset?: number
    }
  ): ElementContent {
    const ec = so.createComponent(ElementContent.getTypeName()) as ElementContent
    const a = ec as any
    a._zOffset = opts.zOffset ?? CONTENT_Z_OFFSET
    a._renderOrderOffset = opts.renderOrderOffset ?? PRIMARY_CONTENT_RO
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
    opts?: {textSize?: number; align?: string; color?: vec4; fontWeight?: FontWeight; renderOrderOffset?: number; zOffset?: number}
  ): ElementContent {
    const align = opts?.align ?? "center"
    return this.content(so, {
      text, sizeOverride: new vec2(width, height), useThemeColors: false,
      textSize: opts?.textSize ?? 32, contentAlignment: align,
      textColorOverride: opts?.color, fontWeight: opts?.fontWeight ?? "regular",
      paddingLeft: align === "left" ? LABEL_EDGE_INSET : 0,
      paddingRight: align === "right" ? LABEL_EDGE_INSET : 0,
      renderOrderOffset: opts?.renderOrderOffset,
      zOffset: opts?.zOffset
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

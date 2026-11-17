// Preload ThemeService before any UIKit visual to break a circular-import init-order
// crash in the package (Visual.ts imports ThemeService before defining COLORS, and the
// theme chain reads COLORS at module-load). Entering the import cycle via ThemeService
// lets Visual.ts finish defining COLORS first. Must remain the FIRST import.
import "UIKit.lspkg/Scripts/Themes/ThemeService"
import {Button} from "UIKit.lspkg/Scripts/Components/Button/Button"
import {BackPlate, BackPlateStyle} from "UIKit.lspkg/Scripts/BackPlate"
import {ElementContent} from "UIKit.lspkg/Scripts/Components/Content/ElementContent"
import {Frame} from "UIKit.lspkg/Scripts/Components/Frame/Frame"
import {FlexItem} from "UIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexItem"
import {FlexLayout} from "UIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexLayout"
import {FlexAlign, FlexDirection, FlexJustify} from "UIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexTypes"
import {ScrollWindow} from "UIKit.lspkg/Scripts/Components/ScrollWindow/ScrollWindow"

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
const PANEL_CONTENT_Z_LIFT = 0.05
const FRAME_PADDING = new vec2(2.2, 2.2)

const WINDOW_WIDTH = 26
const WINDOW_HEIGHT = 18
const ITEM_HEIGHT = 5
const ITEM_COUNT = 8
const ITEM_GAP = 0.6
const TOTAL_SCROLL_HEIGHT = ITEM_COUNT * (ITEM_HEIGHT + ITEM_GAP) - ITEM_GAP

const PANEL_W = 30 // frame inner size at build time
const PANEL_H = 26
const OUTER_W = PANEL_W - 2 // outer flex column, 1 cm chrome margin per side
const OUTER_H = PANEL_H - 2
const TITLE_H = 3
// Corner-grab resize limits (frame inner size, cm)
const FRAME_MIN_SIZE = new vec2(18, 14)
const FRAME_MAX_SIZE = new vec2(60, 46)

/**
 * Programmatic example: Scroll Window Layout
 *
 * Builds a ScrollWindow with a list of tappable items.
 * The scroll dimensions are calculated from item count and height.
 * No @input wiring — the full UI hierarchy is created in buildUI().
 *
 * Web-style frame resize (flexLayoutResize checkbox): the panel Frame has
 * `autoScaleContent` off and `allowNonUniformScaling` on, so pinching a
 * corner changes the frame's inner area per axis instead of zooming the
 * content. `onSizeChanged` feeds the new size into the flex layouts
 * (reflow) and the ScrollWindow mask (crop) — content keeps its 1× scale,
 * like resizing a browser window with `overflow: hidden`.
 */
@component
export class ExampleScrollWindowLayout extends BaseScriptComponent {
  @input
  @hint(
    "Corner-grab resize behavior. <br><br><b>ON — flex layout:</b> web-style resize. Grabbing a corner changes the frame's inner area per axis; content keeps its 1× scale and the layout reflows to the new size, cropping overflow where a mask exists — like resizing a browser window. <br><br><b>OFF — scaling:</b> grabbing a corner uniformly scales the frame and everything inside it, preserving proportions — like zooming an image."
  )
  flexLayoutResize: boolean = false

  private frame: Frame | null = null
  private outerLayout: FlexLayout | null = null
  private titleItem: FlexItem | null = null
  private titleContent: ElementContent | null = null
  private scrollItem: FlexItem | null = null
  private scrollWindow: ScrollWindow | null = null
  private listLayout: FlexLayout | null = null
  private listItems: FlexItem[] = []

  onAwake(): void {
    this.createEvent("OnStartEvent").bind(() => this.buildUI())
  }

  private buildUI(): void {
    const root = this.getSceneObject()
    // Relative to the parent, so the layout moves with wherever its example is placed.
    root.getTransform().setLocalPosition(new vec3(0, 0, -110))

    const panelContent = this.scenePanel(root, "ScrollWindowPanel", PANEL_W, PANEL_H)
    const outer = this.flexColumn(panelContent, OUTER_W, OUTER_H, {gap: 0.8, padX: 1, padY: 0.5})
    this.outerLayout = outer.getComponent(FlexLayout.getTypeName()) as FlexLayout

    // Title
    this.flexChild(outer, {w: WINDOW_WIDTH, h: TITLE_H}, (t) => {
      this.titleItem = t.getComponent(FlexItem.getTypeName()) as FlexItem
      this.titleContent = this.label(t, "Scroll Window", WINDOW_WIDTH, TITLE_H, {
        textSize: 36, align: "left", fontWeight: "bold"
      })
    })

    // ScrollWindow container
    this.flexChild(outer, {w: WINDOW_WIDTH, h: WINDOW_HEIGHT}, (scrollContainer) => {
      this.scrollItem = scrollContainer.getComponent(FlexItem.getTypeName()) as FlexItem
      const sw = scrollContainer.createComponent(ScrollWindow.getTypeName()) as ScrollWindow
      sw.vertical = true
      sw.horizontal = false
      sw.windowSize = new vec2(WINDOW_WIDTH, WINDOW_HEIGHT)
      sw.scrollDimensions = new vec2(WINDOW_WIDTH, TOTAL_SCROLL_HEIGHT)
      sw.edgeFade = true
      this.scrollWindow = sw

      // Scrollable content — a vertical list of buttons
      // The window rests at scroll position 0 showing the authored view and scrolls down through
      // [0, TOTAL - WINDOW]: top-anchor the list so it starts at its first item.
      const listContainer = this.obj(
        scrollContainer, "ScrollContent", new vec3(0, -(TOTAL_SCROLL_HEIGHT - WINDOW_HEIGHT) / 2, 0)
      )
      const list = this.flexColumn(listContainer, WINDOW_WIDTH, TOTAL_SCROLL_HEIGHT, {gap: ITEM_GAP})
      this.listLayout = list.getComponent(FlexLayout.getTypeName()) as FlexLayout

      for (let i = 0; i < ITEM_COUNT; i++) {
        const itemLabel = `Item ${i + 1}`
        this.flexChild(list, {w: WINDOW_WIDTH, h: ITEM_HEIGHT}, (itemObj) => {
          this.listItems.push(itemObj.getComponent(FlexItem.getTypeName()) as FlexItem)
          const btn = this.btn(itemObj, "Primary", "Rectangle", WINDOW_WIDTH, ITEM_HEIGHT)
          this.content(itemObj, {
            text: itemLabel,
            textSize: 26,
            fontWeight: "medium",
            contentAlignment: "left",
            paddingLeft: 1.5
          })
          btn.onTriggerUp.add(() => {
            print(`ScrollWindow: tapped "${itemLabel}"`)
          })
        })
      }
    })

    // Corner-grab → reflow. Fires on every scaling update while dragging.
    if (this.flexLayoutResize) {
      this.frame?.onSizeChanged.add(() => this.reflowToFrameSize())
    }
  }

  /**
   * Pushes the frame's current inner size into the layout tree as deltas
   * from the build-time dimensions. Widths track the frame on both axes;
   * vertically only the ScrollWindow viewport grows/shrinks — the list
   * content keeps its full height, so a shorter frame crops the list
   * (mask) rather than squashing it.
   */
  private reflowToFrameSize(): void {
    if (!this.frame) return
    const dx = this.frame.innerSize.x - PANEL_W
    const dy = this.frame.innerSize.y - PANEL_H
    const contentW = WINDOW_WIDTH + dx

    if (this.outerLayout) {
      this.outerLayout.width = OUTER_W + dx
      this.outerLayout.height = OUTER_H + dy
    }
    if (this.titleItem) this.titleItem.overrideWidth = contentW
    if (this.titleContent) this.titleContent.sizeOverride = new vec2(contentW, TITLE_H)
    if (this.scrollItem) {
      this.scrollItem.overrideWidth = contentW
      this.scrollItem.overrideHeight = WINDOW_HEIGHT + dy
    }
    // The flex pass resizes the ScrollWindow itself (its Element-branded
    // width/height setters update the mask); scrollDimensions must track
    // the width by hand so rows span the new window, while its height
    // stays TOTAL_SCROLL_HEIGHT to keep the full list scrollable.
    if (this.scrollWindow) this.scrollWindow.scrollDimensions = new vec2(contentW, TOTAL_SCROLL_HEIGHT)
    if (this.listLayout) this.listLayout.width = contentW
    for (const item of this.listItems) item.overrideWidth = contentW
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
    mode: "frame" | "backplate" = "frame", style: BackPlateStyle = "dark"
  ): SceneObject {
    if (mode === "frame") {
      const frameObj = this.obj(parent, name)
      const frame = frameObj.createComponent(Frame.getTypeName()) as Frame
      frame.autoShowHide = false
      frame.allowTranslation = true
      // Flex mode: content keeps its 1× scale while the corner grab changes
      // the inner area per axis; reflowToFrameSize() re-lays-out the flex
      // content and the ScrollWindow mask crops the overflow. Scaling mode:
      // the frame zooms its content uniformly (UIKit default).
      frame.autoScaleContent = !this.flexLayoutResize
      frame.allowNonUniformScaling = this.flexLayoutResize
      ;(frame as any)._innerSize = new vec2(width, height)
      ;(frame as any)._padding = FRAME_PADDING
      ;(frame as any)._minimumSize = FRAME_MIN_SIZE
      ;(frame as any)._maximumSize = FRAME_MAX_SIZE
      this.frame = frame
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
    ;(button as any)._shapeSystem3 = shape
    ;(button as any)._styleSystem3 = style
    button.size = new vec3(width, height, 1)
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
    ec.hostRenderOrderOffset = CONTENT_RENDER_ORDER_OFFSET
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

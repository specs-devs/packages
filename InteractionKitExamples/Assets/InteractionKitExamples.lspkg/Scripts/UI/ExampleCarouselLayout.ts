// Preload ThemeService before any UIKit visual to break a circular-import init-order
// crash in the package (Visual.ts imports ThemeService before defining COLORS, and the
// theme chain reads COLORS at module-load). Entering the import cycle via ThemeService
// lets Visual.ts finish defining COLORS first. Must remain the FIRST import.
import "UIKit.lspkg/Scripts/Themes/ThemeService"
import {Button} from "UIKit.lspkg/Scripts/Components/Button/Button"
import {ElementContent} from "UIKit.lspkg/Scripts/Components/Content/ElementContent"
import {IMAGE_MATERIAL_ASSET} from "UIKit.lspkg/Scripts/Utility/Assets"
import {Frame} from "UIKit.lspkg/Scripts/Components/Frame/Frame"
import {FlexItem} from "UIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexItem"
import {FlexLayout} from "UIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexLayout"
import {FlexAlign, FlexDirection, FlexJustify} from "UIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexTypes"
import {ScrollWindow} from "UIKit.lspkg/Scripts/Components/ScrollWindow/ScrollWindow"


const FONT_LIGHT: Font   = requireAsset("../../Fonts/SpecsSans-Light.otf")   as Font
const FONT_REGULAR: Font = requireAsset("../../Fonts/SpecsSans-Regular.otf") as Font
const FONT_MEDIUM: Font  = requireAsset("../../Fonts/SpecsSans-Medium.otf")  as Font
const FONT_BOLD: Font    = requireAsset("../../Fonts/SpecsSans-Bold.otf")    as Font

type FontWeight = "light" | "regular" | "medium" | "bold"

const CONTENT_Z_OFFSET           = 0.08
const CONTENT_RENDER_ORDER_OFFSET = 8
const LAYOUT_Z_LIFT              = 0.02
const LABEL_EDGE_INSET           = 0.75
const PANEL_CONTENT_Z_LIFT       = 0.05
const TITLE_H                    = 3
const SECTION_H                  = 2
// Reflow floor — the frame can shrink to its 10 cm minimum, which would drive a
// derived viewport dimension non-positive; keep widths/heights clamped positive.
const MIN_VIEWPORT               = 2

/**
 * Programmatic example: Double Horizontal Carousel
 *
 * Two independent horizontally-scrollable card rows inside a Frame panel.
 * Cards show an image when one is supplied, otherwise fall back to a text label.
 * All dimensions are exposed as @input parameters — adjust and press Play to rebuild.
 *
 * Web-style frame resize (flexLayoutResize checkbox): the panel Frame has
 * `autoScaleContent` off and `allowNonUniformScaling` on, so pinching a corner
 * changes the frame's inner area per axis instead of zooming the content.
 * `onSizeChanged` widens each carousel viewport to reveal more of the fixed
 * card strip and tracks the title / section-header widths (reflow) — cards keep
 * their 1× scale, like resizing a browser window with `overflow: hidden`.
 */
@component
export class ExampleCarouselLayout extends BaseScriptComponent {

  @ui.label('<span style="color: #60A5FA; font-size: 13px;">Programmatic UI Component</span>')
  @ui.label('<span style="color: #94A3B8; font-size: 11px;">Two horizontal carousels built at runtime. Adjust inputs and press Play to rebuild.</span>')
  @ui.label('<span style="color: #94A3B8; font-size: 11px;">Uncheck Test Mode to start empty — populate row1Items / row2Items via API before Play.</span>')
  @ui.separator

  // ── Test Mode ─────────────────────────────────────────────────────────
  @ui.group_start("Test Mode")
  @input
  @hint("Fill both carousels with mockup cards automatically. Uncheck to start empty and populate via row1Items / row2Items.")
  testMode: boolean = true
  @ui.group_end

  @ui.separator

  // ── Panel ──────────────────────────────────────────────────────────────
  @ui.group_start("Panel")
  @input
  @hint("Title text shown at the top of the panel")
  panelTitle: string = "Carousel"
  @ui.group_end

  // ── Frame ──────────────────────────────────────────────────────────────
  @ui.separator
  @ui.group_start("Frame")
  @input
  @hint(
    "Corner-grab resize behavior. <br><br><b>ON — flex layout:</b> web-style resize. Grabbing a corner changes the frame's inner area per axis; content keeps its 1× scale and the layout reflows to the new size, cropping overflow where a mask exists — like resizing a browser window. <br><br><b>OFF — scaling:</b> grabbing a corner uniformly scales the frame and everything inside it, preserving proportions — like zooming an image."
  )
  flexLayoutResize: boolean = false

  @input
  @hint("Inner content area in cm (width × height) — the frame chrome sits outside this")
  frameInnerSize: vec2 = new vec2(36, 28)

  @input
  @hint("Frame chrome thickness in cm — how far the rounded border extends past the content edge")
  framePadding: vec2 = new vec2(1.0, 1.0)

  @input
  @hint("Inset between frame edge and carousel content — X = left/right, Y = top/bottom (cm)")
  contentInset: vec2 = new vec2(1.5, 1.0)

  @input
  @hint("Frame appearance style — 'Large' (far-field) or 'Small' (near-field)")
  frameAppearance: string = "Large"

  @input
  @hint("Show the × close button on the frame")
  showCloseButton: boolean = true

  @input
  @hint("Show the follow / grip button on the frame")
  showFollowButton: boolean = true

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
  @hint("Offset from the parent in cm (negative Z = in front)")
  positionZ: number = -110
  @ui.group_end

  // ── Row 1 ──────────────────────────────────────────────────────────────
  @ui.separator
  @ui.group_start("Row 1")
  @input
  @hint("Section header label for the first row")
  row1Label: string = "Featured"

  @input
  @hint("Number of cards in row 1")
  row1Count: number = 8

  @input
  @hint("Button style (System 3.0) — e.g. 'Primary', 'Secondary', 'Prism', 'Ghost'")
  row1CardStyle: string = "Primary"

  @input
  @hint("Button shape — 'Rectangle' or 'Capsule'")
  row1CardShape: string = "Rectangle"

  @input
  @hint("Card images for row 1 (in order). If fewer than row1Count, remaining cards show a text label.")
  row1Images: Texture[] = []
  @ui.group_end

  // ── Row 2 ──────────────────────────────────────────────────────────────
  @ui.separator
  @ui.group_start("Row 2")
  @input
  @hint("Section header label for the second row")
  row2Label: string = "Recommended"

  @input
  @hint("Number of cards in row 2")
  row2Count: number = 8

  @input
  @hint("Button style (System 3.0) — e.g. 'Primary', 'Secondary', 'Prism', 'Ghost'")
  row2CardStyle: string = "Secondary"

  @input
  @hint("Button shape — 'Rectangle' or 'Capsule'")
  row2CardShape: string = "Rectangle"

  @input
  @hint("Card images for row 2 (in order). If fewer than row2Count, remaining cards show a text label.")
  row2Images: Texture[] = []
  @ui.group_end

  // ── Cards ──────────────────────────────────────────────────────────────
  @ui.separator
  @ui.group_start("Cards")
  @input
  @hint("How many cards are fully visible at once per row. Card width is auto-computed to fill the carousel.")
  visibleCards: number = 3

  @input
  @hint("Gap between consecutive cards in cm")
  cardGap: number = 0.8

  @input
  @hint("Image size within the card in cm — used when a texture is supplied")
  cardImageSize: number = 5.5
  @ui.group_end

  // ── Typography ─────────────────────────────────────────────────────────
  @ui.separator
  @ui.group_start("Typography")
  @input
  @hint("Font size for the panel title")
  titleTextSize: number = 36

  @input
  @hint("Font size for section header labels")
  sectionTextSize: number = 22

  @input
  @hint("Font size for card text labels (shown when no image is supplied)")
  cardTextSize: number = 22

  @ui.separator
  @ui.label('<span style="color: #94A3B8; font-size: 11px;">Font slots are optional — SpecsSans is auto-loaded from the Fonts folder when left empty.</span>')

  @input
  @hint("Light weight font — auto-loads SpecsSans-Light if empty")
  fontLight: Font

  @input
  @hint("Regular weight font — auto-loads SpecsSans-Regular if empty")
  fontRegular: Font

  @input
  @hint("Medium weight font — auto-loads SpecsSans-Medium if empty")
  fontMedium: Font

  @input
  @hint("Bold font — auto-loads SpecsSans-Bold if empty")
  fontBold: Font
  @ui.group_end

  // ─── Public item API ─────────────────────────────────────────────────

  public row1Items: {label: string; image?: Texture}[] = []
  public row2Items: {label: string; image?: Texture}[] = []

  // ─── Reflow state ─────────────────────────────────────────────────────
  // Captured at build time and reused by reflowToFrameSize() as deltas from
  // the frame's current innerSize. Only populated when flexLayoutResize is on.

  private frame: Frame | null = null
  private outerLayout: FlexLayout | null = null
  private titleItem: FlexItem | null = null
  private titleContent: ElementContent | null = null
  private sectionItems: FlexItem[] = []
  private sectionContents: ElementContent[] = []
  private carouselSlots: FlexItem[] = []
  private carouselStrips: {scroll: ScrollWindow; stripW: number}[] = []
  private buildInnerSize: vec2 = new vec2(0, 0)
  private buildContentW: number = 0
  private buildCarouselW: number = 0
  private buildCarouselH: number = 0

  // ─── Lifecycle ────────────────────────────────────────────────────────

  onAwake(): void {
    this.createEvent("OnStartEvent").bind(() => this.buildUI())
  }

  // ─── Build ────────────────────────────────────────────────────────────

  private buildUI(): void {
    if (this.testMode) {
      if (this.row1Items.length === 0) {
        const imgs1 = this.row1Images
        for (let i = 0; i < this.row1Count; i++) {
          const img = imgs1.length > 0 ? imgs1[Math.floor(Math.random() * imgs1.length)] : undefined
          this.row1Items.push({label: `${this.row1Label} ${i + 1}`, image: img})
        }
      }
      if (this.row2Items.length === 0) {
        const imgs2 = this.row2Images
        for (let i = 0; i < this.row2Count; i++) {
          const img = imgs2.length > 0 ? imgs2[Math.floor(Math.random() * imgs2.length)] : undefined
          this.row2Items.push({label: `${this.row2Label} ${i + 1}`, image: img})
        }
      }
    }
    const root = this.getSceneObject()
    // Relative to the parent, so the layout moves with wherever its example is placed.
    root.getTransform().setLocalPosition(new vec3(this.positionX, this.positionY, this.positionZ))

    const PW         = this.frameInnerSize.x
    const PH         = this.frameInnerSize.y
    const PAD_X      = this.contentInset.x
    const PAD_Y      = this.contentInset.y
    const GAP        = 0.5
    const CONTENT_W  = PW - 2 * PAD_X
    const CAROUSEL_W = CONTENT_W

    // Auto-compute card width to fill the visible carousel area exactly
    const n          = Math.max(1, this.visibleCards)
    const cardW      = (CAROUSEL_W - (n - 1) * this.cardGap) / n

    // Auto-compute card height to fill available vertical space
    // Available height minus title, two section headers, and all row gaps (5 items → 4 gaps)
    const fixedH     = TITLE_H + SECTION_H * 2 + GAP * 4
    const cardH      = (PH - 2 * PAD_Y - fixedH) / 2 - 0.5  // 0.5 breathing room per row

    const CAROUSEL_H = cardH + 0.5

    // Reflow baselines — card size is fixed, so only widths (and split height)
    // change; reflowToFrameSize() reads these against the frame's live innerSize.
    this.buildInnerSize  = new vec2(PW, PH)
    this.buildContentW   = CONTENT_W
    this.buildCarouselW  = CAROUSEL_W
    this.buildCarouselH  = CAROUSEL_H

    const panelContent = this.scenePanel(root, "CarouselPanel", PW, PH)

    const outer = this.flexColumn(panelContent, PW, PH, {
      gap: GAP, padX: PAD_X, padY: PAD_Y
    })
    this.outerLayout = outer.getComponent(FlexLayout.getTypeName()) as FlexLayout

    // ── Title ─────────────────────────────────────────────────────────
    this.flexChild(outer, {w: CONTENT_W, h: TITLE_H}, (t) => {
      this.titleItem = t.getComponent(FlexItem.getTypeName()) as FlexItem
      this.titleContent = this.label(t, this.panelTitle, CONTENT_W, TITLE_H, {
        textSize: this.titleTextSize, align: "left", fontWeight: "bold"
      })
    })

    // ── Row 1 ─────────────────────────────────────────────────────────
    this.flexChild(outer, {w: CONTENT_W, h: SECTION_H}, (t) => {
      this.sectionItems.push(t.getComponent(FlexItem.getTypeName()) as FlexItem)
      this.sectionContents.push(this.label(t, this.row1Label, CONTENT_W, SECTION_H, {
        textSize: this.sectionTextSize, align: "left", fontWeight: "medium",
        color: new vec4(1, 1, 1, 0.65)
      }))
    })

    // ScrollWindow must NOT be on the FlexItem directly — wrap it one level deeper.
    this.flexChild(outer, {w: CAROUSEL_W, h: CAROUSEL_H}, (slot) => {
      this.carouselSlots.push(slot.getComponent(FlexItem.getTypeName()) as FlexItem)
      const sc = this.obj(slot, "ScrollContainer")
      const built = this.buildCarousel(sc, this.row1Items, this.row1CardStyle, this.row1CardShape, CAROUSEL_W, CAROUSEL_H, cardW, cardH)
      if (built) this.carouselStrips.push(built)
    })

    // ── Row 2 ─────────────────────────────────────────────────────────
    this.flexChild(outer, {w: CONTENT_W, h: SECTION_H}, (t) => {
      this.sectionItems.push(t.getComponent(FlexItem.getTypeName()) as FlexItem)
      this.sectionContents.push(this.label(t, this.row2Label, CONTENT_W, SECTION_H, {
        textSize: this.sectionTextSize, align: "left", fontWeight: "medium",
        color: new vec4(1, 1, 1, 0.65)
      }))
    })

    this.flexChild(outer, {w: CAROUSEL_W, h: CAROUSEL_H}, (slot) => {
      this.carouselSlots.push(slot.getComponent(FlexItem.getTypeName()) as FlexItem)
      const sc = this.obj(slot, "ScrollContainer")
      const built = this.buildCarousel(sc, this.row2Items, this.row2CardStyle, this.row2CardShape, CAROUSEL_W, CAROUSEL_H, cardW, cardH)
      if (built) this.carouselStrips.push(built)
    })

    // Corner-grab → reflow. Fires on every scaling update while dragging.
    if (this.flexLayoutResize) {
      this.frame?.onSizeChanged.add(() => this.reflowToFrameSize())
    }
  }

  /**
   * Pushes the frame's current inner size into the layout tree as deltas from
   * the build-time dimensions. Card size is fixed: widths track the frame on
   * both carousels and headers, and the extra height is split between the two
   * carousel viewports. Each ScrollWindow sits below its FlexItem (not on it),
   * so the flex pass can't resize its mask — the viewport size is pushed in by
   * hand while scrollDimensions keeps the fixed strip width, so a wider frame
   * reveals more of the strip (edge-fade crops the rest) and a narrower one
   * hides cards. The strip is untouched, so paging stays consistent and the
   * ScrollWindow re-clamps any now-out-of-bounds offset on its next update.
   */
  private reflowToFrameSize(): void {
    if (!this.frame) return
    const dx = this.frame.innerSize.x - this.buildInnerSize.x
    const dy = this.frame.innerSize.y - this.buildInnerSize.y
    const contentW  = Math.max(this.buildContentW + dx, MIN_VIEWPORT)
    const carouselW = Math.max(this.buildCarouselW + dx, MIN_VIEWPORT)
    const carouselH = Math.max(this.buildCarouselH + dy / 2, MIN_VIEWPORT)

    if (this.outerLayout) {
      this.outerLayout.width  = this.frame.innerSize.x
      this.outerLayout.height = this.frame.innerSize.y
    }
    if (this.titleItem)    this.titleItem.overrideWidth = contentW
    if (this.titleContent) this.titleContent.sizeOverride = new vec2(contentW, TITLE_H)
    for (const item of this.sectionItems) item.overrideWidth = contentW
    for (const content of this.sectionContents) content.sizeOverride = new vec2(contentW, SECTION_H)

    for (const slot of this.carouselSlots) {
      slot.overrideWidth  = carouselW
      slot.overrideHeight = carouselH
    }
    for (const strip of this.carouselStrips) {
      strip.scroll.windowSize = new vec2(carouselW, carouselH)
      strip.scroll.scrollDimensions = new vec2(Math.max(strip.stripW, carouselW), carouselH)
    }
  }

  private buildCarousel(
    scrollContainer: SceneObject,
    items: {label: string; image?: Texture}[],
    cardStyle: string,
    cardShape: string,
    carouselW: number,
    carouselH: number,
    cardW: number,
    cardH: number
  ): {scroll: ScrollWindow; stripW: number} | null {
    if (items.length === 0) return null
    const totalW = items.length * (cardW + this.cardGap) - this.cardGap

    const sw = scrollContainer.createComponent(ScrollWindow.getTypeName()) as ScrollWindow
    sw.vertical         = false
    sw.horizontal       = true
    sw.windowSize       = new vec2(carouselW, carouselH)
    sw.scrollDimensions = new vec2(Math.max(totalW, carouselW), carouselH)
    sw.edgeFade         = true

    // The window rests at scroll position 0 showing the authored view and scrolls right through
    // x in [-(D - W), 0]: left-anchor the strip so it starts at its first card.
    const scrollContent = this.obj(
      scrollContainer, "ScrollContent", new vec3((Math.max(totalW, carouselW) - carouselW) / 2, 0, 0)
    )

    const row = this.flexRow(scrollContent, totalW, carouselH, {
      gap: this.cardGap,
      align: FlexAlign.Center
    })

    for (const item of items) {
      const label = item.label
      const tex   = item.image
      this.flexChild(row, {w: cardW, h: cardH}, (cardObj) => {
        const btn = this.btn(cardObj, cardStyle, cardShape, cardW, cardH)
        if (tex) {
          this.buildImageCard(cardObj, label, tex, cardW, cardH, btn)
        } else {
          this.content(cardObj, {
            text: label, textSize: this.cardTextSize,
            fontWeight: "medium", contentAlignment: "center"
          })
        }
        btn.onTriggerUp.add(() => print(`Carousel: tapped "${label}"`))
      })
    }

    return {scroll: sw, stripW: totalW}
  }

  private buildImageCard(
    cardObj: SceneObject, label: string, tex: Texture, cardW: number, cardH: number, button: Button
  ): void {
    const lblH    = 2.2
    const gap     = 0.4
    const imgSize = Math.min(this.cardImageSize, cardH - lblH - gap - 0.6)

    const inner = this.obj(cardObj, "CardContent")
    // In front of the button's face (its contentZOffset: half its depth plus the bevel), like UIKit's
    // own ElementContent; at CONTENT_Z_OFFSET alone the image and label sat inside the 1 cm button
    // and the card looked hollow / see-through from an angle.
    const face = (button as any).contentZOffset ?? 0.5
    this.liftInZ(inner, face + CONTENT_Z_OFFSET)

    const flex = inner.createComponent(FlexLayout.getTypeName()) as FlexLayout
    // Items are added manually via addItems() before init; disable
    // auto-discovery so addItems() doesn't throw on an uninitialized layout.
    flex.autoDiscoverItemsOnStart = false
    flex.onInitialized.add(() => {
      flex.width          = cardW
      flex.height         = cardH
      flex.direction      = FlexDirection.Column
      flex.justifyContent = FlexJustify.Center
      flex.alignItems     = FlexAlign.Center
      flex.rowGap         = gap
    })

    // Image — centered, fixed size
    this.flexChild(inner, {w: imgSize, h: imgSize}, (imgObj) => {
      const imgComp = imgObj.createComponent("Component.Image") as Image
      imgComp.mainMaterial = IMAGE_MATERIAL_ASSET.clone()
      imgComp.mainPass.baseTex = tex
      imgComp.renderOrder = CONTENT_RENDER_ORDER_OFFSET + 1
    })

    // Label — tight single-line slot directly below image
    this.flexChild(inner, {w: cardW - 1.0, h: lblH}, (lblObj) => {
      this.label(lblObj, label, cardW - 1.0, lblH, {
        textSize: this.cardTextSize, align: "center", fontWeight: "medium"
      })
    })
  }

  // ─── Composition helpers ──────────────────────────────────────────────

  private fontForWeight(weight: FontWeight): Font {
    switch (weight) {
      case "light":  return this.fontLight   || FONT_LIGHT
      case "medium": return this.fontMedium  || FONT_MEDIUM
      case "bold":   return this.fontBold    || FONT_BOLD
      default:       return this.fontRegular || FONT_REGULAR
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

  private scenePanel(parent: SceneObject, name: string, width: number, height: number): SceneObject {
    const frameObj = this.obj(parent, name)
    const frame    = frameObj.createComponent(Frame.getTypeName()) as Frame

    // ButtonManagerConstants only accepts "Large" or "Small" — guard against
    // undefined/@input unset or any other string the inspector might supply.
    const safeAppearance = this.frameAppearance === "Small" ? "Small" : "Large"

    ;(frame as any)._appearance = safeAppearance
    ;(frame as any)._innerSize  = new vec2(width, height)
    ;(frame as any)._padding    = this.framePadding
    frame.autoShowHide     = this.frameAutoHide
    frame.allowTranslation = this.showFollowButton
    // Flex mode: content keeps its 1× scale while the corner grab changes the
    // inner area per axis; reflowToFrameSize() re-lays-out the flex content and
    // each ScrollWindow mask crops the overflow. Scaling mode: the frame zooms
    // its content uniformly (UIKit default).
    frame.autoScaleContent       = !this.flexLayoutResize
    frame.allowNonUniformScaling = this.flexLayoutResize
    this.frame = frame

    // onInitialized fires after appearance setter runs (Frame.ts:1185),
    // so ButtonManagerConstants[appearance] is always defined here.
    frame.onInitialized.add(() => {
      frame.showCloseButton  = this.showCloseButton
      frame.showFollowButton = this.showFollowButton
    })

    return this.obj(frameObj, "FrameContent", new vec3(0, 0, PANEL_CONTENT_Z_LIFT))
  }

  private btn(so: SceneObject, style: string, shape: string, width: number, height: number): Button {
    const button = so.createComponent(Button.getTypeName()) as Button
    ;(button as any)._shapeSystem3  = shape
    ;(button as any)._styleSystem3  = style
    button.size          = new vec3(width, height, 1)
    button.initialize()
    return button
  }

  private content(
    so: SceneObject,
    opts: {
      text?: string; contentAlignment?: string; textSize?: number
      paddingLeft?: number; paddingRight?: number; sizeOverride?: vec2
      useThemeColors?: boolean; textColorOverride?: vec4; fontWeight?: FontWeight
      leadingIcon?: Texture; iconLayout?: string; leadingIconSize?: number
    }
  ): ElementContent {
    const ec = so.createComponent(ElementContent.getTypeName()) as ElementContent
    const a  = ec as any
    a._zOffset           = CONTENT_Z_OFFSET
    ec.hostRenderOrderOffset = CONTENT_RENDER_ORDER_OFFSET
    a._font              = this.fontForWeight(opts.fontWeight ?? "regular")
    if (opts.text !== undefined)             a._text             = opts.text
    if (opts.contentAlignment)               a._contentAlignment = opts.contentAlignment
    if (opts.textSize)                       a._textSize         = opts.textSize
    if (opts.paddingLeft  !== undefined)     a._paddingLeft      = opts.paddingLeft
    if (opts.paddingRight !== undefined)     a._paddingRight     = opts.paddingRight
    if (opts.sizeOverride)                   a._sizeOverride     = opts.sizeOverride
    if (opts.useThemeColors !== undefined)   a._useThemeColors   = opts.useThemeColors
    if (opts.leadingIcon) {
      a._useLeadingIcon  = true
      a._leadingIcon     = opts.leadingIcon
    }
    if (opts.iconLayout)                     a._iconLayout       = opts.iconLayout
    if (opts.leadingIconSize !== undefined)  a._leadingIconSize  = opts.leadingIconSize
    if (opts.textColorOverride) {
      a._useTextColorOverride = true
      a._textColorOverride    = opts.textColorOverride
    }
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
      paddingLeft:  align === "left"  ? LABEL_EDGE_INSET : 0,
      paddingRight: align === "right" ? LABEL_EDGE_INSET : 0
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
    const fi = container.createComponent(FlexItem.getTypeName())   as FlexItem
    if (width  > 0) fi.overrideWidth  = width
    if (height > 0) fi.overrideHeight = height
    fl.onInitialized.add(() => {
      fl.width  = width
      fl.height = height
      fl.direction = direction
      if (direction === FlexDirection.Row) fl.columnGap = opts?.gap ?? 0
      else                                 fl.rowGap    = opts?.gap ?? 0
      fl.paddingTop    = opts?.padY ?? 0
      fl.paddingBottom = opts?.padY ?? 0
      fl.paddingLeft   = opts?.padX ?? 0
      fl.paddingRight  = opts?.padX ?? 0
      fl.justifyContent = opts?.justify ?? FlexJustify.Start
      fl.alignItems     = opts?.align   ?? FlexAlign.Stretch
    })
    return container
  }

  private flexChild(
    parent: SceneObject,
    size: {w?: number; h?: number; grow?: number},
    builder: (child: SceneObject) => void
  ): SceneObject {
    const child = this.obj(parent, "Item")
    this.liftInZ(child, LAYOUT_Z_LIFT)
    const fi = child.createComponent(FlexItem.getTypeName()) as FlexItem
    if (size.w !== undefined && size.w > 0) fi.overrideWidth  = size.w
    if (size.h !== undefined && size.h > 0) fi.overrideHeight = size.h
    fi.flexGrow   = size.grow ?? 0
    fi.flexShrink = 0
    builder(child)
    const parentFl = parent.getComponent(FlexLayout.getTypeName()) as FlexLayout | null
    if (parentFl) parentFl.addItems([fi])
    return child
  }
}

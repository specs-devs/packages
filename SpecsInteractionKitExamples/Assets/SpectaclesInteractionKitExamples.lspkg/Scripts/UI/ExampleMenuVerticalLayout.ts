// Preload ThemeService before any UIKit visual to break a circular-import init-order
// crash in the package (Visual.ts imports ThemeService before defining COLORS, and the
// theme chain reads COLORS at module-load). Entering the import cycle via ThemeService
// lets Visual.ts finish defining COLORS first. Must remain the FIRST import.
import "SpectaclesUIKit.lspkg/Scripts/Themes/ThemeService"
import {Button} from "SpectaclesUIKit.lspkg/Scripts/Components/Button/Button"
import {Switch} from "SpectaclesUIKit.lspkg/Scripts/Components/Switch/Switch"
import {Slider} from "SpectaclesUIKit.lspkg/Scripts/Components/Slider/Slider"
import {BackPlate, BackPlateStyle} from "SpectaclesUIKit.lspkg/Scripts/BackPlate"
import {ElementContent} from "SpectaclesUIKit.lspkg/Scripts/Components/Content/ElementContent"
import {Frame} from "SpectaclesUIKit.lspkg/Scripts/Components/Frame/Frame"
import {FlexItem} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexItem"
import {FlexLayout} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexLayout"
import {FlexAlign, FlexDirection, FlexJustify} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexTypes"
import {GridItem} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Grid/GridItem"
import {GridLayout} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Grid/GridLayout"
import {ScrollWindow} from "SpectaclesUIKit.lspkg/Scripts/Components/ScrollWindow/ScrollWindow"
import {Billboard} from "SpectaclesInteractionKit.lspkg/Components/Interaction/Billboard/Billboard"

const FONT_LIGHT: Font = requireAsset("../../Fonts/SpecsSans-Light.otf") as Font
const FONT_REGULAR: Font = requireAsset("../../Fonts/SpecsSans-Regular.otf") as Font
const FONT_MEDIUM: Font = requireAsset("../../Fonts/SpecsSans-Medium.otf") as Font
const FONT_BOLD: Font = requireAsset("../../Fonts/SpecsSans-Bold.otf") as Font

type FontWeight = "light" | "regular" | "medium" | "bold"

const CONTENT_Z_OFFSET = 0.08
const CONTENT_RENDER_ORDER_OFFSET = 8
const LAYOUT_Z_LIFT = 0.005
const LABEL_EDGE_INSET = 0.75
const PANEL_CONTENT_Z_LIFT = 0.005
const GRID_GAP = 0.5
const TITLE_H = 3
const COL_GAP = 0.8
const ROW_PAD = 0.5
const TAB_GAP = 0.5
const BODY_GAP = 1
const TAB_COL_W = 10

/**
 * Per-card data for each grid tab.
 * Populate homeItems / galleryItems / settingsItems before OnStartEvent fires,
 * or let buildUI() fill them with the built-in example data.
 */
export type ButtonItem = {
  text: string
  image: Texture | undefined
  method: () => void
}

/**
 * Programmatic example: Menu Vertical Layout
 *
 * Vertical tab bar on the left — Home / Gallery / Settings — each switching
 * to a scrollable grid on the right. All structure is built at runtime in
 * buildUI(). Adjust inputs and press Play to rebuild.
 */
@component
export class ExampleMenuVerticalLayout extends BaseScriptComponent {

  // ── Panel ──────────────────────────────────────────────────────────────
  @ui.label('<span style="color: #60A5FA; font-size: 13px;">Programmatic UI Component</span>')
  @ui.label('<span style="color: #94A3B8; font-size: 11px;">Builds the full layout at runtime. Adjust inputs and press Play to rebuild.</span>')
  @ui.label('<span style="color: #94A3B8; font-size: 11px;">Uncheck Test Mode to start with empty cards — populate via API instead.</span>')
  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Custom Items API</span>')
  @ui.label('<span style="color: #94A3B8; font-size: 11px;">Populate these arrays from another script before Play starts:</span>')
  @ui.label('<span style="color: #CBD5E1; font-size: 11px;">component.homeItems     = [{ text, image, method }]</span>')
  @ui.label('<span style="color: #CBD5E1; font-size: 11px;">component.galleryItems  = [{ text, image, method }]</span>')
  @ui.label('<span style="color: #CBD5E1; font-size: 11px;">component.settingsItems = [{ text, image, method }]</span>')
  @ui.separator
  @ui.label('<span style="color: #60A5FA;">ButtonItem Schema</span>')
  @ui.label('<span style="color: #94A3B8; font-size: 11px;">text   — label shown on the card</span>')
  @ui.label('<span style="color: #94A3B8; font-size: 11px;">image  — Texture asset (or undefined for no image)</span>')
  @ui.label('<span style="color: #94A3B8; font-size: 11px;">method — () => void  callback fired when the card is tapped</span>')
  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Quick Start</span>')
  @ui.label('<span style="color: #94A3B8; font-size: 11px;">const menu = so.getComponent("ExampleMenuVerticalLayout")</span>')
  @ui.label('<span style="color: #94A3B8; font-size: 11px;">menu.homeItems = [{ text: "Open", image: tex, method: () => print("ok") }]</span>')
  @ui.separator
  @ui.group_start("Panel")
  @input
  @hint("Title text shown at the top of the panel")
  panelTitle: string = "Menu Vertical"
  @ui.group_end

  // ── Frame ──────────────────────────────────────────────────────────────
  @ui.separator
  @ui.group_start("Frame")
  @input
  @hint("Enable for a draggable Frame with handle bar. Disable for a fixed BackPlate.")
  useFrame: boolean = true

  @input
  @hint("Frame appearance style — 'Small', 'Medium', or 'Large'")
  frameAppearance: string = "Large"

  @input
  @hint("Content area size in cm (width × height). A wider panel accommodates the side tab bar.")
  frameInnerSize: vec2 = new vec2(42, 28)

  @input
  @hint("Border padding around the content area in cm.")
  framePadding: vec2 = new vec2(0.8, 0.8)

  @input
  @hint("Inset between frame edge and content — X = left/right, Y = top/bottom (cm)")
  contentInset: vec2 = new vec2(1.5, 1.0)

  @input
  @hint("Show the × close button on the frame")
  showCloseButton: boolean = true

  @input
  @hint("Show the follow / grip button on the frame")
  showFollowButton: boolean = true

  @input
  @hint("Auto-hide the frame handle bar when idle")
  frameAutoHide: boolean = false

  @input
  @hint("BackPlate style when Frame is disabled — 'dark' or 'light'")
  backplateStyle: string = "dark"
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

  // ── Home Grid ──────────────────────────────────────────────────────────
  @ui.separator
  @ui.group_start("Home Grid")
  @input
  @hint("Number of columns — Home tab")
  homeColumns: number = 3

  @input
  @hint("Number of rows — Home tab")
  homeRows: number = 10
  @ui.group_end

  // ── Gallery Grid ───────────────────────────────────────────────────────
  @ui.separator
  @ui.group_start("Gallery Grid")
  @input
  @hint("Number of columns — Gallery tab (cards are square)")
  galleryColumns: number = 3

  @input
  @hint("Number of rows — Gallery tab")
  galleryRows: number = 10
  @ui.group_end

  // ── Settings Grid ──────────────────────────────────────────────────────
  @ui.separator
  @ui.group_start("Settings Grid")
  @input
  @hint("Number of columns — Settings tab")
  settingsColumns: number = 1

  @input
  @hint("Number of rows — Settings tab")
  settingsRows: number = 10
  @ui.group_end

  // ── Test Mode ─────────────────────────────────────────────────────────
  @ui.separator
  @ui.group_start("Test Mode")
  @input
  @hint("Fill all cards with mockup data automatically. Uncheck to start empty and populate via homeItems / galleryItems / settingsItems.")
  testMode: boolean = true
  @ui.group_end

  // ── Card Images ────────────────────────────────────────────────────────
  @ui.separator
  @ui.group_start("Card Images")
  @input
  @hint("Placeholder texture used in every card in test mode. Drag any image asset here.")
  placeholderImage: Texture | undefined

  @input
  @hint("Gallery image pool — drag textures here. Gallery cards pick randomly from this list. Leave empty to use Placeholder Image instead.")
  galleryImages: Texture[] = []
  @ui.group_end

  // ── Tabs ───────────────────────────────────────────────────────────────
  @ui.separator
  @ui.group_start("Tabs")
  @input
  @hint("Tab labels — provide exactly 3 strings. Defaults to Home / Gallery / Settings when empty.")
  tabNames: string[] = []

  @input
  @hint("Tab icons — provide exactly 3 textures (one per tab). When set each tab shows icon + label. Leave empty for text-only tabs.")
  tabIcons: Texture[] = []
  @ui.group_end

  // ── Typography ─────────────────────────────────────────────────────────
  @ui.separator
  @ui.group_start("Typography")
  @input
  @hint("Font size for tab button labels")
  tabTextSize: number = 24

  @input
  @hint("Font size for the panel title")
  titleTextSize: number = 36

  @input
  @hint("Font size for Home tab card labels")
  homeCardTextSize: number = 18

  @input
  @hint("Font size for Settings tab card labels")
  settingsCardTextSize: number = 22

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

  // ─── Public item API ──────────────────────────────────────────────────
  public homeItems: ButtonItem[] = []
  public galleryItems: ButtonItem[] = []
  public settingsItems: ButtonItem[] = []

  // ─── Internal state ──────────────────────────────────────────────────
  private activeIndex: number = 0
  private contentPanels: SceneObject[] = []

  onAwake(): void {
    this.createEvent("OnStartEvent").bind(() => this.buildUI())
  }

  // ─── Build ────────────────────────────────────────────────────────────

  private buildUI(): void {
    const img = this.testMode ? this.placeholderImage : undefined

    if (this.homeItems.length === 0 && this.testMode) {
      const n = this.homeColumns * this.homeRows
      this.homeItems = Array.from({length: n}, (_, i) => ({
        text: `Home ${i + 1}`, image: img,
        method: () => print(`Home: item ${i + 1} tapped`)
      }))
    }
    if (this.galleryItems.length === 0 && this.testMode) {
      const pool = this.galleryImages.length > 0 ? this.galleryImages : (img ? [img] : [])
      const n = this.galleryColumns * this.galleryRows
      this.galleryItems = Array.from({length: n}, (_, i) => ({
        text: `Photo ${i + 1}`,
        image: pool.length > 0 ? pool[Math.floor(Math.random() * pool.length)] : undefined,
        method: () => print(`Gallery: photo ${i + 1} tapped`)
      }))
    }
    const PW = this.frameInnerSize.x
    const PH = this.frameInnerSize.y
    const OUTER_W = PW - 2
    const OUTER_H = PH - 2
    const BODY_W = OUTER_W - 2 * this.contentInset.x
    const BODY_H = OUTER_H - TITLE_H - COL_GAP - 2 * this.contentInset.y
    const CONTENT_W = BODY_W - TAB_COL_W - BODY_GAP

    const root = this.getSceneObject()
    root.createComponent(Billboard.getTypeName())
    root.getTransform().setWorldPosition(new vec3(this.positionX, this.positionY, this.positionZ))

    const panelContent = this.scenePanel(
      root, "MenuVerticalPanel", PW, PH,
      this.useFrame ? "frame" : "backplate",
      this.backplateStyle as BackPlateStyle,
      this.framePadding,
      this.frameAppearance,
      this.frameAutoHide
    )
    const outer = this.flexColumn(panelContent, OUTER_W, OUTER_H, {
      gap: COL_GAP, padX: this.contentInset.x, padY: this.contentInset.y
    })

    // Title
    this.flexChild(outer, {w: BODY_W, h: TITLE_H}, (t) => {
      this.label(t, this.panelTitle, BODY_W, TITLE_H, {textSize: this.titleTextSize, align: "left", fontWeight: "bold"})
    })

    // Body: tab column on the left, content grid on the right
    this.flexChild(outer, {w: BODY_W, h: BODY_H}, (bodySlot) => {
      const bodyRow = this.flexRow(bodySlot, BODY_W, BODY_H, {
        gap: BODY_GAP, justify: FlexJustify.Start, align: FlexAlign.Start
      })

      // ── Vertical tab column ────────────────────────────────────────────
      type TabPair = {activeObj: SceneObject; inactiveObj: SceneObject}
      const tabPairs: TabPair[] = []

      this.flexChild(bodyRow, {w: TAB_COL_W, h: BODY_H}, (tabColSlot) => {
        const tabCol = this.flexColumn(tabColSlot, TAB_COL_W, BODY_H, {
          gap: TAB_GAP, justify: FlexJustify.Start, align: FlexAlign.Stretch
        })
        const defaultTabNames = ["Home", "Gallery", "Settings"]
        const resolvedTabNames = (this.tabNames && this.tabNames.length === 3) ? this.tabNames : defaultTabNames
        resolvedTabNames.forEach((name, index) => {
          const icon = (this.tabIcons && this.tabIcons.length > index) ? this.tabIcons[index] : undefined
          this.flexChild(tabCol, {w: TAB_COL_W, h: 4}, (tabObj) => {
            // Primary version — shown when this tab is active
            const activeObj = this.obj(tabObj, "TabActive")
            const activeBtn = this.btn(activeObj, "Primary", "Rectangle", TAB_COL_W, 4)
            this.content(activeObj, {text: name, textSize: this.tabTextSize, fontWeight: "medium", leadingIcon: icon})
            activeObj.enabled = index === 0

            // Secondary version — shown when this tab is inactive
            const inactiveObj = this.obj(tabObj, "TabInactive")
            const inactiveBtn = this.btn(inactiveObj, "Secondary", "Rectangle", TAB_COL_W, 4)
            this.content(inactiveObj, {text: name, textSize: this.tabTextSize, fontWeight: "medium", leadingIcon: icon})
            inactiveObj.enabled = index !== 0

            tabPairs.push({activeObj, inactiveObj})

            const onTap = () => {
              this.activeIndex = index
              this.contentPanels.forEach((p, i) => { p.enabled = i === index })
              tabPairs.forEach((pair, i) => {
                pair.activeObj.enabled = i === index
                pair.inactiveObj.enabled = i !== index
              })
              print(`Menu Vertical: tab "${name}" selected`)
            }
            activeBtn.onTriggerUp.add(onTap)
            inactiveBtn.onTriggerUp.add(onTap)
          })
        })
      })

      // ── Content area ───────────────────────────────────────────────────
      this.flexChild(bodyRow, {w: CONTENT_W, h: BODY_H}, (contentArea) => {
        const homePanel = this.obj(contentArea, "HomePanel")
        homePanel.enabled = true
        this.contentPanels.push(homePanel)
        this.buildHomeGrid(homePanel, CONTENT_W, BODY_H)

        const galleryPanel = this.obj(contentArea, "GalleryPanel")
        galleryPanel.enabled = false
        this.contentPanels.push(galleryPanel)
        this.buildGalleryGrid(galleryPanel, CONTENT_W, BODY_H)

        const settingsPanel = this.obj(contentArea, "SettingsPanel")
        settingsPanel.enabled = false
        this.contentPanels.push(settingsPanel)
        this.buildSettingsGrid(settingsPanel, CONTENT_W, BODY_H)
      })
    })
  }

  // ─── Tab grid builders ────────────────────────────────────────────────

  private buildHomeGrid(parent: SceneObject, gridW: number, windowH: number): void {
    const cols = this.homeColumns
    const rows = this.homeRows
    const cardH = 6.5
    const colW = (gridW - (cols - 1) * GRID_GAP) / cols
    const totalH = rows * cardH + (rows - 1) * GRID_GAP
    this.buildScrollGrid(parent, gridW, windowH, this.homeItems, cols, rows, cardH, totalH,
      (cardObj, item) => this.buildHomeCard(cardObj, item, colW, cardH))
  }

  private buildGalleryGrid(parent: SceneObject, gridW: number, windowH: number): void {
    const cols = this.galleryColumns
    const rows = this.galleryRows
    const colW = (gridW - (cols - 1) * GRID_GAP) / cols
    const cardH = colW
    const totalH = rows * cardH + (rows - 1) * GRID_GAP
    this.buildScrollGrid(parent, gridW, windowH, this.galleryItems, cols, rows, cardH, totalH,
      (cardObj, item) => this.buildGalleryCard(cardObj, item, colW, cardH))
  }

  private buildSettingsGrid(parent: SceneObject, gridW: number, windowH: number): void {
    const ROW_H = 5.5
    const ROWS = 12
    const totalH = ROWS * ROW_H + (ROWS - 1) * GRID_GAP

    const sw = parent.createComponent(ScrollWindow.getTypeName()) as ScrollWindow
    ;(sw as any)._vertical = true
    ;(sw as any)._horizontal = false
    ;(sw as any)._windowSize = new vec2(gridW, windowH)
    const scrollDimH = Math.max(totalH, windowH)
    ;(sw as any)._scrollDimensions = new vec2(gridW, scrollDimH)
    ;(sw as any)._edgeFade = false
    ;(sw as any)._scrollPosition = new vec2(0, windowH * 0.5 - scrollDimH * 0.5)

    const scrollContent = this.obj(parent, "ScrollContent")
    const gridContainer = this.obj(scrollContent, "GridContainer")
    const gl = gridContainer.createComponent(GridLayout.getTypeName()) as GridLayout
    gl.onInitialized.add(() => {
      gl.width = gridW
      gl.height = totalH
      gl.templateColumns = `repeat(1, 1fr)`
      gl.autoRows = `${ROW_H}cm`
      gl.columnGap = GRID_GAP
      gl.rowGap = GRID_GAP
    })

    const addToggle = (label: string) => {
      const cardObj = this.obj(gridContainer, "Card")
      const gi = cardObj.createComponent(GridItem.getTypeName()) as GridItem
      this.buildToggleRow(cardObj, label, gridW, ROW_H)
      gl.addItems([gi])
    }
    const addSlider = (label: string) => {
      const cardObj = this.obj(gridContainer, "Card")
      const gi = cardObj.createComponent(GridItem.getTypeName()) as GridItem
      this.buildSliderRow(cardObj, label, gridW, ROW_H)
      gl.addItems([gi])
    }

    addToggle("Notifications"); addToggle("Dark Mode");  addToggle("Auto Play")
    addSlider("Volume");        addSlider("Brightness"); addSlider("Text Size")
    addToggle("Bluetooth");     addToggle("Wi-Fi");      addToggle("Location")
    addSlider("Speed");         addSlider("Font Size");  addSlider("Opacity")
  }

  // ─── Scroll + GridLayout container ───────────────────────────────────

  private buildScrollGrid(
    parent: SceneObject, gridW: number, windowH: number,
    items: ButtonItem[], cols: number, rows: number,
    cardH: number, totalH: number,
    cardBuilder: (cardObj: SceneObject, item: ButtonItem) => void
  ): void {
    const sw = parent.createComponent(ScrollWindow.getTypeName()) as ScrollWindow
    ;(sw as any)._vertical = true
    ;(sw as any)._horizontal = false
    ;(sw as any)._windowSize = new vec2(gridW, windowH)
    const scrollDimH = Math.max(totalH, windowH)
    ;(sw as any)._scrollDimensions = new vec2(gridW, scrollDimH)
    ;(sw as any)._edgeFade = false
    // Start at top: topEdge = scrollDimH * -0.5 + windowH * 0.5
    ;(sw as any)._scrollPosition = new vec2(0, windowH * 0.5 - scrollDimH * 0.5)

    const scrollContent = this.obj(parent, "ScrollContent")

    const gridContainer = this.obj(scrollContent, "GridContainer")
    const gl = gridContainer.createComponent(GridLayout.getTypeName()) as GridLayout
    gl.onInitialized.add(() => {
      gl.width = gridW
      gl.height = totalH
      gl.templateColumns = `repeat(${cols}, 1fr)`
      gl.autoRows = `${cardH}cm`
      gl.columnGap = GRID_GAP
      gl.rowGap = GRID_GAP
    })

    const count = Math.min(items.length, cols * rows)
    for (let i = 0; i < count; i++) {
      const cardObj = this.obj(gridContainer, "Card")
      const gi = cardObj.createComponent(GridItem.getTypeName()) as GridItem
      cardBuilder(cardObj, items[i])
      gl.addItems([gi])
    }
  }

  // ─── Card layouts ─────────────────────────────────────────────────────

  private buildHomeCard(cardObj: SceneObject, item: ButtonItem, colW: number, cardH: number): void {
    const btn = this.btn(cardObj, "PrimaryNeutral", "Rectangle", colW, cardH)
    btn.onTriggerUp.add(() => item.method())
    this.content(cardObj, {
      text: item.text, leadingIcon: item.image,
      contentAlignment: "left", leadingIconSize: Math.min(colW * 0.45, cardH * 0.55),
      textSize: this.homeCardTextSize, fontWeight: "medium", paddingLeft: 1
    })
  }

  private buildGalleryCard(cardObj: SceneObject, item: ButtonItem, colW: number, cardH: number): void {
    const btn = this.btn(cardObj, "PrimaryNeutral", "Rectangle", colW, cardH)
    btn.onTriggerUp.add(() => item.method())
    this.content(cardObj, {leadingIcon: item.image, iconLayout: "top", leadingIconSize: cardH})
  }

  private buildToggleRow(cardObj: SceneObject, label: string, colW: number, cardH: number): void {
    const SWITCH_W = 5
    const SWITCH_H = 2.5
    const SWITCH_PAD = 1.5

    const cardBtn = this.btn(cardObj, "PrimaryNeutral", "Rectangle", colW, cardH)
    this.content(cardObj, {
      text: label,
      textSize: this.settingsCardTextSize, fontWeight: "medium",
      contentAlignment: "left", paddingLeft: 1.5,
      paddingRight: SWITCH_W + SWITCH_PAD * 2
    })

    const switchObj = this.obj(cardObj, "Switch")
    switchObj.getTransform().setLocalPosition(
      new vec3(colW / 2 - SWITCH_W / 2 - SWITCH_PAD, 0, CONTENT_Z_OFFSET + 0.02)
    )
    const sw = switchObj.createComponent(Switch.getTypeName()) as Switch
    ;(sw as any)._size = new vec3(SWITCH_W, SWITCH_H, 1)
    sw.initialize()
    cardBtn.onTriggerUp.add(() => sw.toggle(!sw.isOn))
  }

  private buildSliderRow(cardObj: SceneObject, label: string, colW: number, cardH: number): void {
    const SLIDER_W = Math.min(colW * 0.45, 14)
    const SLIDER_H = 2.5
    const SLIDER_PAD = 1.5

    this.btn(cardObj, "PrimaryNeutral", "Rectangle", colW, cardH)
    this.content(cardObj, {
      text: label,
      textSize: this.settingsCardTextSize, fontWeight: "medium",
      contentAlignment: "left", paddingLeft: 1.5,
      paddingRight: SLIDER_W + SLIDER_PAD * 2
    })

    const sliderObj = this.obj(cardObj, "Slider")
    sliderObj.getTransform().setLocalPosition(
      new vec3(colW / 2 - SLIDER_W / 2 - SLIDER_PAD, 0, CONTENT_Z_OFFSET + 0.02)
    )
    const sl = sliderObj.createComponent(Slider.getTypeName()) as Slider
    ;(sl as any)._size = new vec3(SLIDER_W, SLIDER_H, 1)
    sl.initialize()
  }

  // ─── Composition helpers ──────────────────────────────────────────────

  private fontForWeight(weight: FontWeight): Font {
    switch (weight) {
      case "light": return this.fontLight || FONT_LIGHT
      case "medium": return this.fontMedium || FONT_MEDIUM
      case "bold": return this.fontBold || FONT_BOLD
      default: return this.fontRegular || FONT_REGULAR
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
    autoHide: boolean = false
  ): SceneObject {
    if (mode === "frame") {
      const frameObj = this.obj(parent, name)
      const frame = frameObj.createComponent(Frame.getTypeName()) as Frame
      frame.autoShowHide = autoHide
      frame.allowTranslation = this.showFollowButton
      frame.autoScaleContent = true
      ;(frame as any)._innerSize = new vec2(width, height)
      ;(frame as any)._padding = framePad
      ;(frame as any)._appearance = appearance
      // Must be set in onInitialized — Frame resets these during its own init sequence
      frame.onInitialized.add(() => {
        frame.showCloseButton  = this.showCloseButton
        frame.showFollowButton = this.showFollowButton
      })
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

  private content(
    so: SceneObject,
    opts: {
      text?: string; leadingIcon?: Texture; trailingIcon?: Texture; iconLayout?: string
      contentAlignment?: string; textSize?: number; paddingLeft?: number; paddingRight?: number
      paddingTop?: number; paddingBottom?: number; spacing?: number
      leadingIconSize?: number; trailingIconSize?: number
      sizeOverride?: vec2; useThemeColors?: boolean; textColorOverride?: vec4; fontWeight?: FontWeight
    }
  ): ElementContent {
    const ec = so.createComponent(ElementContent.getTypeName()) as ElementContent
    const a = ec as any
    a._zOffset = CONTENT_Z_OFFSET
    a._renderOrderOffset = CONTENT_RENDER_ORDER_OFFSET
    a._font = this.fontForWeight(opts.fontWeight ?? "regular")
    if (opts.text !== undefined) a._text = opts.text
    if (opts.leadingIcon) { a._useLeadingIcon = true; a._leadingIcon = opts.leadingIcon }
    if (opts.trailingIcon) { a._useTrailingIcon = true; a._trailingIcon = opts.trailingIcon }
    if (opts.iconLayout) a._iconLayout = opts.iconLayout
    if (opts.contentAlignment) a._contentAlignment = opts.contentAlignment
    if (opts.textSize) a._textSize = opts.textSize
    if (opts.leadingIconSize !== undefined) a._leadingIconSize = opts.leadingIconSize
    if (opts.trailingIconSize !== undefined) a._trailingIconSize = opts.trailingIconSize
    if (opts.paddingLeft !== undefined) a._paddingLeft = opts.paddingLeft
    if (opts.paddingRight !== undefined) a._paddingRight = opts.paddingRight
    if (opts.paddingTop !== undefined) a._paddingTop = opts.paddingTop
    if (opts.paddingBottom !== undefined) a._paddingBottom = opts.paddingBottom
    if (opts.spacing !== undefined) a._spacing = opts.spacing
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

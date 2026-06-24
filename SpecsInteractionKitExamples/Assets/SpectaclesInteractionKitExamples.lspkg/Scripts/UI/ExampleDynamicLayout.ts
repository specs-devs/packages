// Preload ThemeService before any UIKit visual to break a circular-import init-order
// crash in the package (Visual.ts imports ThemeService before defining COLORS, and the
// theme chain reads COLORS at module-load). Entering the import cycle via ThemeService
// lets Visual.ts finish defining COLORS first. Must remain the FIRST import.
import "SpectaclesUIKit.lspkg/Scripts/Themes/ThemeService"
import {Button} from "SpectaclesUIKit.lspkg/Scripts/Components/Button/Button"
import {ElementContent} from "SpectaclesUIKit.lspkg/Scripts/Components/Content/ElementContent"
import {Frame} from "SpectaclesUIKit.lspkg/Scripts/Components/Frame/Frame"
import {FlexItem} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexItem"
import {FlexLayout} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexLayout"
import {FlexAlign, FlexDirection, FlexJustify} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexTypes"
import {GridItem} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Grid/GridItem"
import {GridLayout} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Grid/GridLayout"
import {Billboard} from "SpectaclesInteractionKit.lspkg/Components/Interaction/Billboard/Billboard"
import animate, {CancelSet} from "SpectaclesInteractionKit.lspkg/Utils/animate"

const FONT_LIGHT: Font   = requireAsset("../../Fonts/SpecsSans-Light.otf")   as Font
const FONT_REGULAR: Font = requireAsset("../../Fonts/SpecsSans-Regular.otf") as Font
const FONT_MEDIUM: Font  = requireAsset("../../Fonts/SpecsSans-Medium.otf")  as Font
const FONT_BOLD: Font    = requireAsset("../../Fonts/SpecsSans-Bold.otf")    as Font

type FontWeight = "light" | "regular" | "medium" | "bold"

const CONTENT_Z_OFFSET            = 0.08
const CONTENT_RENDER_ORDER_OFFSET = 8
const LAYOUT_Z_LIFT               = 0.005
const LABEL_EDGE_INSET            = 0.75
const PANEL_CONTENT_Z_LIFT        = 0.005

enum UIState {
  Home    = "Home",
  ScreenA = "ScreenA",
  ScreenB = "ScreenB",
  ScreenC = "ScreenC"
}

type NavPair = {activeObj: SceneObject; inactiveObj: SceneObject}

type FlexOpts = {
  gap?: number
  padY?: number; padX?: number
  padLeft?: number; padRight?: number
  justify?: FlexJustify; align?: FlexAlign
}

/**
 * Programmatic example: Dynamic Layout
 *
 * A runtime port of UIManager.ts with no scene wiring required.
 * Demonstrates animated frame resize, state-based panel switching,
 * and a side nav column that appears and disappears per state.
 *
 * States
 *   Home    — compact frame, side nav visible
 *   ScreenA — expanded frame, side nav hidden
 *   ScreenB — same frame size as A, side nav hidden (reached from A)
 *   ScreenC — tall frame, side nav visible, grid content
 */
@component
export class ExampleDynamicLayout extends BaseScriptComponent {

  @ui.label('<span style="color: #60A5FA; font-size: 13px;">Programmatic UI Component</span>')
  @ui.label('<span style="color: #94A3B8; font-size: 11px;">Runtime port of UIManager — no scene wiring. Adjust inputs and press Play.</span>')
  @ui.label('<span style="color: #94A3B8; font-size: 11px;">Frame resizes with animation. Side nav visible on Home and Screen C only.</span>')
  @ui.separator

  // ── Frame ──────────────────────────────────────────────────────────────
  @ui.group_start("Frame")
  @input
  @hint("Frame appearance — 'Large' (far-field) or 'Small' (near-field)")
  frameAppearance: string = "Large"

  @input
  @hint("Frame chrome padding in cm")
  framePadding: vec2 = new vec2(1.0, 1.0)

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
  @ui.group_end

  // ── Screen Sizes ──────────────────────────────────────────────────────
  @ui.separator
  @ui.group_start("Screen Sizes")
  @input
  @hint("Frame inner size for the Home state (cm)")
  homeFrameSize: vec2 = new vec2(33, 18)

  @input
  @hint("Frame inner size for Screen A and B (cm)")
  screenAbSize: vec2 = new vec2(33, 28)

  @input
  @hint("Frame inner size for Screen C — tall grid view (cm)")
  screenCSize: vec2 = new vec2(33, 35)

  @input
  @hint("Frame resize animation duration in seconds")
  animDuration: number = 0.4

  @input
  @hint("Width of the side navigation column in cm")
  navWidth: number = 8
  @ui.group_end

  // ── Position ───────────────────────────────────────────────────────────
  @ui.separator
  @ui.group_start("Position")
  @input positionX: number = 0
  @input positionY: number = 0
  @input @hint("Distance from camera in cm (negative = in front)") positionZ: number = -110
  @ui.group_end

  // ── Typography ─────────────────────────────────────────────────────────
  @ui.separator
  @ui.group_start("Typography")
  @input @hint("Panel title text size") titleTextSize: number = 36
  @input @hint("Body / button label text size") bodyTextSize: number = 22
  @input @hint("Side nav button label text size") navTextSize: number = 22
  @ui.separator
  @ui.label('<span style="color: #94A3B8; font-size: 11px;">Font slots are optional — SpecsSans is auto-loaded when left empty.</span>')
  @input fontLight: Font
  @input fontRegular: Font
  @input fontMedium: Font
  @input fontBold: Font
  @ui.group_end

  // ─── Internal state ───────────────────────────────────────────────────
  private _frame: Frame
  private _currentState: UIState = UIState.Home
  private _resizeCancel: CancelSet = new CancelSet()
  private _sideNav: SceneObject
  private _panels: Partial<Record<UIState, SceneObject>> = {}
  private _navPairs: NavPair[] = []

  // maps each nav slot index to the states that make it "active"
  private readonly NAV_ACTIVE_STATES: UIState[][] = [
    [UIState.Home],
    [UIState.ScreenA, UIState.ScreenB],
    [UIState.ScreenC]
  ]

  onAwake(): void {
    this.createEvent("OnStartEvent").bind(() => this.buildUI())
  }

  // ─── Public API ───────────────────────────────────────────────────────
  public get currentState(): UIState { return this._currentState }
  public transitionTo(state: UIState): void { this._applyState(state) }

  // ─── Build ─────────────────────────────────────────────────────────────

  private buildUI(): void {
    const root = this.getSceneObject()
    root.createComponent(Billboard.getTypeName())
    root.getTransform().setWorldPosition(new vec3(this.positionX, this.positionY, this.positionZ))

    const FW       = this.homeFrameSize.x
    const FH       = this.homeFrameSize.y
    const PAD_X    = this.contentInset.x
    const PAD_Y    = this.contentInset.y
    const NAV_W    = this.navWidth
    const NAV_GAP  = 1.0
    const BTN_H    = 5.0
    const BTN_GAP  = 0.8
    const TITLE_H  = 3.0
    // Width of content area when side nav is present
    const MAIN_W   = FW - 2 * PAD_X - NAV_W - NAV_GAP
    // Width of content area when no side nav
    const FULL_W   = FW - 2 * PAD_X

    // ── Frame ─────────────────────────────────────────────────────────
    const frameObj = this.obj(root, "DynamicFrame")
    this._frame = frameObj.createComponent(Frame.getTypeName()) as Frame
    const safeApp = this.frameAppearance === "Small" ? "Small" : "Large"
    ;(this._frame as any)._appearance = safeApp
    ;(this._frame as any)._innerSize  = new vec2(FW, FH)
    ;(this._frame as any)._padding    = this.framePadding
    this._frame.autoShowHide     = this.frameAutoHide
    this._frame.allowTranslation = this.showFollowButton
    this._frame.autoScaleContent = false
    this._frame.onInitialized.add(() => {
      this._frame.showCloseButton  = this.showCloseButton
      this._frame.showFollowButton = this.showFollowButton
    })

    const fc = this.obj(frameObj, "FrameContent", new vec3(0, 0, PANEL_CONTENT_Z_LIFT))

    // ── Side Nav ───────────────────────────────────────────────────────
    // Positioned at left edge; stays in place while frame resizes.
    const navX   = -(FW * 0.5) + PAD_X + NAV_W * 0.5
    const maxNavH = this.screenCSize.y
    this._sideNav = this.obj(fc, "SideNav", new vec3(navX, 0, LAYOUT_Z_LIFT))

    const navDefs: {label: string; target: UIState}[] = [
      {label: "Home",     target: UIState.Home},
      {label: "Screen A", target: UIState.ScreenA},
      {label: "Screen C", target: UIState.ScreenC}
    ]
    const navCol = this.flexColumn(this._sideNav, NAV_W, maxNavH, {
      gap: BTN_GAP, padY: PAD_Y, justify: FlexJustify.Start
    })
    navDefs.forEach((def, i) => {
      this.flexChild(navCol, {w: NAV_W, h: BTN_H}, slot => {
        const isInitActive = this.NAV_ACTIVE_STATES[i].includes(UIState.Home)

        const activeObj = this.obj(slot, "NavActive")
        const aBtn = this.btn(activeObj, "Primary", "Rectangle", NAV_W, BTN_H)
        this.content(activeObj, {text: def.label, textSize: this.navTextSize, fontWeight: "medium", contentAlignment: "center"})
        aBtn.onTriggerUp.add(() => this._applyState(def.target))
        activeObj.enabled = isInitActive

        const inactiveObj = this.obj(slot, "NavInactive")
        const iBtn = this.btn(inactiveObj, "Secondary", "Rectangle", NAV_W, BTN_H)
        this.content(inactiveObj, {text: def.label, textSize: this.navTextSize, fontWeight: "medium", contentAlignment: "center"})
        iBtn.onTriggerUp.add(() => this._applyState(def.target))
        inactiveObj.enabled = !isInitActive

        this._navPairs.push({activeObj, inactiveObj})
      })
    })

    // ── Home Panel ─────────────────────────────────────────────────────
    {
      const H = this.homeFrameSize.y
      const panel = this.obj(fc, "HomePanel")
      this._panels[UIState.Home] = panel

      const col = this.flexColumn(panel, FW, H, {
        gap: BTN_GAP, padY: PAD_Y,
        padLeft: PAD_X + NAV_W + NAV_GAP, padRight: PAD_X
      })
      this.flexChild(col, {w: MAIN_W, h: TITLE_H}, t =>
        this.label(t, "Welcome", MAIN_W, TITLE_H, {textSize: this.titleTextSize, align: "left", fontWeight: "bold"})
      )
      this.flexChild(col, {w: MAIN_W, h: 3}, t =>
        this.label(t, "Choose a screen from the side navigation.", MAIN_W, 3, {
          textSize: this.bodyTextSize, align: "left", color: new vec4(1, 1, 1, 0.65)
        })
      )
      this.flexChild(col, {w: MAIN_W, h: BTN_H}, t => {
        const b = this.btn(t, "PrimaryNeutral", "Rectangle", MAIN_W, BTN_H)
        this.content(t, {text: "Open Screen A →", textSize: this.bodyTextSize, fontWeight: "medium", contentAlignment: "left", paddingLeft: 1.5})
        b.onTriggerUp.add(() => this._applyState(UIState.ScreenA))
      })
      this.flexChild(col, {w: MAIN_W, h: BTN_H}, t => {
        const b = this.btn(t, "PrimaryNeutral", "Rectangle", MAIN_W, BTN_H)
        this.content(t, {text: "Open Screen C →", textSize: this.bodyTextSize, fontWeight: "medium", contentAlignment: "left", paddingLeft: 1.5})
        b.onTriggerUp.add(() => this._applyState(UIState.ScreenC))
      })
    }

    // ── Screen A Panel ─────────────────────────────────────────────────
    {
      const H = this.screenAbSize.y
      const panel = this.obj(fc, "ScreenAPanel")
      panel.enabled = false
      this._panels[UIState.ScreenA] = panel

      const col = this.flexColumn(panel, FW, H, {gap: BTN_GAP, padY: PAD_Y, padX: PAD_X})
      this.flexChild(col, {w: FULL_W, h: TITLE_H}, t =>
        this.label(t, "Screen A", FULL_W, TITLE_H, {textSize: this.titleTextSize, align: "left", fontWeight: "bold"})
      )
      this.flexChild(col, {w: FULL_W, h: 5}, t =>
        this.label(t, "An expanded view with a nested navigation flow.\nContinue deeper or return to Home.", FULL_W, 5, {
          textSize: this.bodyTextSize, align: "left", color: new vec4(1, 1, 1, 0.65)
        })
      )
      this.flexChild(col, {w: FULL_W, h: BTN_H}, t => {
        const b = this.btn(t, "Primary", "Rectangle", FULL_W, BTN_H)
        this.content(t, {text: "Continue to Screen B →", textSize: this.bodyTextSize, fontWeight: "medium", contentAlignment: "center"})
        b.onTriggerUp.add(() => this._applyState(UIState.ScreenB))
      })
      this.flexChild(col, {w: FULL_W, h: BTN_H}, t => {
        const b = this.btn(t, "Secondary", "Rectangle", FULL_W, BTN_H)
        this.content(t, {text: "← Back to Home", textSize: this.bodyTextSize, fontWeight: "medium", contentAlignment: "center"})
        b.onTriggerUp.add(() => this._applyState(UIState.Home))
      })
    }

    // ── Screen B Panel ─────────────────────────────────────────────────
    {
      const H = this.screenAbSize.y
      const panel = this.obj(fc, "ScreenBPanel")
      panel.enabled = false
      this._panels[UIState.ScreenB] = panel

      const col = this.flexColumn(panel, FW, H, {gap: BTN_GAP, padY: PAD_Y, padX: PAD_X})
      this.flexChild(col, {w: FULL_W, h: TITLE_H}, t =>
        this.label(t, "Screen B", FULL_W, TITLE_H, {textSize: this.titleTextSize, align: "left", fontWeight: "bold"})
      )
      this.flexChild(col, {w: FULL_W, h: 5}, t =>
        this.label(t, "Reached via Screen A. Demonstrates nested navigation.\nThe frame stayed expanded from the previous state.", FULL_W, 5, {
          textSize: this.bodyTextSize, align: "left", color: new vec4(1, 1, 1, 0.65)
        })
      )
      this.flexChild(col, {w: FULL_W, h: BTN_H}, t => {
        const b = this.btn(t, "Secondary", "Rectangle", FULL_W, BTN_H)
        this.content(t, {text: "← Return to Home", textSize: this.bodyTextSize, fontWeight: "medium", contentAlignment: "center"})
        b.onTriggerUp.add(() => this._applyState(UIState.Home))
      })
    }

    // ── Screen C Panel ─────────────────────────────────────────────────
    {
      const H        = this.screenCSize.y
      const GCOLS    = 3
      const CARD_H   = 5.5
      const GGAP     = 0.6
      const GROWS    = 4
      const gridH    = GROWS * CARD_H + (GROWS - 1) * GGAP
      const bodyH    = H - 2 * PAD_Y - TITLE_H - BTN_GAP
      const cardW    = (MAIN_W - (GCOLS - 1) * GGAP) / GCOLS

      const panel = this.obj(fc, "ScreenCPanel")
      panel.enabled = false
      this._panels[UIState.ScreenC] = panel

      const col = this.flexColumn(panel, FW, H, {
        gap: BTN_GAP, padY: PAD_Y,
        padLeft: PAD_X + NAV_W + NAV_GAP, padRight: PAD_X
      })
      this.flexChild(col, {w: MAIN_W, h: TITLE_H}, t =>
        this.label(t, "Screen C", MAIN_W, TITLE_H, {textSize: this.titleTextSize, align: "left", fontWeight: "bold"})
      )
      this.flexChild(col, {w: MAIN_W, h: bodyH}, slot => {
        const gc = this.obj(slot, "GridContent")
        const gl = gc.createComponent(GridLayout.getTypeName()) as GridLayout
        gl.onInitialized.add(() => {
          gl.width  = MAIN_W
          gl.height = gridH
          gl.templateColumns = `repeat(${GCOLS}, 1fr)`
          gl.autoRows        = `${CARD_H}cm`
          gl.columnGap       = GGAP
          gl.rowGap          = GGAP
        })
        for (let i = 0; i < GCOLS * GROWS; i++) {
          const cardObj = this.obj(gc, "GridCard")
          const gi      = cardObj.createComponent(GridItem.getTypeName()) as GridItem
          const btn     = this.btn(cardObj, "PrimaryNeutral", "Rectangle", cardW, CARD_H)
          this.content(cardObj, {text: `Item ${i + 1}`, textSize: this.bodyTextSize, fontWeight: "medium", contentAlignment: "center"})
          btn.onTriggerUp.add(() => print(`Screen C: item ${i + 1} tapped`))
          gl.addItems([gi])
        }
      })
    }
  }

  // ─── State machine ────────────────────────────────────────────────────

  private _applyState(state: UIState): void {
    if (state === this._currentState) return
    this._currentState = state
    print(`DynamicLayout: → ${state}`)

    // Switch content panels
    ;(Object.keys(this._panels) as UIState[]).forEach(k => {
      const p = this._panels[k]
      if (p) p.enabled = (k === state)
    })

    // Side nav visible in Home and ScreenC only
    const showNav = state === UIState.Home || state === UIState.ScreenC
    if (this._sideNav) this._sideNav.enabled = showNav

    // Update nav button active/inactive styling
    this._navPairs.forEach((pair, i) => {
      const isActive = this.NAV_ACTIVE_STATES[i]?.includes(state) ?? false
      pair.activeObj.enabled   = isActive
      pair.inactiveObj.enabled = !isActive
    })

    // Animate frame to target size
    if (this._frame) this._animateResize(this._frameSizeFor(state))
  }

  private _frameSizeFor(state: UIState): vec2 {
    if (state === UIState.ScreenA || state === UIState.ScreenB) return this.screenAbSize
    if (state === UIState.ScreenC) return this.screenCSize
    return this.homeFrameSize
  }

  private _animateResize(target: vec2): void {
    this._resizeCancel.cancel()
    const start = this._frame.innerSize
    animate({
      duration: this.animDuration,
      cancelSet: this._resizeCancel,
      easing: "ease-in-out-cubic",
      update: (t: number) => {
        this._frame.innerSize = vec2.lerp(start, target, t)
      }
    })
  }

  // ─── Composition helpers ──────────────────────────────────────────────

  private fontForWeight(w: FontWeight): Font {
    switch (w) {
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

  private btn(so: SceneObject, style: string, shape: string, w: number, h: number): Button {
    const button = so.createComponent(Button.getTypeName()) as Button
    ;(button as any)._themeOverride = "SnapOS2"
    ;(button as any)._shapeSnapOS2  = shape
    ;(button as any)._styleSnapOS2  = style
    ;(button as any)._size          = new vec3(w, h, 1)
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
    a._renderOrderOffset = CONTENT_RENDER_ORDER_OFFSET
    a._font              = this.fontForWeight(opts.fontWeight ?? "regular")
    if (opts.text !== undefined)            a._text             = opts.text
    if (opts.contentAlignment)              a._contentAlignment = opts.contentAlignment
    if (opts.textSize)                      a._textSize         = opts.textSize
    if (opts.paddingLeft  !== undefined)    a._paddingLeft      = opts.paddingLeft
    if (opts.paddingRight !== undefined)    a._paddingRight     = opts.paddingRight
    if (opts.sizeOverride)                  a._sizeOverride     = opts.sizeOverride
    if (opts.useThemeColors !== undefined)  a._useThemeColors   = opts.useThemeColors
    if (opts.leadingIcon) { a._useLeadingIcon = true; a._leadingIcon = opts.leadingIcon }
    if (opts.iconLayout)                    a._iconLayout       = opts.iconLayout
    if (opts.leadingIconSize !== undefined) a._leadingIconSize  = opts.leadingIconSize
    if (opts.textColorOverride) { a._useTextColorOverride = true; a._textColorOverride = opts.textColorOverride }
    return ec
  }

  private label(
    so: SceneObject, text: string, w: number, h: number,
    opts?: {textSize?: number; align?: string; color?: vec4; fontWeight?: FontWeight}
  ): ElementContent {
    const align = opts?.align ?? "center"
    return this.content(so, {
      text, sizeOverride: new vec2(w, h), useThemeColors: false,
      textSize: opts?.textSize ?? 32, contentAlignment: align,
      textColorOverride: opts?.color, fontWeight: opts?.fontWeight ?? "regular",
      paddingLeft:  align === "left"  ? LABEL_EDGE_INSET : 0,
      paddingRight: align === "right" ? LABEL_EDGE_INSET : 0
    })
  }

  private flexColumn(parent: SceneObject, w: number, h: number, opts?: FlexOpts): SceneObject {
    return this.makeFlex(parent, FlexDirection.Column, w, h, opts)
  }

  private flexRow(parent: SceneObject, w: number, h: number, opts?: FlexOpts): SceneObject {
    return this.makeFlex(parent, FlexDirection.Row, w, h, opts)
  }

  private makeFlex(parent: SceneObject, direction: FlexDirection, w: number, h: number, opts?: FlexOpts): SceneObject {
    const container = this.obj(parent, "Flex")
    this.liftInZ(container, LAYOUT_Z_LIFT)
    const fl = container.createComponent(FlexLayout.getTypeName()) as FlexLayout
    // Items are added manually via addItems() before init; disable
    // auto-discovery so addItems() doesn't throw on an uninitialized layout.
    fl.autoDiscoverItemsOnStart = false
    const fi = container.createComponent(FlexItem.getTypeName())   as FlexItem
    if (w > 0) fi.overrideWidth  = w
    if (h > 0) fi.overrideHeight = h
    fl.onInitialized.add(() => {
      fl.width     = w
      fl.height    = h
      fl.direction = direction
      if (direction === FlexDirection.Row) fl.columnGap = opts?.gap ?? 0
      else                                 fl.rowGap    = opts?.gap ?? 0
      fl.paddingTop    = opts?.padY ?? 0
      fl.paddingBottom = opts?.padY ?? 0
      fl.paddingLeft   = opts?.padLeft  ?? opts?.padX ?? 0
      fl.paddingRight  = opts?.padRight ?? opts?.padX ?? 0
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

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
import {ScrollWindow} from "SpectaclesUIKit.lspkg/Scripts/Components/ScrollWindow/ScrollWindow"
import {ScrollBar} from "SpectaclesUIKit.lspkg/Scripts/ScrollBar"
import {Slider} from "SpectaclesUIKit.lspkg/Scripts/Components/Slider/Slider"
import {Switch} from "SpectaclesUIKit.lspkg/Scripts/Components/Switch/Switch"

/**
 * RocketUI — a tiny, self-contained toolkit for building Spectacles UIKit 2.0 panels
 * entirely in code (no @input wiring, no prefabs).
 *
 * Every method creates real SceneObjects + UIKit components at runtime, so a developer
 * can read this file top-to-bottom and learn the whole "build UI in TypeScript" workflow:
 *
 *   1. {@link frame}        — a draggable panel (the UIKit replacement for ContainerFrame)
 *   2. {@link flexColumn} / {@link flexRow} / {@link flexChild} — flexbox-style layout
 *   3. {@link button} / {@link toggleBtn} — tappable + radio-style buttons
 *   4. {@link slider} / {@link switchControl} — value + on/off controls
 *   5. {@link scrollWindow} — a scrollable region
 *   6. {@link label} / {@link content} / {@link dynamicText} — text on/inside elements
 *
 * The helpers are static (no instance state) so they read like plain functions:
 *   const content = RocketUI.frame(root, "Launch", 26, 30)
 *   const col = RocketUI.flexColumn(content, 24, 28, {gap: 1})
 *
 * Fonts live in the shared examples package (../../Fonts) and are loaded once below.
 */
export class RocketUI {
  // ─── Fonts ────────────────────────────────────────────────────────────────
  static readonly FONT_LIGHT: Font = requireAsset("../../Fonts/SpecsSans-Light.otf") as Font
  static readonly FONT_REGULAR: Font = requireAsset("../../Fonts/SpecsSans-Regular.otf") as Font
  static readonly FONT_MEDIUM: Font = requireAsset("../../Fonts/SpecsSans-Medium.otf") as Font
  static readonly FONT_BOLD: Font = requireAsset("../../Fonts/SpecsSans-Bold.otf") as Font

  // ─── Shared text sizes ──────────────────────────────────────────────────────
  // One consistent scale used by every Rocket Workshop panel so the UI feels uniform.
  static readonly TITLE_SIZE = 120 // panel titles ("Rocket Parts", "Launch Control")
  static readonly LABEL_SIZE = 100 // section labels ("Nose Cone", "Flight Path", "Show Platform" …)
  static readonly BODY_SIZE = 80  // rows, button labels, values ("Sleek", "A", "1.0x" …)

  // ─── Tuning constants ───────────────────────────────────────────────────────
  // Small Z lifts keep text/content from z-fighting the surface they sit on.
  private static readonly CONTENT_Z_OFFSET = 0.08
  private static readonly CONTENT_RENDER_ORDER_OFFSET = 8
  private static readonly LAYOUT_Z_LIFT = 0.02
  private static readonly DYNAMIC_TEXT_Z_OFFSET = 0.15
  private static readonly LABEL_EDGE_INSET = 0.75
  private static readonly PANEL_CONTENT_Z_LIFT = 0.01
  // Lift interactive controls (slider/switch) clear of the panel backing: their
  // internal visuals depth-test against it, and need a gap well above
  // depth-buffer precision to avoid z-fighting (see disableContentDepthWrite).
  private static readonly CONTROL_Z_LIFT = 0.05
  private static readonly FRAME_PADDING = new vec2(2.2, 2.2)

  // ─── Scene-object helpers ─────────────────────────────────────────────────

  /** Create an empty SceneObject parented under `parent`, optionally at a local position. */
  static obj(parent: SceneObject, name: string, position?: vec3): SceneObject {
    const so = global.scene.createSceneObject(name)
    so.setParent(parent)
    if (position) so.getTransform().setLocalPosition(position)
    return so
  }

  /**
   * Depth-first search for a descendant named `name` (the diorama bridge: lets the
   * code-first entry point reach authored art without an @input). Returns null if absent.
   */
  static findChild(root: SceneObject, name: string): SceneObject | null {
    const childCount = root.getChildrenCount()
    for (let i = 0; i < childCount; i++) {
      const child = root.getChild(i)
      if (child.name === name) return child
      const found = RocketUI.findChild(child, name)
      if (found) return found
    }
    return null
  }

  /**
   * Depth-first search for the first component of `componentType` on any descendant of
   * `root` (e.g. find the AnimationPlayer in the diorama without hard-coding which object
   * holds it). Returns null if none found.
   */
  static findComponentInChildren<T extends Component>(root: SceneObject, componentType: string): T | null {
    const direct = root.getComponent(componentType as any) as T
    if (!isNull(direct)) return direct
    const childCount = root.getChildrenCount()
    for (let i = 0; i < childCount; i++) {
      const found = RocketUI.findComponentInChildren<T>(root.getChild(i), componentType)
      if (found) return found
    }
    return null
  }

  /** Nudge a SceneObject forward in Z by `z` (local space). */
  static liftInZ(so: SceneObject, z: number): void {
    const t = so.getTransform()
    const p = t.getLocalPosition()
    t.setLocalPosition(new vec3(p.x, p.y, p.z + z))
  }

  static fontForWeight(weight: FontWeight): Font {
    switch (weight) {
      case "light": return RocketUI.FONT_LIGHT
      case "medium": return RocketUI.FONT_MEDIUM
      case "bold": return RocketUI.FONT_BOLD
      default: return RocketUI.FONT_REGULAR
    }
  }

  // ─── Panel (Frame) ────────────────────────────────────────────────────────

  /**
   * Create a draggable UIKit {@link Frame} panel — the 2.0 replacement for the old
   * SIK ContainerFrame. Returns the *content* SceneObject you should parent UI into
   * (already inset inside the frame's padding and lifted slightly in Z).
   */
  static frame(parent: SceneObject, name: string, width: number, height: number): SceneObject {
    const frameObj = RocketUI.obj(parent, name)
    const frame = frameObj.createComponent(Frame.getTypeName()) as Frame
    frame.autoShowHide = false
    frame.allowTranslation = true
    frame.autoScaleContent = true
    ;(frame as any)._innerSize = new vec2(width, height)
    ;(frame as any)._padding = RocketUI.FRAME_PADDING
    return RocketUI.obj(frameObj, "FrameContent", new vec3(0, 0, RocketUI.PANEL_CONTENT_Z_LIFT))
  }

  // ─── Flexbox layout ─────────────────────────────────────────────────────────

  static flexColumn(
    parent: SceneObject, width: number, height: number, opts?: FlexOpts
  ): SceneObject {
    return RocketUI.makeFlex(parent, FlexDirection.Column, width, height, opts)
  }

  static flexRow(
    parent: SceneObject, width: number, height: number, opts?: FlexOpts
  ): SceneObject {
    return RocketUI.makeFlex(parent, FlexDirection.Row, width, height, opts)
  }

  private static makeFlex(
    parent: SceneObject, direction: FlexDirection, width: number, height: number, opts?: FlexOpts
  ): SceneObject {
    const container = RocketUI.obj(parent, "Flex")
    RocketUI.liftInZ(container, RocketUI.LAYOUT_Z_LIFT)
    const fl = container.createComponent(FlexLayout.getTypeName()) as FlexLayout
    // Items are added manually via addItems() before init; disable auto-discovery
    // so addItems() doesn't throw on an uninitialized layout.
    fl.autoDiscoverItemsOnStart = false
    const fi = container.createComponent(FlexItem.getTypeName()) as FlexItem
    if (width > 0) fi.overrideWidth = width
    if (height > 0) fi.overrideHeight = height
    fl.onInitialized.add(() => {
      fl.width = width
      fl.height = height
      fl.direction = direction
      if (direction === FlexDirection.Row) fl.columnGap = opts?.gap ?? 0
      else fl.rowGap = opts?.gap ?? 0
      fl.paddingTop = opts?.padTop ?? opts?.padY ?? 0
      fl.paddingBottom = opts?.padBottom ?? opts?.padY ?? 0
      fl.paddingLeft = opts?.padX ?? 0
      fl.paddingRight = opts?.padX ?? 0
      fl.justifyContent = opts?.justify ?? FlexJustify.Start
      fl.alignItems = opts?.align ?? FlexAlign.Stretch
    })
    return container
  }

  /**
   * Add a sized child to a flex container and populate it via `builder`. The child is
   * registered with the parent FlexLayout so it participates in layout.
   */
  static flexChild(
    parent: SceneObject, size: {w?: number; h?: number; grow?: number},
    builder: (child: SceneObject) => void
  ): SceneObject {
    const child = RocketUI.obj(parent, "Item")
    RocketUI.liftInZ(child, RocketUI.LAYOUT_Z_LIFT)
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

  // ─── Controls ──────────────────────────────────────────────────────────────

  /** A standard tappable button. Subscribe to taps via `button.onTriggerUp.add(...)`. */
  static button(
    so: SceneObject, style: ButtonStyle, shape: ButtonShape, width: number, height: number
  ): Button {
    return RocketUI.makeButton(so, style, shape, width, height, false)
  }

  /**
   * A radio-style button (`_toggleable = true`). Register it with a ToggleGroup so only
   * one button in the group is "on" at a time; the group emits `onToggleSelected`.
   */
  static toggleBtn(
    so: SceneObject, style: ButtonStyle, shape: ButtonShape, width: number, height: number
  ): Button {
    return RocketUI.makeButton(so, style, shape, width, height, true)
  }

  private static makeButton(
    so: SceneObject, style: ButtonStyle, shape: ButtonShape,
    width: number, height: number, toggleable: boolean
  ): Button {
    const button = so.createComponent(Button.getTypeName()) as Button
    ;(button as any)._themeOverride = "SnapOS2"
    ;(button as any)._shapeSnapOS2 = shape
    ;(button as any)._styleSnapOS2 = style
    ;(button as any)._size = new vec3(width, height, 1)
    if (toggleable) (button as any)._toggleable = true
    button.initialize()
    return button
  }

  /** A 0..1 slider. Read `slider.currentValue`; react via `slider.onValueChange.add(...)`. */
  static slider(so: SceneObject, width: number, initial: number): Slider {
    const sliderObj = RocketUI.obj(so, "Slider", new vec3(0, 0, RocketUI.CONTROL_Z_LIFT))
    const slider = sliderObj.createComponent(Slider.getTypeName()) as Slider
    ;(slider as any)._themeOverride = "SnapOS2"
    ;(slider as any)._size = new vec3(width, 4, 1)
    slider.initialize()
    slider.updateCurrentValue(initial)
    return slider
  }

  /** An on/off switch. Read `sw.isOn`; react via `sw.onFinished.add(() => sw.isOn)`. */
  static switchControl(so: SceneObject, initialOn: boolean): Switch {
    const switchObj = RocketUI.obj(so, "Switch", new vec3(0, 0, RocketUI.CONTROL_Z_LIFT))
    const sw = switchObj.createComponent(Switch.getTypeName()) as Switch
    ;(sw as any)._themeOverride = "SnapOS2"
    ;(sw as any)._size = new vec3(8, 4.2, 1)
    sw.initialize()
    sw.isOn = initialOn
    return sw
  }

  /**
   * A vertical scroll region. `windowSize` is the visible viewport; `contentHeight` is
   * the full scrollable height. Returns the container SceneObject to parent content into
   * (already configured); add a flex list as its child to lay items out.
   */
  static scrollWindow(
    so: SceneObject, windowWidth: number, windowHeight: number, contentHeight: number
  ): ScrollWindow {
    const sw = so.createComponent(ScrollWindow.getTypeName()) as ScrollWindow
    ;(sw as any)._vertical = true
    ;(sw as any)._horizontal = false
    ;(sw as any)._windowSize = new vec2(windowWidth, windowHeight)
    ;(sw as any)._scrollDimensions = new vec2(windowWidth, contentHeight)
    // Edge fade draws a translucent gradient plane over the whole window (the "dark box");
    // leave it off so the scroll content sits cleanly on the panel. Masking/clipping is a
    // separate MaskingComponent and still works.
    ;(sw as any)._edgeFade = false
    return sw
  }

  /**
   * A UIKit {@link ScrollBar} wired to a {@link ScrollWindow} — the visible affordance
   * that a region scrolls. Parent it OUTSIDE the ScrollWindow's object (the window's
   * mask would clip it) and place it alongside the window via `position`.
   *
   * The ScrollBar draws its bar along local +X, so for a vertical bar the holder is
   * rotated +90° around Z; that points the slider axis up, which keeps the knob at the
   * top of the bar when the window is scrolled to the top (slider value 1 ↔ scroll y 1).
   */
  static scrollBar(
    parent: SceneObject, scrollWindow: ScrollWindow, length: number, thickness: number, position: vec3
  ): ScrollBar {
    const barObj = RocketUI.obj(parent, "ScrollBar", position)
    // Disable while configuring: runtime-created components run their lifecycle inline,
    // and ScrollBar reads its inputs (notably scrollWindow) during setup.
    barObj.enabled = false
    barObj.getTransform().setLocalRotation(quat.fromEulerAngles(0, 0, Math.PI / 2))
    const bar = barObj.createComponent(ScrollBar.getTypeName()) as ScrollBar
    ;(bar as any)._size = new vec2(length, thickness)
    ;(bar as any).orientation = "Vertical"
    ;(bar as any).scrollWindow = scrollWindow
    barObj.enabled = true
    return bar
  }

  // ─── Text / content ──────────────────────────────────────────────────────────

  /**
   * Attach an {@link ElementContent} (text and/or a leading icon) to a UIKit element such
   * as a Button or Frame. This is how you put a label/icon *on* an interactive element.
   */
  static content(so: SceneObject, opts: ContentOpts): ElementContent {
    const ec = so.createComponent(ElementContent.getTypeName()) as ElementContent
    const a = ec as any
    a._zOffset = RocketUI.CONTENT_Z_OFFSET
    a._renderOrderOffset = RocketUI.CONTENT_RENDER_ORDER_OFFSET
    a._font = RocketUI.fontForWeight(opts.fontWeight ?? "regular")
    if (opts.text !== undefined) a._text = opts.text
    if (opts.leadingIcon) {
      a._useLeadingIcon = true
      a._leadingIcon = opts.leadingIcon
      if (opts.leadingIconSize !== undefined) a._leadingIconSize = opts.leadingIconSize
    }
    if (opts.iconLayout) a._iconLayout = opts.iconLayout
    if (opts.spacing !== undefined) {
      a._customSpacing = true
      a._spacing = opts.spacing
    }
    if (opts.contentAlignment) a._contentAlignment = opts.contentAlignment
    if (opts.textSize) a._textSize = opts.textSize
    if (opts.paddingLeft !== undefined) a._paddingLeft = opts.paddingLeft
    if (opts.paddingRight !== undefined) a._paddingRight = opts.paddingRight
    if (opts.paddingTop !== undefined) a._paddingTop = opts.paddingTop
    if (opts.paddingBottom !== undefined) a._paddingBottom = opts.paddingBottom
    if (opts.sizeOverride) a._sizeOverride = opts.sizeOverride
    if (opts.useThemeColors !== undefined) a._useThemeColors = opts.useThemeColors
    if (opts.textColorOverride) {
      a._useTextColorOverride = true
      a._textColorOverride = opts.textColorOverride
    }
    return ec
  }

  /** A convenience wrapper around {@link content} for a plain (non-interactive) text label. */
  static label(
    so: SceneObject, text: string, width: number, height: number, opts?: LabelOpts
  ): ElementContent {
    const align = opts?.align ?? "center"
    return RocketUI.content(so, {
      text,
      sizeOverride: new vec2(width, height),
      useThemeColors: false,
      textSize: opts?.textSize ?? 32,
      contentAlignment: align,
      textColorOverride: opts?.color,
      fontWeight: opts?.fontWeight ?? "regular",
      paddingLeft: align === "left" ? RocketUI.LABEL_EDGE_INSET : 0,
      paddingRight: align === "right" ? RocketUI.LABEL_EDGE_INSET : 0,
      paddingTop: 0,
      paddingBottom: 0
    })
  }

  /**
   * A raw Text component you can update every frame (e.g. a live value readout). Unlike
   * {@link label}, this is a standalone Text — keep the returned reference to set `.text`.
   */
  static dynamicText(
    parent: SceneObject, name: string, text: string, size: number,
    color: vec4, font: Font, hAlign: HorizontalAlignment = HorizontalAlignment.Center,
    localPos: vec3 = new vec3(0, 0, RocketUI.DYNAMIC_TEXT_Z_OFFSET)
  ): Text {
    const textObj = RocketUI.obj(parent, name, localPos)
    const tc = textObj.createComponent("Component.Text") as Text
    tc.text = text
    tc.size = size
    tc.textFill.color = color
    tc.font = font
    tc.horizontalAlignment = hAlign
    tc.verticalAlignment = VerticalAlignment.Center
    tc.horizontalOverflow = HorizontalOverflow.Overflow
    tc.verticalOverflow = VerticalOverflow.Overflow
    const pass = (tc as any).getMaterial(0).mainPass
    pass.depthTest = true
    pass.depthWrite = true
    return tc
  }
}

// ─── Shared option types ───────────────────────────────────────────────────────

export type FontWeight = "light" | "regular" | "medium" | "bold"

/** UIKit SnapOS2 button styles (filled, neutral, etc.). */
export type ButtonStyle = "Primary" | "PrimaryNeutral" | "Secondary"

/** UIKit SnapOS2 button shapes. */
export type ButtonShape = "Rectangle" | "Round" | "Capsule"

export interface FlexOpts {
  gap?: number
  padY?: number
  padX?: number
  padTop?: number // overrides padY for the top edge only
  padBottom?: number // overrides padY for the bottom edge only
  justify?: FlexJustify
  align?: FlexAlign
}

export interface ContentOpts {
  text?: string
  leadingIcon?: Texture
  leadingIconSize?: number
  iconLayout?: string
  spacing?: number
  contentAlignment?: string
  textSize?: number
  paddingLeft?: number
  paddingRight?: number
  paddingTop?: number
  paddingBottom?: number
  sizeOverride?: vec2
  useThemeColors?: boolean
  textColorOverride?: vec4
  fontWeight?: FontWeight
}

export interface LabelOpts {
  textSize?: number
  align?: string
  color?: vec4
  fontWeight?: FontWeight
}

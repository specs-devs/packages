/**
 * Glasses Inc. 2026
 * UIKit.ts — SpectaclesUIKit 2.0 composition helpers for the AnchorExamples screens.
 *
 * Everything the screens need to lay out content the modern way:
 *  - a single type scale (`applyTextRole` / `roleSize`) so text size + weight never drift
 *  - `flexContainer` / `gridContainer` builders that create the layout component AFTER its
 *    children so FlexLayout / GridLayout auto-discover them on OnStartEvent (no `addItems`
 *    race, no children stacking at the origin)
 *  - `addText`, `makeButton` leaf helpers that emit a SceneObject + FlexItem + content in one call
 *
 * Layout is done with FlexLayout / GridLayout (CSS-flex / CSS-grid in cm) — never with
 * hand-picked `setLocalPosition` — so nothing overflows the panel. Buttons are the UIKit 2.0
 * `Button` (System 3.0 theme) with `setVariant`, replacing the deprecated `RectangleButton`.
 *
 * Render order: this project has no root `Component.Canvas`, so draw order is controlled by
 * `renderOrder` (the legitimate mechanism without a Canvas). Raw Text drawn on top of the frame
 * plate / button faces defaults to `renderOrder = TEXT_RENDER_ORDER`. UIKit `Button`s manage
 * their own visual and are left at their default.
 */
import {FlexLayout} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexLayout"
import {FlexItem} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexItem"
import {
  FlexAlign,
  FlexAlignSelf,
  FlexDirection,
  FlexJustify,
} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexTypes"
import {GridLayout} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Grid/GridLayout"
import {GridItem} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Grid/GridItem"
import {Button} from "SpectaclesUIKit.lspkg/Scripts/Components/Button/Button"
import {ElementContent, TextAlignment} from "SpectaclesUIKit.lspkg/Scripts/Components/Content/ElementContent"

export {ElementContent}

export {FlexAlign, FlexAlignSelf, FlexDirection, FlexJustify}

// ── Typography: single source of truth for text size + weight ────────────────
//
// `Component.Text.size` is the glyph EM-SQUARE height (em-square cm = size / 43.886).
// These are the Snap Specs type-scale sizes at the z = -110 cm focal plane. Pick a role,
// never a raw number — a font swap is then one `FONT_SIZE_SCALE` edit, not a hunt.
const FONT_SIZE_SCALE = 1.0

export type TextRole =
  | "Title1"
  | "Title2"
  | "HeadlineXL"
  | "Headline1"
  | "Headline2"
  | "Subheadline"
  | "Button"
  | "Callout"
  | "Body"
  | "Caption"

const TYPE_SCALE: Record<TextRole, {size: number; weight: number}> = {
  Title1: {size: 105, weight: 700},
  Title2: {size: 93, weight: 700},
  HeadlineXL: {size: 62, weight: 700},
  Headline1: {size: 54, weight: 700},
  Headline2: {size: 48, weight: 700},
  Subheadline: {size: 41, weight: 700},
  Button: {size: 39, weight: 500},
  Callout: {size: 39, weight: 700},
  Body: {size: 39, weight: 500},
  Caption: {size: 38, weight: 500},
}

/** Font-corrected em-square size for a role at a focal distance (cm). */
export function roleSize(role: TextRole, distanceCm: number = 110): number {
  return TYPE_SCALE[role].size * FONT_SIZE_SCALE * (distanceCm / 110)
}

/** Apply a type-scale role to a Text — the one place size + weight are set. */
export function applyTextRole(t: Text, role: TextRole, distanceCm: number = 110): void {
  t.size = roleSize(role, distanceCm)
  ;(t as Text & {weight?: number}).weight = TYPE_SCALE[role].weight
}

// Draw order (this project has no root Canvas, so renderOrder is the sort mechanism):
// frame plate = 0 < button faces < raw Text labels, so content always paints on top of the plate.
/** Draw order for a UIKit Button face, above the frame plate (0). */
export const BUTTON_RENDER_ORDER = 8
/** Draw order for raw Text sitting on top of the frame plate / button faces. */
export const TEXT_RENDER_ORDER = 10

// ── SceneObject helpers ──────────────────────────────────────────────────────

export function makeObj(parent: SceneObject, name: string, position?: vec3): SceneObject {
  const obj = global.scene.createSceneObject(name)
  obj.setParent(parent)
  if (position) obj.getTransform().setLocalPosition(position)
  return obj
}

export function liftZ(obj: SceneObject, dz: number): void {
  const t = obj.getTransform()
  const p = t.getLocalPosition()
  t.setLocalPosition(new vec3(p.x, p.y, p.z + dz))
}

// ── Flex container (children created BEFORE the layout, via the build callback) ──

export interface FlexAsItem {
  w?: number
  h?: number
  grow?: number
  alignSelf?: FlexAlignSelf
}

export interface FlexOpts {
  name?: string
  direction: FlexDirection
  width?: number
  height?: number
  gap?: number
  padX?: number
  padY?: number
  justify?: FlexJustify
  align?: FlexAlign
  /** When this container is itself a child of another flex layout, its FlexItem config. */
  asItem?: FlexAsItem
  zLift?: number
}

/**
 * Creates a FlexLayout container. The `build` callback creates the children FIRST, then this
 * helper adds the FlexLayout component LAST so it auto-discovers those children on OnStartEvent.
 */
export function flexContainer(
  parent: SceneObject,
  opts: FlexOpts,
  build: (container: SceneObject) => void
): SceneObject {
  const container = makeObj(parent, opts.name ?? "Flex")
  if (opts.zLift) liftZ(container, opts.zLift)
  if (opts.asItem) attachFlexItem(container, opts.asItem)

  build(container)

  const flex = container.createComponent(FlexLayout.getTypeName()) as FlexLayout
  flex.direction = opts.direction
  flex.width = opts.width ?? -1
  flex.height = opts.height ?? -1
  if (opts.direction === FlexDirection.Row || opts.direction === FlexDirection.RowReverse) {
    flex.columnGap = opts.gap ?? 0
  } else {
    flex.rowGap = opts.gap ?? 0
  }
  flex.paddingTop = opts.padY ?? 0
  flex.paddingBottom = opts.padY ?? 0
  flex.paddingLeft = opts.padX ?? 0
  flex.paddingRight = opts.padX ?? 0
  flex.justifyContent = opts.justify ?? FlexJustify.Start
  flex.alignItems = opts.align ?? FlexAlign.Stretch
  return container
}

/** Attach a FlexItem to an existing SceneObject so a parent FlexLayout lays it out. */
export function asFlexItem(obj: SceneObject, cfg: FlexAsItem): FlexItem {
  const fi = obj.createComponent(FlexItem.getTypeName()) as FlexItem
  if (cfg.w !== undefined && cfg.w > 0) fi.overrideWidth = cfg.w
  if (cfg.h !== undefined && cfg.h > 0) fi.overrideHeight = cfg.h
  fi.flexGrow = cfg.grow ?? 0
  fi.flexShrink = 0
  if (cfg.alignSelf) fi.alignSelf = cfg.alignSelf
  return fi
}

const attachFlexItem = asFlexItem

// ── Grid container (same children-before-layout pattern) ─────────────────────

export interface GridOpts {
  name?: string
  columns: number
  cellW: number
  cellH: number
  gap?: number
  asItem?: FlexAsItem
  zLift?: number
}

/**
 * Creates a GridLayout with `columns` fixed-width columns and auto-sized rows. The `build`
 * callback creates the GridItem cells first (use `addGridCell`), then the GridLayout is added.
 */
export function gridContainer(
  parent: SceneObject,
  opts: GridOpts,
  build: (container: SceneObject) => void
): SceneObject {
  const container = makeObj(parent, opts.name ?? "Grid")
  if (opts.zLift) liftZ(container, opts.zLift)
  if (opts.asItem) attachFlexItem(container, opts.asItem)

  build(container)

  const grid = container.createComponent(GridLayout.getTypeName()) as GridLayout
  grid.width = opts.columns * opts.cellW + (opts.columns - 1) * (opts.gap ?? 0)
  grid.height = -1
  grid.templateColumns = `repeat(${opts.columns}, ${opts.cellW}cm)`
  grid.templateRows = "auto"
  grid.autoRows = `${opts.cellH}cm`
  if (opts.gap) grid.gap = opts.gap
  return container
}

/** A single grid cell (GridItem) sized to (w, h) cm. Build its content into the returned object. */
export function addGridCell(parent: SceneObject, name: string, w: number, h: number): SceneObject {
  const cell = makeObj(parent, name)
  const item = cell.createComponent(GridItem.getTypeName()) as GridItem
  item.overrideWidth = w
  item.overrideHeight = h
  return cell
}

// ── Text ─────────────────────────────────────────────────────────────────────

export interface TextOpts {
  role?: TextRole
  width: number
  height: number
  halign?: HorizontalAlignment
  valign?: VerticalAlignment
  wrap?: boolean
  color?: vec4
  renderOrder?: number
  name?: string
  /** FlexItem config when the text is a direct child of a flex container. */
  asItem?: FlexAsItem
}

/** Raw Component.Text as a flex child, sized to a cm rect so it never overflows its cell. */
export function addText(parent: SceneObject, text: string, opts: TextOpts): Text {
  const w = opts.width
  const h = opts.height
  const so = makeObj(parent, opts.name ?? "Text")
  attachFlexItem(so, opts.asItem ?? {w, h})

  const t = so.createComponent("Component.Text") as Text
  t.text = text
  t.depthTest = true
  applyTextRole(t, opts.role ?? "Body")
  t.horizontalAlignment = opts.halign ?? HorizontalAlignment.Center
  t.verticalAlignment = opts.valign ?? VerticalAlignment.Center
  t.horizontalOverflow = opts.wrap ? HorizontalOverflow.Wrap : HorizontalOverflow.Overflow
  t.verticalOverflow = VerticalOverflow.Overflow
  t.layoutRect = Rect.create(-w / 2, w / 2, -h / 2, h / 2)
  t.textFill.mode = TextFillMode.Solid
  t.textFill.color = opts.color ?? new vec4(1, 1, 1, 1)
  t.renderOrder = opts.renderOrder ?? TEXT_RENDER_ORDER
  return t
}

// ── Button (UIKit Button, System 3.0) ───────────────────────────────────────

export type ButtonStyle = "Prism" | "PrismGhost" | "Primary" | "Secondary" | "Ghost"

export interface ButtonOpts {
  label: string
  width: number
  height: number
  style?: ButtonStyle
  role?: TextRole
  toggleable?: boolean
  initialOn?: boolean
  name?: string
  onTrigger?: () => void
}

export interface MadeButton {
  obj: SceneObject
  button: Button
  labelText: ElementContent
}

/**
 * A UIKit 2.0 Button as a flex child, sized to (width, height) cm, with theme-aware ElementContent
 * that follows the button face through hover and press animations. `setVariant` runs before `initialize()` (required by the kit). Selection state
 * uses toggle mode (`isOn`) — the supported way to re-render a selected look at runtime.
 */
export function makeButton(parent: SceneObject, opts: ButtonOpts): MadeButton {
  const obj = makeObj(parent, opts.name ?? `Btn_${opts.label.replace(/\s/g, "")}`)
  attachFlexItem(obj, {w: opts.width, h: opts.height})

  const btn = obj.createComponent(Button.getTypeName()) as Button
  btn.setVariant({theme: "System3", shape: "Rectangle", style: opts.style ?? "Primary"})
  if (opts.toggleable) btn.setIsToggleable(true)
  btn.size = new vec3(opts.width, opts.height, 1)
  btn.renderOrder = BUTTON_RENDER_ORDER // draw above the frame plate (no Canvas in this project)
  if (opts.toggleable && opts.initialOn) btn.isOn = true
  btn.initialize()

  const labelText = addButtonLabel(obj, opts.label, opts.role ?? "Button")
  if (opts.onTrigger) btn.onTriggerUp.add(opts.onTrigger)

  return {obj, button: btn, labelText}
}

/** Theme-aware label whose depth and colors follow its sibling UIKit Button. */
export function addButtonLabel(
  btnObj: SceneObject,
  label: string,
  role: TextRole = "Button"
): ElementContent {
  const content = btnObj.createComponent(ElementContent.getTypeName()) as ElementContent
  content.text = label
  content.textSize = roleSize(role)
  content.textAlignment = TextAlignment.Center
  content.paddingLeft = 0.5
  content.paddingRight = 0.5
  return content
}

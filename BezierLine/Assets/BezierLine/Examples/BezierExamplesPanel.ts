/**
 * BezierExamplesPanel — UIKit control panel for the BezierExamples board.
 *
 * Sliders for width / curve / segments, switches for camera facing, flow markers and debug
 * drawing, buttons to add a card, clear connectors or reset the board, plus a live readout of
 * connector and vertex counts. Wire `board` to the BezierExamples component in the Inspector.
 */
import {FlexLayout} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexLayout"
import {FlexItem} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexItem"
import {FlexAlign, FlexDirection, FlexJustify} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexTypes"
import {BackPlate} from "SpectaclesUIKit.lspkg/Scripts/BackPlate"
import {Button} from "SpectaclesUIKit.lspkg/Scripts/Components/Button/Button"
import {Switch} from "SpectaclesUIKit.lspkg/Scripts/Components/Switch/Switch"
import {Slider} from "SpectaclesUIKit.lspkg/Scripts/Components/Slider/Slider"
import {BezierExamples} from "./BezierExamples"

// ── Typography: the single source of truth for text size + weight ────────────
// Component.Text.size is the glyph em-square height (em cm = size / 43.886),
// calibrated for the SnapOS system font at the z = -110 cm focal plane.
const FONT_SIZE_SCALE = 1.0

type TextRole =
  | "Title1" | "Title2" | "HeadlineXL" | "Headline1" | "Headline2"
  | "Subheadline" | "Button" | "Callout" | "Body" | "Caption"

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

function roleSize(role: TextRole, distanceCm: number = 110): number {
  return TYPE_SCALE[role].size * FONT_SIZE_SCALE * (distanceCm / 110)
}

function applyTextRole(t: Text, role: TextRole, distanceCm: number = 110): void {
  t.size = roleSize(role, distanceCm)
  ;(t as Text & {weight?: number}).weight = TYPE_SCALE[role].weight
}

const PAD_X = 1.6
const PAD_Y = 1.6
const ROW_GAP = 0.8
const HEADER_HEIGHT = 3.6
const ROW_HEIGHT = 2.6
const LABEL_WIDTH = 8.5
const SLIDER_HEIGHT = 2.0
const SWITCH_WIDTH = 3.6
const SWITCH_HEIGHT = 2.0
const BUTTON_HEIGHT = 2.8
const BUTTON_GAP = 0.8
/** Lift a label off the button face so its leading glyph is not occluded by the button's own visual. */
const BUTTON_LABEL_Z = 0.08
const CONTENT_Z = 0.6

const WIDTH_MIN = 0.1
const WIDTH_MAX = 1.5
const CURVE_MAX = 30
const SEGMENTS_MIN = 4
const SEGMENTS_MAX = 64

@component
export class BezierExamplesPanel extends BaseScriptComponent {
  @ui.label("BezierLine Examples Panel")
  @ui.separator
  @input
  @hint("The BezierExamples board this panel controls.")
  board: BezierExamples

  @ui.group_start("Settings")
  @input
  @hint("Panel width in cm.")
  @widget(new SliderWidget(20, 40, 0.5))
  panelWidth: number = 28

  @input
  @hint("Distance from the viewer the panel is designed for, in cm. Text is scaled from the 110 cm type scale.")
  @widget(new SliderWidget(60, 200, 5))
  focalDistanceCm: number = 130

  @input
  @hint("One-line hint shown under the title.")
  hintText: string = "Pinch a card to move it. Pinch a dot, drag to another card. Tap a dot to clear."
  @ui.group_end

  private widthLabel!: Text
  private curveLabel!: Text
  private segmentsLabel!: Text
  private statsText!: Text

  onAwake(): void {
    this.buildPanel()
    this.createEvent("OnStartEvent").bind(() => {
      if (!this.board) {
        print("[BezierExamplesPanel] Assign the 'board' input (BezierExamples component).")
        return
      }
      this.board.onConnectionsChanged.add(() => this.refreshStats())
      this.refreshStats()
    })
  }

  // ── Panel construction ─────────────────────────────────────────────────────

  private buildPanel(): void {
    this.sceneObject.createComponent("Component.Canvas")
    // BackPlate first so the Canvas hierarchy DFS paints it behind the content.
    const backPlate = this.sceneObject.createComponent(BackPlate.getTypeName()) as BackPlate

    const content = this.obj(this.sceneObject, "Content", new vec3(0, 0, CONTENT_Z))
    const flex = content.createComponent(FlexLayout.getTypeName()) as FlexLayout
    flex.width = this.panelWidth
    flex.height = -1
    flex.direction = FlexDirection.Column
    flex.justifyContent = FlexJustify.Start
    flex.alignItems = FlexAlign.Stretch
    flex.rowGap = ROW_GAP
    flex.paddingTop = PAD_Y
    flex.paddingBottom = PAD_Y
    flex.paddingLeft = PAD_X
    flex.paddingRight = PAD_X
    flex.onLayoutComplete.add((r) => {
      backPlate.size = new vec2(r.containerWidth, r.containerHeight)
    })

    const innerW = this.panelWidth - PAD_X * 2
    const initialWidth = this.board ? this.board.lineWidth : 0.45
    const initialCurve = this.board ? this.board.handleLength : 15
    const initialSegments = this.board ? this.board.segments : 32

    this.addText(content, "BezierLine", "Title2", innerW, HEADER_HEIGHT, HorizontalAlignment.Left)
    this.addText(content, this.hintText, "Caption", innerW, 2.2, HorizontalAlignment.Left, 0.65)

    this.widthLabel = this.addSliderRow(content, "Width", this.normalize(initialWidth, WIDTH_MIN, WIDTH_MAX), (v) => {
      const width = WIDTH_MIN + v * (WIDTH_MAX - WIDTH_MIN)
      this.widthLabel.text = `Width ${width.toFixed(2)}`
      if (this.board) this.board.setLineWidth(width)
      this.refreshStats()
    })
    this.widthLabel.text = `Width ${initialWidth.toFixed(2)}`

    this.curveLabel = this.addSliderRow(content, "Curve", this.normalize(initialCurve, 0, CURVE_MAX), (v) => {
      const cm = Math.round(v * CURVE_MAX * 2) / 2
      this.curveLabel.text = `Curve ${cm} cm`
      if (this.board) this.board.setHandleLength(cm)
    })
    this.curveLabel.text = `Curve ${initialCurve} cm`

    this.segmentsLabel = this.addSliderRow(
      content,
      "Segments",
      this.normalize(initialSegments, SEGMENTS_MIN, SEGMENTS_MAX),
      (v) => {
        const segments = Math.round(SEGMENTS_MIN + v * (SEGMENTS_MAX - SEGMENTS_MIN))
        this.segmentsLabel.text = `Segments ${segments}`
        if (this.board) this.board.setSegments(segments)
        this.refreshStats()
      }
    )
    this.segmentsLabel.text = `Segments ${initialSegments}`

    this.addSwitchRow(content, [
      {label: "Camera", initial: this.board ? this.board.faceCamera : true, onChange: (on) => this.board?.setFaceCamera(on)},
      {label: "Flow", initial: this.board ? this.board.flowMarkers : true, onChange: (on) => this.board?.setFlowMarkers(on)},
      {label: "Debug", initial: this.board ? this.board.debugDraw : false, onChange: (on) => this.board?.setDebugDraw(on)},
    ])

    this.addButtonRow(content, [
      {label: "Add card", onTrigger: () => this.board?.addCard()},
      {label: "Clear", onTrigger: () => this.board?.clearConnections()},
      {label: "Reset", onTrigger: () => this.board?.resetBoard()},
    ])

    this.statsText = this.addText(content, "", "Caption", innerW, 2.0, HorizontalAlignment.Left, 0.6)
  }

  private refreshStats(): void {
    if (!this.statsText || !this.board) return
    const n = this.board.connectionCount
    this.statsText.text = `${n} connector${n === 1 ? "" : "s"}  ·  ${this.board.vertexCount} vertices`
  }

  // ── Rows ───────────────────────────────────────────────────────────────────

  private addSliderRow(parent: SceneObject, name: string, initial: number, onChange: (v: number) => void): Text {
    const row = this.makeRow(parent, `Row ${name}`)
    const label = this.addRowText(row, name, "Body", LABEL_WIDTH)
    const sliderSO = this.obj(row, "Slider")
    const slider = sliderSO.createComponent(Slider.getTypeName()) as Slider
    // Size BEFORE the slider initializes (OnStart) — it computes fill and knob once.
    slider.size = new vec3(this.panelWidth - PAD_X * 2 - LABEL_WIDTH - 1.0, SLIDER_HEIGHT, 1)
    slider.currentValue = initial
    sliderSO.createComponent(FlexItem.getTypeName())
    slider.onValueChange.add((v: number) => onChange(v))
    return label
  }

  private addSwitchRow(
    parent: SceneObject,
    switches: {label: string; initial: boolean; onChange: (on: boolean) => void}[]
  ): void {
    const row = this.makeRow(parent, "Row Switches")
    const innerW = this.panelWidth - PAD_X * 2
    const cellW = innerW / switches.length
    for (const s of switches) {
      const cell = this.obj(row, `Cell ${s.label}`)
      const cellFlex = cell.createComponent(FlexLayout.getTypeName()) as FlexLayout
      cellFlex.direction = FlexDirection.Row
      cellFlex.justifyContent = FlexJustify.Start
      cellFlex.alignItems = FlexAlign.Center
      cellFlex.columnGap = 0.6
      cellFlex.width = cellW
      cellFlex.height = ROW_HEIGHT
      const cellItem = cell.createComponent(FlexItem.getTypeName()) as FlexItem
      cellItem.overrideWidth = cellW

      const switchSO = this.obj(cell, "Switch")
      const sw = switchSO.createComponent(Switch.getTypeName()) as Switch
      sw.size = new vec3(SWITCH_WIDTH, SWITCH_HEIGHT, 1)
      sw.isOn = s.initial
      switchSO.createComponent(FlexItem.getTypeName())
      // onFinished's argument says whether the change was explicit, not the new state: read isOn.
      sw.onFinished.add(() => s.onChange(sw.isOn))

      this.addRowText(cell, s.label, "Caption", cellW - SWITCH_WIDTH - 0.8, HorizontalAlignment.Left)
    }
  }

  private addButtonRow(parent: SceneObject, buttons: {label: string; onTrigger: () => void}[]): void {
    const row = this.obj(parent, "Row Buttons")
    const rowFlex = row.createComponent(FlexLayout.getTypeName()) as FlexLayout
    rowFlex.direction = FlexDirection.Row
    rowFlex.justifyContent = FlexJustify.SpaceBetween
    rowFlex.alignItems = FlexAlign.Center
    rowFlex.columnGap = 0.8
    rowFlex.width = -1
    rowFlex.height = ROW_HEIGHT + 0.4
    const rowItem = row.createComponent(FlexItem.getTypeName()) as FlexItem
    rowItem.marginTop = 0.4

    const innerW = this.panelWidth - PAD_X * 2
    const buttonW = (innerW - BUTTON_GAP * (buttons.length - 1)) / buttons.length
    for (const b of buttons) {
      const so = this.obj(row, b.label)
      const button = so.createComponent(Button.getTypeName()) as Button
      // Button.size is only safe to write once the element has initialized.
      button.onInitialized.add(() => {
        button.size = new vec3(buttonW, BUTTON_HEIGHT, 1)
      })
      this.addButtonLabel(so, b.label, buttonW - 0.6)
      const item = so.createComponent(FlexItem.getTypeName()) as FlexItem
      item.overrideWidth = buttonW
      item.overrideHeight = BUTTON_HEIGHT
      button.onTriggerUp.add(() => b.onTrigger())
    }
  }

  /** Raw text label drawn on a Button face, width-budgeted so it never truncates. */
  private addButtonLabel(parent: SceneObject, text: string, widthCM: number): void {
    const so = this.obj(parent, "Label", new vec3(0, 0, BUTTON_LABEL_Z))
    const t = so.createComponent("Component.Text") as Text
    t.text = text
    t.depthTest = true
    applyTextRole(t, "Button", this.focalDistanceCm)
    t.horizontalAlignment = HorizontalAlignment.Center
    t.verticalAlignment = VerticalAlignment.Center
    t.horizontalOverflow = HorizontalOverflow.Overflow
    t.verticalOverflow = VerticalOverflow.Overflow
    t.layoutRect = Rect.create(-widthCM / 2, widthCM / 2, -1.2, 1.2)
  }

  private makeRow(parent: SceneObject, name: string): SceneObject {
    const row = this.obj(parent, name)
    const rowFlex = row.createComponent(FlexLayout.getTypeName()) as FlexLayout
    rowFlex.direction = FlexDirection.Row
    rowFlex.justifyContent = FlexJustify.SpaceBetween
    rowFlex.alignItems = FlexAlign.Center
    rowFlex.width = -1
    rowFlex.height = ROW_HEIGHT
    row.createComponent(FlexItem.getTypeName())
    return row
  }

  // ── Text ───────────────────────────────────────────────────────────────────

  /** Full-width text in a column layout. */
  private addText(
    parent: SceneObject,
    text: string,
    role: TextRole,
    width: number,
    height: number,
    align: HorizontalAlignment,
    alpha: number = 1
  ): Text {
    const so = this.obj(parent, "Text")
    const t = so.createComponent("Component.Text") as Text
    t.text = text
    t.depthTest = true
    applyTextRole(t, role, this.focalDistanceCm)
    t.horizontalAlignment = align
    t.verticalAlignment = VerticalAlignment.Center
    t.horizontalOverflow = HorizontalOverflow.Wrap
    t.verticalOverflow = VerticalOverflow.Overflow
    t.layoutRect = Rect.create(-width / 2, width / 2, -height / 2, height / 2)
    t.textFill.color = new vec4(1, 1, 1, alpha)
    const item = so.createComponent(FlexItem.getTypeName()) as FlexItem
    item.overrideWidth = width
    item.overrideHeight = height
    return t
  }

  /** Text that shares a row with a control — explicit width so the row does not collapse it. */
  private addRowText(
    parent: SceneObject,
    text: string,
    role: TextRole,
    widthCM: number,
    align: HorizontalAlignment = HorizontalAlignment.Left
  ): Text {
    const so = this.obj(parent, "RowText")
    const t = so.createComponent("Component.Text") as Text
    t.text = text
    t.depthTest = true
    applyTextRole(t, role, this.focalDistanceCm)
    t.horizontalAlignment = align
    t.verticalAlignment = VerticalAlignment.Center
    t.horizontalOverflow = HorizontalOverflow.Overflow
    t.verticalOverflow = VerticalOverflow.Overflow
    t.layoutRect = Rect.create(-widthCM / 2, widthCM / 2, -1.2, 1.2)
    const item = so.createComponent(FlexItem.getTypeName()) as FlexItem
    item.overrideWidth = widthCM
    item.overrideHeight = ROW_HEIGHT
    return t
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  private obj(parent: SceneObject, name: string, position?: vec3): SceneObject {
    const so = global.scene.createSceneObject(name)
    so.setParent(parent)
    if (position) so.getTransform().setLocalPosition(position)
    return so
  }

  private normalize(value: number, min: number, max: number): number {
    return Math.min(1, Math.max(0, (value - min) / (max - min)))
  }
}

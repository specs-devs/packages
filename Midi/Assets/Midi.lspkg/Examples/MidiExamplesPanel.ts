// MidiExamplesPanel — the package's PLACE_IN_SCENE demo + guide panel.
//
// A world-space UIKit panel driven end-to-end by this package with zero
// hardware: MockMidiTransport plays a drum pattern, ClockTracker derives the
// tempo, and the panel reacts — pads flash on NoteOn, the BPM and last note
// update live, Start/Stop buttons drive the transport.
//
// The exact same onMessage() handler works against a real BLE-MIDI keyboard:
// swap MockMidiTransport for BleMidiTransport and feed it GATT packets (see
// Examples/PianoVisualizer.ts for that side).
import {MockMidiTransport} from "../Transports/MockMidiTransport"
import {ClockTracker} from "../Timing/ClockTracker"
import {MidiKind, midiNoteName} from "../Core/MidiTypes"
import type {MidiMessage} from "../Core/MidiTypes"

import {FlexLayout} from "UIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexLayout"
import {FlexItem} from "UIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexItem"
import {
  FlexAlign,
  FlexAlignSelf,
  FlexDirection,
  FlexJustify,
} from "UIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexTypes"
import {BackPlate} from "UIKit.lspkg/Scripts/BackPlate"
import {Button} from "UIKit.lspkg/Scripts/Components/Button/Button"

const PANEL_W = 26
const PAD = 1.8
const LAYOUT_Z_LIFT = 0.02
const BUTTON_LABEL_Z = 0.08
const PAD_COUNT = 4

// ── Typography: the single source of truth for text size + weight ────────────
// Component.Text.size is the glyph em-square height (em cm = size / 43.886),
// calibrated for the SnapOS system font at the z = -110 cm focal plane.
const FONT_SIZE_SCALE = 1.0

type TextRole =
  | "Title1" | "Title2" | "HeadlineXL" | "Headline1" | "Headline2"
  | "Subheadline" | "Button" | "Callout" | "Body" | "Caption"

const TYPE_SCALE: Record<TextRole, {size: number; weight: number}> = {
  Title1:      {size: 105, weight: 700},
  Title2:      {size: 93,  weight: 700},
  HeadlineXL:  {size: 62,  weight: 700},
  Headline1:   {size: 54,  weight: 700},
  Headline2:   {size: 48,  weight: 700},
  Subheadline: {size: 41,  weight: 700},
  Button:      {size: 39,  weight: 500},
  Callout:     {size: 39,  weight: 700},
  Body:        {size: 39,  weight: 500},
  Caption:     {size: 38,  weight: 500},
}

function roleSize(role: TextRole, distanceCm: number = 110): number {
  return TYPE_SCALE[role].size * FONT_SIZE_SCALE * (distanceCm / 110)
}

function applyTextRole(t: Text, role: TextRole, distanceCm: number = 110): void {
  t.size = roleSize(role, distanceCm)
  ;(t as Text & {weight?: number}).weight = TYPE_SCALE[role].weight
}

const GUIDE_TEXT =
  "This demo is driven by MockMidiTransport — a fake instrument that " +
  "plays a drum pattern right in Preview, no hardware needed. " +
  "Your lens code is three calls: onMessage(...) to react, start() to open " +
  "the transport, and stop() to close it. For a real Bluetooth keyboard, swap " +
  "in BleMidiTransport and feed it GATT packets — the handler stays identical."

@component
export class MidiExamplesPanel extends BaseScriptComponent {
  @ui.label("Midi Examples Panel")
  @ui.separator
  @ui.group_start("Settings")
  @input
  @hint("Tempo of the mock instrument, in beats per minute.")
  @widget(new SliderWidget(40, 200, 1))
  bpm: number = 70

  @input
  @hint("Start the mock instrument automatically when the lens starts.")
  autoStart: boolean = true

  @input
  @hint("Accent color used for pad flashes and the running-state highlight.")
  @widget(new ColorWidget())
  accentColor: vec4 = new vec4(0.45, 0.9, 0.55, 1)
  @ui.group_end

  private midi!: MockMidiTransport
  private clock: ClockTracker = new ClockTracker()
  private running: boolean = false
  /** Last bpm pushed to the transport, so slider changes are applied once. */
  private appliedBpm: number = -1

  private pads: Text[] = []
  private padPop: number[] = []
  private bpmText!: Text
  private noteText!: Text

  onAwake() {
    this.midi = new MockMidiTransport(this.bpm)
    this.buildPanel()

    // React to every message the transport emits — the package contract.
    this.midi.onMessage((msg: MidiMessage) => {
      this.clock.handle(msg, getTime())
      if (msg.kind === MidiKind.NoteOn && msg.data1 !== undefined) {
        const pad = msg.data1 % PAD_COUNT
        this.padPop[pad] = 1
        if (this.noteText) {
          this.noteText.text = `${midiNoteName(msg.data1)}  vel ${msg.data2 ?? 0}`
        }
      }
    })

    this.createEvent("OnStartEvent").bind(() => {
      if (this.autoStart) this.startTransport()
    })

    this.createEvent("UpdateEvent").bind((e: UpdateEvent) => {
      const dt = e.getDeltaTime()
      if (this.bpm !== this.appliedBpm) {
        this.appliedBpm = this.bpm
        this.midi.setBpm(this.bpm)
      }
      if (this.running) this.midi.tick(dt)
      this.updatePads(dt)
      this.updateReadout()
    })
  }

  // ── Transport control (also the public API for other scripts) ─────────────
  startTransport(): void {
    if (this.running) return
    this.midi.start()
    this.running = true
  }

  stopTransport(): void {
    if (!this.running) return
    this.midi.stop()
    this.running = false
    if (this.noteText) {
      this.noteText.text = "—"
    }
  }

  // ── Panel construction ─────────────────────────────────────────────────────
  private buildPanel() {
    this.sceneObject.createComponent("Component.Canvas")

    // BackPlate first so the Canvas hierarchy DFS paints it behind the content.
    const backPlate = this.sceneObject.createComponent(BackPlate.getTypeName()) as BackPlate

    const content = this.obj(this.sceneObject, "Content", new vec3(0, 0, 0.6))
    const flex = content.createComponent(FlexLayout.getTypeName()) as FlexLayout
    flex.width = PANEL_W
    flex.height = -1
    flex.direction = FlexDirection.Column
    flex.alignItems = FlexAlign.Stretch
    flex.rowGap = 1.2
    flex.paddingTop = PAD
    flex.paddingBottom = PAD
    flex.paddingLeft = PAD
    flex.paddingRight = PAD

    flex.onLayoutComplete.add((r) => {
      backPlate.size = new vec2(r.containerWidth, r.containerHeight)
    })

    this.addCenteredText(content, "Midi", "Headline1", 2.4)
    this.addCenteredText(content, "BLE-MIDI for Specs — live mock-instrument demo", "Caption", 1.4,
      new vec4(1, 1, 1, 0.6))
    this.addGuideText(content)
    this.buildPadRow(content)
    this.buildReadoutRow(content)
    this.buildButtonRow(content)
  }

  private buildPadRow(parent: SceneObject) {
    const row = this.flexRow(parent, PANEL_W - PAD * 2, 3.4, {
      justify: FlexJustify.Center,
      align: FlexAlign.Center,
      gap: 2.2,
    })
    for (let i = 0; i < PAD_COUNT; i++) {
      this.flexChild(row, {w: 3, h: 3}, (cell) => {
        const t = cell.createComponent("Component.Text") as Text
        t.text = "●" // ●
        t.depthTest = true
        applyTextRole(t, "Title2")
        t.horizontalAlignment = HorizontalAlignment.Center
        t.verticalAlignment = VerticalAlignment.Center
        t.horizontalOverflow = HorizontalOverflow.Overflow
        t.verticalOverflow = VerticalOverflow.Overflow
        t.layoutRect = Rect.create(-1.5, 1.5, -1.5, 1.5)
        this.pads.push(t)
        this.padPop.push(0)
      })
    }
  }

  private buildReadoutRow(parent: SceneObject) {
    const row = this.flexRow(parent, PANEL_W - PAD * 2, 2.6, {
      justify: FlexJustify.SpaceBetween,
      align: FlexAlign.Center,
      padX: 1.0,
    })
    this.bpmText = this.addRowText(row, "BPM —", "Callout", 8)
    this.noteText = this.addRowText(row, "—", "Callout", 11)
  }

  private buildButtonRow(parent: SceneObject) {
    const row = this.flexRow(parent, PANEL_W - PAD * 2, 3.2, {
      justify: FlexJustify.Center,
      align: FlexAlign.Center,
      gap: 1.6,
    })
    this.addButton(row, "Start", 6.5, 2.6, () => this.startTransport())
    this.addButton(row, "Stop", 6.5, 2.6, () => this.stopTransport())
  }

  // ── Per-frame visuals ───────────────────────────────────────────────────────
  private updatePads(dt: number) {
    const dim = new vec4(1, 1, 1, 0.25)
    for (let i = 0; i < this.pads.length; i++) {
      this.padPop[i] = Math.max(0, this.padPop[i] - dt * 2.5)
      const k = this.padPop[i]
      this.pads[i].textFill.color = new vec4(
        dim.x + (this.accentColor.x - dim.x) * k,
        dim.y + (this.accentColor.y - dim.y) * k,
        dim.z + (this.accentColor.z - dim.z) * k,
        dim.w + (this.accentColor.w - dim.w) * k,
      )
    }
  }

  private updateReadout() {
    if (!this.bpmText) return
    const bpm = this.clock.bpm
    this.bpmText.text = this.clock.running && bpm > 0 ? `BPM ${Math.round(bpm)}` : "BPM —"
  }

  // ── Layout helpers (specs-build-ui canonical) ──────────────────────────────
  private obj(parent: SceneObject, name: string, position?: vec3): SceneObject {
    const sceneObject = global.scene.createSceneObject(name)
    sceneObject.setParent(parent)
    if (position) sceneObject.getTransform().setLocalPosition(position)
    return sceneObject
  }

  private liftInZ(sceneObject: SceneObject, zOffset: number): void {
    const transform = sceneObject.getTransform()
    const pos = transform.getLocalPosition()
    transform.setLocalPosition(new vec3(pos.x, pos.y, pos.z + zOffset))
  }

  private flexRow(parent: SceneObject, width: number, height: number,
      opts?: {gap?: number, padY?: number, padX?: number, justify?: FlexJustify, align?: FlexAlign}): SceneObject {
    const container = this.obj(parent, "Flex")
    this.liftInZ(container, LAYOUT_Z_LIFT)
    const flexLayout = container.createComponent(FlexLayout.getTypeName()) as FlexLayout
    // Children are registered programmatically via flexChild -> addItems, which
    // throws pre-init while auto-discovery is on.
    flexLayout.autoDiscoverItemsOnStart = false
    const flexItem = container.createComponent(FlexItem.getTypeName()) as FlexItem
    if (width > 0) flexItem.overrideWidth = width
    if (height > 0) flexItem.overrideHeight = height

    flexLayout.onInitialized.add(() => {
      flexLayout.width = width
      flexLayout.height = height
      flexLayout.direction = FlexDirection.Row
      flexLayout.columnGap = opts?.gap ?? 0
      flexLayout.paddingTop = opts?.padY ?? 0
      flexLayout.paddingBottom = opts?.padY ?? 0
      flexLayout.paddingLeft = opts?.padX ?? 0
      flexLayout.paddingRight = opts?.padX ?? 0
      flexLayout.justifyContent = opts?.justify ?? FlexJustify.Start
      flexLayout.alignItems = opts?.align ?? FlexAlign.Stretch
    })
    return container
  }

  private flexChild(parent: SceneObject, size: {w?: number, h?: number, grow?: number},
      builder: (childObject: SceneObject) => void): SceneObject {
    const child = this.obj(parent, "Item")
    this.liftInZ(child, LAYOUT_Z_LIFT)
    const flexItem = child.createComponent(FlexItem.getTypeName()) as FlexItem
    if (size.w !== undefined && size.w > 0) flexItem.overrideWidth = size.w
    if (size.h !== undefined && size.h > 0) flexItem.overrideHeight = size.h
    flexItem.flexGrow = size.grow ?? 0
    flexItem.flexShrink = 0

    builder(child)

    const parentFlexLayout = parent.getComponent(FlexLayout.getTypeName()) as FlexLayout | null
    if (parentFlexLayout) parentFlexLayout.addItems([flexItem])
    return child
  }

  // Column-direction centered text row (alignSelf = Stretch spans the card width).
  private addCenteredText(parent: SceneObject, text: string, role: TextRole, h: number,
      color?: vec4): Text {
    const so = this.obj(parent, "Text")
    const t = so.createComponent("Component.Text") as Text
    t.text = text
    t.depthTest = true
    applyTextRole(t, role)
    t.horizontalAlignment = HorizontalAlignment.Center
    t.verticalAlignment = VerticalAlignment.Center
    t.horizontalOverflow = HorizontalOverflow.Overflow
    t.verticalOverflow = VerticalOverflow.Overflow
    t.layoutRect = Rect.create(-0.5, 0.5, -0.5, 0.5)
    if (color) t.textFill.color = color
    const item = so.createComponent(FlexItem.getTypeName()) as FlexItem
    item.alignSelf = FlexAlignSelf.Stretch
    item.overrideHeight = h
    return t
  }

  // The multi-line guide body — wraps inside the panel's inner width.
  private addGuideText(parent: SceneObject) {
    const so = this.obj(parent, "Guide")
    const innerW = PANEL_W - PAD * 2
    const t = so.createComponent("Component.Text") as Text
    t.text = GUIDE_TEXT
    t.depthTest = true
    applyTextRole(t, "Caption")
    t.textFill.color = new vec4(1, 1, 1, 0.75)
    t.horizontalAlignment = HorizontalAlignment.Center
    t.verticalAlignment = VerticalAlignment.Center
    t.horizontalOverflow = HorizontalOverflow.Wrap
    t.verticalOverflow = VerticalOverflow.Overflow
    t.layoutRect = Rect.create(-innerW / 2, innerW / 2, -3.5, 3.5)
    const item = so.createComponent(FlexItem.getTypeName()) as FlexItem
    item.alignSelf = FlexAlignSelf.Stretch
    item.overrideHeight = 7.0
  }

  // Row-direction text with a real width budget (never Stretch in a row).
  private addRowText(parent: SceneObject, text: string, role: TextRole, widthCM: number): Text {
    const so = this.obj(parent, "RowText")
    const t = so.createComponent("Component.Text") as Text
    t.text = text
    t.depthTest = true
    applyTextRole(t, role)
    t.horizontalAlignment = HorizontalAlignment.Center
    t.verticalAlignment = VerticalAlignment.Center
    t.horizontalOverflow = HorizontalOverflow.Overflow
    t.verticalOverflow = VerticalOverflow.Overflow
    t.layoutRect = Rect.create(-widthCM / 2, widthCM / 2, -1.2, 1.2)
    const item = so.createComponent(FlexItem.getTypeName()) as FlexItem
    this.registerWithRow(parent, item)
    return t
  }

  // Rows have autoDiscoverItemsOnStart disabled, so every direct child must be
  // registered explicitly or it renders unpositioned at the row's origin.
  private registerWithRow(parent: SceneObject, item: FlexItem) {
    const layout = parent.getComponent(FlexLayout.getTypeName()) as FlexLayout | null
    if (layout) layout.addItems([item])
  }

  private addButtonLabel(parent: SceneObject, text: string, widthCM: number) {
    const so = this.obj(parent, "ButtonLabel", new vec3(0, 0, BUTTON_LABEL_Z))
    const t = so.createComponent("Component.Text") as Text
    t.text = text
    t.depthTest = true
    applyTextRole(t, "Button")
    t.horizontalAlignment = HorizontalAlignment.Center
    t.verticalAlignment = VerticalAlignment.Center
    t.horizontalOverflow = HorizontalOverflow.Overflow
    t.verticalOverflow = VerticalOverflow.Overflow
    t.layoutRect = Rect.create(-widthCM / 2, widthCM / 2, -1.2, 1.2)
    so.createComponent(FlexItem.getTypeName())
  }

  private addButton(parent: SceneObject, text: string, sizeXCM: number, sizeYCM: number,
      onClick: () => void) {
    const so = this.obj(parent, text)
    const btn = so.createComponent(Button.getTypeName()) as Button
    btn.size = new vec3(sizeXCM, sizeYCM, 1)
    this.addButtonLabel(so, text, sizeXCM - 0.5)
    const item = so.createComponent(FlexItem.getTypeName()) as FlexItem
    this.registerWithRow(parent, item)
    btn.onTriggerUp.add(onClick)
  }
}

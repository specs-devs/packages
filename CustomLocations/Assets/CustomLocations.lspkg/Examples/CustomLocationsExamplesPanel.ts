/**
 * Glasses Inc. 2026
 * CustomLocationsExamplesPanel — UIKit status panel for a Custom Location Group.
 *
 * Wire `locationGroup` to the SceneObject that holds the CustomLocationGroupComponent (LocationRoot in
 * the Examples scene). The panel lists the group id and every child Located At object with its live
 * tracking state and distance, lets you show / hide the scan meshes, and can force the
 * ActivateWhenInCameraView listeners on or off so the content flow can be tested in Preview without
 * being at the real location.
 */
import {FlexLayout} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexLayout"
import {FlexItem} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexItem"
import {FlexAlign, FlexDirection, FlexJustify} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexTypes"
import {BackPlate} from "SpectaclesUIKit.lspkg/Scripts/BackPlate"
import {Button} from "SpectaclesUIKit.lspkg/Scripts/Components/Button/Button"
import {Switch} from "SpectaclesUIKit.lspkg/Scripts/Components/Switch/Switch"
import {ActivateWhenInCameraView} from "../Scripts/ActivateWhenInCameraView"
import {DeactivateLocationMeshOnDevice} from "../Scripts/DeactivateLocationMeshOnDevice"
import {Logger} from "../Scripts/Logger"

// Component.Text.size is the glyph em-square height, calibrated for the z = -110 cm focal plane.
type TextRole = "Title2" | "Body" | "Caption" | "Button"
const TYPE_SCALE: Record<TextRole, {size: number; weight: number}> = {
  Title2: {size: 93, weight: 700},
  Body: {size: 39, weight: 500},
  Caption: {size: 38, weight: 500},
  Button: {size: 39, weight: 500},
}

function applyTextRole(t: Text, role: TextRole, distanceCm: number): void {
  t.size = TYPE_SCALE[role].size * (distanceCm / 110)
  ;(t as Text & {weight?: number}).weight = TYPE_SCALE[role].weight
}

const PAD_X = 1.6
const PAD_Y = 1.6
const ROW_GAP = 0.8
const HEADER_HEIGHT = 3.6
const ROW_HEIGHT = 2.6
const SWITCH_WIDTH = 3.6
const SWITCH_HEIGHT = 2.0
const BUTTON_HEIGHT = 2.8
const BUTTON_GAP = 0.8
const BUTTON_LABEL_Z = 0.08
const CONTENT_Z = 0.6
const STATUS_LINE_HEIGHT = 1.9

type LocationState = "Waiting" | "Ready" | "Can track" | "Cannot track" | "Found" | "Lost" | "Error"

interface LocationRow {
  object: SceneObject
  locatedAt: LocatedAtComponent
  state: LocationState
  text: Text
}

@component
export class CustomLocationsExamplesPanel extends BaseScriptComponent {
  @ui.label("CustomLocations Examples Panel")
  @ui.separator
  @input
  @hint("SceneObject holding the CustomLocationGroupComponent (its children are the Located At objects)")
  locationGroup: SceneObject

  @input
  @allowUndefined
  @hint("Camera used for distance readouts; defaults to the main camera found in the scene")
  camera: Camera

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
  @hint("Seconds between distance readout refreshes")
  @widget(new SliderWidget(0.1, 2, 0.1))
  refreshInterval: number = 0.5

  @input
  @hint("Enable general logging")
  enableLogging: boolean = false
  @ui.group_end

  private logger: Logger
  private group: CustomLocationGroupComponent | null = null
  private groupText!: Text
  private rows: LocationRow[] = []
  private activators: ActivateWhenInCameraView[] = []
  private meshToggle: DeactivateLocationMeshOnDevice | null = null
  private refreshTimer = 0

  onAwake(): void {
    this.logger = new Logger("CustomLocationsExamplesPanel", this.enableLogging)
    this.collectLocations()
    this.buildPanel()
    this.createEvent("OnStartEvent").bind(() => this.onStart())
    this.createEvent("UpdateEvent").bind(() => this.onUpdate())
  }

  // ── Location discovery ─────────────────────────────────────────────────────

  private collectLocations(): void {
    if (!this.locationGroup) {
      this.logger.error("Assign the 'locationGroup' input (SceneObject with a CustomLocationGroupComponent).")
      return
    }
    this.group = this.locationGroup.getComponent("CustomLocationGroupComponent") as CustomLocationGroupComponent | null
    this.meshToggle = this.locationGroup.getComponent(
      DeactivateLocationMeshOnDevice.getTypeName()
    ) as DeactivateLocationMeshOnDevice | null

    for (const child of this.locationGroup.children) {
      const locatedAt = child.getComponent("LocatedAtComponent") as LocatedAtComponent | null
      if (!locatedAt) continue
      this.rows.push({object: child, locatedAt, state: "Waiting", text: null as unknown as Text})
      const activator = child.getComponent(ActivateWhenInCameraView.getTypeName()) as ActivateWhenInCameraView | null
      if (activator) this.activators.push(activator)
    }
    this.logger.info(`Found ${this.rows.length} location(s), ${this.activators.length} activator(s)`)
  }

  private onStart(): void {
    if (!this.camera) {
      this.camera = this.findMainCamera()
    }
    if (this.group) {
      this.group.onFound.add((locationId: string) => {
        this.logger.info(`Group found via location ${locationId}`)
        this.groupText.text = `Group ${this.groupLabel()} · found (${locationId})`
      })
    }
    for (const row of this.rows) {
      const set = (state: LocationState) => {
        row.state = state
        this.refreshRow(row)
      }
      row.locatedAt.onReady.add(() => set("Ready"))
      row.locatedAt.onCanTrack.add(() => set("Can track"))
      row.locatedAt.onCannotTrack.add(() => set("Cannot track"))
      row.locatedAt.onFound.add(() => set("Found"))
      row.locatedAt.onLost.add(() => set("Lost"))
      row.locatedAt.onError.add(() => set("Error"))
      this.refreshRow(row)
    }
  }

  private onUpdate(): void {
    this.refreshTimer += getDeltaTime()
    if (this.refreshTimer < this.refreshInterval) return
    this.refreshTimer = 0
    for (const row of this.rows) this.refreshRow(row)
  }

  private refreshRow(row: LocationRow): void {
    if (!row.text) return
    const activator = row.object.getComponent(ActivateWhenInCameraView.getTypeName()) as ActivateWhenInCameraView | null
    // Measure to the content center the activator uses, not to the scan origin.
    const center = (activator && activator.centerReference) || row.object
    const distance = this.camera
      ? `${(center.getTransform().getWorldPosition().distance(this.camera.getTransform().getWorldPosition()) / 100).toFixed(1)} m`
      : "—"
    const active = activator ? (activator.isActivated ? " · active" : "") : ""
    row.text.text = `${this.locationLabel(row)} · ${row.state} · ${distance}${active}`
  }

  private locationLabel(row: LocationRow): string {
    const asset = row.locatedAt.location
    if (asset && asset.name) return asset.name.replace(/\.location$/, "")
    return row.object.name
  }

  private groupLabel(): string {
    return this.locationGroup ? this.locationGroup.name : "?"
  }

  // ── Actions ────────────────────────────────────────────────────────────────

  private setScanMeshesVisible(visible: boolean): void {
    if (this.meshToggle) {
      this.meshToggle.setMeshesVisible(visible)
      return
    }
    for (const row of this.rows) {
      const visual = row.object.getComponent("Component.RenderMeshVisual") as RenderMeshVisual | null
      if (visual) visual.enabled = visible
    }
  }

  private activateAll(on: boolean): void {
    for (const activator of this.activators) {
      if (on) activator.activateListeners()
      else activator.deactivateListeners()
    }
    for (const row of this.rows) this.refreshRow(row)
  }

  // ── Panel construction ─────────────────────────────────────────────────────

  private buildPanel(): void {
    this.sceneObject.createComponent("Component.Canvas")
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
    this.addText(content, "CustomLocations", "Title2", innerW, HEADER_HEIGHT, HorizontalAlignment.Left)
    this.addText(
      content,
      "Walk to the scanned location. Content activates when you are close and looking at it.",
      "Caption",
      innerW,
      2.2,
      HorizontalAlignment.Left,
      0.65
    )

    this.groupText = this.addText(
      content,
      this.group ? `Group ${this.groupLabel()} · waiting for a scan to track` : "No CustomLocationGroupComponent found",
      "Body",
      innerW,
      STATUS_LINE_HEIGHT,
      HorizontalAlignment.Left
    )
    for (const row of this.rows) {
      row.text = this.addText(content, "", "Caption", innerW, STATUS_LINE_HEIGHT, HorizontalAlignment.Left, 0.85)
    }

    const meshesInitiallyVisible = global.deviceInfoSystem.isEditor()
    this.addSwitchRow(content, [
      {label: "Scan meshes", initial: meshesInitiallyVisible, onChange: (on) => this.setScanMeshesVisible(on)},
    ])

    this.addButtonRow(content, [
      {label: "Activate all", onTrigger: () => this.activateAll(true)},
      {label: "Deactivate all", onTrigger: () => this.activateAll(false)},
    ])
  }

  // ── Rows ───────────────────────────────────────────────────────────────────

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

  private findMainCamera(): Camera | null {
    const count = global.scene.getRootObjectsCount()
    for (let i = 0; i < count; i++) {
      const found = this.findCameraIn(global.scene.getRootObject(i))
      if (found) return found
    }
    return null
  }

  private findCameraIn(so: SceneObject): Camera | null {
    const cam = so.getComponent("Component.Camera") as Camera | null
    if (cam) return cam
    for (const child of so.children) {
      const found = this.findCameraIn(child)
      if (found) return found
    }
    return null
  }
}

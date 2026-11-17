// FriendMarkerUI — billboarded label rendered above the friend marker sphere.
// Generated via /specs-build-ui: BackPlate + FlexLayout column with
// [icon + name] row, large distance readout, and a status caption.
// Main script pushes state via setName / setDistanceMeters / setStatus / setVisible.

import {FlexLayout} from "UIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexLayout"
import {FlexItem} from "UIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexItem"
import {
  FlexAlign,
  FlexDirection,
  FlexJustify,
} from "UIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexTypes"
import {BackPlate} from "UIKit.lspkg/Scripts/BackPlate"
import {ElementContent} from "UIKit.lspkg/Scripts/Components/Content/ElementContent"
import {Billboard} from "InteractionKit.lspkg/Components/Interaction/Billboard/Billboard"
import {FEET_PER_METER, formatFeetMiles} from "./GeoMath"

const ICON_PERSON: Texture = requireAsset("../../Images/person_pin_circle.png") as Texture

// ── Type scale — single source of truth (canonical: specs-build-ui references/patterns.md → Typography)
const FONT_SIZE_SCALE = 1.0
type TextRole =
  | "Title1" | "Title2" | "HeadlineXL" | "Headline1" | "Headline2"
  | "Subheadline" | "Button" | "Callout" | "Body" | "Caption"
const TYPE_SCALE: Record<TextRole, {size: number; weight: number}> = {
  Title1: {size: 105, weight: 700}, Title2: {size: 93, weight: 700},
  HeadlineXL: {size: 62, weight: 700}, Headline1: {size: 54, weight: 700},
  Headline2: {size: 48, weight: 700}, Subheadline: {size: 41, weight: 700},
  Button: {size: 39, weight: 500}, Callout: {size: 39, weight: 700},
  Body: {size: 39, weight: 500}, Caption: {size: 38, weight: 500},
}
function roleSize(role: TextRole, distanceCm: number = 110): number {
  return TYPE_SCALE[role].size * FONT_SIZE_SCALE * (distanceCm / 110)
}
function applyTextRole(t: Text, role: TextRole, distanceCm: number = 110): void {
  t.size = roleSize(role, distanceCm)
  ;(t as Text & {weight?: number}).weight = TYPE_SCALE[role].weight
}

const LAYOUT_Z_LIFT = 0.02
const DYNAMIC_TEXT_Z_OFFSET = 0.15
const CONTENT_W = 13.5

const COLOR_PRIMARY = new vec4(1, 1, 1, 1)
const COLOR_ACCENT = new vec4(0.45, 0.9, 0.85, 1) // cyan-teal, matches pointer
const COLOR_SECONDARY = new vec4(1, 1, 1, 0.6)

@component
export class FriendMarkerUI extends BaseScriptComponent {
  private nameText!: Text
  private distanceText!: Text
  private statusText!: Text

  onAwake(): void {
    this.sceneObject.createComponent("Component.Canvas")
    this.sceneObject.createComponent(Billboard.getTypeName())
    const backPlate = this.sceneObject.createComponent(BackPlate.getTypeName()) as BackPlate

    const flex = this.sceneObject.createComponent(FlexLayout.getTypeName()) as FlexLayout
    flex.autoDiscoverItemsOnStart = false // items are registered programmatically via addItems
    flex.onLayoutComplete.add((result) => {
      backPlate.size = new vec2(result.containerWidth, result.containerHeight)
    })
    flex.direction = FlexDirection.Column
    flex.alignItems = FlexAlign.Center
    flex.justifyContent = FlexJustify.Center
    flex.rowGap = 0.35
    flex.paddingTop = 1.0
    flex.paddingBottom = 1.0
    flex.paddingLeft = 1.4
    flex.paddingRight = 1.4
    flex.width = -1
    flex.height = -1

    // Row 1: person icon + friend name
    this.flexChild(this.sceneObject, {w: CONTENT_W, h: 2.6}, (cell) => {
      const row = this.flexRow(cell, CONTENT_W, 2.6, {
        gap: 0.5,
        justify: FlexJustify.Center,
        align: FlexAlign.Center,
      })
      this.flexChild(row, {w: 2.2, h: 2.2}, (iconCell) => {
        const ec = iconCell.createComponent(ElementContent.getTypeName()) as ElementContent
        ec.leadingIcon = ICON_PERSON
        ec.iconLayout = "left"
        ec.leadingIconSize = 2.0
        ec.sizeOverride = new vec2(2.2, 2.2)
      })
      this.flexChild(row, {w: 10.3, h: 2.6}, (nameCell) => {
        this.nameText = this.makeText(
          nameCell, "Friend", "Subheadline",
          Rect.create(-5.15, 5.15, -1.2, 1.2), COLOR_PRIMARY)
      })
    })

    // Row 2: large distance readout
    this.flexChild(this.sceneObject, {w: CONTENT_W, h: 2.4}, (cell) => {
      this.distanceText = this.makeText(
        cell, "— ft", "Headline2",
        Rect.create(-0.5, 0.5, -0.5, 0.5), COLOR_ACCENT)
    })

    // Row 3: status caption
    this.flexChild(this.sceneObject, {w: CONTENT_W, h: 1.6}, (cell) => {
      this.statusText = this.makeText(
        cell, "Waiting for phone…", "Caption",
        Rect.create(-0.5, 0.5, -0.5, 0.5), COLOR_SECONDARY)
    })
  }

  // ── Public API (main script pushes state through these) ──────────────

  setName(name: string): void {
    if (this.nameText) this.nameText.text = name
  }

  setDistanceMeters(meters: number | null, heightDiffM: number | null = null): void {
    if (!this.distanceText) return
    let text: string
    if (meters === null || !isFinite(meters)) {
      text = "— ft"
    } else {
      text = formatFeetMiles(meters)
    }
    if (heightDiffM !== null && isFinite(heightDiffM)) {
      const feet = Math.abs(heightDiffM) * FEET_PER_METER
      text += ` · ${heightDiffM > 0 ? "↑" : "↓"}${feet.toFixed(0)} ft`
    }
    this.distanceText.text = text
  }

  setStatus(status: string): void {
    if (this.statusText) this.statusText.text = status
  }

  setVisible(visible: boolean): void {
    this.sceneObject.enabled = visible
  }

  // ── Layout composition helpers (canonical: specs-build-ui references/helpers.md) ──

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
    return this.makeFlex(parent, FlexDirection.Row, width, height, opts)
  }

  private makeFlex(parent: SceneObject, direction: FlexDirection, width: number, height: number,
      opts?: {gap?: number, padY?: number, padX?: number, justify?: FlexJustify, align?: FlexAlign}): SceneObject {
    const container = this.obj(parent, "Flex")
    this.liftInZ(container, LAYOUT_Z_LIFT)
    const flexLayout = container.createComponent(FlexLayout.getTypeName()) as FlexLayout
    flexLayout.autoDiscoverItemsOnStart = false // items are registered programmatically via addItems
    const flexItem = container.createComponent(FlexItem.getTypeName()) as FlexItem
    if (width > 0) flexItem.overrideWidth = width
    if (height > 0) flexItem.overrideHeight = height

    flexLayout.onInitialized.add(() => {
      flexLayout.width = width
      flexLayout.height = height
      flexLayout.direction = direction
      if (direction === FlexDirection.Row) {
        flexLayout.columnGap = opts?.gap ?? 0
      } else {
        flexLayout.rowGap = opts?.gap ?? 0
      }
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

  private makeText(parent: SceneObject, initial: string, role: TextRole, rect: Rect, color: vec4): Text {
    const tObj = this.obj(parent, "Text")
    this.liftInZ(tObj, DYNAMIC_TEXT_Z_OFFSET)
    const t = tObj.createComponent("Component.Text") as Text
    t.text = initial
    applyTextRole(t, role)
    t.textFill.color = color
    t.horizontalAlignment = HorizontalAlignment.Center
    t.verticalAlignment = VerticalAlignment.Center
    t.horizontalOverflow = HorizontalOverflow.Overflow
    t.depthTest = true
    t.layoutRect = rect
    return t
  }
}

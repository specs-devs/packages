// FaceMeshExamplesHeadSelectorUI.ts — compact world-space head selector panel.
//
// [Prev]  (face) Pirate Shark  [Next]
//               Face Mesh
//               2 / 4
// [-] 100% [+]        [Debug: Off]
//        [-] Fade 40% [+]
//
// Attach to the authored "HeadSelectorUI" root (world (-1, -16, -55) cm).
// Composition derived from the installed UIKit 2.1.0 / SIK 3.0.0
// sources (LS 5.24): Frame (fixed, non-grabbable) -> content host lifted in +Z
// -> FlexLayout column -> [top row: round icon Button, column(name
// ElementContent, source Text, index Text), round icon Button] + [control row:
// scale group(round Button, scale Text, round Button), capsule Option Button]
// + [fade row: fade group(round Button, fade Text, round Button)].
// The UI holds no domain state: Main pushes name/index/source/scale/option
// labels in and listens to onPrev/onNext/onScaleDown/onScaleUp/onNextOption/
// onFadeDown/onFadeUp.
// Button trigger subscriptions bind in OnStartEvent.

import {Button} from "UIKit.lspkg/Scripts/Components/Button/Button"
import {Frame} from "UIKit.lspkg/Scripts/Components/Frame/Frame"
import {ElementContent} from "UIKit.lspkg/Scripts/Components/Content/ElementContent"
import {addContentToElement} from "UIKit.lspkg/Scripts/Components/Content/ElementContentFactory"
import {FlexLayout} from "UIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexLayout"
import {FlexItem} from "UIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexItem"
import {FlexAlign, FlexDirection, FlexJustify} from "UIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexTypes"
import {ThemeService} from "UIKit.lspkg/Scripts/Themes/ThemeService"
import {System3} from "UIKit.lspkg/Scripts/Themes/System-3.0/System3"
import {InteractableManipulation} from "InteractionKit.lspkg/Components/Interaction/InteractableManipulation/InteractableManipulation"
import Event, {PublicApi} from "InteractionKit.lspkg/Utils/Event"

const UI_THEME = "System 3.0"
// Depth tie-breakers (intra-panel only).
const PANEL_CONTENT_Z_LIFT = 0.6
const LAYOUT_Z_LIFT = 0.02
const DYNAMIC_TEXT_Z_OFFSET = 0.15
const BUTTON_COLLIDER_DEPTH_CM = 1.0

// Snap Specs type scale (em-square size at 110 cm), scaled to the authored distance.
const BODY_SIZE = 39
const CAPTION_SIZE = 38
const SOURCE_SIZE = 32

// Control-row geometry (cm). Center-to-center spacing between adjacent
// tappables stays >= 1.5x the scale button diameter (2.8 -> 4.2 cm).
const TOP_ROW_MIN_H = 5.2
const ROW_GAP = 0.4
const CONTROL_ROW_H = 3.0
const SCALE_BTN = 2.8
const SCALE_LABEL_W = 3.0
const SCALE_GROUP_GAP = 0.4
const CONTROL_GROUP_GAP = 1.0
const OPTION_BTN_W = 5.6
const OPTION_BTN_H = 2.8
// Fade row mirrors the scale group: same button size/shape/gap; wider readout
// for "Fade 40%". (-)->(+) center-to-center = SCALE_BTN + FADE_LABEL_W + 2*gap = 8.2 cm.
const FADE_LABEL_W = 4.6
const CONTROL_ROW_MIN_W =
  2 * SCALE_BTN + SCALE_LABEL_W + 2 * SCALE_GROUP_GAP + CONTROL_GROUP_GAP + OPTION_BTN_W

@component
export class FaceMeshExamplesHeadSelectorUI extends BaseScriptComponent {
  @input
  @hint("Distance from the viewer in cm; scales text to stay legible")
  viewDistanceCm: number = 55

  @input
  @hint("Inner (content) width of the frame in cm")
  innerWidthCm: number = 16

  @input
  @hint("Inner (content) height of the frame in cm")
  innerHeightCm: number = 4.5

  @input
  @hint("Prev/Next button diameter in cm")
  buttonSizeCm: number = 3.5

  @input
  @widget(new ColorWidget())
  indexColor: vec4 = new vec4(0.72, 0.74, 0.78, 1)

  @input
  initialName: string = "Pirate Shark"

  @input
  @widget(new ColorWidget())
  sourceColor: vec4 = new vec4(0.55, 0.78, 1.0, 1)

  private onPrevEvent = new Event<void>()
  /** Fires when the user taps the Prev button. */
  public readonly onPrev: PublicApi<void> = this.onPrevEvent.publicApi()

  private onNextEvent = new Event<void>()
  /** Fires when the user taps the Next button. */
  public readonly onNext: PublicApi<void> = this.onNextEvent.publicApi()

  private onScaleDownEvent = new Event<void>()
  /** Fires when the user taps the scale-down (-) button. */
  public readonly onScaleDown: PublicApi<void> = this.onScaleDownEvent.publicApi()

  private onScaleUpEvent = new Event<void>()
  /** Fires when the user taps the scale-up (+) button. */
  public readonly onScaleUp: PublicApi<void> = this.onScaleUpEvent.publicApi()

  private onNextOptionEvent = new Event<void>()
  /** Fires when the user taps the Option button (toggles the debug Face Mesh). */
  public readonly onNextOption: PublicApi<void> = this.onNextOptionEvent.publicApi()

  private onFadeDownEvent = new Event<void>()
  /** Fires when the user taps the fade-down (-) button. */
  public readonly onFadeDown: PublicApi<void> = this.onFadeDownEvent.publicApi()

  private onFadeUpEvent = new Event<void>()
  /** Fires when the user taps the fade-up (+) button. */
  public readonly onFadeUp: PublicApi<void> = this.onFadeUpEvent.publicApi()

  private frame: Frame | null = null
  private nameContent: ElementContent | null = null
  private indexText: Text | null = null
  private prevButton: Button | null = null
  private nextButton: Button | null = null
  private pendingName: string | null = null
  private pendingIndex: string | null = null
  private sourceText: Text | null = null
  private scaleText: Text | null = null
  private scaleDownButton: Button | null = null
  private scaleUpButton: Button | null = null
  private optionButton: Button | null = null
  private optionContent: ElementContent | null = null
  private pendingSource: string | null = null
  private pendingScale: string | null = null
  private pendingOptionLabel: string | null = null
  private pendingOptionVisible = false
  private fadeText: Text | null = null
  private fadeDownButton: Button | null = null
  private fadeUpButton: Button | null = null
  private pendingFade: string | null = null
  private pendingBindings: Array<{button: Button; onClick: () => void}> = []

  onAwake(): void {
    // Theme must be set before any UIKit visual is created.
    ThemeService.getInstance().setTheme(System3)
    this.build()
    // SIK/UIKit interaction subscriptions bind in OnStartEvent.
    this.createEvent("OnStartEvent").bind(() => this.bindButtons())
  }

  // ─── Public API (contract with Main) ─────────────────────────────────────

  /** Show the current character name. */
  public setCharacterName(name: string): void {
    this.pendingName = name
    if (this.nameContent) this.nameContent.text = name
  }

  /** Show the 1-based position, e.g. setIndex(2, 4) -> "2 / 4". */
  public setIndex(index: number, total: number): void {
    const label = `${Math.round(index)} / ${Math.round(total)}`
    this.pendingIndex = label
    if (this.indexText) this.indexText.text = label
  }

  /** Enable/disable both navigation buttons (e.g. while a swap animates). */
  public setInteractable(enabled: boolean): void {
    if (this.prevButton) this.prevButton.inactive = !enabled
    if (this.nextButton) this.nextButton.inactive = !enabled
    if (this.scaleDownButton) this.scaleDownButton.inactive = !enabled
    if (this.scaleUpButton) this.scaleUpButton.inactive = !enabled
    if (this.optionButton) this.optionButton.inactive = !enabled
    if (this.fadeDownButton) this.fadeDownButton.inactive = !enabled
    if (this.fadeUpButton) this.fadeUpButton.inactive = !enabled
  }

  /** Show where the current head comes from, e.g. "Face Mesh". */
  public setSource(text: string): void {
    this.pendingSource = text
    if (this.sourceText) this.sourceText.text = text
  }

  /** Readout between the scale buttons, e.g. "100%". */
  public setScaleLabel(text: string): void {
    this.pendingScale = text
    if (this.scaleText) this.scaleText.text = text
  }

  /** Readout between the fade buttons, e.g. "Fade 40%". */
  public setFadeLabel(text: string): void {
    this.pendingFade = text
    if (this.fadeText) this.fadeText.text = text
  }

  /** Show or hide the Option button (the debug Face Mesh toggle). */
  public setOptionVisible(visible: boolean): void {
    this.pendingOptionVisible = visible
    if (this.optionButton) this.optionButton.sceneObject.enabled = visible
  }

  /** Label on the Option button, e.g. "Option 2/3". */
  public setOptionLabel(text: string): void {
    this.pendingOptionLabel = text
    if (this.optionContent) this.optionContent.text = text
  }

  /** Show or hide the whole panel. */
  public setVisible(visible: boolean): void {
    const count = this.sceneObject.getChildrenCount()
    for (let i = 0; i < count; i++) this.sceneObject.getChild(i).enabled = visible
  }

  // ─── Construction ────────────────────────────────────────────────────────

  private build(): void {
    const root = this.sceneObject
    const innerW = this.innerWidthCm > 0 ? this.innerWidthCm : 16
    const innerH = this.innerHeightCm > 0 ? this.innerHeightCm : 4.5
    const btn = this.buttonSizeCm > 0 ? this.buttonSizeCm : 3.5
    const dist = this.viewDistanceCm > 0 ? this.viewDistanceCm : 55
    const bodySize = BODY_SIZE * (dist / 110)
    const captionSize = CAPTION_SIZE * (dist / 110)
    const sourceSize = SOURCE_SIZE * (dist / 110)
    const panelW = Math.max(innerW, CONTROL_ROW_MIN_W)
    const topH = Math.max(innerH, TOP_ROW_MIN_H)
    const panelH = topH + 2 * ROW_GAP + 2 * CONTROL_ROW_H

    const backIcon = this.loadTexture("back")
    const forwardIcon = this.loadTexture("forward")
    const faceIcon = this.loadTexture("face")

    // Fixed panel frame on the authored root.
    const frame = root.createComponent(Frame.getTypeName()) as Frame
    frame.autoShowHide = false
    frame.autoScaleContent = false
    frame.allowScaling = false
    frame.allowTranslation = false
    this.frame = frame
    frame.onInitialized.add(() => {
      frame.innerSize = new vec2(panelW, panelH)
      frame.showCloseButton = false
      this.disableFrameManipulation(root, frame)
    })

    // Canvas: hierarchy order = render order for the stacked surfaces.
    if (!root.getComponent("Component.Canvas")) {
      const canvas = root.createComponent("Component.Canvas") as Canvas
      canvas.sortingType = Canvas.SortingType.Hierarchy
    }

    // Content host in front of the frame plate.
    const content = this.adoptOrCreate(root, "Content", new vec3(0, 0, PANEL_CONTENT_Z_LIFT))

    const gap = 0.5
    const centerW = Math.max(4, panelW - 2 * btn - 2 * gap)
    const stack = this.makeFlex(content, "Stack", FlexDirection.Column, panelW, panelH, ROW_GAP)
    const row = this.makeFlex(stack, "Row", FlexDirection.Row, panelW, topH, gap)

    this.prevButton = this.addIconButton(row, "PrevButton", backIcon, "<", btn, bodySize, () =>
      this.onPrevEvent.invoke()
    )

    const column = this.makeFlex(row, "LabelColumn", FlexDirection.Column, centerW, topH, 0.1)
    const nameH = 2.4
    const sourceH = 1.1
    const indexH = 1.3
    this.nameContent = this.addStandaloneContent(
      column,
      "NameLabel",
      this.pendingName ?? this.initialName,
      bodySize,
      centerW,
      nameH,
      faceIcon
    )
    this.sourceText = this.addDynamicText(
      column,
      "SourceLabel",
      this.pendingSource ?? "Face Mesh",
      sourceSize,
      centerW,
      sourceH,
      this.sourceColor
    )
    this.indexText = this.addDynamicText(column, "IndexLabel", this.pendingIndex ?? "1 / 4", captionSize, centerW, indexH)

    this.nextButton = this.addIconButton(row, "NextButton", forwardIcon, ">", btn, bodySize, () =>
      this.onNextEvent.invoke()
    )

    // Control row: [-] [100%] [+]   gap   [Option].
    const controls = this.makeFlex(stack, "ControlRow", FlexDirection.Row, panelW, CONTROL_ROW_H, CONTROL_GROUP_GAP)
    const scaleGroupW = 2 * SCALE_BTN + SCALE_LABEL_W + 2 * SCALE_GROUP_GAP
    const scaleGroup = this.makeFlex(controls, "ScaleGroup", FlexDirection.Row, scaleGroupW, CONTROL_ROW_H, SCALE_GROUP_GAP)
    this.scaleDownButton = this.addIconButton(scaleGroup, "ScaleDownButton", null, "-", SCALE_BTN, bodySize, () =>
      this.onScaleDownEvent.invoke()
    )
    this.scaleText = this.addDynamicText(
      scaleGroup,
      "ScaleLabel",
      this.pendingScale ?? "100%",
      captionSize,
      SCALE_LABEL_W,
      CONTROL_ROW_H
    )
    this.scaleUpButton = this.addIconButton(scaleGroup, "ScaleUpButton", null, "+", SCALE_BTN, bodySize, () =>
      this.onScaleUpEvent.invoke()
    )

    this.optionButton = this.addIconButton(
      controls,
      "OptionButton",
      null,
      this.pendingOptionLabel ?? "Option",
      OPTION_BTN_W,
      captionSize,
      () => this.onNextOptionEvent.invoke(),
      "Capsule",
      OPTION_BTN_H
    )
    this.optionContent = this.lastButtonContent
    this.optionButton.sceneObject.enabled = this.pendingOptionVisible

    // Fade row: [-] [Fade 40%] [+], built like the scale group.
    const fadeRow = this.makeFlex(stack, "FadeRow", FlexDirection.Row, panelW, CONTROL_ROW_H, CONTROL_GROUP_GAP)
    const fadeGroupW = 2 * SCALE_BTN + FADE_LABEL_W + 2 * SCALE_GROUP_GAP
    const fadeGroup = this.makeFlex(fadeRow, "FadeGroup", FlexDirection.Row, fadeGroupW, CONTROL_ROW_H, SCALE_GROUP_GAP)
    this.fadeDownButton = this.addIconButton(fadeGroup, "FadeDownButton", null, "-", SCALE_BTN, bodySize, () =>
      this.onFadeDownEvent.invoke()
    )
    this.fadeText = this.addDynamicText(
      fadeGroup,
      "FadeLabel",
      this.pendingFade ?? "Fade 0%",
      captionSize,
      FADE_LABEL_W,
      CONTROL_ROW_H
    )
    this.fadeUpButton = this.addIconButton(fadeGroup, "FadeUpButton", null, "+", SCALE_BTN, bodySize, () =>
      this.onFadeUpEvent.invoke()
    )
  }

  private bindButtons(): void {
    for (const b of this.pendingBindings) b.button.onTriggerUp.add(() => b.onClick())
    this.pendingBindings = []
  }

  private loadTexture(which: "back" | "forward" | "face"): Texture | null {
    try {
      if (which === "back") return requireAsset("../Icons/arrow_back.png") as Texture
      if (which === "forward") return requireAsset("../Icons/arrow_forward.png") as Texture
      return requireAsset("../Icons/face.png") as Texture
    } catch (e) {
      print(`[FaceMeshExamplesHeadSelectorUI] icon '${which}' missing, using text glyph: ${e}`)
      return null
    }
  }

  private disableFrameManipulation(host: SceneObject, frame: Frame): void {
    const manip = host.getComponent(InteractableManipulation.getTypeName()) as InteractableManipulation | null
    if (manip && !isNull(manip)) {
      manip.setCanTranslate(false)
      manip.setCanRotate(false)
      manip.setCanScale(false)
      manip.enabled = false
    }
    const plane = frame.interactionPlane
    if (plane && !isNull(plane)) plane.enabled = false
    for (let i = host.getChildrenCount() - 1; i >= 0; i--) {
      const child = host.getChild(i)
      if (!isNull(child) && child.name === "InteractionPlaneColliderRoot") child.enabled = false
    }
  }

  private obj(parent: SceneObject, name: string, pos?: vec3): SceneObject {
    const so = global.scene.createSceneObject(name)
    so.setParent(parent)
    if (pos) so.getTransform().setLocalPosition(pos)
    return so
  }

  /** Reuse a scene-authored child by name; create it only if absent. */
  private adoptOrCreate(parent: SceneObject, name: string, pos: vec3): SceneObject {
    for (let i = 0; i < parent.getChildrenCount(); i++) {
      const c = parent.getChild(i)
      if (c.name === name) return c
    }
    return this.obj(parent, name, pos)
  }

  private registerItem(parent: SceneObject, item: FlexItem): void {
    const parentFlex = parent.getComponent(FlexLayout.getTypeName()) as FlexLayout | null
    if (parentFlex) parentFlex.addItems([item])
  }

  private makeFlex(
    parent: SceneObject,
    name: string,
    direction: FlexDirection,
    width: number,
    height: number,
    gap: number
  ): SceneObject {
    const container = this.obj(parent, name, new vec3(0, 0, LAYOUT_Z_LIFT))
    const flex = container.createComponent(FlexLayout.getTypeName()) as FlexLayout
    flex.autoDiscoverItemsOnStart = false // required before addItems
    flex.direction = direction
    flex.width = width
    flex.height = height
    if (direction === FlexDirection.Row) flex.columnGap = gap
    else flex.rowGap = gap
    flex.justifyContent = FlexJustify.Center
    flex.alignItems = FlexAlign.Center

    const item = container.createComponent(FlexItem.getTypeName()) as FlexItem
    item.overrideWidth = width
    item.overrideHeight = height
    item.flexShrink = 0
    this.registerItem(parent, item)
    return container
  }

  private addIconButton(
    parent: SceneObject,
    name: string,
    icon: Texture | null,
    glyph: string,
    sizeCm: number,
    textSize: number,
    onClick: () => void,
    shape: "Round" | "Capsule" = "Round",
    heightCm: number = sizeCm
  ): Button {
    const so = this.obj(parent, name, new vec3(0, 0, LAYOUT_Z_LIFT))
    const button = so.createComponent(Button.getTypeName()) as Button
    // Variant before size and anything init-dependent.
    button.setVariant({theme: UI_THEME, shape: shape, style: "Secondary"})
    const fit = () => {
      button.size = new vec3(sizeCm, heightCm, 1)
      button.colliderFitElement = false
      button.colliderSize = new vec3(sizeCm, heightCm, BUTTON_COLLIDER_DEPTH_CM)
      button.colliderCenter = new vec3(0, 0, -BUTTON_COLLIDER_DEPTH_CM / 2)
    }
    fit()
    button.onInitialized.add(fit)

    // Companion-mode content on the button's own SceneObject.
    if (icon) {
      const ec = addContentToElement(so, {leadingIcon: icon})
      ec.leadingIconSize = Math.min(sizeCm, heightCm) * 0.55
      this.lastButtonContent = ec
    } else {
      this.lastButtonContent = addContentToElement(so, {text: glyph, textSize: textSize})
    }

    const item = so.createComponent(FlexItem.getTypeName()) as FlexItem
    item.overrideWidth = sizeCm
    item.overrideHeight = heightCm
    item.flexShrink = 0
    this.registerItem(parent, item)

    // Trigger subscription is deferred to OnStartEvent (see bindButtons).
    this.pendingBindings.push({button: button, onClick: onClick})
    return button
  }

  private lastButtonContent: ElementContent | null = null

  /** Standalone ElementContent: FlexItem lives on the content's own SceneObject. */
  private addStandaloneContent(
    parent: SceneObject,
    name: string,
    text: string,
    textSize: number,
    widthCm: number,
    heightCm: number,
    leadingIcon: Texture | null
  ): ElementContent {
    const cell = this.obj(parent, name, new vec3(0, 0, LAYOUT_Z_LIFT))
    const host = this.obj(cell, "Content")
    const config: {
      text: string
      textSize: number
      sizeOverride: vec2
      leadingIcon?: Texture
    } = {
      text: text,
      textSize: textSize,
      sizeOverride: new vec2(widthCm, heightCm)
    }
    if (leadingIcon) config.leadingIcon = leadingIcon
    const ec = addContentToElement(host, config)
    const item = host.createComponent(FlexItem.getTypeName()) as FlexItem
    item.overrideWidth = widthCm
    item.overrideHeight = heightCm
    item.flexShrink = 0
    this.registerItem(parent, item)
    return ec
  }

  /** Raw Text for a live value with an explicit color. */
  private addDynamicText(
    parent: SceneObject,
    name: string,
    value: string,
    size: number,
    widthCm: number,
    heightCm: number,
    color?: vec4
  ): Text {
    const so = this.obj(parent, name, new vec3(0, 0, DYNAMIC_TEXT_Z_OFFSET))
    const t = so.createComponent("Component.Text") as Text
    t.text = value
    t.size = size
    t.depthTest = true
    t.horizontalAlignment = HorizontalAlignment.Center
    t.verticalAlignment = VerticalAlignment.Center
    t.horizontalOverflow = HorizontalOverflow.Overflow
    t.verticalOverflow = VerticalOverflow.Overflow
    t.textFill.color = color ?? this.indexColor
    t.layoutRect = Rect.create(-widthCm / 2, widthCm / 2, -heightCm / 2, heightCm / 2)
    const item = so.createComponent(FlexItem.getTypeName()) as FlexItem
    item.overrideWidth = widthCm
    item.overrideHeight = heightCm
    item.flexShrink = 0
    this.registerItem(parent, item)
    return t
  }
}

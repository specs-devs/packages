/**
 * DecartControlsUI — runtime controls for the Decart reality-distortion loop.
 *
 * Start/Stop toggle button + prompt TextInputField, wired to the
 * DecartRealtimeRestyle script via typed @input. Changing the prompt or
 * starting/stopping here does NOT reset the Lens (unlike Inspector edits),
 * so it is the safe way to drive the loop in the editor.
 */
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
import {ElementContent} from "UIKit.lspkg/Scripts/Components/Content/ElementContent"
import {TextInputField} from "UIKit.lspkg/Scripts/Components/TextInputField/TextInputField"
import {Slider} from "UIKit.lspkg/Scripts/Components/Slider/Slider"
import {DecartRealtimeRestyle} from "./DecartRealtimeRestyle"

// Live display-tuning sliders. Slider values are normalized 0–1; each maps to a
// real range below. Current values are printed as one line so they can be read off
// the on-device journal (journalctl) while dragging, then baked in as defaults.
type SliderSpec = {
  name: string
  min: number
  max: number
  slider: Slider
  apply: (v: number) => void
}

// ── Type scale — single source of truth (references/patterns.md → Typography)
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

const PANEL_DISTANCE_CM = 74
const PANEL_W = 34
const PANEL_H = 33
const PAD = 1.2
const INPUT_H = 3.2
const BTN_W = 8
const BTN_H = 3.2
const SLIDER_H = 1.6
const PRESET_H = 2.8

// Curated style presets — well-formed Decart "restyle the entire scene" prompts
// (concrete visual traits + preserve subjects/layout/motion), one style each. The
// Zombie prompt mirrors DEFAULT_PROMPT in DecartRealtimeRestyle. Short labels fit the
// 3-across grid; tapping a button sends the full prompt and fills the custom field.
const PRESETS: {label: string; prompt: string}[] = [
  {
    label: "Zombie",
    prompt:
      "Transform the entire scene into a post-apocalyptic zombie wasteland. The final video should show decayed grey-green skin, ashen desaturated color, crumbling debris-strewn surroundings, drifting dust and haze, and dim overcast light, while preserving the original subjects, layout, and motion.",
  },
  {
    label: "Anime",
    prompt:
      "Transform the entire scene into a hand-drawn anime style. The final video should show bold clean linework, flat cel-shaded color blocks, vivid saturated colors, glossy highlights, and simplified backgrounds, while preserving the original subjects, layout, and motion.",
  },
  {
    label: "Water",
    prompt:
      "Transform the entire scene into a watercolor painting. The final video should show soft translucent color washes, visible paper texture, loose ink outlines, muted pastel tones, and simplified forms, while preserving the original subjects, layout, and motion.",
  },
  {
    label: "Cyber",
    prompt:
      "Transform the entire scene into a neon cyberpunk city at night. The final video should show glowing magenta and cyan neon, wet reflective surfaces, holographic signage, deep shadows, and high-contrast electric lighting, while preserving the original subjects, layout, and motion.",
  },
  {
    label: "Clay",
    prompt:
      "Transform the entire scene into stop-motion claymation. The final video should show soft molded clay surfaces, visible fingerprint texture, rounded chunky shapes, matte handmade materials, and warm studio lighting, while preserving the original subjects, layout, and motion.",
  },
  {
    label: "Snow",
    prompt:
      "Transform the entire scene into a snowy winter world. The final video should show fresh snow blanketing surfaces, frosted edges, soft blue-white daylight, gentle falling snowflakes, and cool crisp tones, while preserving the original subjects, layout, and motion.",
  },
]

@component
export class DecartControlsUI extends BaseScriptComponent {
  @input
  @hint('The DecartRealtimeRestyle script component this panel controls')
  decartScript: DecartRealtimeRestyle

  private inputField: TextInputField | null = null
  private toggleLabel: ElementContent | null = null

  private sliders: SliderSpec[] = []
  private readoutText: Text | null = null
  private curScale = 0
  private curX = 0
  private curY = 0
  private curZ = 0

  // Minimize/expand: everything collapsible lives under bodyRoot; the toggle button
  // sits outside it so it stays visible when collapsed.
  private bodyRoot: SceneObject | null = null
  private minLabel: ElementContent | null = null
  private minimized = false

  onAwake(): void {
    this.sceneObject.createComponent("Component.Canvas")

    // Collapsible body: backplate + all controls. The minimize toggle (added last)
    // is a sibling OUTSIDE this, so it stays visible when the body is hidden.
    const body = global.scene.createSceneObject("Body")
    body.setParent(this.sceneObject)
    this.bodyRoot = body

    const bp = body.createComponent(BackPlate.getTypeName()) as BackPlate
    bp.size = new vec2(PANEL_W, PANEL_H)

    const content = global.scene.createSceneObject("Content")
    content.setParent(body)
    content.getTransform().setLocalPosition(new vec3(0, 0, 0.6))

    const col = content.createComponent(FlexLayout.getTypeName()) as FlexLayout
    col.width = PANEL_W
    col.height = PANEL_H
    col.direction = FlexDirection.Column
    col.alignItems = FlexAlign.Stretch
    col.justifyContent = FlexJustify.Center
    col.rowGap = 0.9
    col.paddingTop = PAD
    col.paddingBottom = PAD
    col.paddingLeft = PAD
    col.paddingRight = PAD

    // Children are created here in onAwake, before OnStart — the layouts'
    // autoDiscoverItemsOnStart picks them up; addItems() would throw pre-init.
    this.addPromptField(content)
    this.addPresetGrid(content)
    this.addButtonRow(content)
    this.addReadout(content)

    // Live display-tuning sliders (Scale / X / Y / Z-depth). Wired to
    // DecartRealtimeRestyle's setters; current values shown on the panel readout
    // (and printed to the journal). Initial values come from the script's current
    // tunables (its @input defaults: scale 2.09, x 11, y 7, z 0).
    const s = this.decartScript
    this.addSlider(content, "scale", 0.5, 3.5, s ? s.getDisplayZoom() : 2.09, (v) => {
      this.curScale = v
      if (this.decartScript) this.decartScript.setDisplayZoom(v)
      this.logDisplayValues()
    })
    this.addSlider(content, "x", -50, 50, s ? s.getDisplayOffsetX() : 11, (v) => {
      this.curX = v
      if (this.decartScript) this.decartScript.setDisplayOffsetX(v)
      this.logDisplayValues()
    })
    this.addSlider(content, "y", -50, 50, s ? s.getDisplayOffsetY() : 7, (v) => {
      this.curY = v
      if (this.decartScript) this.decartScript.setDisplayOffsetY(v)
      this.logDisplayValues()
    })
    this.addSlider(content, "z", -60, 40, s ? s.getDisplayOffsetZ() : 0.15, (v) => {
      this.curZ = v
      if (this.decartScript) this.decartScript.setDisplayOffsetZ(v)
      this.logDisplayValues()
    })

    // Always-visible minimize/expand toggle, floated just above the panel.
    this.addMinimizeToggle(this.sceneObject)

    // Initialise each slider's knob to its starting value AFTER UIKit has finished
    // its own OnStart init (a bare createEvent('OnStartEvent') here would race the
    // child slider components' init, which run lower in the hierarchy).
    const initEvt = this.createEvent("DelayedCallbackEvent")
    initEvt.bind(() => this.initSliderValues())
    this.createEvent("OnStartEvent").bind(() => initEvt.reset(0.2))
  }

  /** Small button that hides/shows the whole panel body so it can be dismissed. */
  private addMinimizeToggle(parent: SceneObject): void {
    const so = global.scene.createSceneObject("MenuToggle")
    so.setParent(parent)
    so.getTransform().setLocalPosition(new vec3(0, PANEL_H / 2 + 2.5, 0.7))
    const btn = so.createComponent(Button.getTypeName()) as Button
    btn.size = new vec3(10, 3, 1)
    const ec = so.createComponent(ElementContent.getTypeName()) as ElementContent
    ec.text = "Hide"
    ec.textSize = roleSize("Button", PANEL_DISTANCE_CM)
    this.minLabel = ec
    btn.onTriggerUp.add(() => this.setMinimized(!this.minimized))
  }

  private setMinimized(m: boolean): void {
    this.minimized = m
    if (this.bodyRoot) {
      this.bodyRoot.enabled = !m
    }
    if (this.minLabel) {
      this.minLabel.text = m ? "Menu" : "Hide"
    }
  }

  /** Two rows of 3 one-tap style presets; the custom text field still works alongside. */
  private addPresetGrid(parent: SceneObject): void {
    for (let r = 0; r < 2; r++) {
      const row = global.scene.createSceneObject("PresetRow" + r)
      row.setParent(parent)
      const flex = row.createComponent(FlexLayout.getTypeName()) as FlexLayout
      flex.direction = FlexDirection.Row
      flex.alignItems = FlexAlign.Center
      flex.justifyContent = FlexJustify.SpaceEvenly
      flex.columnGap = 0.6
      flex.width = -1
      flex.height = PRESET_H
      for (let c = 0; c < 3; c++) {
        const p = PRESETS[r * 3 + c]
        if (p) {
          this.addPresetButton(row, p.label, p.prompt)
        }
      }
      row.createComponent(FlexItem.getTypeName())
    }
  }

  private addPresetButton(row: SceneObject, label: string, prompt: string): void {
    const so = global.scene.createSceneObject("Preset_" + label)
    so.setParent(row)
    const btn = so.createComponent(Button.getTypeName()) as Button
    btn.size = new vec3(9, PRESET_H, 1)
    const ec = so.createComponent(ElementContent.getTypeName()) as ElementContent
    ec.text = label
    ec.textSize = roleSize("Caption", PANEL_DISTANCE_CM)
    so.createComponent(FlexItem.getTypeName())
    btn.onTriggerUp.add(() => this.applyPreset(prompt))
  }

  /** Send a preset prompt to the loop and mirror it into the editable text field. */
  private applyPreset(prompt: string): void {
    if (this.decartScript) {
      this.decartScript.setPrompt(prompt)
    }
    if (this.inputField) {
      this.inputField.text = prompt
    }
    print("[DecartUI] preset -> " + prompt.substring(0, 60))
  }

  /** A full-width labeled-by-log slider mapped from 0–1 to [min,max]. */
  private addSlider(
    parent: SceneObject,
    name: string,
    min: number,
    max: number,
    initial: number,
    apply: (v: number) => void
  ): void {
    const so = global.scene.createSceneObject(name + "Slider")
    so.setParent(parent)
    const sl = so.createComponent(Slider.getTypeName()) as Slider
    sl.size = new vec3(PANEL_W - PAD * 2, SLIDER_H, 1)
    sl.hasTrackVisual = true
    sl.onValueChange.add((t: number) => apply(min + t * (max - min)))
    so.createComponent(FlexItem.getTypeName())
    this.sliders.push({name, min, max, slider: sl, apply})
    // seed the tracked value so the first log line is correct even before a drag
    apply(initial)
  }

  private initSliderValues(): void {
    for (const spec of this.sliders) {
      const norm = spec.max === spec.min ? 0 : (this.currentFor(spec) - spec.min) / (spec.max - spec.min)
      spec.slider.currentValue = Math.max(0, Math.min(1, norm))
    }
    this.logDisplayValues()
  }

  private currentFor(spec: SliderSpec): number {
    if (spec.name === "scale") return this.curScale
    if (spec.name === "x") return this.curX
    if (spec.name === "y") return this.curY
    return this.curZ
  }

  /** On-panel line you can read in the headset: "scale 2.30   x -4   y 12". */
  private addReadout(parent: SceneObject): void {
    const so = global.scene.createSceneObject("Readout")
    so.setParent(parent)
    const t = so.createComponent("Component.Text") as Text
    t.text = "S --  X --  Y --  Z --"
    applyTextRole(t, "Caption", PANEL_DISTANCE_CM)
    so.createComponent(FlexItem.getTypeName())
    this.readoutText = t
  }

  private logDisplayValues(): void {
    // Compact on-panel line (fits the 34cm panel); verbose line to the journal.
    if (this.readoutText) {
      this.readoutText.text =
        "S" +
        this.curScale.toFixed(2) +
        "  X" +
        this.curX.toFixed(0) +
        "  Y" +
        this.curY.toFixed(0) +
        "  Z" +
        this.curZ.toFixed(0)
    }
    print(
      "[DecartUI] display  scale=" +
        this.curScale.toFixed(2) +
        "  x=" +
        this.curX.toFixed(1) +
        "  y=" +
        this.curY.toFixed(1) +
        "  z=" +
        this.curZ.toFixed(1)
    )
  }

  private addPromptField(parent: SceneObject): FlexItem {
    const so = global.scene.createSceneObject("PromptInput")
    so.setParent(parent)

    const tf = so.createComponent(TextInputField.getTypeName()) as TextInputField
    tf.size = new vec3(PANEL_W - PAD * 2, INPUT_H, 1)
    // Pre-fill after the field initializes — a write before init is overwritten.
    const initEvt = (tf as unknown as {onInitialized?: {add: (cb: () => void) => void}}).onInitialized
    if (initEvt) {
      initEvt.add(() => {
        tf.text = this.decartScript ? this.decartScript.prompt : ""
      })
    } else {
      tf.text = this.decartScript ? this.decartScript.prompt : ""
    }
    tf.onTextChanged.add((value: string) => {
      if (this.decartScript) {
        this.decartScript.setPrompt(value)
      }
    })
    this.inputField = tf

    const item = so.createComponent(FlexItem.getTypeName()) as FlexItem
    item.alignSelf = FlexAlignSelf.Stretch
    return item
  }

  private addButtonRow(parent: SceneObject): FlexItem {
    const row = global.scene.createSceneObject("ButtonRow")
    row.setParent(parent)
    const flex = row.createComponent(FlexLayout.getTypeName()) as FlexLayout
    flex.direction = FlexDirection.Row
    flex.alignItems = FlexAlign.Center
    flex.justifyContent = FlexJustify.Center
    flex.width = -1
    flex.height = BTN_H

    const btnSO = global.scene.createSceneObject("StartStop")
    btnSO.setParent(row)
    const btn = btnSO.createComponent(Button.getTypeName()) as Button
    btn.size = new vec3(BTN_W, BTN_H, 1)
    const ec = btnSO.createComponent(ElementContent.getTypeName()) as ElementContent
    ec.text = "Start"
    ec.textSize = roleSize("Button", PANEL_DISTANCE_CM)
    this.toggleLabel = ec
    btnSO.createComponent(FlexItem.getTypeName())

    btn.onTriggerUp.add(() => this.toggleLoop())

    const item = row.createComponent(FlexItem.getTypeName()) as FlexItem
    return item
  }

  private toggleLoop(): void {
    if (!this.decartScript) {
      print("[DecartControls] decartScript @input is not wired")
      return
    }
    if (this.decartScript.isRunning()) {
      this.decartScript.stopLoop()
      if (this.toggleLabel) {
        this.toggleLabel.text = "Start"
      }
    } else {
      // Push the freshest field text before starting, in case no change event fired.
      if (this.inputField && this.inputField.text && this.inputField.text.length > 0) {
        this.decartScript.setPrompt(this.inputField.text)
      }
      this.decartScript.startLoop()
      if (this.toggleLabel) {
        this.toggleLabel.text = "Stop"
      }
    }
  }
}

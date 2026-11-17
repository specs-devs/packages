/**
 * Example only: small helpers that build the demo panels at runtime with UIKit (Frame, RectangleButton,
 * Slider) and Text, so the examples need no authored UI. Text is sized to stay readable at ~130 cm on SPECS,
 * where the example carousel places the examples.
 */
import {RectangleButton} from "UIKit.lspkg/Scripts/Components/Button/RectangleButton"
import {Frame} from "UIKit.lspkg/Scripts/Components/Frame/Frame"
import {Slider} from "UIKit.lspkg/Scripts/Components/Slider/Slider"

export const PANEL_RENDER_ORDER = 30
export const TITLE_SIZE = 80
export const BODY_SIZE = 60
export const BUTTON_HEIGHT = 4.5

export function createChild(parent: SceneObject, name: string, position: vec3): SceneObject {
  const child = global.scene.createSceneObject(name)
  child.setParent(parent)
  child.getTransform().setLocalPosition(position)
  return child
}

/** A grabbable UIKit Frame; `populate` runs once the frame has built its content object. */
export function createPanel(parent: SceneObject, name: string, position: vec3, size: vec2, populate: (content: SceneObject) => void): Frame {
  const frameObject = createChild(parent, name, position)
  const frame = frameObject.createComponent(Frame.getTypeName()) as Frame
  frame.autoShowHide = false
  frame.allowTranslation = true
  frame.innerSize = size
  frame.onInitialized.add(() => {
    frame.renderOrder = PANEL_RENDER_ORDER - 1
    populate(frame.content)
  })
  return frame
}

export function createText(parent: SceneObject, name: string, position: vec3, size: number, width: number, height: number, value: string = ""): Text {
  const textObject = createChild(parent, name, position)
  const text = textObject.createComponent("Component.Text") as Text
  text.size = size
  text.text = value
  text.textFill.color = new vec4(1, 1, 1, 1)
  text.horizontalAlignment = HorizontalAlignment.Center
  text.verticalAlignment = VerticalAlignment.Center
  text.horizontalOverflow = HorizontalOverflow.Wrap
  text.verticalOverflow = VerticalOverflow.Shrink
  text.layoutRect = Rect.create(-width / 2, width / 2, -height / 2, height / 2)
  text.depthTest = true
  text.renderOrder = PANEL_RENDER_ORDER + 2
  return text
}

export function createButton(parent: SceneObject, name: string, position: vec3, width: number, label: string, onPress: () => void): Text {
  const buttonObject = createChild(parent, name, position)
  const button = buttonObject.createComponent(RectangleButton.getTypeName()) as RectangleButton
  button.size = new vec3(width, BUTTON_HEIGHT, 1)
  button.renderOrder = PANEL_RENDER_ORDER
  button.initialize()
  const text = createText(buttonObject, "Label", new vec3(0, 0, 0.6), BODY_SIZE, width - 0.5, BUTTON_HEIGHT, label)
  text.horizontalOverflow = HorizontalOverflow.Shrink
  button.onTriggerUp.add(onPress)
  return text
}

/**
 * A labelled UIKit slider. `onChange` receives the value mapped to [min, max]; the label shows it.
 * Returns a setter for the value (e.g. when a preset changes it).
 */
export function createSlider(
  parent: SceneObject,
  name: string,
  position: vec3,
  width: number,
  label: string,
  min: number,
  max: number,
  value: number,
  onChange: (value: number) => void
): (value: number) => void {
  const row = createChild(parent, name, position)
  const caption = createText(row, "Caption", new vec3(0, 2.6, 0.5), BODY_SIZE, width, 3, "")
  const sliderObject = createChild(row, "Slider", new vec3(0, -0.6, 0.5))
  const slider = sliderObject.createComponent(Slider.getTypeName()) as Slider
  slider.size = new vec3(width, 3, 1)
  slider.initialize()
  slider.renderOrder = PANEL_RENDER_ORDER
  const show = (v: number) => (caption.text = label + "  " + v.toFixed(2))
  const toNormalized = (v: number) => (max === min ? 0 : MathUtils.clamp((v - min) / (max - min), 0, 1))
  slider.currentValue = toNormalized(value)
  show(value)
  slider.onValueChange.add((normalized: number) => {
    const v = min + normalized * (max - min)
    show(v)
    onChange(v)
  })
  return (v: number) => {
    show(v)
    slider.currentValue = toNormalized(v)
  }
}

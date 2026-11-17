import {RectangleButton} from "UIKit.lspkg/Scripts/Components/Button/RectangleButton"
import {Frame} from "UIKit.lspkg/Scripts/Components/Frame/Frame"

const FRAME_PADDING = 2
const BUTTON_WIDTH = 16
const BUTTON_HEIGHT = 4
const BUTTON_GAP = 1.5
const CONTENT_Z = 0.5
const LABEL_Z = 0.65 // button labels sit in front of the 1 cm deep button face (+0.5 cm), never inside it
const LABEL_SIZE = 44
const CONTENT_RENDER_ORDER = 10

/**
 * Shows this guide's text on a UIKit Frame with a button at the bottom.
 * Pressing the button disables the guide.
 *
 * Attach it to the guide SceneObject (the one with the guide Text). The text
 * stays authored on that Text component; this component only presents it at
 * runtime, so the guide can be closed in the Lens as well as disabled in
 * the editor.
 */
@component
export class GuideDismissPanel extends BaseScriptComponent {
  @input
  @hint("Label of the button that closes the guide")
  buttonLabel: string = "Ok, I understood"

  private built = false

  onAwake(): void {
    this.createEvent("OnStartEvent").bind(() => this.build())
  }

  private build(): void {
    if (this.built) {
      return
    }
    this.built = true

    const source = this.findText(this.sceneObject)
    if (!source) {
      print("GuideDismissPanel: no Text found under " + this.sceneObject.name + ", nothing to present")
      return
    }

    const frameObject = this.createChild(this.sceneObject, "GuideFrame", vec3.zero())
    const frame = frameObject.createComponent(Frame.getTypeName()) as Frame
    frame.autoShowHide = false
    frame.allowTranslation = true

    const textObject = this.createChild(frame.content, "GuideText", new vec3(0, 0, CONTENT_Z))
    const text = this.copyText(source, textObject)
    source.enabled = false

    const bounds = text.getBoundingBox()
    let width = bounds.right - bounds.left
    let height = bounds.top - bounds.bottom
    if (!(width > 0) || !(height > 0)) {
      width = text.layoutRect.right - text.layoutRect.left
      height = text.layoutRect.top - text.layoutRect.bottom
    }
    width = Math.max(width, BUTTON_WIDTH)

    const innerHeight = height + BUTTON_GAP + BUTTON_HEIGHT
    const textCenter = bounds.getCenter()
    // Center the text horizontally and keep it above the button row.
    textObject
      .getTransform()
      .setLocalPosition(new vec3(-textCenter.x, innerHeight / 2 - height / 2 - textCenter.y, CONTENT_Z))

    frame.innerSize = new vec2(width + FRAME_PADDING * 2, innerHeight + FRAME_PADDING * 2)

    const buttonObject = this.createChild(
      frame.content,
      "GuideDismissButton",
      new vec3(0, -innerHeight / 2 + BUTTON_HEIGHT / 2, CONTENT_Z)
    )
    const button = buttonObject.createComponent(RectangleButton.getTypeName()) as RectangleButton
    button.size = new vec3(BUTTON_WIDTH, BUTTON_HEIGHT, 1)
    button.renderOrder = CONTENT_RENDER_ORDER
    button.initialize()
    this.createLabel(buttonObject, text)
    button.onTriggerUp.add(() => {
      this.sceneObject.enabled = false
    })
  }

  private findText(root: SceneObject): Text | null {
    const own = root.getComponent("Component.Text")
    if (own) {
      return own
    }
    for (let i = 0; i < root.getChildrenCount(); i++) {
      const found = this.findText(root.getChild(i))
      if (found) {
        return found
      }
    }
    return null
  }

  private copyText(source: Text, target: SceneObject): Text {
    const text = target.createComponent("Component.Text")
    text.text = source.text
    text.size = source.size
    if (source.font) {
      text.font = source.font
    }
    text.textFill.color = source.textFill.color
    text.horizontalAlignment = source.horizontalAlignment
    text.verticalAlignment = source.verticalAlignment
    text.horizontalOverflow = source.horizontalOverflow
    text.verticalOverflow = source.verticalOverflow
    text.layoutRect = source.layoutRect
    text.lineSpacing = source.lineSpacing
    text.letterSpacing = source.letterSpacing
    text.backgroundSettings.enabled = false
    text.depthTest = true
    text.renderOrder = CONTENT_RENDER_ORDER + 1
    return text
  }

  private createLabel(parent: SceneObject, style: Text): void {
    const labelObject = this.createChild(parent, "Label", new vec3(0, 0, LABEL_Z))
    const label = labelObject.createComponent("Component.Text")
    label.text = this.buttonLabel
    label.size = LABEL_SIZE
    if (style.font) {
      label.font = style.font
    }
    label.textFill.color = new vec4(1, 1, 1, 1)
    label.horizontalAlignment = HorizontalAlignment.Center
    label.verticalAlignment = VerticalAlignment.Center
    label.horizontalOverflow = HorizontalOverflow.Shrink
    label.layoutRect = Rect.create(-BUTTON_WIDTH / 2, BUTTON_WIDTH / 2, -BUTTON_HEIGHT / 2, BUTTON_HEIGHT / 2)
    label.depthTest = true
    label.renderOrder = CONTENT_RENDER_ORDER + 2
  }

  private createChild(parent: SceneObject, name: string, position: vec3): SceneObject {
    const child = global.scene.createSceneObject(name)
    child.setParent(parent)
    child.getTransform().setLocalPosition(position)
    return child
  }
}

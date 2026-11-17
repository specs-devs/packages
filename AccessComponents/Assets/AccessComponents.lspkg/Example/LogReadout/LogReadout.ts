import {Frame} from "SpectaclesUIKit.lspkg/Scripts/Components/Frame/Frame"
import WorldCameraFinderProvider from "SpectaclesInteractionKit.lspkg/Providers/CameraProvider/WorldCameraFinderProvider"

const FRAME_WIDTH = 30
const FRAME_HEIGHT = 10
const TITLE_HEIGHT = 2.5
const CONTENT_Z = 0.5
const TITLE_SIZE = 40
const LINE_SIZE = 32
const CONTENT_RENDER_ORDER = 100
// Where the panel sits relative to the head pose when it starts (cm): just above the example
// carousel (90 cm away, top edge near eye level) and below the examples.
const PANEL_DISTANCE = 95
const PANEL_LIFT = 11
// Longest line shown; longer lines are cut with "…".
const MAX_LINE_LENGTH = 90

/**
 * Shows the Lens's latest print() lines on a small UIKit panel, so what the examples log can be read
 * in the Lens itself (on device there's no log window). Every line still goes to the regular log.
 *
 * Keep this object enabled and above the examples in the hierarchy: print() is hooked in onAwake, so
 * lines printed before that are not shown. The panel is built under `panelRoot`, which can be hidden
 * (e.g. by a guide) and shown later; lines printed meanwhile are kept.
 */
@component
export class LogReadout extends BaseScriptComponent {
  @input
  @hint("Object the panel is built under (hide it to hide the panel)")
  @allowUndefined
  panelRoot: SceneObject

  @input
  @hint("Title shown above the lines")
  title: string = "Log"

  @input
  @hint("How many of the latest lines are shown")
  lineCount: number = 6

  private lines: string[] = []
  private text: Text | null = null

  onAwake(): void {
    const g = globalThis as any
    const original = g.print
    g.print = (message: any) => {
      original(message)
      this.add("" + message)
    }
    this.createEvent("OnStartEvent").bind(() => this.build())
  }

  private add(line: string): void {
    const clean = line.replace(/\s+/g, " ").trim()
    if (clean.length === 0) {
      return
    }
    this.lines.push(clean.length > MAX_LINE_LENGTH ? clean.substring(0, MAX_LINE_LENGTH - 1) + "…" : clean)
    if (this.lines.length > this.lineCount) {
      this.lines.splice(0, this.lines.length - this.lineCount)
    }
    if (this.text) {
      this.text.text = this.lines.join("\n")
    }
  }

  private build(): void {
    const root = this.panelRoot || this.sceneObject
    this.placeInFrontOfUser(root)
    const frameObject = this.createChild(root, "LogFrame", vec3.zero())
    const frame = frameObject.createComponent(Frame.getTypeName()) as Frame
    frame.autoShowHide = false
    frame.allowTranslation = true
    frame.innerSize = new vec2(FRAME_WIDTH, FRAME_HEIGHT)
    // frame.content only exists once the Frame has initialized (on its own OnStart).
    frame.onInitialized.add(() => {
      frame.renderOrder = CONTENT_RENDER_ORDER - 1
      const top = FRAME_HEIGHT / 2
      const title = this.createText(frame.content, "Title", new vec3(0, top - TITLE_HEIGHT / 2, CONTENT_Z), TITLE_SIZE, TITLE_HEIGHT)
      title.text = this.title
      const bodyHeight = FRAME_HEIGHT - TITLE_HEIGHT
      this.text = this.createText(frame.content, "Lines", new vec3(0, -TITLE_HEIGHT / 2, CONTENT_Z), LINE_SIZE, bodyHeight)
      this.text.horizontalAlignment = HorizontalAlignment.Left
      this.text.verticalAlignment = VerticalAlignment.Bottom
      this.text.verticalOverflow = VerticalOverflow.Shrink
      this.text.text = this.lines.join("\n")
    })
  }

  /** Puts the panel in front of the user's head pose, facing them. */
  private placeInFrontOfUser(root: SceneObject): void {
    const camera = WorldCameraFinderProvider.getInstance()
    const head = camera.getWorldPosition()
    let forward = camera.getForwardPositionParallelToGround(1).sub(head)
    forward = forward.length > 0.0001 ? forward.normalize() : new vec3(0, 0, -1)
    const position = head.add(forward.uniformScale(PANEL_DISTANCE)).add(vec3.up().uniformScale(PANEL_LIFT))
    const transform = root.getTransform()
    transform.setWorldPosition(position)
    transform.setWorldRotation(quat.lookAt(head.sub(position).normalize(), vec3.up()))
  }

  private createText(parent: SceneObject, name: string, position: vec3, size: number, height: number): Text {
    const textObject = this.createChild(parent, name, position)
    const text = textObject.createComponent("Component.Text")
    text.size = size
    text.textFill.color = new vec4(1, 1, 1, 1)
    text.horizontalAlignment = HorizontalAlignment.Center
    text.verticalAlignment = VerticalAlignment.Center
    text.horizontalOverflow = HorizontalOverflow.Truncate
    const width = FRAME_WIDTH - 2
    text.layoutRect = Rect.create(-width / 2, width / 2, -height / 2, height / 2)
    text.depthTest = true
    text.renderOrder = CONTENT_RENDER_ORDER + 2
    return text
  }

  private createChild(parent: SceneObject, name: string, position: vec3): SceneObject {
    const child = global.scene.createSceneObject(name)
    child.setParent(parent)
    child.getTransform().setLocalPosition(position)
    return child
  }
}

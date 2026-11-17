/**
 * SPECS Inc. 2027
 * Web Capture panel: a UIKit Frame with the title, the live status and the Start / Stop Capture button.
 * Drop it on any object in the scene and point "Web Capture" at the WebCapture component. The panel is
 * built at runtime in front of the user and can be dragged. It is added to Web Capture as an extra
 * capture root, so it also shows in the replay.
 */
import {RectangleButton} from "UIKit.lspkg/Scripts/Components/Button/RectangleButton"
import {Frame} from "UIKit.lspkg/Scripts/Components/Frame/Frame"
import {RoundedRectangle, RoundedRectBlendMode} from "UIKit.lspkg/Scripts/Visuals/RoundedRectangle/RoundedRectangle"
import WorldCameraFinderProvider from "InteractionKit.lspkg/Providers/CameraProvider/WorldCameraFinderProvider"
import {CursorCapture} from "./CursorCapture"
import {WebCapture} from "./WebCapture"

// UIKit System-3.0 Frame: its body is the inner size plus a 2.5 cm margin on every side
const FRAME_MARGIN = 2.5
const PADDING = 3
const INNER_WIDTH = 46
const INNER_HEIGHT = 54
const LENGTHS = [30, 60, 90] // seconds the capture button records for
const LENGTH_WIDTH = 30
const LENGTH_HEIGHT = 7
const BUTTON_WIDTH = 40
const BUTTON_HEIGHT = 10
const CONTENT_Z = 0.5
const LABEL_Z = 0.3
const RENDER_ORDER = 40
const RED = new vec4(0.94, 0.27, 0.27, 1)

/** A short, human status for the panel: the Lens's full status carries paths and ids that don't fit. */
function shortStatus(message: string): string {
  const m = message || ""
  if (m.indexOf("Recording") === 0) return "Recording…"
  if (m.indexOf("Saving") === 0) return "Saving…"
  if (m.indexOf("Saved") === 0) return "Saved · " + (m.split(" ")[1] || "") + " s"
  if (m.indexOf("Connected") === 0) return m.indexOf("Snap Cloud") >= 0 ? "Ready · Snap Cloud" : "Ready"
  if (m.indexOf("Not connected") === 0 || m.indexOf("Offline") === 0) return "Offline · kept in memory"
  return m.length > 40 ? m.substring(0, 38) + "…" : m
}

@component
export class CapturePanel extends BaseScriptComponent {
  @input
  @hint("The WebCapture component this panel starts and stops")
  webCapture: WebCapture

  @input
  @hint("Distance in front of the user, in cm")
  distance: number = 90

  @input
  @hint("Height relative to eye level, in cm (negative = lower)")
  heightOffset: number = -12

  private frameObject: SceneObject | null = null
  private statusText: Text | null = null
  private labelText: Text | null = null
  private dot: SceneObject | null = null
  private cursors: CursorCapture | null = null

  onAwake(): void {
    this.createEvent("OnStartEvent").bind(() => this.build())
    this.createEvent("UpdateEvent").bind(() => this.watchGate())
    // after the Interaction Kit has placed its cursors for this frame
    this.createEvent("LateUpdateEvent").bind(() => {
      if (this.cursors) this.cursors.update()
    })
  }

  private gate(): boolean {
    const gate = this.webCapture ? this.webCapture.showButtonWhenEnabled : null
    return !gate || gate.isEnabledInHierarchy
  }

  /** Keeps the panel hidden until the object Show Button When Enabled is switched on (e.g. after the guide). */
  private watchGate(): void {
    if (this.frameObject) {
      const show = this.gate()
      if (this.frameObject.enabled !== show) this.frameObject.enabled = show
    }
  }

  private build(): void {
    if (!this.webCapture) {
      print("CapturePanel: set the Web Capture input")
      return
    }
    // The system draws the hand cursors on Specs, so they are recorded as shapes for the replay.
    this.cursors = new CursorCapture(this.webCapture, this.sceneObject)
    const object = global.scene.createSceneObject("CapturePanelFrame")
    object.setParent(this.sceneObject)
    this.frameObject = object
    this.place(object)
    const frame = object.createComponent(Frame.getTypeName()) as Frame
    frame.autoShowHide = false
    frame.allowTranslation = true
    frame.onInitialized.add(() => this.populate(frame))
    object.enabled = this.gate()
  }

  private populate(frame: Frame): void {
    frame.renderOrder = RENDER_ORDER - 1
    if (this.frameObject) this.webCapture.addCaptureRoot(this.frameObject)
    // What the portal draws for the panel: UIKit's own visuals are shader-sized and can't be replayed as meshes.
    this.shape(frame.content, "PanelPlate", [INNER_WIDTH + PADDING * 2 + FRAME_MARGIN * 2, INNER_HEIGHT + PADDING * 2 + FRAME_MARGIN * 2], 0.8, [0.12549, 0.12549, 0.12549, 1], undefined, 0, 0.1)

    const title = this.text(frame.content, "Title", "Web Capture", 64, new vec3(0, 21, CONTENT_Z), INNER_WIDTH - 12, 8)
    title.textFill.color = new vec4(1, 1, 1, 1)

    const dotObject = this.child(frame.content, "RecordingDot", new vec3(-INNER_WIDTH / 2 + 3, 21, CONTENT_Z))
    const dot = dotObject.createComponent(RoundedRectangle.getTypeName()) as RoundedRectangle
    dot.size = new vec2(3, 3)
    dot.cornerRadius = 1.5
    dot.blendMode = RoundedRectBlendMode.Normal
    dot.backgroundColor = RED
    dot.renderOrder = RENDER_ORDER
    dotObject.enabled = false
    this.dot = dotObject
    this.webCapture.addPanelShape(dotObject, {size: [3, 3], radius: 1.5, color: [0.94, 0.27, 0.27, 1], layer: 3})

    const status = this.text(frame.content, "Status", shortStatus(this.webCapture.status), 36, new vec3(0, 10, CONTENT_Z), INNER_WIDTH - 4, 12)
    status.textFill.color = new vec4(0.78, 0.82, 0.88, 1)
    status.verticalOverflow = VerticalOverflow.Shrink
    this.statusText = status
    this.webCapture.onStatusChanged((message) => {
      if (this.statusText) this.statusText.text = shortStatus(message)
    })

    const buttonObject = this.child(frame.content, "CaptureButton", new vec3(0, -19, CONTENT_Z))
    const button = buttonObject.createComponent(RectangleButton.getTypeName()) as RectangleButton
    button.size = new vec3(BUTTON_WIDTH, BUTTON_HEIGHT, 1)
    button.renderOrder = RENDER_ORDER
    button.initialize()
    const idle = this.shape(buttonObject, "ButtonIdle", [BUTTON_WIDTH, BUTTON_HEIGHT], 1.6, [0.35686, 0.38039, 0.37255, 1], undefined, 1, 0.15)
    const rec = this.shape(buttonObject, "ButtonRecording", [BUTTON_WIDTH, BUTTON_HEIGHT], 1.6, [0.3176, 0.4078, 0.451, 1], undefined, 1, 0.15)
    rec.enabled = false
    const label = this.text(buttonObject, "Label", "●  Start Capture", 64, new vec3(0, 0, LABEL_Z), BUTTON_WIDTH, BUTTON_HEIGHT)
    label.textFill.color = new vec4(1, 1, 1, 1)
    label.horizontalOverflow = HorizontalOverflow.Shrink
    label.renderOrder = RENDER_ORDER + 2
    this.labelText = label

    // How long a capture runs: one small button that cycles 30 / 60 / 90 s (locked while recording)
    const lengthObject = this.child(frame.content, "LengthButton", new vec3(0, -5, CONTENT_Z))
    const lengthButton = lengthObject.createComponent(RectangleButton.getTypeName()) as RectangleButton
    lengthButton.size = new vec3(LENGTH_WIDTH, LENGTH_HEIGHT, 1)
    lengthButton.renderOrder = RENDER_ORDER
    lengthButton.initialize()
    this.shape(lengthObject, "LengthPlate", [LENGTH_WIDTH, LENGTH_HEIGHT], 1.4, [0.35686, 0.38039, 0.37255, 1], undefined, 1, 0.15)
    let lengthIndex = Math.max(0, LENGTHS.indexOf(this.webCapture.recordSeconds))
    const lengthLabel = this.text(lengthObject, "Label", "Length · " + LENGTHS[lengthIndex] + " s", 44, new vec3(0, 0, LABEL_Z), LENGTH_WIDTH, LENGTH_HEIGHT)
    lengthLabel.textFill.color = new vec4(1, 1, 1, 1)
    lengthLabel.horizontalOverflow = HorizontalOverflow.Shrink
    lengthLabel.renderOrder = RENDER_ORDER + 2
    this.webCapture.setRecordSeconds(LENGTHS[lengthIndex])
    // UIKit buttons expose onTriggerUp; typed loosely so a UIKit rename can't break the panel's build
    const press = lengthButton as unknown as {onTriggerUp?: {add: (callback: () => void) => void}}
    if (press.onTriggerUp) {
      press.onTriggerUp.add(() => {
        if (this.webCapture.isRecording) return
        lengthIndex = (lengthIndex + 1) % LENGTHS.length
        this.webCapture.setRecordSeconds(LENGTHS[lengthIndex])
        lengthLabel.text = "Length · " + LENGTHS[lengthIndex] + " s"
      })
    }

    this.webCapture.attachPanel(buttonObject, (text, recording) => {
      if (this.labelText) this.labelText.text = text
      if (this.dot) this.dot.enabled = recording
      idle.enabled = !recording
      rec.enabled = recording
    })

    const autoScale = frame.autoScaleContent
    frame.autoScaleContent = false
    frame.innerSize = new vec2(INNER_WIDTH + PADDING * 2, INNER_HEIGHT + PADDING * 2)
    frame.syncScaleBaseline()
    frame.autoScaleContent = autoScale
  }

  private text(parent: SceneObject, name: string, value: string, size: number, position: vec3, width: number, height: number): Text {
    const object = this.child(parent, name, position)
    const text = object.createComponent("Component.Text")
    text.text = value
    text.size = size
    text.horizontalAlignment = HorizontalAlignment.Center
    text.verticalAlignment = VerticalAlignment.Center
    text.horizontalOverflow = HorizontalOverflow.Wrap
    text.verticalOverflow = VerticalOverflow.Overflow
    text.layoutRect = Rect.create(-width / 2, width / 2, -height / 2, height / 2)
    text.depthTest = true
    text.renderOrder = RENDER_ORDER + 1
    return text
  }

  /** An empty object that carries a recorded panel shape (invisible in the Lens, drawn by the portal). */
  private shape(parent: SceneObject, name: string, size: number[], radius: number, color: number[], border: number[] | undefined, layer: number, z: number): SceneObject {
    const object = this.child(parent, name, new vec3(0, 0, z))
    this.webCapture.addPanelShape(object, {size: size, radius: radius, color: color, border: border, layer: layer})
    return object
  }

  private child(parent: SceneObject, name: string, position: vec3): SceneObject {
    const object = global.scene.createSceneObject(name)
    object.setParent(parent)
    object.getTransform().setLocalPosition(position)
    return object
  }

  /** In front of the head pose, facing the user, a little below eye level. */
  private place(object: SceneObject): void {
    const camera = WorldCameraFinderProvider.getInstance()
    const position = camera.getWorldPosition()
    let forward = camera.getForwardPositionParallelToGround(1).sub(position)
    forward = forward.length > 0.0001 ? forward.normalize() : new vec3(0, 0, -1)
    const transform = object.getTransform()
    transform.setWorldPosition(position.add(forward.uniformScale(this.distance)).add(new vec3(0, this.heightOffset, 0)))
    transform.setWorldRotation(quat.lookAt(forward.uniformScale(-1), vec3.up()))
  }
}

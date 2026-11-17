/**
 * SPECS Inc. 2027
 * Records the interaction cursors (the dot at the end of each hand's targeting ray). On Specs the cursor is drawn by
 * the system, not by a Lens mesh, so a capture of the scene's objects doesn't contain it. This helper asks the
 * Interaction Kit where each cursor is every frame and moves an empty object there; the object is registered with
 * Web Capture as a small round shape, so the portal draws the cursor in the replay (it shrinks while pinching).
 *
 * Used by CapturePanel; to use it without the panel: `new CursorCapture(webCapture, parent)` once the scene has
 * started, then `update()` every frame.
 */
import {CursorControllerProvider} from "InteractionKit.lspkg/Providers/CursorControllerProvider/CursorControllerProvider"
import WorldCameraFinderProvider from "InteractionKit.lspkg/Providers/CameraProvider/WorldCameraFinderProvider"
import {WebCapture} from "./WebCapture"

const SIZE_CM_AT_1M = 1.6 // the cursor keeps about the same size on the display: it grows with distance
const PINCH_SCALE = 0.6
const MIN_ALPHA = 0.05

interface CursorLike {
  cursorPosition: vec3 | null
  cursorAlpha?: number
  interactor?: {currentTrigger?: number} | null
}

export class CursorCapture {
  private objects: SceneObject[] = []
  private camera = WorldCameraFinderProvider.getInstance()

  constructor(
    private webCapture: WebCapture,
    private parent: SceneObject
  ) {}

  /** Call every frame. Creates one recorded object per cursor the Interaction Kit has. */
  update(): void {
    let cursors: CursorLike[] = []
    try {
      cursors = CursorControllerProvider.getInstance().getAllCursors() as unknown as CursorLike[]
    } catch (e) {
      return // Interaction Kit not in the scene yet
    }
    for (let i = 0; i < cursors.length; i++) {
      const object = this.objectFor(i)
      const cursor = cursors[i]
      let position: vec3 | null = null
      try {
        position = cursor.cursorPosition
      } catch (e) {
        position = null
      }
      const alpha = typeof cursor.cursorAlpha === "number" ? cursor.cursorAlpha : 1
      const shown = position !== null && alpha > MIN_ALPHA
      if (object.enabled !== shown) object.enabled = shown
      if (!shown || position === null) continue
      const eye = this.camera.getWorldPosition()
      const toEye = eye.sub(position)
      const distance = toEye.length
      const transform = object.getTransform()
      transform.setWorldPosition(position)
      if (distance > 0.001) transform.setWorldRotation(quat.lookAt(toEye.uniformScale(1 / distance), vec3.up()))
      const pinching = !!cursor.interactor && typeof cursor.interactor.currentTrigger === "number" && cursor.interactor.currentTrigger !== 0
      const scale = Math.max(0.4, Math.min(4, distance / 100)) * (pinching ? PINCH_SCALE : 1)
      transform.setWorldScale(new vec3(scale, scale, scale))
    }
    for (let i = cursors.length; i < this.objects.length; i++) this.objects[i].enabled = false
  }

  private objectFor(index: number): SceneObject {
    while (this.objects.length <= index) {
      const object = global.scene.createSceneObject("Cursor" + (this.objects.length === 0 ? "" : " " + (this.objects.length + 1)))
      object.setParent(this.parent)
      object.enabled = false
      this.webCapture.addPanelShape(object, {size: [SIZE_CM_AT_1M, SIZE_CM_AT_1M], radius: SIZE_CM_AT_1M / 2, color: [1, 1, 1, 0.95], layer: 9})
      this.objects.push(object)
    }
    return this.objects[index]
  }
}

import WorldCameraFinderProvider from "InteractionKit.lspkg/Providers/CameraProvider/WorldCameraFinderProvider"
import {Button} from "UIKit.lspkg/Scripts/Components/Button/Button"
import {Frame} from "UIKit.lspkg/Scripts/Components/Frame/Frame"

/**
 * Opens and closes the near-field panel from a button on the far panel.
 *
 * Each tap on the button flips the panel: closed panels open in front of the user,
 * open panels close.
 *
 * The panel has two levels: a placement root, which this script puts in front of
 * the user, and the Frame on its child, which the user drags. Each open puts the
 * root along the user's gaze, turned to face them, and moves the Frame back onto
 * it, dropping wherever it was dragged last time. Billboarding, follow and the
 * follow button are the Frame's own Inspector settings.
 */

// How far along the user's gaze the panel opens, in cm.
const OPEN_DISTANCE = 50

@component
export class NearMenuToggle extends BaseScriptComponent {
  // The panel's placement root. Leave it disabled in the hierarchy.
  @input
  placement: SceneObject

  // The Frame on the placement root's child.
  @input
  nearFrame: Frame

  // The button that opens and closes the panel.
  @input
  toggleButton: Button

  // The user's camera. Leave empty to use the scene's world camera (the prefab can't
  // reference the scene camera, so this is empty by default).
  @input
  @allowUndefined
  camera: SceneObject

  onAwake(): void {
    this.createEvent("OnStartEvent").bind(() => this.onStart())
  }

  private onStart(): void {
    this.toggleButton.onTriggerUp.add(() => this.setOpen(!this.placement.enabled))
  }

  private setOpen(open: boolean): void {
    if (open) {
      this.placeInFront()
    }
    this.placement.enabled = open
  }

  // Puts the placement root along the gaze, facing the user, with the Frame back on it.
  private placeInFront(): void {
    const head = this.camera ? this.camera.getTransform() : WorldCameraFinderProvider.getInstance().getTransform()
    const eye = head.getWorldPosition()
    // A camera looks down its local -Z, so `back` is the gaze.
    const position = eye.add(head.back.uniformScale(OPEN_DISTANCE))

    const root = this.placement.getTransform()
    root.setWorldPosition(position)
    root.setWorldRotation(quat.lookAt(eye.sub(position), vec3.up()))

    const frame = this.nearFrame.sceneObject.getTransform()
    frame.setLocalPosition(vec3.zero())
    frame.setLocalRotation(quat.quatIdentity())
  }
}

import WorldCameraFinderProvider from "InteractionKit.lspkg/Providers/CameraProvider/WorldCameraFinderProvider"

/**
 * Copies the world camera's pose onto this SceneObject every frame, so its children behave as if they were
 * parented to the camera (head-locked). The demo puts DecartDisplayQuad under it, which lets the display ship
 * inside the prefab instead of under the developer's Camera.
 */
@component
export class HeadLockedDisplay extends BaseScriptComponent {
  private cameraTransform: Transform
  private transform: Transform

  onAwake(): void {
    this.transform = this.getSceneObject().getTransform()
    this.createEvent("OnStartEvent").bind(() => {
      this.cameraTransform = WorldCameraFinderProvider.getInstance().getTransform()
      this.follow()
    })
    this.createEvent("LateUpdateEvent").bind(() => this.follow())
  }

  private follow(): void {
    if (!this.cameraTransform) {
      return
    }
    this.transform.setWorldPosition(this.cameraTransform.getWorldPosition())
    this.transform.setWorldRotation(this.cameraTransform.getWorldRotation())
  }
}

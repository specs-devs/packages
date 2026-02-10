/**
 * Specs Inc. 2026
 * Simple image tracking component that parents the object to the main camera for marker-based
 * augmented reality. Automatically sets up the object hierarchy for image tracking.
 */
import { Utils } from "./Utils";

@component
export class SimpleImageTracking extends BaseScriptComponent {
  onAwake() {
    const mainCamera: SceneObject = Utils.getRootCamera(); // Ensure the camera is set up correctly

    /* Check if the camera is found */
    if (mainCamera) {
      /* Set the parent of this object to the main camera */
      this.getSceneObject().setParent(mainCamera);
    } else {
      /* If no camera is found, log an error from the Utils */
      return null;
    }
  }
}

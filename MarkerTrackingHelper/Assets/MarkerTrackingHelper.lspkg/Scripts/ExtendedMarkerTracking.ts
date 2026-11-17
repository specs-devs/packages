/**
 * SPECS Inc. 2027
 * Extended marker tracking controller with world tracking support. Manages marker tracking with
 * device tracking validation and proper camera hierarchy setup for AR experiences.
 */
import { Utils } from "./Utils";
import { Logger } from "Utilities.lspkg/Scripts/Utils/Logger";
import { bindStartEvent, bindUpdateEvent, bindLateUpdateEvent, bindDestroyEvent } from "SnapDecorators.lspkg/decorators";

@component
export class ExtendMarkerTrackingController extends BaseScriptComponent {
  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Marker Tracking Configuration</span>')
  @ui.label('<span style="color: #94A3B8; font-size: 11px;">Configure the marker tracking component and parent object</span>')

  @input markerTrackingComponent: MarkerTrackingComponent;

  @input()
  @hint("Drop the parent of MarkerTrackingComponent here")
  parentObject: SceneObject;

  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Logging Configuration</span>')
  @ui.label('<span style="color: #94A3B8; font-size: 11px;">Control logging output for this script instance</span>')

  @input
  @hint("Enable general logging (animation cycles, events, etc.)")
  enableLogging: boolean = false;

  @input
  @hint("Enable lifecycle logging (onAwake, onStart, onUpdate, onDestroy, etc.)")
  enableLoggingLifecycle: boolean = false;

  // Logger instance
  private logger: Logger;

  private newParent: SceneObject;
  private detachEvent: DelayedCallbackEvent;

  /**
   * Called when component is initialized
   */
  onAwake(): void {
    // Initialize logger
    this.logger = new Logger("ExtendMarkerTrackingController", this.enableLogging || this.enableLoggingLifecycle, true);

    if (this.enableLoggingLifecycle) {
      this.logger.debug("LIFECYCLE: onAwake() - Component initializing");
    }

    const mainCamera: SceneObject =
      Utils.getRootCamera(); /* Ensure the camera is set up correctly */

    /* Check if the camera is found */
    if (mainCamera) {
      const deviceTrackingComponent = mainCamera.getComponent(
        "Component.DeviceTracking"
      );
      /* Check if the device tracking component is found and if the actual device tracking mode is World */
      if (
        deviceTrackingComponent &&
        deviceTrackingComponent.getActualDeviceTrackingMode() ==
          DeviceTrackingMode.World
      ) {
        /* Set the parent of this object to the main camera */
        this.getSceneObject().setParent(mainCamera);
        this.createEvent("OnStartEvent").bind(() => {
          if (this.markerTrackingComponent.enabled) {
            Utils.addMarkerFoundHandler(this.markerTrackingComponent, () => {
              this.onMarkerFoundCallback();
            });
          }
        });
      } else {
        throw new Error(
          "You are missing a DeviceTrackingComponent with World tracking mode. Please add one to the camera."
        );
      }
    } else {
      /* If no camera is found, log an error from the Utils */
      return null;
    }
  }

  onMarkerFoundCallback() {
    this.logger.debug("Marker Found");

    /* Create the parent object outside of the Camera object once, and reuse it on later detections */
    if (!this.newParent) {
      this.newParent = global.scene.createSceneObject("NewParent");
    }
    if (!this.detachEvent) {
      this.detachEvent = this.createEvent("DelayedCallbackEvent");
      this.detachEvent.bind(() => {
        this.parentObject.setParentPreserveWorldTransform(this.newParent);
        this.markerTrackingComponent.enabled = false;
      });
    }

    this.detachEvent.reset(0.5);
  }
}

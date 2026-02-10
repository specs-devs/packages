/**
 * Specs Inc. 2026
 * Image tracking controller with utilities for aspect ratio resizing and custom callbacks. Provides
 * advanced image tracking features including marker found/lost events and object scaling.
 */
import { Utils } from "./Utils";

/* enable ruler as well as trigger callbacks when marker is found or lost. */
@component
export class ImageTrackingController extends BaseScriptComponent {
  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Tracking Configuration</span>')
  @ui.label('<span style="color: #94A3B8; font-size: 11px;">Configure marker tracking component and objects to resize based on marker aspect ratio</span>')

  @input markerTrackingComponent: MarkerTrackingComponent;
  @input resizeObjectArray: SceneObject[];

  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Custom Callbacks</span>')
  @ui.label('<span style="color: #94A3B8; font-size: 11px;">Enable custom function callbacks for marker found/lost events</span>')

  @input
  @hint(
    "Enable this to add functions from another script to this component's callback events"
  )
  editEventCallbacks: boolean = false;
  @ui.group_start("On State Changed Callbacks")
  @showIf("editEventCallbacks")
  @input("Component.ScriptComponent")
  @hint("The script containing functions to be called on marker found")
  @allowUndefined
  private customFunctionScript: ScriptComponent | undefined;
  @input
  @hint(
    "The names for the functions on the provided script, to be called on marker found"
  )
  @allowUndefined
  private onMarkerFoundFunctionNames: string[] = [];
  @input
  @hint(
    "The names for the functions on the provided script, to be called on marker found"
  )
  @allowUndefined
  private onMarkerLostFunctionNames: string[] = [];

  @ui.group_end
  private aspectRatio: number;
  private height: number;
  onAwake() {
    const mainCamera: SceneObject = Utils.getRootCamera(); // Ensure the camera is set up correctly

    /* Check if the camera is found */
    if (mainCamera) {
      /* Set the parent of this object to the main camera */
      this.getSceneObject().setParent(mainCamera);

      print("ImageTrackingController onAwake");
      /* Get the aspect ratio (width / height) of the texture used by the marker asset. */
      this.aspectRatio = this.markerTrackingComponent.marker.getAspectRatio();

      /* Get the height of the marker asset in real-life centimeters. */
      this.height = this.markerTrackingComponent.marker.height;

      this.createEvent("OnStartEvent").bind(() => {
        print("ImageTrackingController OnStartEvent");

        /* Resize object array to scale with the marker size. */
        this.scaleResizeObjectArray();

        /* Run callback when marker is found/lost. */
        if (this.markerTrackingComponent.enabled) {
          this.markerTrackingComponent.onMarkerFound = () => {
            this.onMarkerFoundCallback();
          };

          this.markerTrackingComponent.onMarkerLost = () => {
            this.onMarkerLostCallback();
          };
        }
      });
    } else {
      // If no camera is found, log an error from the Utils
      return null;
    }
  }

  onMarkerFoundCallback() {
    if (this.editEventCallbacks && this.customFunctionScript) {
      const executeCallback = Utils.createMarkerCallback<boolean>(
        this.customFunctionScript,
        this.onMarkerFoundFunctionNames
      );
      executeCallback(true);
    }
  }

  onMarkerLostCallback() {
    if (this.editEventCallbacks && this.customFunctionScript) {
      const executeCallback = Utils.createMarkerCallback<boolean>(
        this.customFunctionScript,
        this.onMarkerLostFunctionNames
      );
      executeCallback(true);
    }
  }

  /* Scales ResizeObjectArray with unit size to size of marker*/
  scaleResizeObjectArray() {
    for (let i = 0; i < this.resizeObjectArray.length; i++) {
      const children = this.resizeObjectArray[i];
      if (children) {
        children
          .getTransform()
          .setLocalScale(
            new vec3(this.aspectRatio * this.height, this.height, this.height)
          );
      }
    }
  }
}

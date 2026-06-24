/**
 * Specs Inc. 2026
 * Demonstrates how to access components on a scene object. This script shows how to get references
 * to components attached to a specific scene object and check their types.
 */
import { Logger } from "Utilities.lspkg/Scripts/Utils/Logger";
import { bindStartEvent } from "SnapDecorators.lspkg/decorators";

@component
export class AccessComponentOnSceneObjectTS extends BaseScriptComponent {
  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Scene Object Reference</span>')
  @ui.label('<span style="color: #94A3B8; font-size: 11px;">Reference to the scene object whose components you want to access</span>')

  @input
  @allowUndefined
  @hint("The object to access the component from")
  mySceneObject: SceneObject;

  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Debug Settings</span>')

  @input
  @allowUndefined
  @hint("Show logs in the console")
  debug: boolean;

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

  /**
   * Called when component is initialized
   */
  onAwake(): void {
    this.logger = new Logger("AccessComponentOnSceneObjectTS", this.enableLogging || this.enableLoggingLifecycle, true);
    if (this.enableLoggingLifecycle) {
      this.logger.debug("LIFECYCLE: onAwake() - Component initializing");
    }
  }

  @bindStartEvent
  onStart(): void {
    if (this.enableLogging || this.enableLoggingLifecycle) {
      print("Start event triggered");
    }

    if (this.mySceneObject !== null) {
      if (this.enableLogging || this.enableLoggingLifecycle) {
        print("Scene object is not null");
        print("Scene object name: " + this.mySceneObject.name);
      }
    }

    if (
      this.mySceneObject
        .getComponent("Component.RenderMeshVisual")
        .getTypeName()
    ) {
      if (this.enableLogging || this.enableLoggingLifecycle) {
        print("Scene object has a RenderMeshVisual component");
      }
    } else {
      if (this.enableLogging || this.enableLoggingLifecycle) {
        print("Scene object does not have a RenderMeshVisual component");
      }
    }
  }
}

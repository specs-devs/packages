/**
 * Specs Inc. 2026
 * Demonstrates how to access components on child scene objects. This script shows how to navigate
 * the scene hierarchy to find and access components on child objects of a parent scene object.
 */
import { Logger } from "Utilities.lspkg/Scripts/Utils/Logger";
import { bindStartEvent } from "SnapDecorators.lspkg/decorators";

@component
export class AccessComponentOnChildSceneObjectTS extends BaseScriptComponent {
  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Scene Object Reference</span>')
  @ui.label('<span style="color: #94A3B8; font-size: 11px;">Reference to the parent scene object whose child components you want to access</span>')

  @input
  @allowUndefined
  @hint("The parent component")
  parentSceneobject: SceneObject;

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
    this.logger = new Logger("AccessComponentOnChildSceneObjectTS", this.enableLogging || this.enableLoggingLifecycle, true);
    if (this.enableLoggingLifecycle) {
      this.logger.debug("LIFECYCLE: onAwake() - Component initializing");
    }
  }

  @bindStartEvent
  onStart(): void {
    if (this.enableLogging || this.enableLoggingLifecycle) {
      print("Start event triggered");
    }

    if (
      this.parentSceneobject !== null &&
      this.parentSceneobject.getChild(0) !== null
    ) {
      if (this.enableLogging || this.enableLoggingLifecycle) {
        print("Parent scene object is not null");
        print("Parent scene object name: " + this.parentSceneobject.name);
        print(
          "Parent child object name: " + this.parentSceneobject.getChild(0).name
        );
      }
    }

    if (
      this.parentSceneobject
        .getChild(0)
        .getComponent("Component.RenderMeshVisual")
        .getTypeName()
    ) {
      if (this.enableLogging || this.enableLoggingLifecycle) {
        print("Parent child object has a RenderMeshVisual component");
      }
    } else {
      if (this.enableLogging || this.enableLoggingLifecycle) {
        print("Parent child object does not have a RenderMeshVisual component");
      }
    }
  }
}

/**
 * Specs Inc. 2026
 * Demonstrates how to access custom components using the requireType() method. This script shows
 * how to dynamically load and access custom TypeScript components at runtime.
 */
import { Logger } from "Utilities.lspkg/Scripts/Utils/Logger";
import { bindStartEvent } from "SnapDecorators.lspkg/decorators";

@component
export class AccessCustomComponentsUsingRequiredTS extends BaseScriptComponent {
  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Target Configuration</span>')
  @ui.label('<span style="color: #94A3B8; font-size: 11px;">Specify the scene object that has the custom component you want to access</span>')

  @input
  public targetObject: SceneObject;

  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Debug Settings</span>')

  @input
  public debug: boolean = false;

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
  private typeName = requireType(
    './CustomComponentTS'
  ) as keyof ComponentNameMap;

  onAwake(): void {
    this.logger = new Logger("AccessCustomComponentsUsingRequiredTS", this.enableLogging || this.enableLoggingLifecycle, true);
    if (this.enableLoggingLifecycle) {
      this.logger.debug("LIFECYCLE: onAwake() - Component initializing");
    }
  }

  @bindStartEvent
  onStart(): void {


    try {
      if (this.enableLogging || this.enableLoggingLifecycle) {
        print("AccessCustomComponentsUsingRequiredTS initialized");
      }

      // Get all components on this object
      const components = this.targetObject.getAllComponents();
      if (this.enableLogging || this.enableLoggingLifecycle) {
        print(`Found ${components.length} components on this object`);
      }
      const customComponentExample = this.targetObject.getComponent(
        this.typeName
      ) as any;

      customComponentExample.hasTexture();

      if (this.enableLogging || this.enableLoggingLifecycle) {
        print(`Found Texture Size ${customComponentExample.textureSize} on this object`);
      }

    } catch (error) {
      if (this.enableLogging || this.enableLoggingLifecycle) {
        print(`Error: ${error}`);
      }
    }
  }
}

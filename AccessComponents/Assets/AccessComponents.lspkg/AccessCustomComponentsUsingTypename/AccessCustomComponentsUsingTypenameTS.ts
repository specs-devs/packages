/**
 * Specs Inc. 2026
 * Demonstrates how to access custom components using the @typename decorator. This approach provides
 * type-safe access to custom components by declaring their type with @typename before using @input.
 */
import { Logger } from "Utilities.lspkg/Scripts/Utils/Logger";
import { bindStartEvent } from "SnapDecorators.lspkg/decorators";

@component
export class AccessCustomComponentsUsingTypenameTS extends BaseScriptComponent {
  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Component Type Definition</span>')
  @ui.label('<span style="color: #94A3B8; font-size: 11px;">Define the custom component type using @typename decorator</span>')

  // Define the component type using @typename
  @typename
  CustomComponentTS: keyof ComponentNameMap;

  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Component Reference</span>')
  @ui.label('<span style="color: #94A3B8; font-size: 11px;">Input the custom component instance to access its methods and properties</span>')

  // Input the component directly
  @input('CustomComponentTS')
  customComponent: any;

  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Debug Settings</span>')

  // Debug flag to enable logging
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

  
  // Called when the script is initialized
  onAwake(): void {
    this.logger = new Logger("AccessCustomComponentsUsingTypenameTS", this.enableLogging || this.enableLoggingLifecycle, true);
    if (this.enableLoggingLifecycle) {
      this.logger.debug("LIFECYCLE: onAwake() - Component initializing");
    }
  }

  @bindStartEvent
  onStart(): void {
    try {
      if (this.enableLogging || this.enableLoggingLifecycle) {
        print("AccessCustomComponentsUsingTypenameTS initialized");
      }
      
      // Access the component directly
      if (this.customComponent) {
        // Call methods on the component
        const hasTexture = this.customComponent.hasTexture();
        if (this.enableLogging || this.enableLoggingLifecycle) {
          print(`Component has texture: ${hasTexture}`);
        }
        
        // Access properties
        if (this.customComponent.textureSize !== undefined) {
          if (this.enableLogging || this.enableLoggingLifecycle) {
            print(`Texture size: ${this.customComponent.textureSize}`);
          }
        }
      } else {
        if (this.enableLogging || this.enableLoggingLifecycle) {
          print("Custom component not found");
        }
      }
    } catch (error) {
      if (this.enableLogging || this.enableLoggingLifecycle) {
        print(`Error: ${error}`);
      }
    }
  }
}

/**
 * Specs Inc. 2026
 * Demonstrates how to access custom components using the @typename decorator. This approach provides
 * type-safe access to custom components by declaring their type with @typename before using @input.
 */
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
  
  // Called when the script is initialized
  onAwake(): void {
    // Create an event for onStart to ensure components are fully initialized
    this.createEvent("OnStartEvent").bind(() => {
      this.onStart();
    });
  }
  
  // Called when the scene starts
  onStart(): void {
    try {
      this.debug && print("AccessCustomComponentsUsingTypenameTS initialized");
      
      // Access the component directly
      if (this.customComponent) {
        // Call methods on the component
        const hasTexture = this.customComponent.hasTexture();
        this.debug && print(`Component has texture: ${hasTexture}`);
        
        // Access properties
        if (this.customComponent.textureSize !== undefined) {
          this.debug && print(`Texture size: ${this.customComponent.textureSize}`);
        }
      } else {
        print("Custom component not found");
      }
    } catch (error) {
      print(`Error: ${error}`);
    }
  }
}

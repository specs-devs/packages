/**
 * Specs Inc. 2026
 * Demonstrates accessing a JavaScript component from TypeScript using a declaration file.
 * This approach provides type safety and IntelliSense support for JavaScript components.
 */
import { JSComponentA } from './AccessJSfromTSwithDeclaration_JSComponentA_Declaration';
@component
export class TSComponentB extends BaseScriptComponent {
  @ui.separator
  @ui.label('<span style="color: #60A5FA;">JavaScript Component Reference</span>')
  @ui.label('<span style="color: #94A3B8; font-size: 11px;">Reference to the JavaScript component with full type definitions from the declaration file</span>')

  @input('Component.ScriptComponent')
  refScript: JSComponentA;
  
  // Track the current value for display
  private currentValue: number = 0;
  
  onAwake() {
    // Access basic properties
    print("Number value: " + this.refScript.numberVal);
    print("String value: " + this.refScript.stringVal);
    print("Boolean value: " + this.refScript.boolVal);
    print("Array value: " + JSON.stringify(this.refScript.arrayVal));
    print("Object value: " + JSON.stringify(this.refScript.objectVal));
    
    // Call methods
    this.refScript.printHelloWorld();
    
    const sum = this.refScript.add(5, 3);
    print("5 + 3 = " + sum);
    
    const product = this.refScript.multiply(4, 7);
    print("4 * 7 = " + product);
    
    // Set up event handling
    this.refScript.onValueChanged(this.handleValueChanged.bind(this));
    
    // Update the value to trigger the callback
    this.refScript.updateValue(42);
  }
  
  // Event handler for value changes
  private handleValueChanged(newValue: number): void {
    this.currentValue = newValue;
    print("Value changed to: " + newValue);
  }
  
  // Example of a method that could be called from elsewhere
  public incrementValue(): void {
    if (this.refScript) {
      this.refScript.updateValue(this.currentValue + 1);
    }
  }
}

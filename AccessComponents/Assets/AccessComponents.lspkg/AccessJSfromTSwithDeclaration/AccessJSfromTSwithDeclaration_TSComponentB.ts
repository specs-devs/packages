/**
 * Specs Inc. 2026
 * Demonstrates accessing a JavaScript component from TypeScript using a declaration file.
 * This approach provides type safety and IntelliSense support for JavaScript components.
 */
import { JSComponentA } from './AccessJSfromTSwithDeclaration_JSComponentA_Declaration';
import { Logger } from "Utilities.lspkg/Scripts/Utils/Logger";
import { bindStartEvent } from "SnapDecorators.lspkg/decorators";

@component
export class TSComponentB extends BaseScriptComponent {
  @ui.separator
  @ui.label('<span style="color: #60A5FA;">JavaScript Component Reference</span>')
  @ui.label('<span style="color: #94A3B8; font-size: 11px;">Reference to the JavaScript component with full type definitions from the declaration file</span>')

  @input('Component.ScriptComponent')
  refScript: JSComponentA;

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

  // Track the current value for display
  private currentValue: number = 0;

  private log(message: string): void {
    if (this.enableLogging || this.enableLoggingLifecycle) {
      print(message);
    }
  }

  onAwake(): void {
    this.logger = new Logger("TSComponentB", this.enableLogging || this.enableLoggingLifecycle, true);
    if (this.enableLoggingLifecycle) {
      this.logger.debug("LIFECYCLE: onAwake() - Component initializing");
    }
  }

  @bindStartEvent
  onStart(): void {
    this.log("Number value: " + this.refScript.numberVal);
    this.log("String value: " + this.refScript.stringVal);
    this.log("Boolean value: " + this.refScript.boolVal);
    this.log("Array value: " + JSON.stringify(this.refScript.arrayVal));
    this.log("Object value: " + JSON.stringify(this.refScript.objectVal));
    
    this.refScript.printHelloWorld();
    
    const sum = this.refScript.add(5, 3);
    this.log("5 + 3 = " + sum);
    
    const product = this.refScript.multiply(4, 7);
    this.log("4 * 7 = " + product);
    
    this.refScript.onValueChanged(this.handleValueChanged.bind(this));
    
    this.refScript.updateValue(42);
  }
  
  // Event handler for value changes
  private handleValueChanged(newValue: number): void {
    this.currentValue = newValue;
    this.log("Value changed to: " + newValue);
  }
  
  // Example of a method that could be called from elsewhere
  public incrementValue(): void {
    if (this.refScript) {
      this.refScript.updateValue(this.currentValue + 1);
    }
  }
}

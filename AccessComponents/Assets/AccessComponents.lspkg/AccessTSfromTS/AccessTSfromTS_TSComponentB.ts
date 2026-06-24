/**
 * Specs Inc. 2026
 * Demonstrates accessing another TypeScript component with full type safety and IntelliSense.
 * Shows the benefits of TypeScript-to-TypeScript communication with compile-time type checking.
 */
import { TSComponentA } from './AccessTSfromTS_TSComponentA';
import { Logger } from "Utilities.lspkg/Scripts/Utils/Logger";
import { bindStartEvent } from "SnapDecorators.lspkg/decorators";

@component
export class TSComponentB extends BaseScriptComponent {
  @ui.separator
  @ui.label('<span style="color: #60A5FA;">TypeScript Component Reference</span>')
  @ui.label('<span style="color: #94A3B8; font-size: 11px;">Reference to TSComponentA with full type safety and IntelliSense support</span>')

  // Reference to TSComponentA with proper typing
  @input
  refScript: TSComponentA;

  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Debug Settings</span>')

  // Debug flag
  @input
  debug: boolean = true;

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

  // Track if component is initialized
  private initialized: boolean = false;
  
  // Helper method for debug logging
  private log(message: string): void {
    if (this.enableLogging || this.enableLoggingLifecycle) {
      print(`[TSComponentB] ${message}`);
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
    if (!this.refScript) {
      this.log("Error: TSComponentA reference is missing!");
      return;
    }
    
    this.initialized = true;
    
    this.refScript.debug = this.debug;
    this.log("Debug settings synchronized with TSComponentA");
    
    this.log("Number value: " + this.refScript.numberVal);
    this.log("String value: " + this.refScript.stringVal);
    this.log("Boolean value: " + this.refScript.boolVal);
    this.log("Array value: " + JSON.stringify(this.refScript.arrayVal));
    this.log("Object value: " + JSON.stringify(this.refScript.objectVal));
    
    this.refScript.printHelloWorld();
    this.log("Last called method: " + this.refScript.getLastCalledMethod());
    
    const info = this.refScript.getComponentInfo();
    this.log(`Component info: name=${info.name}, version=${info.version}, lastCalled=${info.lastCalled}`);
    
    const processedData = this.refScript.processData({ id: 123, name: "Test Data" });
    this.log(`Processed data timestamp: ${processedData.timestamp}`);
    
    const average = this.refScript.calculateAverage(this.refScript.arrayVal);
    this.log(`Average of array values: ${average}`);
    
    this.log("Initial counter: " + this.refScript.getCounter());
    this.log("After increment: " + this.refScript.incrementCounter());
    this.log("After increment by 5: " + this.refScript.incrementCounter(5));
    this.log("After reset: " + this.refScript.resetCounter());
  }
  
  // Public methods that could be called from elsewhere
  public getComponentInfo(): { name: string; version: number; lastCalled: string } | null {
    if (!this.initialized || !this.refScript) return null;
    return this.refScript.getComponentInfo();
  }
  
  public incrementCounter(amount: number = 1): number {
    if (!this.initialized || !this.refScript) return 0;
    const newValue = this.refScript.incrementCounter(amount);
    this.log(`Counter incremented from TSComponentB: ${newValue}`);
    return newValue;
  }
  
  public resetCounter(): number {
    if (!this.initialized || !this.refScript) return 0;
    const newValue = this.refScript.resetCounter();
    this.log(`Counter reset from TSComponentB: ${newValue}`);
    return newValue;
  }
  
  // Toggle debug mode for both components
  public toggleDebug(): void {
    this.debug = !this.debug;
    if (this.initialized && this.refScript) {
      this.refScript.debug = this.debug;
      this.refScript.toggleDebug();
    }
    this.log(`Debug mode ${this.debug ? 'enabled' : 'disabled'}`);
  }
}

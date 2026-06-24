/**
 * Specs Inc. 2026
 * TypeScript component that can be accessed from JavaScript code. Demonstrates how to create
 * TypeScript components with methods and properties that are callable from JavaScript scripts.
 */
import { Logger } from "Utilities.lspkg/Scripts/Utils/Logger";
import { bindStartEvent } from "SnapDecorators.lspkg/decorators";

@component
export class TSComponentA extends BaseScriptComponent {
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

  // Basic properties
  numberVal: number = 1;
  stringVal: string = "Hello from TypeScript";
  boolVal: boolean = true;
  arrayVal: number[] = [1, 2, 3, 4, 5];
  objectVal: Record<string, any> = { 
    name: "TSComponentA", 
    version: 1.5,
    features: ["typeSafety", "intellisense"]
  };
  
  // Private state
  private counter: number = 0;

  onAwake(): void {
    this.logger = new Logger("TSComponentA", this.enableLogging || this.enableLoggingLifecycle, true);
    if (this.enableLoggingLifecycle) {
      this.logger.debug("LIFECYCLE: onAwake() - Component initializing");
    }
  }

  @bindStartEvent
  onStart(): void {
    this.log("TSComponentA initialized");
  }
  
  // Helper method for debug logging
  private log(message: string): void {
    if (this.enableLogging || this.enableLoggingLifecycle) {
      print(`[TSComponentA] ${message}`);
    }
  }
  
  // Original method enhanced with debug
  printHelloWorld(): void {
    if (this.enableLogging || this.enableLoggingLifecycle) {
      print('Hello, world!');
    }
  }
  
  // New methods
  getDescription(): string {
    const desc = `TypeScript Component (version ${this.objectVal.version})`;
    this.log(`Description requested: ${desc}`);
    return desc;
  }
  
  // Math operations
  add(a: number, b: number): number {
    const result = a + b;
    this.log(`Addition: ${a} + ${b} = ${result}`);
    return result;
  }
  
  multiply(a: number, b: number): number {
    const result = a * b;
    this.log(`Multiplication: ${a} * ${b} = ${result}`);
    return result;
  }
  
  // Counter methods
  incrementCounter(amount: number = 1): number {
    this.counter += amount;
    this.log(`Counter incremented by ${amount} to ${this.counter}`);
    return this.counter;
  }
  
  resetCounter(): number {
    this.counter = 0;
    this.log("Counter reset to 0");
    return this.counter;
  }
  
  getCounter(): number {
    return this.counter;
  }
  
  // Toggle debug mode
  toggleDebug(): void {
    this.debug = !this.debug;
    if (this.enableLogging || this.enableLoggingLifecycle) {
      this.log(`Debug mode ${this.debug ? 'enabled' : 'disabled'}`);
    }
  }
}

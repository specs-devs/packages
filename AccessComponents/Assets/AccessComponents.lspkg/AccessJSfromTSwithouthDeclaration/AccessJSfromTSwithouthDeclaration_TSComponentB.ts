/**
 * Specs Inc. 2026
 * Demonstrates accessing a JavaScript component from TypeScript without a declaration file.
 * Uses the 'any' type for flexibility but without IntelliSense support or type checking.
 */
import { Logger } from "Utilities.lspkg/Scripts/Utils/Logger";
import { bindStartEvent } from "SnapDecorators.lspkg/decorators";

@component
export class TSComponentB extends BaseScriptComponent {
  @ui.separator
  @ui.label('<span style="color: #60A5FA;">JavaScript Component Reference</span>')
  @ui.label('<span style="color: #94A3B8; font-size: 11px;">Reference to the JavaScript component accessed dynamically without type definitions</span>')

  @input('Component.ScriptComponent')
  refScript: any;

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
    if (!this.refScript) {
      this.log("Error: JS Component reference is missing!");
      return;
    }

    this.initialized = true;
    
    this.refScript.debug = this.debug;
    
    this.log("Number value: " + this.refScript.numberVal);
    this.log("String value: " + this.refScript.stringVal);
    this.log("Boolean value: " + this.refScript.boolVal);
    this.log("Array value: " + JSON.stringify(this.refScript.arrayVal));
    this.log("Object value: " + JSON.stringify(this.refScript.objectVal));
    
    this.refScript.printHelloWorld();
    
    const sum = this.refScript.calculateSum(1, 2, 3, 4, 5);
    this.log("Sum of numbers 1-5: " + sum);
    
    const formattedMessage = this.refScript.formatMessage(
      "Hello, {0}! Today is {1} and the temperature is {2}°C.",
      "User",
      "Monday",
      25
    );
    this.log(formattedMessage);
    
    this.log("Initial counter: " + this.refScript.counter);
    this.log("After increment: " + this.refScript.increment());
    this.log("After increment by 5: " + this.refScript.increment(5));
    this.log("After reset: " + this.refScript.reset());
    
    this.setupEventListeners();
    
    this.triggerEvents();
  }
  
  private setupEventListeners(): void {
    // Listen for 'valueChanged' event
    this.refScript.on('valueChanged', (newValue: number) => {
      this.log("Event received: Value changed to " + newValue);
    });
    
    // Listen for 'messageReceived' event
    this.refScript.on('messageReceived', (message: string, priority: number) => {
      this.log(`Event received: Message "${message}" with priority ${priority}`);
    });
  }
  
  private triggerEvents(): void {
    // Emit events to demonstrate the event system
    this.refScript.emit('valueChanged', 42);
    this.refScript.emit('messageReceived', "Hello from TypeScript", 1);
  }
         
  // Public methods that could be called from elsewhere
  public incrementCounter(amount: number = 1): number {
    if (!this.initialized || !this.refScript) return 0;
    const newValue = this.refScript.increment(amount);
    this.log(`Counter incremented from TS: ${newValue}`);
    return newValue;
  }
  
  public resetCounter(): number {
    if (!this.initialized || !this.refScript) return 0;
    const newValue = this.refScript.reset();
    this.log(`Counter reset from TS: ${newValue}`);
    return newValue;
  }
  
  public sendMessage(message: string, priority: number = 0): void {
    if (!this.initialized || !this.refScript) return;
    this.log(`Sending message from TS: "${message}" with priority ${priority}`);
    this.refScript.emit('messageReceived', message, priority);
  }
  
  // Toggle debug mode for both this component and the JS component
  public toggleDebug(): void {
    this.debug = !this.debug;
    if (this.initialized && this.refScript) {
      this.refScript.debug = this.debug;
    }
    this.log(`Debug mode ${this.debug ? 'enabled' : 'disabled'}`);
  }
}

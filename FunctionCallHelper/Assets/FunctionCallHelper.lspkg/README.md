![FunctionCallHelper](../AssetImage/FunctionCallHelper.png)

# Function Call Helper

A powerful utility package for creating dynamic, button-triggered function call systems in Lens Studio. This package simplifies the creation of interactive UI panels where buttons can trigger arbitrary functions on script components, making it ideal for debugging interfaces, test panels, configuration screens, and dynamic menu systems.

## Features

- **Dynamic Button Generation**: Automatically create buttons from a list of triggerable functions
- **Flexible Function Binding**: Bind any function from any script component to UI buttons
- **ScrollWindow Integration**: Automatic scroll dimension calculation for scrollable button lists
- **GridLayout Support**: Seamless integration with GridLayout for organized button arrangements
- **Automatic Component Discovery**: Find ScrollWindow and GridLayout components in parent hierarchy
- **Snap-to-Grid Scrolling**: Configure scroll snapping to align with button rows
- **Text Formatting**: Split function names into multi-line button labels (PascalCase or space-separated)
- **Multiple Button Types**: Compatible with CapsuleButton, RectangleButton, and custom button components

## Quick Start

Create a dynamic function menu with automatic button generation:

```typescript
import { ButtonClickEvent, TriggerableFunction } from "FunctionCallHelper.lspkg/FunctionCallHelper";

@component
export class DynamicMenu extends BaseScriptComponent {
  @input functionTriggerScript: ScriptComponent;
  @input buttonPrefab: ObjectPrefab;
  @input parentContainer: SceneObject;

  onAwake() {
    // Create triggerable function definitions
    const functions: TriggerableFunction[] = [
      { script: this.functionTriggerScript, functionName: "StartGame" },
      { script: this.functionTriggerScript, functionName: "LoadLevel" },
      { script: this.functionTriggerScript, functionName: "ShowSettings" },
      { script: this.functionTriggerScript, functionName: "QuitGame" }
    ];

    // Set up button click event system
    const buttonClickEvent = this.sceneObject.createComponent("ButtonClickEvent");
    buttonClickEvent.triggerableFunctions = functions;
    buttonClickEvent.buttonPrefab = this.buttonPrefab;
    buttonClickEvent.parentObject = this.parentContainer;
  }
}
```

## Script Highlights

### ButtonClickEvent.ts (FunctionCallHelper.ts)

The core component that powers the entire function call system. ButtonClickEvent manages the lifecycle of dynamic button creation, event binding, and function invocation. It automatically instantiates buttons from a prefab for each function in the triggerableFunctions array, binds onTriggerUp events to invoke the target functions, and sets button text labels from function names. The component intelligently discovers ScrollWindow and GridLayout components in the parent hierarchy, configuring scroll dimensions and snap regions based on the number of buttons and grid cell sizes. Supports both beautified display names (via getFunctionName() method on target scripts) and automatic PascalCase splitting for readable button labels. Includes comprehensive error handling with validation for missing prefabs, parent objects, and script components.

### TriggerableFunction.ts

A typedef structure that defines the schema for functions that can be triggered via button clicks. Each TriggerableFunction contains a reference to a script component and the string name of the function to invoke on that component. This decoupled approach allows any function on any script to be called through the button system without tight coupling, enabling maximum flexibility for creating debug panels, test interfaces, and dynamic configuration menus.

## Core API Methods

```typescript
// ButtonClickEvent configuration
@input triggerableFunctions: TriggerableFunction[]
@input buttonPrefab: ObjectPrefab
@input parentObject: SceneObject
@input scrollWindow: ScrollWindow  // Optional, auto-discovered
@input gridLayout: GridLayout      // Optional, auto-discovered

// TriggerableFunction structure
interface TriggerableFunction {
  script: ScriptComponent
  functionName: string
}

// Internal methods (called automatically)
createButton(triggerableFunction: TriggerableFunction, index: number): void
invokeFunction(scriptComponent: ScriptComponent, functionName: string): void
updateScrollDimensions(): void
```

## Advanced Usage

### Debug Panel with Scrolling

Create a comprehensive debug panel with many functions:

```typescript
@component
export class DebugPanel extends BaseScriptComponent {
  @input debugFunctions: ScriptComponent;
  @input buttonPrefab: ObjectPrefab;
  @input scrollContainer: SceneObject;
  @input scrollWindow: ScrollWindow;
  @input gridLayout: GridLayout;

  onAwake() {
    // Define all debug functions
    const debugFunctions: TriggerableFunction[] = [
      { script: this.debugFunctions, functionName: "LogSystemInfo" },
      { script: this.debugFunctions, functionName: "ResetPlayerPosition" },
      { script: this.debugFunctions, functionName: "ToggleDebugMode" },
      { script: this.debugFunctions, functionName: "ClearCache" },
      { script: this.debugFunctions, functionName: "ReloadAssets" },
      { script: this.debugFunctions, functionName: "ShowPerformanceStats" },
      { script: this.debugFunctions, functionName: "DumpObjectHierarchy" },
      { script: this.debugFunctions, functionName: "TestNetworkConnection" },
      { script: this.debugFunctions, functionName: "ValidateConfiguration" },
      { script: this.debugFunctions, functionName: "ExportLogs" }
    ];

    // Create button system
    const buttonSystem = this.sceneObject.createComponent("ButtonClickEvent");
    buttonSystem.triggerableFunctions = debugFunctions;
    buttonSystem.buttonPrefab = this.buttonPrefab;
    buttonSystem.parentObject = this.scrollContainer;
    buttonSystem.scrollWindow = this.scrollWindow;
    buttonSystem.gridLayout = this.gridLayout;

    print(`Debug panel initialized with ${debugFunctions.length} functions`);
  }
}

// Target script with debug functions
@component
export class DebugFunctions extends BaseScriptComponent {
  LogSystemInfo(param: string) {
    print("System Info:");
    print(`Platform: ${global.deviceInfoSystem.getOSVersion()}`);
    print(`Model: ${global.deviceInfoSystem.getModel()}`);
  }

  ResetPlayerPosition(param: string) {
    print("Resetting player position to origin");
    // Reset logic here
  }

  ToggleDebugMode(param: string) {
    print("Debug mode toggled");
    // Toggle debug mode
  }

  ClearCache(param: string) {
    print("Cache cleared");
    // Clear cache logic
  }

  ReloadAssets(param: string) {
    print("Reloading all assets");
    // Reload logic
  }

  ShowPerformanceStats(param: string) {
    print("FPS: 60, Memory: 120MB");
    // Show performance data
  }

  DumpObjectHierarchy(param: string) {
    print("Dumping scene object hierarchy");
    // Dump hierarchy logic
  }

  TestNetworkConnection(param: string) {
    print("Testing network connection...");
    // Network test logic
  }

  ValidateConfiguration(param: string) {
    print("Configuration validation complete");
    // Validation logic
  }

  ExportLogs(param: string) {
    print("Exporting logs to file");
    // Export logic
  }
}
```

### Dynamic Function Registry

Build a system that allows adding functions at runtime:

```typescript
@component
export class DynamicFunctionRegistry extends BaseScriptComponent {
  @input buttonPrefab: ObjectPrefab;
  @input parentContainer: SceneObject;

  private functionRegistry: TriggerableFunction[] = [];
  private buttonClickEvent: ButtonClickEvent;

  onAwake() {
    // Initialize button system
    this.buttonClickEvent = this.sceneObject.createComponent("ButtonClickEvent");
    this.buttonClickEvent.buttonPrefab = this.buttonPrefab;
    this.buttonClickEvent.parentObject = this.parentContainer;
  }

  registerFunction(script: ScriptComponent, functionName: string) {
    // Add function to registry
    this.functionRegistry.push({
      script: script,
      functionName: functionName
    });

    // Update button system
    this.buttonClickEvent.triggerableFunctions = this.functionRegistry;

    print(`Registered function: ${functionName}, total: ${this.functionRegistry.length}`);
  }

  unregisterFunction(functionName: string) {
    // Remove function from registry
    this.functionRegistry = this.functionRegistry.filter(
      fn => fn.functionName !== functionName
    );

    // Update button system
    this.buttonClickEvent.triggerableFunctions = this.functionRegistry;

    print(`Unregistered function: ${functionName}`);
  }

  clearRegistry() {
    this.functionRegistry = [];
    this.buttonClickEvent.triggerableFunctions = [];
    print("Function registry cleared");
  }
}
```

### Multi-Script Function Menu

Create buttons that call functions across multiple different scripts:

```typescript
@component
export class MultiScriptMenu extends BaseScriptComponent {
  @input gameplayScript: ScriptComponent;
  @input audioScript: ScriptComponent;
  @input visualScript: ScriptComponent;
  @input buttonPrefab: ObjectPrefab;
  @input menuContainer: SceneObject;

  onAwake() {
    const functions: TriggerableFunction[] = [
      // Gameplay functions
      { script: this.gameplayScript, functionName: "StartGame" },
      { script: this.gameplayScript, functionName: "PauseGame" },
      { script: this.gameplayScript, functionName: "RestartLevel" },

      // Audio functions
      { script: this.audioScript, functionName: "PlayBackgroundMusic" },
      { script: this.audioScript, functionName: "StopAllSounds" },
      { script: this.audioScript, functionName: "ToggleMute" },

      // Visual functions
      { script: this.visualScript, functionName: "EnablePostProcessing" },
      { script: this.visualScript, functionName: "ToggleFullscreen" },
      { script: this.visualScript, functionName: "AdjustBrightness" }
    ];

    const buttonSystem = this.sceneObject.createComponent("ButtonClickEvent");
    buttonSystem.triggerableFunctions = functions;
    buttonSystem.buttonPrefab = this.buttonPrefab;
    buttonSystem.parentObject = this.menuContainer;
  }
}
```

### Custom Button Text with Beautified Names

Implement custom button text formatting:

```typescript
@component
export class BeautifiedFunctionScript extends BaseScriptComponent {
  private currentFunctionName: string = "";

  // This method is called by ButtonClickEvent to get display name
  getFunctionName(): string {
    return this.currentFunctionName;
  }

  // Example function with beautified name
  ComplexSystemInitialization(param: string) {
    this.currentFunctionName = "Initialize System";
    print("Complex system initialization started");
    // Implementation here
  }

  UserAuthenticationProcess(param: string) {
    this.currentFunctionName = "Authenticate User";
    print("User authentication in progress");
    // Implementation here
  }

  DataSynchronizationService(param: string) {
    this.currentFunctionName = "Sync Data";
    print("Synchronizing data with server");
    // Implementation here
  }
}
```

### Conditional Function Availability

Show/hide buttons based on application state:

```typescript
@component
export class ConditionalFunctionMenu extends BaseScriptComponent {
  @input buttonPrefab: ObjectPrefab;
  @input parentContainer: SceneObject;
  @input targetScript: ScriptComponent;

  private isDebugMode = false;
  private isAuthenticated = false;

  onAwake() {
    this.updateAvailableFunctions();
  }

  updateAvailableFunctions() {
    const functions: TriggerableFunction[] = [];

    // Always available functions
    functions.push({ script: this.targetScript, functionName: "ViewHelp" });
    functions.push({ script: this.targetScript, functionName: "ShowCredits" });

    // Debug-only functions
    if (this.isDebugMode) {
      functions.push({ script: this.targetScript, functionName: "ShowDebugInfo" });
      functions.push({ script: this.targetScript, functionName: "ToggleWireframe" });
      functions.push({ script: this.targetScript, functionName: "DumpMemory" });
    }

    // Authenticated user functions
    if (this.isAuthenticated) {
      functions.push({ script: this.targetScript, functionName: "SaveProgress" });
      functions.push({ script: this.targetScript, functionName: "LoadProfile" });
      functions.push({ script: this.targetScript, functionName: "Logout" });
    } else {
      functions.push({ script: this.targetScript, functionName: "Login" });
      functions.push({ script: this.targetScript, functionName: "Register" });
    }

    // Create button system
    const buttonSystem = this.sceneObject.createComponent("ButtonClickEvent");
    buttonSystem.triggerableFunctions = functions;
    buttonSystem.buttonPrefab = this.buttonPrefab;
    buttonSystem.parentObject = this.parentContainer;
  }

  toggleDebugMode() {
    this.isDebugMode = !this.isDebugMode;
    this.updateAvailableFunctions();
  }

  setAuthenticated(authenticated: boolean) {
    this.isAuthenticated = authenticated;
    this.updateAvailableFunctions();
  }
}
```

### Performance Testing Interface

Create a test harness for performance benchmarking:

```typescript
@component
export class PerformanceTestPanel extends BaseScriptComponent {
  @input testRunner: ScriptComponent;
  @input buttonPrefab: ObjectPrefab;
  @input testContainer: SceneObject;

  onAwake() {
    const testFunctions: TriggerableFunction[] = [
      { script: this.testRunner, functionName: "BenchmarkRenderingPerformance" },
      { script: this.testRunner, functionName: "TestPhysicsSimulation" },
      { script: this.testRunner, functionName: "MeasureScriptPerformance" },
      { script: this.testRunner, functionName: "ProfileMemoryUsage" },
      { script: this.testRunner, functionName: "StressTestParticles" },
      { script: this.testRunner, functionName: "BenchmarkNetworkLatency" },
      { script: this.testRunner, functionName: "TestTextureLoadingSpeed" },
      { script: this.testRunner, functionName: "MeasureAudioProcessing" }
    ];

    const buttonSystem = this.sceneObject.createComponent("ButtonClickEvent");
    buttonSystem.triggerableFunctions = testFunctions;
    buttonSystem.buttonPrefab = this.buttonPrefab;
    buttonSystem.parentObject = this.testContainer;
  }
}

@component
export class PerformanceTestRunner extends BaseScriptComponent {
  BenchmarkRenderingPerformance(param: string) {
    const startTime = getTime();
    // Run rendering tests
    const duration = getTime() - startTime;
    print(`Rendering benchmark completed in ${duration}s`);
  }

  TestPhysicsSimulation(param: string) {
    print("Running physics simulation test...");
    // Physics test implementation
  }

  MeasureScriptPerformance(param: string) {
    print("Measuring script execution performance...");
    // Script performance measurement
  }

  ProfileMemoryUsage(param: string) {
    print("Profiling memory usage patterns...");
    // Memory profiling
  }

  StressTestParticles(param: string) {
    print("Stress testing particle systems...");
    // Particle stress test
  }

  BenchmarkNetworkLatency(param: string) {
    print("Benchmarking network latency...");
    // Network latency test
  }

  TestTextureLoadingSpeed(param: string) {
    print("Testing texture loading speed...");
    // Texture loading test
  }

  MeasureAudioProcessing(param: string) {
    print("Measuring audio processing performance...");
    // Audio processing test
  }
}
```

## Configuration Tips

### ScrollWindow Setup

For optimal scrolling behavior:

1. **Snap Region Configuration**: The system automatically sets snap regions based on GridLayout cell sizes
2. **Initial Scroll Position**: Automatically sets to top (normalized Y = 1) for vertical scrolling
3. **Dimension Calculation**: Scroll dimensions are calculated as `totalRows * cellHeight` for vertical scrolls

### GridLayout Integration

Best practices for grid layouts:

1. **Cell Sizing**: Ensure GridLayout cell size accommodates button prefab dimensions
2. **Column Count**: Set appropriate column count for your UI layout (1 column for vertical lists)
3. **Spacing**: Configure cell spacing in GridLayout for visual separation
4. **Initialization**: System handles GridLayout initialization and layout updates automatically

### Button Prefab Requirements

Your button prefab should:

1. Have a CapsuleButton or RectangleButton component (or custom button with onTriggerUp event)
2. Include a Text component as the first child for label display
3. Be designed to fit within GridLayout cell dimensions
4. Support dynamic text content updates

## Built with 👻 by the Spectacles team

---

[See more packages](https://github.com/specs-devs/packages)


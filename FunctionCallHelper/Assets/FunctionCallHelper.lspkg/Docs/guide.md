# FunctionCallHelper guide and recipes

[← Agent usage index](../README.md)

## Use when

Read this for longer patterns after the [minimal examples](examples.md): debug
panels, menus spanning several scripts, test harnesses, and configuration
tips. This content moved here from the package README and was corrected
against the source of this revision (typed `createComponent`, real imports,
current scroll behavior). Every snippet sets the inputs in the host's
`onAwake`, right after `createComponent`. `ButtonClickEvent` reads them on its
first `OnStartEvent`, when it builds the buttons; after that, change
`triggerableFunctions` and call the public `rebuild()` to build them again.

Labels: a target script **without** `getFunctionName()` gets one button per
method labelled with the raw method name (the recipes below rely on this).
A script **with** `getFunctionName()` gets that label when it backs one entry.
When several entries point at one script, each button shows its own method
name split into words, unless `getFunctionName(functionName: string)` takes the
name and returns a label per function.

## Recipes

### Debug Panel with Scrolling

Create a comprehensive debug panel with many functions:

```typescript
import { ButtonClickEvent, TriggerableFunction } from "FunctionCallHelper.lspkg/FunctionCallHelper";
import { ScrollWindow } from "UIKit.lspkg/Scripts/Components/ScrollWindow/ScrollWindow";
import { GridLayout } from "UIKit.lspkg/Scripts/Components/Layout2D/Grid/GridLayout";

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
    const buttonSystem = this.sceneObject.createComponent(ButtonClickEvent.getTypeName()) as ButtonClickEvent;
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
    // Print whatever system info you need here
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

### Multi-Script Function Menu

Create buttons that call functions across multiple different scripts:

```typescript
import { ButtonClickEvent, TriggerableFunction } from "FunctionCallHelper.lspkg/FunctionCallHelper";

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

    const buttonSystem = this.sceneObject.createComponent(ButtonClickEvent.getTypeName()) as ButtonClickEvent;
    buttonSystem.triggerableFunctions = functions;
    buttonSystem.buttonPrefab = this.buttonPrefab;
    buttonSystem.parentObject = this.menuContainer;
  }
}
```

### Performance Testing Interface

Create a test harness for performance benchmarking:

```typescript
import { ButtonClickEvent, TriggerableFunction } from "FunctionCallHelper.lspkg/FunctionCallHelper";

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

    const buttonSystem = this.sceneObject.createComponent(ButtonClickEvent.getTypeName()) as ButtonClickEvent;
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

## Patterns from earlier READMEs that do not work in this revision

Earlier READMEs showed three more recipes. They are kept here as notes so
nobody re-derives them; see [API status](api-status.md#removed).

- **Dynamic Function Registry** (push/pop entries and re-assign
  `triggerableFunctions`): assignment alone does nothing; call `rebuild()`
  afterwards to replace the buttons with the new list.
- **Custom Button Text with Beautified Names** (a `getFunctionName()` that
  returns a value updated inside each function): the label is read once per
  button at build time, before any function has run, so every button would
  show the initial (empty) value. Return a constant, or call `rebuild()` to
  re-read the labels.
- **Conditional Function Availability** (rebuild the list when debug/auth state
  changes, calling `createComponent` again from a toggle): each call adds
  another `ButtonClickEvent` that instantiates a full second set of buttons
  into the same parent; nothing removes the old ones. Use separate panels and
  enable/disable their host objects instead.

## Configuration tips

### ScrollWindow setup

1. **Snapping** is not configured by the package. Set `scrollSnapping` /
   `snapRegion` on the ScrollWindow in the Inspector if you want it (the prefab
   ships with snapping off and `snapRegion = (0, 3)`).
2. **Initial scroll position**: for a vertical ScrollWindow the package aligns
   the grid's top with the window's top and sets
   `scrollPositionNormalized = (0, 0)` (0 = top).
3. **Dimensions**: with a GridLayout, the scroll dimensions are the grid's
   `width × height`. Without one, they are `functionCount × 4` cm tall by the
   window width.

### GridLayout integration

1. **Cell sizing**: with `overrideButtonSize` on, the package writes one fixed
   column (`templateColumns = "<buttonSize.x>cm"`), `autoRows = "<buttonSize.y>cm"`,
   and a grid `height` that fits every row plus `rowGap`, `topPadding` and
   `paddingBottom`. With it off, size the grid tracks yourself to fit the prefab.
2. **Placement**: every button gets a `GridItem` with `autoPlacement = true`;
   the grid places them on its next layout pass (next frame).
3. **Spacing**: set `rowGap` / paddings on the GridLayout; they are included in
   the computed height.

### Button prefab requirements

1. A component with an `onTriggerUp` event on the prefab root: UIKit
   `Button`, `CapsuleButton`, `RectangleButton` or `RoundButton` (found on the
   root or a direct child) or any other component with `onTriggerUp` (found by
   the root-only fallback scan).
2. A `Text` component on a **direct child** of the prefab root for the label
   (the first such child is used).
3. Designed to fit the grid cell, or use `overrideButtonSize`.

# FunctionCallHelper components

[← Agent usage index](../README.md)

## Use when

Use this as the import, input and behavior index after choosing the package.
Everything here is derived from `FunctionCallHelper.ts`, the `Examples/`
scripts and the two prefabs in this revision.

## Imports

| Symbol | Import |
|---|---|
| `ButtonClickEvent` (component) | `import {ButtonClickEvent} from "FunctionCallHelper.lspkg/FunctionCallHelper"` |
| `TriggerableFunction` (`@typedef`) | `import {TriggerableFunction} from "FunctionCallHelper.lspkg/FunctionCallHelper"` |
| `TestScript1` … `TestScript9` (samples) | `import {TestScript1} from "FunctionCallHelper.lspkg/Examples/TestScript1"` (same pattern for 2–9) |

The module imports `SpectaclesUIKit.lspkg/Scripts/Themes/ThemeService` first
(a side-effect import that avoids a UIKit circular-import crash), then UIKit
`Button`, `CapsuleButton`, `RectangleButton`, `RoundButton`, `ScrollWindow`, `GridLayout`, `GridItem`,
`Utilities.lspkg` `ValidationUtils`/`Logger`, and the
`SnapDecorators.lspkg/decorators` lifecycle binders (`bindStartEvent`,
`bindUpdateEvent`, `bindLateUpdateEvent`, `bindDestroyEvent`). Those packages
must be installed.

## `TriggerableFunction`

`@typedef` class, so it appears as a struct in the Inspector array.

| Field | Type | Meaning |
|---|---|---|
| `script` | `ScriptComponent` | Component that owns the method |
| `functionName` | `string` | Exact (case-sensitive) name of a method on `script` |

In TypeScript a plain object literal `{script, functionName}` satisfies the type.

## `ButtonClickEvent`

`@component`, file `FunctionCallHelper.ts`. In the prefab its ScriptComponent
is named `FunctionCallHelper`.

### Inputs

| Input | Type | Default | Meaning |
|---|---|---|---|
| `triggerableFunctions` | `TriggerableFunction[]` | — | One button per entry, in order |
| `buttonPrefab` | `ObjectPrefab` | — (required) | Instantiated once per entry under `parentObject` |
| `parentObject` | `SceneObject` | — (required) | Parent of the buttons; also the start of the ScrollWindow/GridLayout search |
| `scrollWindow` | UIKit `ScrollWindow` | `undefined` (`@allowUndefined`) | Found on `parentObject` or its ancestors if unset |
| `gridLayout` | UIKit `GridLayout` | `undefined` (`@allowUndefined`) | Found on `parentObject` or its ancestors if unset |
| `overrideButtonSize` | `boolean` | `false` | Stamp `buttonSize` on every button and size the grid to fit |
| `buttonSize` | `vec3` | `(10, 4, 0.5)` cm | Shown when `overrideButtonSize`; button width/height/depth |
| `topPadding` | `number` | `3` cm | Shown when `overrideButtonSize`; grid `paddingTop` (clears the Frame title bar) |
| `enableLogging` | `boolean` | `false` | Logger output |
| `enableLoggingLifecycle` | `boolean` | `false` | Lifecycle log lines |

The prefab overrides: `overrideButtonSize = true`, `buttonSize = (10, 2, 0)`,
`topPadding = 2`, both logging flags `true`, and nine entries pointing at
`TestScript1`…`TestScript9`.

Many diagnostic `print` calls (button found, label set, scroll dimensions,
function called) are unconditional: they print regardless of the logging flags.

### Public methods, properties, events

| Member | Meaning |
|---|---|
| `rebuild(): void` | Destroys the buttons this component created and builds `triggerableFunctions` again (re-reading labels and re-sizing the grid/scroll area). No-op before the first build, which still happens on start / ScrollWindow init |

`ButtonClickEvent` exposes no events; all other methods are private (see
[api-status](api-status.md#internal)).

### Lifecycle

1. `onAwake`: creates the logger and binds `OnStartEvent`.
2. `onStart`: asserts `buttonPrefab` and `parentObject` (throws
   `FunctionTriggerer: … is not assigned` if null). Resolves `scrollWindow` and
   `gridLayout` by walking from `parentObject` up through its parents.
3. If a ScrollWindow was found and is not yet `initialized`, waits for its
   `onInitialized`; otherwise builds immediately.
4. Build, per entry in order:
   - `buttonPrefab.instantiate(parentObject)`;
   - if a GridLayout exists, adds a `GridItem` with `autoPlacement = true`;
   - looks for UIKit `Button`, `CapsuleButton`, `RectangleButton` or
     `RoundButton` on the instance root, then on its direct children; if none, scans the root's components for any
     component with an `onTriggerUp` event;
   - with `overrideButtonSize`, sets `button.size = buttonSize`, calls
     `button.initialize()` if present, and sets `size` again one frame later;
   - subscribes `onTriggerUp` → `invokeFunction(script, functionName)`;
   - labels the first **direct child** that has a `Text` component with
     `script.getFunctionName(functionName)` if the script defines it, else
     `functionName`. When several entries point at the same script with
     different functions and its `getFunctionName` takes no parameter, the
     label is the method name split into words (`activateSystem` → "Activate System").
5. After all buttons: with `overrideButtonSize` and a grid, sets the grid's
   `templateColumns = "<x>cm"`, `autoRows = "<y>cm"`, `width = x`,
   `height = n·y + (n−1)·rowGap + topPadding + paddingBottom`, `paddingTop = topPadding`.
6. With a ScrollWindow: sets its public `scrollDimensions` to the grid's
   `width × height` (no grid: `n × 4` cm tall, window width), moves the grid so
   its top aligns with the window top, and sets `scrollPositionNormalized = (0, 0)`
   (top) when the window is vertical.

### Invocation

On pinch release, `invokeFunction` calls `script[functionName]("")`, i.e. with
one empty-string argument. It throws if `script` is null, `functionName` is
empty, or the method is not found (the error lists the methods it can see).

## Prefabs

### `FunctionCallHelper__PLACE_IN_SCENE.prefab`

```
FunctionCallHelper__PLACE_IN_SCENE      ButtonClickEvent (named "FunctionCallHelper"), local z = -60
├── Guide                               GuideDismissPanel (demo scaffolding)
├── ExampleCarousel                     ExampleCarousel (demo scaffolding)
├── Frame [FunctionCallHelper]          UIKit Frame
│   ├── Text                            status line written by the test scripts
│   └── ScrollWindow                    UIKit ScrollWindow (vertical, window 10×10)
│       └── GridLayout                  UIKit GridLayout  ← parentObject
└── YOUR-SCRIPTS-HERE
    ├── TestScript1 … TestScript9       one sample target per object
```

Add your own target scripts under `YOUR-SCRIPTS-HERE` (or anywhere) and add a
`triggerableFunctions` entry for each. The `[FunctionCallHelper]` suffix on
the Frame is the title the example carousel shows for it.

### Demo scaffolding (Example/)

These demo-only scripts ship in `FunctionCallHelper.lspkg/Example/` so the
prefab works on its own. They aren't part of the package API. Remove `Guide`
and `ExampleCarousel` from your instance when you build your own Lens. The
button panel keeps working without them.

| File | Used by | Key inputs |
|---|---|---|
| `Example/GuideDismissPanel/GuideDismissPanel.ts` | `Guide` | `buttonLabel` (`"Ok, I understood"`), `hideUntilDismissed: SceneObject[]` (`ExampleCarousel`, `Frame [FunctionCallHelper]`): hidden while the guide shows, enabled when it's closed. The prefab root isn't listed, so the guide itself stays visible. |
| `Example/ExampleCarousel/ExampleCarousel.ts` | `ExampleCarousel` | `examples: SceneObject[]` (`Frame [FunctionCallHelper]`, titled "Function Call Helper"), `exampleInfo: string[]`, `steps: SceneObject[]` (empty), `stepInfo: string[]` (empty; what each step shows, in the same order as `steps`), `startIndex` (`0`), `previousLabel` / `nextLabel`, `examplesPushBack` (`20` cm), `anchorExamples` (`true`, the panel is moved in front of the user), `startMinimized` (`false`), `extraPanelDrop` (`0` cm) |

With a single example the carousel shows only its title, the description and
the minimize button. Previous / Next appear when `examples` lists more than
one object.

### `CapsuleButton.prefab`

```
CapsuleButton      UIKit CapsuleButton + Layout item
└── Text           label (replaced at build time)
```

## Sample targets (`Examples/`)

Each `TestScriptN` has one input, `displayText: Text`, one public method that
writes `"<method>() called!"` to it, and `getFunctionName()`.

| Script | Method | `getFunctionName()` |
|---|---|---|
| `TestScript1` | `activateSystem()` | "Activate System" |
| `TestScript2` | `processData()` | "Process Data" |
| `TestScript3` | `executeCommand()` | "Execute Command" |
| `TestScript4` | `triggerAction()` | "Trigger Action" |
| `TestScript5` | `performTask()` | "Perform Task" |
| `TestScript6` | `runOperation()` | "Run Operation" |
| `TestScript7` | `startProcess()` | "Start Process" |
| `TestScript8` | `handleEvent()` | "Handle Event" |
| `TestScript9` | `updateStatus()` | "Update Status" |

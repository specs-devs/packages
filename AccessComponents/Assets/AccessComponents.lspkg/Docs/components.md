# AccessComponents components

[← Agent usage index](../README.md)

## Use when

Use this as the index of the 13 examples after choosing the package: which
files, classes, inputs and members each one has, and how the prefab wires it.
Everything is derived from the scripts and
`AccessComponents__PLACE_IN_SCENE.prefab` in this revision.

All imports use the prefix `AccessComponents.lspkg/<ExampleFolder>/`. JS files
are not importable from TS; reach them through a `ScriptComponent` input.

## Shared conventions

- **TS scripts**: `@component` classes; work runs in an `onStart()` bound with
  SnapDecorators' `@bindStartEvent`. Inputs `enableLogging` and
  `enableLoggingLifecycle` (both `boolean`, script default `false`) gate **all**
  of their prints, including error lines. The prefab wires `enableLogging: true`
  on all 9 TS example scripts. Where a TS script also has a
  `debug: boolean` input, its prints need `debug` on as well (`debug && logging`;
  wired `true` in the prefab), and `toggleDebug()` switches them.
- **JS scripts**: `//@input` declarations; most bind `OnStartEvent`. Prints
  are gated by `script.debug` (wired `true` in the prefab).
- **Prefab**: one child group per example, named `[<Example>]`. Only
  `[AccessComponentOnChildSceneObjectTS]` is enabled; enable one group at a time.

## Examples

### 1–2. Component on a child SceneObject — `AccessComponentOnChildSceneObject/`

| File | Class / type | Inputs |
|---|---|---|
| `AccessComponentOnChildSceneObjectTS.ts` | `AccessComponentOnChildSceneObjectTS` | `parentSceneobject: SceneObject` (`@allowUndefined`; note lowercase "o"), `debug: boolean` (`@allowUndefined`), logging flags |
| `AccessComponentOnChildSceneObjectJS.js` | JS script | `parentSceneObject: SceneObject`, `debug: bool` |

Reads `parent.getChild(0)` and checks it for `Component.RenderMeshVisual`.
Prefab: the input points at `Parent` (box mesh) whose child `Children` has a
mesh. Prints the parent and child names and "Parent child object has a
RenderMeshVisual component".

### 3–4. Component on a SceneObject — `AccessComponentOnSceneObject/`

| File | Class / type | Inputs |
|---|---|---|
| `AccessComponentOnSceneObjectTS.ts` | `AccessComponentOnSceneObjectTS` | `mySceneObject: SceneObject` (`@allowUndefined`), `debug: boolean` (`@allowUndefined`), logging flags |
| `AccessComponentOnSceneObjectJS.js` | JS script | `mySceneObject: SceneObject`, `debug: bool` |

Checks `mySceneObject.getComponent("Component.RenderMeshVisual")`. Prefab: the
input points at the sibling `SceneObject` (box mesh).

### 5–6. Custom component via `requireType()` — `AccessCustomComponentsUsingRequired/`

| File | Class / type | Inputs / members |
|---|---|---|
| `AccessCustomComponentsUsingRequiredTS.ts` | `AccessCustomComponentsUsingRequiredTS` | `targetObject: SceneObject`, `debug: boolean = false`, logging flags |
| `CustomComponentTS.ts` | `CustomComponentTS` | `textureSize: number = 512`, `hasTexture(): boolean` (prints, returns `true`) |
| `AccessCustomComponentsUsingRequiredJS.js` | JS script | `targetObject: SceneObject` (falls back to its own object), `debug: bool` |
| `CustomComponentJS.js` | JS script | `script.textureSize = 512`, `script.hasTexture()` |

TS: `requireType("./CustomComponentTS") as keyof ComponentNameMap`, counts
`getComponents("Component")`, then `getComponent(typeName)` and calls
`hasTexture()`. JS: `requireType("./CustomComponentJS")` the same way. The
whole lookup is in `try/catch`.

### 7–8. Custom component via `@typename` — `AccessCustomComponentsUsingTypename/`

| File | Class / type | Inputs |
|---|---|---|
| `AccessCustomComponentsUsingTypenameTS.ts` | `AccessCustomComponentsUsingTypenameTS` | `@typename CustomComponentTS: keyof ComponentNameMap`; `@input('CustomComponentTS') customComponent: any`; `debug: boolean = false`; logging flags |
| `AccessCustomComponentsUsingTypenameJS.js` | JS script | `//@typename CustomComponentTS`; `//@input CustomComponentTS customComponent`; `debug: bool` |

Calls `customComponent.hasTexture()` and reads `textureSize`. A `@typename`
name is a local alias that is bound to a script asset in the Inspector, not a
class lookup: in the prefab both examples bind `CustomComponentTS` to
`CustomComponentTS.ts`, and each points `customComponent` at a sibling
`CustomComponentTS` object, so the JS example shows JS reading a TS component.
The group object is
named `[AccessCustomComponentsUsingTypeNameTS]` (capital N).

### 9. JS → JS — `AccessJSfromJS/`

| File | Members / inputs |
|---|---|
| `AccessJSfromJS_ComponentA.js` | `numberVal = 1`, `textValue = "Hello World"`, `isActive = true`, `lastUpdated`, `config {maxValue, minValue, defaultSpeed}`; `printHelloWorld()`, `incrementNumber(amount = 1)`, `setText(newText)`, `toggleActive()`, `getStatus()` |
| `AccessJSfromJS_JSComponentB.js` | `refScript: Component.ScriptComponent`, `debug: bool`, `updateInterval: int = 60` (1–300 frames) |

B calls A's members at start, deliberately calls `setText(123)` (prints
`Error: setText requires a string parameter`), then every `updateInterval`
frames increments / toggles A. Component A's `//@input` line is malformed (no
type or name), so A has no working `debug` input; its prints stay silent.

### 10. JS → TS with a declaration — `AccessJSfromTSwithDeclaration/`

| File | Class / type | Members / inputs |
|---|---|---|
| `AccessJSfromTSwithDeclaration_JSComponentA.js` | JS script | `numberVal`, `stringVal`, `boolVal`, `arrayVal`, `objectVal`; `printHelloWorld()`, `add(a,b)`, `multiply(a,b)`, `onValueChanged(cb)`, `updateValue(v)` |
| `AccessJSfromTSwithDeclaration_JSComponentA_Declaration.ts` | `interface JSComponentA extends ScriptComponent` (same members) + empty `@component class Declaration` | — |
| `AccessJSfromTSwithDeclaration_TSComponentB.ts` | `AccessJSfromTSwithDeclaration_TSComponentB` | `@input('Component.ScriptComponent') refScript: JSComponentA`; logging flags. Public `incrementValue()` |

The `Declaration` class exists only so the declaration file is a valid
component; the prefab carries it on its own object.

### 11. JS → TS without a declaration — `AccessJSfromTSwithouthDeclaration/`

| File | Class / type | Members / inputs |
|---|---|---|
| `AccessJSfromTSwithouthDeclaration_JSComponentA.js` | JS script | `debug = true`, `numberVal`, `stringVal`, `boolVal`, `arrayVal`, `objectVal`, `counter`; `printHelloWorld()`, `log(msg)`, `calculateSum(...n)`, `formatMessage(tpl, ...v)`, `increment(amount = 1)`, `reset()`, `on(event, cb)`, `emit(event, ...args)` |
| `AccessJSfromTSwithouthDeclaration_TSComponentB.ts` | `AccessJSfromTSwithouthDeclaration_TSComponentB` | `@input('Component.ScriptComponent') refScript: any`, `debug: boolean = true` (copied to the JS `debug`), logging flags. Public `incrementCounter(amount = 1)`, `resetCounter()`, `sendMessage(message, priority = 0)`, `toggleDebug()` |

B registers `valueChanged` / `messageReceived` listeners with `on()` and fires
them with `emit()`.

### 12. TS → JS — `AccessTSfromJS/`

| File | Class / type | Members / inputs |
|---|---|---|
| `AccessTSfromJS_TSComponentA.ts` | `AccessTSfromJS_TSComponentA` | `debug: boolean = true`, logging flags; `numberVal`, `stringVal`, `boolVal`, `arrayVal`, `objectVal`; `printHelloWorld()`, `getDescription()`, `add(a,b)`, `multiply(a,b)`, `incrementCounter(amount = 1)`, `resetCounter()`, `getCounter()`, `toggleDebug()` |
| `AccessTSfromJS_JSComponentB.js` | JS script | `refScript: Component.ScriptComponent`, `debug: bool = true`; adds `toggleDebugMode()`, `incrementTSCounter(amount)`, `resetTSCounter()` |

The JS script runs at **load time** (top level, not `OnStartEvent`). In the
prefab the `AccessTSfromJS_TSComponentA` object is **disabled**; the JS script
still reads its fields and calls its methods (verified in Preview), but
A's own `onStart` does not run.

### 13. TS → TS — `AccessTSfromTS/`

| File | Class | Members / inputs |
|---|---|---|
| `AccessTSfromTS_TSComponentA.ts` | `AccessTSfromTS_TSComponentA` | `debug: boolean = true`, logging flags; `numberVal`, `stringVal`, `boolVal`, `arrayVal`, `objectVal`; `printHelloWorld()`, `getComponentInfo()`, `processData<T>(data)`, `calculateAverage(numbers)`, `incrementCounter(amount = 1)`, `resetCounter()`, `getCounter()`, `getLastCalledMethod()`, `toggleDebug()` |
| `AccessTSfromTS_TSComponentB.ts` | `AccessTSfromTS_TSComponentB` | `@input refScript: AccessTSfromTS_TSComponentA` (imported from `./AccessTSfromTS_TSComponentA`), `debug: boolean = true`, logging flags. Public `getComponentInfo()`, `incrementCounter(amount = 1)`, `resetCounter()`, `toggleDebug()` |

This is the fully typed pattern: the input's type is the imported class, so
every member is checked at compile time.

## Class names

Each example class is named after its file (`AccessTSfromTS_TSComponentA`, …).
The old shared names `TSComponentA` (examples 12, 13) and `TSComponentB` (10, 11,
13) are still exported from each file as deprecated aliases, so existing imports
keep compiling; import the new name in new code. Each alias is a re-export at
the end of the file, e.g. `export { AccessTSfromTS_TSComponentA as TSComponentA };`.

## Demo scaffolding (`Example/`)

These scripts ship in `AccessComponents.lspkg/Example/` and are wired inside
`AccessComponents__PLACE_IN_SCENE.prefab` (order: Guide, LogReadout,
ExampleCarousel, then the 13 example groups). They only present the examples;
they are not part of the access patterns, and you don't need them in your own
Lens.

| Object / script | Class | Key inputs |
|---|---|---|
| `Guide` — `Example/GuideDismissPanel/GuideDismissPanel.ts` | `GuideDismissPanel` | `hideUntilDismissed: SceneObject[]` — hidden until "Ok, I understood" is pressed (here: ExampleCarousel, LogPanel and the 13 example groups; only the ones enabled at start are re-enabled); `buttonLabel: string = "Ok, I understood"` (only used when the panel is built at runtime) |
| `ExampleCarousel` — `Example/ExampleCarousel/ExampleCarousel.ts` | `ExampleCarousel` | `examples: SceneObject[]` (the 13 groups, in order), `exampleInfo: string[]` (one line per example), `steps: SceneObject[]`, `stepInfo: string[] = []` (one line per step, same order as `steps`; an empty entry falls back to the step's example info), `startIndex: number = 0`, `previousLabel` / `nextLabel`, `examplesPushBack: number = 20`, `anchorExamples: boolean = true`, `startMinimized: boolean = false`, `extraPanelDrop: number = 0` |
| `LogReadout` — `Example/LogReadout/LogReadout.ts` | `LogReadout` | `panelRoot: SceneObject` (here `LogPanel`), `title: string = "Log"`, `lineCount: number = 6`. Shows the latest `print()` lines on a panel; every line still goes to the regular log |

Keep the Guide and LogReadout above the examples in the hierarchy: the guide
hides its targets in `onAwake`, and LogReadout hooks `print()` in `onAwake`.

## Demo assets

Visuals used by the example groups; nothing in the scripts depends on them.

- `Materials/`: `SimpleDiffuse.mat`, `Simple PBR.mat`
- `Shaders/`: `Simple Diffuse.graphShader`, `Simple Diffuse 2.graphShader`,
  `simple_pbr.graphShader`, `simple_pbr 2.graphShader`
- `Meshes/`: `Box.mesh`, `Sphere.mesh`
- `Textures/Base.png`, `Images/Base.png`

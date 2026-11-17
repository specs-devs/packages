# Access Components

## What it is
Access Components is a package of small, log-only reference examples that show how one script reaches components
and other scripts. It covers built-in components on an object or its child, custom components looked up by
`requireType()` or bound with `@typename`, and calls between JavaScript and TypeScript components in every direction.
It is for Lens developers who want a working, wired pattern to copy rather than a runtime API.

## What it does
- You drop `AccessComponents__PLACE_IN_SCENE.prefab` into a Specs scene. It holds 13 example groups (one child group
  per example, named `[<Example>]`); only the first group is enabled, and you enable one group at a time.
- Each example runs once on its first `OnStartEvent` and prints what it finds to the Logger: component lookups,
  member reads, method calls and callbacks on the other script.
- The prefab also carries demo scaffolding: a guide panel that hides the examples until "Ok, I understood" is
  pressed, a log panel that mirrors the latest `print()` lines, and an example carousel (Previous / Next / minimize)
  to step through the 13 groups.

## Highlights
- Each pattern ships as a TypeScript/JavaScript pair: component on a SceneObject, component on a child,
  custom component via `requireType()`, custom component via `@typename`.
- Cross-language calls in all directions: JS to JS, JS to TS (with and without a hand-written
  `interface … extends ScriptComponent` declaration), TS to JS and fully typed TS to TS.
- Callbacks and events across scripts: the "without declaration" example registers listeners with `on()` and fires
  them with `emit()` on a JS component.
- TS examples use SnapDecorators' `@bindStartEvent`; their prints are gated by `enableLogging` /
  `enableLoggingLifecycle` (and `debug` where present), JS prints by `debug`. The prefab wires these on.
- The JS-to-JS example deliberately calls `setText(123)` to show its parameter check
  (`Error: setText requires a string parameter`).

## Core scripts
| Script | What it does |
|---|---|
| `AccessComponentOnSceneObject/AccessComponentOnSceneObjectTS.ts` | Checks an input object for `Component.RenderMeshVisual`, null-checked. |
| `AccessComponentOnChildSceneObject/AccessComponentOnChildSceneObjectTS.ts` | Reads `getChild(0)` of a parent input and checks it for a mesh visual. |
| `AccessCustomComponentsUsingRequired/AccessCustomComponentsUsingRequiredTS.ts` | Looks up `CustomComponentTS` with `requireType()` and calls `hasTexture()`. |
| `AccessCustomComponentsUsingTypename/AccessCustomComponentsUsingTypenameTS.ts` | Takes the custom component as a `@typename`-typed Inspector input. |
| `AccessJSfromTSwithDeclaration/AccessJSfromTSwithDeclaration_TSComponentB.ts` | Calls a JS component from TS through a typed declaration interface. |
| `AccessJSfromTSwithouthDeclaration/AccessJSfromTSwithouthDeclaration_TSComponentB.ts` | Calls a JS component from TS through an `any` input, with `on()` / `emit()` events. |
| `AccessTSfromJS/AccessTSfromJS_JSComponentB.js` | JS script that reads fields and calls methods on a TS component. |
| `AccessTSfromTS/AccessTSfromTS_TSComponentB.ts` | Fully typed TS-to-TS access via an `@input` of the imported class. |
| `AccessJSfromJS/AccessJSfromJS_JSComponentB.js` | JS script that calls another JS script's members, then updates it every `updateInterval` frames. |

## Extra info
- **Requires:** Utilities and SnapDecorators (imported by the TS scripts); InteractionKit, UIKit, Motion and Icons
  (used by the demo scaffolding only, the examples themselves need no SIK prefab). Everything works in the Lens Studio
  Preview; output goes to the Logger.
- **Get started:** add `AccessComponents__PLACE_IN_SCENE.prefab` to a scene with a Camera and Interaction Kit (SIK),
  enable one example group, run Preview and read the Logger. Imports include the example folder, e.g.
  `AccessComponents.lspkg/AccessTSfromTS/AccessTSfromTS_TSComponentA`; the folder
  `AccessJSfromTSwithouthDeclaration` is spelled with "withouth".
- **More docs:**
  - [cheat-sheet.md](cheat-sheet.md) - load-bearing rules, read first
  - [components.md](components.md) - the 13 examples: files, classes, inputs, members, prefab wiring
  - [guide.md](guide.md) - choosing an access pattern, helper and cache recipes
  - [examples.md](examples.md) - prefab path and minimal compiling snippets
  - [api-status.md](api-status.md) - current, deprecated and removed members
  - [troubleshooting.md](troubleshooting.md) - package-specific symptoms and fixes

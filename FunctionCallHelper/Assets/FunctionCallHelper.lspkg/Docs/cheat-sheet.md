# FunctionCallHelper cheat sheet (load-bearing rules)

[← Agent usage index](../README.md)

## Use when

Read this **first**, and again right before you wire a Function Call Helper
panel. Each rule points to the detail.

## The rules

1. **Import from the package root.** `import {ButtonClickEvent, TriggerableFunction}
   from "FunctionCallHelper.lspkg/FunctionCallHelper"`. There is no `Scripts/`
   folder and no separate `TriggerableFunction` module. → [components](components.md)
2. **The component class is `ButtonClickEvent`, the file is `FunctionCallHelper.ts`.**
   Create it by type: `obj.createComponent(ButtonClickEvent.getTypeName()) as ButtonClickEvent`,
   never `createComponent("ButtonClickEvent")`. → [examples](examples.md)
3. **Buttons are built once, in `OnStartEvent`.** Set `triggerableFunctions`,
   `buttonPrefab` and `parentObject` before that first start (Inspector, or
   synchronously right after `createComponent`). Re-assigning
   `triggerableFunctions` later does nothing until you call `rebuild()`.
   `buttonPrefab` and `parentObject` are asserted non-null in `onStart` and
   throw if missing. → [components](components.md)
4. **The function is called by name with one empty-string argument.**
   `script[functionName]("")`. It must be a public method on that exact
   `ScriptComponent` (case-sensitive). A wrong name throws
   `FunctionTriggerer: Function "…" not found on script component` on pinch,
   not at start. → [troubleshooting](troubleshooting.md)
5. **Labels: `getFunctionName(functionName)` or the method name.** The target
   script's `getFunctionName` is called with the function name. A no-argument
   `getFunctionName()` is only used when the script backs one entry; buttons
   for several functions on one script show their method names split into
   words. Without `getFunctionName` the label is the raw `functionName`.
   → [components](components.md)
6. **The button prefab needs a button component with `onTriggerUp` and a Text
   child.** UIKit `Button`/`CapsuleButton`/`RectangleButton`/`RoundButton` are
   found directly (on the root or a direct child); any other component exposing
   `onTriggerUp` is found through a fallback scan of the root's components. The
   label goes on the first direct child with a `Text`. → [components](components.md)
7. **`parentObject` is the GridLayout object.** ScrollWindow and GridLayout are
   searched from `parentObject` upward (self, then parents). Put
   `parentObject` = the GridLayout node inside the ScrollWindow, as in the
   prefab. → [components](components.md)

## Verify

Every button shows its own label (not "Text"), pinching it runs the function,
and the list starts at the top and scrolls inside the frame. →
[troubleshooting](troubleshooting.md)

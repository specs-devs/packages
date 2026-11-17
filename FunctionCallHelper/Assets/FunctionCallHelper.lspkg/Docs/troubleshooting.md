# FunctionCallHelper troubleshooting

[← Agent usage index](../README.md)

## Use when

Use this table for package-specific failures. Generic Lens scripting, UIKit
layout and SIK interaction issues belong to the relevant CLAD skill and to
those packages' own docs.

## Known limitations

| Symptom | Package cause | Package fix |
|---|---|---|
| Every button reads "Text" (the prefab placeholder) and the log shows `Text component not found on button child` | Older revisions labelled `getChild(0)`; UIKit buttons add their own visual child first. This revision labels the first direct child with a `Text` | Update to this revision. If it still happens, the prefab's `Text` is not a direct child of the button root: move it there |
| All buttons that target one script show the same label | Older revisions used the script's no-argument `getFunctionName()` for every one of its buttons. This revision labels each button with its own method name (split into words) when several entries share a script | Update to this revision. For custom per-function labels, declare `getFunctionName(functionName: string)` and switch on the name |
| Pinch logs `FunctionTriggerer: Function "x" not found on script component` | `functionName` misspelled, wrong case, or the method lives on a different component | Use the exact method name on the referenced component; the error lists the visible methods |
| Lens throws at start: `FunctionTriggerer: Button prefab is not assigned` / `Parent object is not assigned` | `buttonPrefab` / `parentObject` null at `OnStartEvent` | Wire both in the Inspector, or set them synchronously after `createComponent` |
| Changing `triggerableFunctions` at runtime adds/removes nothing | Buttons are built in `OnStartEvent` (or ScrollWindow init); assigning the array later does not rebuild by itself | Call `rebuild()` after changing the array: it destroys the buttons it created and builds the new list |
| Buttons pile at one point / don't lay out | No GridLayout found from `parentObject` upward, so no `GridItem` is added | Set `parentObject` to the GridLayout node (as in the prefab), or assign `gridLayout` |
| Buttons below the visible rows extend past the frame in an orthographic editor render | Editor render ignores ScrollWindow clipping | Not a bug: Preview and device clip correctly |
| Rows past the window cannot be reached | Scroll dimensions come from the grid `height`; without `overrideButtonSize` the grid keeps its authored height | Enable `overrideButtonSize` (the grid height is then computed from the button count) or size the grid yourself |
| First button hidden under the Frame title bar | `topPadding` too small | Increase `topPadding` (only applied with `overrideButtonSize`) |
| Button never reacts, log `Button component not found on button prefab…` then a component list | Prefab has no UIKit button (`Button`, `CapsuleButton`, `RectangleButton`, `RoundButton`) on its root or a direct child, and no other component with an `onTriggerUp` event on its root (fallback scan is root-only) | Put the UIKit button component on the prefab root |
| Status line sits above the field of view after adding the panel under a carousel or other lifted UI | The prefab is authored at `(0, 0, -60)` for a viewer at the origin | Lower the instance (the QA scene used `y = -12`) |

## Verification

After a fix, Preview with the SIK prefab, check every label, pinch every
button, and drag the list to the last row.

# FunctionCallHelper API status

[← Agent usage index](../README.md)

## Use when

Check this file before choosing a member or copying an older Function Call
Helper example. It is the compatibility index for the package revision that
contains it.

## Status meanings

- **Current** — recommended public surface for new work.
- **Deprecated** — still present; migrate to the named replacement.
- **Experimental** — public, but compatibility is not guaranteed.
- **Removed** — unavailable in this revision.
- **Internal** — resolvable implementation detail, not supported API.

## Current API

| Capability | Current surface |
|---|---|
| Panel component | `ButtonClickEvent` from `FunctionCallHelper.lspkg/FunctionCallHelper` |
| Function entry | `TriggerableFunction` (`@typedef`: `script: ScriptComponent`, `functionName: string`) |
| Configuration | `@input`s `triggerableFunctions`, `buttonPrefab`, `parentObject`, `scrollWindow`, `gridLayout`, `overrideButtonSize`, `buttonSize`, `topPadding`, `buttonSpacing`, `enableLogging`, `enableLoggingLifecycle` |
| Display name hook | optional `getFunctionName(functionName?: string): string` on the target script; receives the function name. A no-argument version is used only when the script backs one entry |
| Rebuild | `rebuild(): void` — destroys the created buttons and builds `triggerableFunctions` again |
| Ready-made panel | `FunctionCallHelper__PLACE_IN_SCENE.prefab` |
| Button template | `CapsuleButton.prefab` |
| Sample targets | `TestScript1` … `TestScript9` in `Examples/` |

Exact inputs, defaults and behavior are in [components.md](components.md).

## Deprecated

| Deprecated surface | Current replacement |
|---|---|
| `CapsuleButton.prefab` (built on UIKit `CapsuleButton`, which UIKit marks deprecated) | Still the shipped template. A prefab with the current UIKit `Button` is detected directly (root or direct child), like `CapsuleButton` / `RectangleButton` / `RoundButton`; check UIKit's own `Docs/api-status.md` |

## Experimental

No package API is designated Experimental in this revision.

## Removed

These were described by earlier READMEs and do not work in this revision:

| Removed / never-working surface | Replacement |
|---|---|
| Automatic scroll snap regions from GridLayout cell size | Configure `snapRegion` on the ScrollWindow in the Inspector if you need snapping |
| Initial scroll position "normalized Y = 1" | The list is aligned to the top and set to `scrollPositionNormalized = (0, 0)` (0 = top) |
| Multi-line PascalCase label splitting | Labels are set on a single line; `splitIntoLines` exists but is never called (Internal) |
| Updating the buttons just by re-assigning `triggerableFunctions` after start | Re-assign, then call `rebuild()` |
| A label that changes per call via `getFunctionName()` | Labels are read when buttons are built; call `rebuild()` to re-read them |

## Internal

Private, not supported API (they exist in the source but may change):
`createButton`, `invokeFunction`, `updateScrollDimensions`,
`createButtonsAndUpdateScroll`, `applyGridSizeOverride`, `applySizeOverride`,
`findButtonComponent`, `isScriptSharedByFunctions`, `beautifyFunctionName`,
`splitIntoLines`.

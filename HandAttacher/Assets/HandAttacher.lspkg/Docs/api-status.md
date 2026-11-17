# HandAttacher API status

[← Agent usage index](../README.md)

## Use when

Check this file before reusing an older Hand Attacher example. It describes
the package revision that contains it.

## Status meanings

- **Current** — recommended public surface for new work.
- **Deprecated** — still present; migrate to the named replacement.
- **Experimental** — public, but compatibility is not guaranteed.
- **Removed** — unavailable in this revision.
- **Internal** — resolvable but not supported API.

## Current API

| Capability | Current surface (`HandAttacher.lspkg/Scripts/HandAttacher`) |
|---|---|
| Attach to a joint | `HandAttacher` component; `@input`s `targetObject`, `handSide`, `handJoint` |
| Offsets | `positionOffset`, `rotationOffset`; `setPositionOffset(vec3)`, `setRotationOffset(vec3)` |
| Smoothing | `usePositionSmoothing`, `positionSmoothSpeed`, `useRotationSmoothing`, `rotationSmoothSpeed` |
| Partial follow | `enablePosition`, `enableRotation` |
| Visibility | `hideWhenNotTracked` |
| Runtime changes | `setHand(side)`, `setJoint(joint)`, `setTarget(obj)`, `refresh()` |
| Query | `isHandTracked()` |
| Value enums | `HandSide` (`Left`, `Right`, `Dominant`, `NonDominant`), `HandJoint` (25 members, see [components](components.md)) |
| Logging | `debugMode` (tracking found/lost lines), `enableLogging`, `enableLoggingLifecycle` |

## Deprecated

| Deprecated surface | Current replacement |
|---|---|
| `createComponent("Component.ScriptComponent") as HandAttacher` (older README) | `createComponent(HandAttacher.getTypeName())` |
| Import `HandAttacher.lspkg/HandAttacher` (older README) | `HandAttacher.lspkg/Scripts/HandAttacher` |

## Experimental

No surface is designated Experimental in this revision.

## Removed

| Removed surface | Replacement |
|---|---|
| `Scripts/GuideDismissPanel/GuideDismissPanel.ts` (old guide copy inside the package) | none; it was unused sample scaffolding |

## Internal

Private members (`currentHand`, `targetTransform`, `getJoint`, `updatePosition`,
`updateRotation`, `setupHandTracking`) and the decorated
`updateHandAttachment()` update hook are implementation details. Don't call
them.

## Notes for this revision

- The `HandJoint` enum has **25** members (wrist plus 4 thumb and 5 for each other
  finger), although older text says "26 joints".
- The prefab ships with `debugMode = true`, so the demo prints
  `Hand tracking started/stopped`.
- Upcoming: raw hand-joint data (what Hand Attacher reads) will require a
  one-time user permission in a future Specs OS release. The API surface here
  does not change; see the
  [README](../README.md#hand-tracking-permission-upcoming).

# MarkerTrackingHelper API status

[← Agent usage index](../README.md)

## Use when

Check this file before reusing an older Marker Tracking Helper example. It
describes the package revision that contains it (version: see `package.native`).

## Status meanings

- **Current** — recommended public surface for new work.
- **Deprecated** — still present; migrate to the named replacement.
- **Experimental** — public, but compatibility is not guaranteed.
- **Removed** — unavailable in this revision.
- **Internal** — resolvable but not supported API.

## Current API

| Capability | Current surface (prefix `MarkerTrackingHelper.lspkg/Scripts/`) |
|---|---|
| Content follows the marker | `SimpleImageTracking` + `MarkerTrackingHelper_Simple__PLACE_IN_SCENE.prefab` |
| Resize to marker + found/lost callbacks | `ImageTrackingController` (`resizeObjectArray`, `editEventCallbacks`, `onMarkerFoundFunctionNames`, `onMarkerLostFunctionNames`) + `MarkerTrackingHelper_ResizableWithCallbacks__PLACE_IN_SCENE.prefab` |
| Play an animated texture on found | `MarkerCallbacks.onMarkerFound()` / `onMarkerLost()` |
| Detach to the world after detection | `ExtendMarkerTrackingController` (`markerTrackingComponent`, `parentObject`) + `MarkerTrackingHelper_Extended__PLACE_IN_SCENE.prefab` |
| Helpers | `Utils.getRootCamera()`, `Utils.createMarkerCallback()`, `Utils.addMarkerFoundHandler()`, `Utils.addMarkerLostHandler()` |
| Marker definition | `Image Marker [EDIT_ME].imgmarker` (21 cm) |

## Deprecated

| Deprecated surface | Current replacement |
|---|---|
| `Utils.getRootCamera()` (kept "for backward compatibility" per its source comment) | Utilities' `ComponentUtils.getRootCamera()` (`Utilities.lspkg/Scripts/Utils/ComponentUtils`) |

## Experimental

No surface is designated Experimental in this revision.

## Removed

| Removed / never-shipped surface (older README) | Replacement |
|---|---|
| `createComponent("ExtendMarkerTrackingController")`, then assigning inputs | Use the Extended prefab, or add the component in the Inspector |
| `validateWorldTracking()` | None. The World-mode check is internal to `ExtendMarkerTrackingController.onAwake` and throws on failure |
| A multi-marker state-tracking API on `ImageTrackingController` | None. Use one prefab instance per marker ([guide](guide.md)) |
| `SimpleImageTracking` found/lost callbacks | `ImageTrackingController` callbacks |
| `Scripts/GuideDismissPanel/GuideDismissPanel.ts` (old guide copy) | none; it was unused sample scaffolding |

## Internal

The private callback inputs (`customFunctionScript`, `on*FunctionNames`) are
serialized Inspector fields. Set them in the Inspector, not from TS. The
`NewParent` object that the Extended controller creates is an implementation
detail.

## Notes for this revision

- The "thank you" animated texture atlas is now a PNG, so it renders in the
  desktop Preview as well as on device.
- The prefab mesh/material references and the marker texture were repaired in
  this revision. Re-instantiate older scene instances so they pick up the fixes.
- New `Utils.addMarkerFoundHandler()` / `addMarkerLostHandler()` chain a
  handler onto the tracker. The controllers use them, so handlers assigned
  before OnStart keep firing. Lost callback functions now receive `false`, and
  the Extended controller reuses one `NewParent` across detections.

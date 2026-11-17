# WebCapture API status

[← Agent usage index](../README.md)

## Use when

Read before reusing code written against another revision, or before depending on a surface that may
change. This is the first release (4.0.0, Lens Studio 5.25).

## Current (4.0.0)

| Surface | Notes |
|---|---|
| `WebCapture` component, inputs and methods in [components](components.md) | Stable |
| `WebCaptureTarget` component | Stable |
| `webcapture-scene/1` snapshot and `webcapture/1` recording | Stable; new optional fields may be added, readers ignore unknown fields |
| `edits` block | Written by the portal; fields may be added |
| Plugin HTTP API and Lens socket on ports 47790 / 47791 | Stable for this release |
| Snap Cloud RPCs in `setup.sql` | Stable; re-run `setup.sql` after updating the package |
| `CaptureRecorder`, `relativePose`, `cameraPose` | Public helpers |
| `CapturePanel` component | Stable; the one-button capture UI |
| Portal tabs Recordings / Edit / Schedule, output formats and the `edits` additions (`output`, `logo`, `device`, `hands`, `stab`) | Stable; fields may be added |

## Internal

| Surface | Notes |
|---|---|
| `LocalPortalTransport`, `SnapCloudTransport`, `OfflineTransport` | Used by `WebCapture`; constructing them yourself works but isn't a stable API |
| `NdkCamera`, `BackgroundRecorder` (`CaptureAssets`), `CameraCalibration` | Camera layer internals; the `video` recording fields (`webcapture/1` background) are the stable surface |
| `NDKCapture` layer API (`configureLayer`, `startLayer`, `streamLayer`) | Owned by the `NDKCapture` package; the AR layer's `arCameraPosition` 4 (capture camera) works on current firmware but is documented as unsupported there |
| Portal scheduler engine contract (`schedule`, `cancel`, `poll`) | New in 4.0.0; may change before it is declared stable |
| `Example/` scripts and assets | Demo scaffolding only |
| `WebCapturePortal/src/*` module exports | The portal's internals; `window.webcapture` is a test hook |

## Removed

Nothing (first release).

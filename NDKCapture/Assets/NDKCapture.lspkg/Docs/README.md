# NDK Capture

## What it is

A Spectacles package that streams and records a Lens as separate layers, built on SpecsNDK 1.1.0.
It bundles a native module, the `NDKCapture` component, a Lens Studio plugin and a browser Studio.

## What it does

- **Stream:** `camera`, `ar`, `ui` and `mic` layers go live to the NDK Capture Studio, which
  composites them. Every layer control in the Studio is applied to the running Lens.
- **Record:** the layers are recorded as separate tracks plus an `ndkcapture/1` manifest (initial
  settings, every live change, markers). On Specs: native NKC1 tracks and a `SpecsCapture` MP4 on
  the device too.
- **Edit later:** the Studio replays a recording, trims and cuts it, overrides any layer setting,
  adds markers and a title and exports WebM. Edits go in `edits.json`; tracks never change.

## Highlights

- Three independent `SpecsRecorder` sessions on Specs: natural video, the new AR-video stream type
  and the new audio stream type (SpecsNDK 1.1.0)
- Per-layer encoder settings (fps, bitrate, key-frame interval) and live bitrate / key-frame
  requests; per-layer composition (opacity, blend, order, position, scale, rotation)
- Editor backend so the whole loop works in Lens Studio Preview
- Self-contained Studio (static files) served by the plugin; nothing hosted outside your computer

## Core scripts

- `Scripts/NDKCapture.ts` — the component: layers, streaming, recording, markers, Studio commands
- `Scripts/NDKCaptureProtocol.ts` — layer ids, `LayerSettings`, the manifest and the messages
- `Scripts/NDKCaptureNativeModule.ts` — typed loader for `Modules/libNDKCaptureModule.so`
- `Scripts/StudioLink.ts` — the WebSocket to the plugin (reconnects every 3 s)

## Docs

See the list in the package [README](../README.md#package-docs-ship-in-docs).

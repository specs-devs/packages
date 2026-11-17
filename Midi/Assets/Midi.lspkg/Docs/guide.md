# Midi guide

[← Agent usage index](../README.md)

## Use when

Read retained installation and transport-contract guidance from the original README.

This guide preserves the original repository context. Installation/release status is not certified by source documentation. Repository tests live under Midi/test and are not shipped package components. Claims about the frozen real-device fixture are the existing source contract, not new hardware verification in this pass.

## Install

Install from the Lens Studio Asset Library: open the Asset Library, find `Midi`, and add it to your project. Pin a version by installing a specific one; the package version is the pin, and there is no folder to keep in sync.

Until the first Asset Library release actually lands, the interim path is to copy the `Midi.lspkg/` folder from this repo into your project's `Assets/` directory, taken at the git tag or commit you want to pin. Treat that as temporary: it is a hand-copy, which is the drift problem this package exists to remove. The referenced repository migration file is not part of this installed source revision; confirm release availability separately.

## Import

Import modules by the package-root path, including the `.lspkg` folder name (the standard Lens Studio package-import convention). Modules are grouped by role:

```ts
import { BleMidiTransport } from 'Midi.lspkg/Transports/BleMidiTransport'
import type { MidiTransport } from 'Midi.lspkg/Transports/MidiTransport'
import { MidiKind, midiNoteName } from 'Midi.lspkg/Core/MidiTypes'
```

## Modules

| Module | Purpose |
|--------|---------|
| `Core/MidiTypes` | `MidiKind`, `MidiMessage`, byte helpers, and `midiNoteName()` |
| `Core/MidiParser` | Incremental MIDI byte-stream parser (running status, realtime, SysEx) |
| `Transports/MidiTransport` | The `MidiTransport` interface and `BaseMidiTransport` (the seam every transport implements) |
| `Transports/BleMidiTransport` | BLE-MIDI de-framer plus a parallel timed channel (`onTimedMessage` / `feedPacketTimed`) |
| `Transports/MockMidiTransport` | Synthetic transport for Lens Studio Preview (no device needed) |
| `Timing/SourceClockUnwrapper` | 13-bit BLE-MIDI timestamp rollover unwrap |
| `Timing/ClockTracker` | BPM and beat derived from MIDI clock |
| `Examples/PianoVisualizer` | Attachable component: held keys on a BLE-MIDI keyboard scale the SceneObject |
| `Examples/MidiExamplesPanel` | UIKit demo panel: mock instrument, flashing pads, BPM readout, Start/Stop |

## Examples

Drop `Midi__PLACE_IN_SCENE.prefab` into the scene to get the guide, the example carousel and the demo panel; the panel builds its own UI (title, explanation text, pads, BPM / note readout, Start / Stop) at runtime. The panel runs entirely off `MockMidiTransport`, so it
plays in Lens Studio Preview with no hardware. The **core modules (`Core/`, `Transports/`, `Timing/`) import no
other package**. The optional `Examples/MidiExamplesPanel` imports SpectaclesUIKit, the
`Example/` demo scaffolding (guide and carousel) imports SpectaclesInteractionKit and
SpectaclesUIKit, and `Testing/` imports Leaf. The package itself still declares
SpectaclesInteractionKit, SpectaclesUIKit, Motion, Icons and Leaf in `package_dependencies.json`,
so they are installed with it.

## The transport seam

Every transport (Bluetooth today, a wired path later) implements the `MidiTransport` interface. A lens writes against that interface, so swapping or adding a transport does not change the lens. Device-specific quirks (a piano's channel layout, pedal behavior) stay in the consuming lens; this package only ever deals in standard MIDI.

## Behavior contract

The `test/` suite in this repo is the behavior contract. It runs on plain Node (>= 22, `node --experimental-strip-types`) with no build step and includes a frozen real-device capture fixture (`op1f-notes`, captured off a real OP-1 Field over BLE-MIDI on a Specs device). The de-framer's output must not change: if a change moves those fixture assertions, it is a regression, not a feature.

```bash
bash test/run.sh
```

## Versioning

Semver, chosen explicitly at release time rather than derived from anything else; the installed version is the Version field in `package.native`. SpectaclesInteractionKit is a declared dependency (`package_dependencies.json`) used only by the `Example/` demo scaffolding; the MIDI modules don't import it. Exports are filed under `release/ls-<version>/` to record which Lens Studio build produced each archive, and the version you install from the Asset Library is the semver. Release tooling is outside the installed package.

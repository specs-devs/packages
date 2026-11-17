<p align="center">
  <img src="Docs/media/Midi.png" width="250px" alt="Midi"/>
</p>

# Midi

Transport-agnostic TypeScript MIDI parser, BLE-MIDI de-framer and source-clock reconstruction for SPECS consumers. The core runs without SIK/UIKit or Bluetooth globals. The consuming Lens owns scanning, pairing and GATT notification/write integration; optional examples add a UIKit mock panel and a piano visualizer, and optional `Testing/` adds a LEAF interactor that drives MIDI into a lens under test.

## Usage

This section ships with the package and describes the exact installed revision. Generic Lens scripting, scene construction and SPECS spatial design are out of scope here; this package owns MIDI framing, events, timing and its consumer seam.

### Package identity

- Descriptor: `package.native`.
- Consumer imports: `Midi.lspkg/Core/`, `Midi.lspkg/Transports/`, `Midi.lspkg/Timing/`, and optional `Midi.lspkg/Examples/` and `Midi.lspkg/Testing/`.
- Mock demo prefab: `Midi.lspkg/Midi__PLACE_IN_SCENE.prefab`. It is self-contained: drop it into a SPECS scene (Camera + SIK) and you get the guide, the example carousel and the mock instrument.
- Demo scaffolding: `Midi.lspkg/Example/` holds `ExampleCarousel` and `GuideDismissPanel`. The prefab uses them to present the demo; Core, Transports, Timing and `Examples/` don't depend on them.
- Declared example companions: InteractionKit, UIKit, Motion and Icons. See `package_dependencies.json`. `Examples/MidiExamplesPanel` imports UIKit; the `Example/` scaffolding imports InteractionKit and UIKit. Core parser/transports/timing do not import these UI packages.
- Declared test dependency: Leaf, imported only by `Testing/`. Core parser/transports/timing do not import LEAF.

### Version and API status

Read [API status](Docs/api-status.md) for supported exports, internal-only helpers and exact timing semantics. The source descriptor does not establish Asset Library release availability.

### Applicability

Use the parser for a raw MIDI stream, BleMidiTransport for BLE-MIDI GATT payloads, MockMidiTransport for a hardware-free Preview, and `Testing/LeafMidiInteractor` to play exact notes, chords, pedal and clock into a lens from a LEAF scenario, with seeded jitter, drift, reorder and drop faults. Add a lens-side Bluetooth adapter for a real instrument; this package does not discover or connect to it.

### Package Docs (ship in Docs/)

- [Cheat sheet](Docs/cheat-sheet.md): read first for listener, transport and timing rules.
- [Components](Docs/components.md): read for every exported API and example input.
- [API status](Docs/api-status.md): read before using a transport or timing helper.
- [Examples](Docs/examples.md): read for mock, parser and timed-BLE consumers.
- [Troubleshooting](Docs/troubleshooting.md): read for missing notes, timing and connection assumptions.
- [Guide](Docs/guide.md): read for the retained source-contract and installation guidance.

### Verification

1. Compile the chosen module imports without requiring UIKit for core-only use.
2. Run the repository's `Midi/test/run.sh` for parser/framing fixtures after any behavior change.
3. In Preview, the prefab panel plays on its own (`autoStart`): pads flash, BPM (about 70) and last note update; Stop shows `BPM —` / `—`, Start resumes.
4. Feed a BLE notification fixture and compare onMessage with the timed feed path.
5. For `Testing/`, run a LEAF scenario that points the lens under test at `LeafMidiInteractor.transport`; `start()` throws if nothing is listening.
6. On device, verify the consuming Bluetooth adapter and notification/write path separately.

## Built with 👽 by the SPECS team

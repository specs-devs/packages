# Midi api-status

[← Agent usage index](../README.md)

## Use when

Check supported exports and implementation limits for this installed revision.

| Status | Surface | Evidence / limit |
| --- | --- | --- |
| Current | MidiKind/MidiMessage, byte-length helpers, midiNoteName | Core/MidiTypes; const values + union, optional fields by kind |
| Current | MidiParser | Incremental raw MIDI stream parsing, reset |
| Current | MidiTransport/BaseMidiTransport | Synchronous listeners, no unsubscribe |
| Current | BleMidiTransport | BLE framing, ordinary/timed feeds, outgoing sink; no hardware adapter |
| Current | MockMidiTransport | Deterministic clock/drum NoteOn generator; tick driven by consumer |
| Current | ClockTracker/SourceClockUnwrapper | 24PPQN/4-4 clock analysis and 13-bit millisecond unwrap |
| Current | MidiExamplesPanel/PianoVisualizer | Optional attachable examples |
| Current | LeafMidiInteractor/LeafMidiTransport/MidiEventBuilder | Optional `Testing/` for LEAF scenarios; requires Leaf. MidiEventBuilder is pure |
| Internal | isStatus/MPC_AKAI_SYSEX_ID | Exported for tests, explicitly not supported API |
| Deprecated | None declared | No aliases or migration removals claimed |
| Experimental | Device adapter integration | Supplied by consumer; not implemented by these transports |
| Demo scaffolding | `Example/GuideDismissPanel`, `Example/ExampleCarousel` | Present the demo inside `Midi__PLACE_IN_SCENE.prefab` (guide + carousel); not part of the MIDI API |

Verified in the Lens Studio Preview (2026-10-01): the prefab panel compiles and runs with no runtime errors; pads flash, BPM and last note update, Stop clears the readout and Start resumes. Not verified here: the `test/` suite run, a real BLE-MIDI device, `PianoVisualizer` and `feedPacketTimed` on device. The installed package excludes repository test/release machinery. SourceClockUnwrapper assumes monotonic local arrival timing accurate within half a wrap (4096ms); output is non-decreasing, seeded at the first counter value, not wall-clock time. ClockTracker assumes 4/4 because MIDI clock carries no meter.

# Midi

## What it is
A transport-agnostic TypeScript MIDI library for Specs Lenses: a raw MIDI stream parser, a BLE-MIDI de-framer and
source-clock reconstruction behind one transport interface. The core runs without Interaction Kit (SIK), UI Kit or
Bluetooth globals, so it is for developers who want to read a MIDI instrument (or a mock) inside a Lens. The consuming
Lens owns Bluetooth scanning, pairing and GATT notifications; this package does not connect to hardware.

## What it does
- **Parsing:** `MidiParser.feed()` turns raw MIDI bytes into `MidiMessage` objects (note on/off, CC, program change,
  pressure, pitch bend, SysEx, clock, start/stop/continue, song position), with running status across calls.
- **BLE-MIDI:** your Bluetooth adapter hands GATT payloads to `BleMidiTransport.feedPacket()` or `feedPacketTimed()`;
  it strips the BLE framing and delivers messages to `onMessage` listeners (and `onTimedMessage` with reconstructed
  source timestamps). `send()` / `sendSysEx()` produce framed packets for a write sink you supply.
- **Timing:** `SourceClockUnwrapper` unwraps the 13-bit BLE-MIDI timestamp into a monotonic millisecond timeline;
  `ClockTracker` derives tempo, beat and bar from a MIDI clock stream (24 PPQN, 4/4).
- **Mock:** `MockMidiTransport`, driven by `tick()` from your UpdateEvent, generates a clock and drum NoteOns through
  the same listener path, so a Lens can be built in the Lens Studio Preview with no instrument.
- **Demo:** the prefab's `MidiExamplesPanel` builds a UI Kit panel that plays the mock pattern on its own: pads flash on
  NoteOn, BPM and last note update live, and Start / Stop drive the transport.

## Highlights
- One `MidiTransport` seam, so the same `onMessage` handler works with the mock and a real BLE-MIDI keyboard.
- `MidiKind` is a const object plus a string-literal union, usable as both values and a type.
- Clear units: feed arrival in nanoseconds, source timestamps in milliseconds, `ClockTracker.handle` in seconds.
- `PianoVisualizer` shows a minimal real-keyboard consumer that takes raw GATT bytes.
- Optional `Testing/` (Leaf): `LeafMidiInteractor` plays notes, chords, pedal and clock into a Lens under test, with
  seeded jitter, drift, reorder and drop faults; `LeafMidiTransport` records what the Lens sends back.

## Core scripts
| Script | What it does |
|---|---|
| `Core/MidiTypes.ts` | `MidiKind`, `MidiMessage`, byte-length helpers and `midiNoteName()`. |
| `Core/MidiParser.ts` | Incremental raw MIDI parser (running status, realtime, SysEx). |
| `Transports/MidiTransport.ts` | The `MidiTransport` interface and `BaseMidiTransport` listener base. |
| `Transports/BleMidiTransport.ts` | BLE-MIDI de-framer with ordinary and timed feeds and an outgoing sink. |
| `Transports/MockMidiTransport.ts` | Hardware-free clock and drum generator for the Preview. |
| `Timing/SourceClockUnwrapper.ts` | Reconstructs a monotonic millisecond timeline from BLE timestamps. |
| `Timing/ClockTracker.ts` | Tempo, beat and bar estimation from MIDI clock. |
| `Examples/MidiExamplesPanel.ts` | The demo panel: mock transport, ClockTracker, flashing pads and Start / Stop. |
| `Examples/PianoVisualizer.ts` | Minimal BLE keyboard consumer fed with raw GATT packets. |
| `Testing/LeafMidiInteractor.ts` | Drives MIDI events and faults into a Lens from a Leaf scenario. |

## Extra info
- **Requires:** InteractionKit, UIKit, Motion, Icons (for the examples and demo scaffolding only) and Leaf (for
  `Testing/` only); `Core/`, `Transports/` and `Timing/` import none of them. A real instrument needs a Lens-side
  Bluetooth GATT adapter that you write; the mock demo runs in the Preview.
- **Get started:** drop `Midi__PLACE_IN_SCENE.prefab` into a Specs scene (Camera and SIK) for the mock instrument
  demo, or import `Midi.lspkg/Transports/BleMidiTransport` and feed it your GATT notifications.
- **More docs:**
  - [cheat-sheet.md](cheat-sheet.md) – listener, transport and timing rules, read first
  - [components.md](components.md) – every exported API and example input
  - [api-status.md](api-status.md) – supported exports, internal helpers and timing semantics
  - [examples.md](examples.md) – mock, parser and timed BLE consumers
  - [troubleshooting.md](troubleshooting.md) – missing notes, timing units and connection assumptions
  - [guide.md](guide.md) – install, import and module overview

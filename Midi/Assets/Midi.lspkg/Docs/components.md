# Midi components

[← Agent usage index](../README.md)

## Use when

Read the exact source surface before wiring a consumer or extending a transport.

The following inventory comes from every exported class/interface/function/value in this source revision. Private/protected implementation state is omitted. Private Inspector inputs, if any, remain listed. The two @internal MidiTypes exports are test helpers, not supported surface.

MidiExamplesPanel Inspector defaults: bpm=70, autoStart=true, accentColor=(0.45,0.9,0.55,1). PianoVisualizer has no Inspector inputs and accepts raw GATT bytes through onBlePacket.

## Core/MidiParser

Import `Midi.lspkg/Core/MidiParser`.

### MidiParser


Exact declarations (reference, not a runnable script):

```text
feed(bytes: number[] | Uint8Array): MidiMessage[]

reset(): void
```

## Core/MidiTypes

Import `Midi.lspkg/Core/MidiTypes`.

### Exported value

Source contract:

The message kinds this package emits, one per MIDI status it models.

 A const object plus a same-named string-literal union (below) rather than a TS
 `enum`, so a single `import { MidiKind } from 'Midi.lspkg/Core/MidiTypes'` gives you
 both the values and the type, and the module still runs under node's
 strip-only type mode, which rejects runtime enums. The values are plain
 strings, so comparing against `'noteOn'` directly also works.

Exact declarations (reference, not a runnable script):

```text
export const MidiKind = {
  NoteOff: "noteOff",
  NoteOn: "noteOn",
  PolyAftertouch: "polyAftertouch",
  ControlChange: "controlChange",
  ProgramChange: "programChange",
  ChannelPressure: "channelPressure",
  PitchBend: "pitchBend",
  SysEx: "sysEx",
  Clock: "clock", // 0xF8, 24 per quarter note
  Start: "start", // 0xFA
  Continue: "continue", // 0xFB
  Stop: "stop", // 0xFC
  SongPosition: "songPosition", // 0xF2
  Other: "other" // realtime/common we do not model explicitly
} as const
```

### MidiKind

Source contract:

Union of the {@link MidiKind} values, e.g. `'noteOn' | 'clock' | ...`.

Exact declarations (reference, not a runnable script):

```text
export type MidiKind = (typeof MidiKind)[keyof typeof MidiKind]
```

### MidiMessage

Source contract:

One parsed MIDI message. `kind` and `raw` are always set; which of the
 optional fields are populated depends on `kind`, and a field not listed for a
 kind is absent rather than zero:

 - `NoteOff`, `NoteOn`, `PolyAftertouch`, `ControlChange`: `channel`, `data1`, `data2`
 - `ProgramChange`, `ChannelPressure`: `channel`, `data1` (single-data-byte statuses)
 - `PitchBend`: `channel` and `bend`, never `data1`/`data2`
 - `SysEx`: `sysex` (and `raw` holds the same bytes)
 - `SongPosition`: `songPosition` only, no `channel`
 - `Clock`, `Start`, `Continue`, `Stop`: nothing beyond `kind` and a 1-byte `raw`
 - `Other`: nothing beyond `kind` and `raw` (unmodelled system-common such as
   0xF1/0xF3/0xF6, plus realtime bytes other than clock and transport)

 A Note On with velocity 0 is reported as `kind: NoteOff` with `data2 === 0`,
 the conventional running-note-off encoding, so consumers do not need to
 special-case it.

Exact declarations (reference, not a runnable script):

```text
kind: MidiKind

channel?: number

data1?: number

data2?: number

bend?: number

sysex?: number[]

songPosition?: number

raw: number[]
```

### Exported value

Source contract:

True for a status byte (bit 7 set, 0x80-0xFF).

 Note for BLE-MIDI callers: timestamp bytes also have bit 7 set, so inside a
 packet this predicate alone cannot tell status from timestamp. `BleMidiTransport`
 disambiguates using expected message lengths.

 @internal Exported for tests only. Nothing in this package calls it, so it is
 not part of the supported surface and may be removed without a major bump.

Exact declarations (reference, not a runnable script):

```text
export const isStatus = (b: number): boolean => b >= 0x80
```

### Exported value

Source contract:

True for a system-realtime status byte (0xF8-0xFF). These are single bytes
 that may appear anywhere, including between the bytes of another message and
 inside a SysEx frame, and they never disturb running status.

Exact declarations (reference, not a runnable script):

```text
export const isRealtime = (b: number): boolean => b >= 0xf8
```

### Exported value

Source contract:

True for a data byte (bit 7 clear, 0x00-0x7F).

Exact declarations (reference, not a runnable script):

```text
export const isDataByte = (b: number): boolean => b < 0x80
```

### channelVoiceDataLen

Source contract:

How many data bytes follow a channel-voice status byte, excluding the status
 byte itself. Keyed on the high nibble, so the channel (low nibble, 0-15) is
 ignored.

 @param status Status byte, e.g. 0x93 for note on channel 3.
 @returns 2 for note off/note on/poly aftertouch/control change/pitch bend, 1
 for program change and channel pressure, 0 for anything else (including
 system bytes 0xF0-0xFF, which this function does not describe).

Exact declarations (reference, not a runnable script):

```text
export function channelVoiceDataLen(status: number): number
```

### systemCommonDataLen

Source contract:

How many data bytes follow a system-common status byte, excluding the status
 byte itself. Matches the whole byte, not a nibble.

 @param status Status byte in the 0xF1-0xF7 range.
 @returns 2 for song position pointer (0xF2), 1 for MTC quarter frame (0xF1)
 and song select (0xF3), 0 for everything else. SysEx (0xF0/0xF7) and realtime
 (0xF8-0xFF) also return 0 because they are not fixed-length; handle those
 before calling this.

Exact declarations (reference, not a runnable script):

```text
export function systemCommonDataLen(status: number): number
```

### Exported value

Source contract:

Akai's MIDI manufacturer id, the first payload byte after 0xF0 in an Akai
 SysEx frame. Provided for consumers that route SysEx by vendor; nothing in
 this package matches on it.

 @internal Exported for tests only. No consumer in this package reads it, so
 it is not part of the supported surface and may be removed without a major
 bump. Promote it deliberately if a lens starts routing SysEx by vendor.

Exact declarations (reference, not a runnable script):

```text
export const MPC_AKAI_SYSEX_ID = 0x47
```

### Exported value

Source contract:

MIDI clock resolution: 24 clock pulses per quarter note (PPQN). `ClockTracker`
 uses it to turn clock arrival intervals into BPM and to derive beat and bar
 phase.

Exact declarations (reference, not a runnable script):

```text
export const CLOCKS_PER_QUARTER = 24
```

### midiNoteName

Source contract:

Formats a MIDI note number as a pitch name plus octave, e.g. 60 -> `"C4"` and
 54 -> `"F#3"`.

 Uses the convention where note 60 is middle C and is named C4, which puts the
 MIDI range at `"C-1"` (0) through `"G9"` (127); concert A (69) is `"A4"`.
 Accidentals are always spelled as sharps, never flats.

 @param note MIDI note number, normally 0-127.
 @returns Pitch name and octave. Never throws and never clamps: out-of-range
 input keeps counting in the same scheme, so 128 is `"G#9"` and -1 is `"B-2"`.

Exact declarations (reference, not a runnable script):

```text
export function midiNoteName(note: number): string
```

## Examples/MidiExamplesPanel

Import `Midi.lspkg/Examples/MidiExamplesPanel`.

### MidiExamplesPanel

Builds its whole UI at runtime in `onAwake()` on its own SceneObject: a `Component.Canvas`, a UIKit `BackPlate` sized from the content `FlexLayout`, the title, a short built-in explanation text, four pad dots (`note % 4`), a BPM / last-note row and Start / Stop UIKit `Button`s. It owns one `MockMidiTransport(bpm)` and a `ClockTracker` fed with `getTime()` seconds. `UpdateEvent` applies a changed `bpm` once, calls `tick(dt)` only while running, fades the pads and refreshes the readout. `startTransport()` / `stopTransport()` are idempotent public methods; `stopTransport()` also resets the note readout to `—`, and BPM shows `BPM —` whenever `ClockTracker.running` is false (after the mock's `Stop`). The prefab root `Midi__PLACE_IN_SCENE` is authored at (0, 0, −110); the panel sits in its `MidiExample` group (see [Prefab](#prefab-midiexamples__place_in_sceneprefab)).

Exact declarations (reference, not a runnable script):

```text
@ui.label("Midi Examples Panel")
  @ui.separator
  @ui.group_start("Settings")
  @input
  @hint("Tempo of the mock instrument, in beats per minute.")
  @widget(new SliderWidget(40, 200, 1))
  bpm: number = 70

@input
  @hint("Start the mock instrument automatically when the lens starts.")
  autoStart: boolean = true

@input
  @hint("Accent color used for pad flashes and the running-state highlight.")
  @widget(new ColorWidget())
  accentColor: vec4 = new vec4(0.45, 0.9, 0.55, 1)

onAwake()

startTransport(): void

stopTransport(): void
```

## Prefab: `Midi__PLACE_IN_SCENE.prefab`

Under the root (authored at (0, 0, −110)), in order:

- `Guide`: the overview panel with the "Ok, I understood" button, 10 cm in front of the root.
- `ExampleCarousel`: the carousel that frames the example (starts minimized; minimize toggles the info text). With a single example it shows no Previous / Next.
- `MidiExample`: the example group at (0, −15, 0), holding `MidiExamplesPanel`.

## Demo scaffolding (`Example/`)

These scripts ship in `Midi.lspkg/Example/` and are wired inside `Midi__PLACE_IN_SCENE.prefab`. They only present the demo; the MIDI modules don't need them.

| Object / script | Class | Key inputs |
|---|---|---|
| `Guide`: `Example/GuideDismissPanel/GuideDismissPanel.ts` | `GuideDismissPanel` | `hideUntilDismissed: SceneObject[]` lists the objects hidden until "Ok, I understood" is pressed (here: `ExampleCarousel` and `MidiExample`). `buttonLabel: string = "Ok, I understood"` is only used when the panel is built at runtime |
| `ExampleCarousel`: `Example/ExampleCarousel/ExampleCarousel.ts` | `ExampleCarousel` | `examples: SceneObject[]` (here `[MidiExample]`), `exampleInfo: string[]` (one line per example), `steps: SceneObject[]` (empty here), `stepInfo: string[]` (one line per `steps` entry; empty entries fall back to the example's info; empty here), `startIndex: number = 0`, `previousLabel` / `nextLabel`, `examplesPushBack: number = 20`, `anchorExamples: boolean = true`, `startMinimized: boolean` (true here), `extraPanelDrop: number = 0` |

Both inputs point at the example group rather than the prefab root, because hiding the root would also hide the guide and the carousel.

## Examples/PianoVisualizer

Import `Midi.lspkg/Examples/PianoVisualizer`.

### PianoVisualizer


Exact declarations (reference, not a runnable script):

```text
onAwake()

onBlePacket(bytes: Uint8Array)
```

## Testing/LeafMidiInteractor

Import `Midi.lspkg/Testing/LeafMidiInteractor`. Requires Leaf (declared dependency); for LEAF scenarios only.

### LeafMidiInteractor

Source contract:

Drives synthetic MIDI into a lens for LEAF scenarios, at the same seam a real
 transport feeds. Owns a LeafMidiTransport, exposed as .transport, that the
 lens consumes exactly like a real one. Detaches automatically when the
 scenario completes.

 `start()` throws if nothing is consuming `.transport`, since events delivered
 to no listener would make a scenario pass without testing anything. Every
 emitter is a no-op after `detach()`, and `detach()` delivers a Note Off for
 every note still held.

Exact declarations (reference, not a runnable script):

```text
constructor(options?: LeafMidiInteractorOptions)

readonly transport: LeafMidiTransport

start(): void

stop(): void

noteOn(note: number, velocity?: number): void

noteOff(note: number, velocity = 0): void

note(note: number, durationMs = 100, velocity?: number): Promise<void>

chord(notes: number[], velocity?: number): void

controlChange(cc: number, value: number): void

pedal(down: boolean): void

clock(): void

play(events: TimedEvent[], fault?: FaultConfig): Promise<void>

detach(): void
```

### LeafMidiInteractorOptions

```text
channel?: number          // default MIDI channel 0-15; default 0
defaultVelocity?: number  // default Note On velocity 0-127; default 100
fault?: FaultConfig       // default faults for play(); a per-call fault wins
```

## Testing/LeafMidiTransport

Import `Midi.lspkg/Testing/LeafMidiTransport` (also re-exported by `Testing/LeafMidiInteractor`).

### LeafMidiTransport

Source contract:

A MidiTransport that LeafMidiInteractor drives directly. The lens under test
 consumes it exactly like a real transport, while the interactor injects
 events through deliver(). Outbound send()/sendSysEx() are recorded so a
 scenario can assert what the lens sent back to the instrument.

 Delivery walks the live listener list, as BaseMidiTransport does: a listener
 registered during delivery also receives the message in flight.

Exact declarations (reference, not a runnable script):

```text
readonly sent: number[][]

onMessage(listener: MidiListener): void

deliver(msg: MidiMessage): void

send(bytes: number[]): void

sendSysEx(payload: number[]): void

start(): void

stop(): void

get connected(): boolean

get listenerCount(): number
```

## Testing/MidiEventBuilder

Import `Midi.lspkg/Testing/MidiEventBuilder` (also re-exported by `Testing/LeafMidiInteractor`). Pure; no LEAF or Lens Studio dependency.

Source contract:

Message builders return a MidiMessage with both the parsed fields and the
 exact raw bytes. applyFaults() perturbs a schedule with seeded jitter, drift,
 adjacent-pair reordering and drops; the same seed and input give the same
 output. With no fault config it returns a stable copy sorted by time, and it
 never mutates its input.

Exact declarations (reference, not a runnable script):

```text
noteOnMessage(note: number, velocity = 100, channel = 0): MidiMessage

noteOffMessage(note: number, velocity = 0, channel = 0): MidiMessage

controlChangeMessage(cc: number, value: number, channel = 0): MidiMessage

sustainPedalMessage(down: boolean, channel = 0): MidiMessage

clockMessage(): MidiMessage

applyFaults(events: TimedEvent[], fault?: FaultConfig): TimedEvent[]

interface TimedEvent { atMs: number; msg: MidiMessage }

interface FaultConfig { jitterMs?: number; driftPpm?: number; reorderProbability?: number; dropProbability?: number; seed?: number }
```

## Timing/ClockTracker

Import `Midi.lspkg/Timing/ClockTracker`.

### ClockTracker

Source contract:

Derives musical time from a MIDI clock stream: a tempo estimate plus beat and
 bar position. Driven entirely by {@link ClockTracker.handle}.

 Assumes {@link CLOCKS_PER_QUARTER} (24) pulses per quarter note and a 4/4 bar,
 since a MIDI clock stream carries no meter.

Exact declarations (reference, not a runnable script):

```text
constructor()

get running(): boolean

get tickCount(): number

get bpm(): number

get quarterPhase(): number

get beatInBar(): number

get barPhase(): number

handle(msg: MidiMessage, nowSec: number): void

reset(): void
```

## Timing/SourceClockUnwrapper

Import `Midi.lspkg/Timing/SourceClockUnwrapper`.

### SourceClockUnwrapper

Source contract:

Reconstructs a monotonic, unbounded millisecond timeline from the 13-bit
 BLE-MIDI timestamp, which wraps every 8192 ms. No musical analysis: that is
 {@link ClockTracker}'s job.

 Keep one instance per BLE connection, and call {@link reset} on disconnect.
 The timeline is seeded on the first call, so only differences between returned
 values are meaningful.

Exact declarations (reference, not a runnable script):

```text
unwrap(raw13: number, arrivalMs: number): number

reset(): void
```

## Transports/BleMidiTransport

Import `Midi.lspkg/Transports/BleMidiTransport`.

### BleWriteFn

Source contract:

Sink for outbound BLE-MIDI packets: write these bytes to the peripheral's MIDI
 GATT characteristic. Pass one to the {@link BleMidiTransport} constructor.

 Called synchronously from `send()` and `sendSysEx()`, once per call, with a
 fully framed packet (header byte, timestamp byte, then the MIDI message) and
 never with a bare MIDI message. Neither caller checks `connected` first, so
 guard on your side if a write before `start()` or after `stop()` matters.

 @param packet Framed packet bytes, each 0-255.

Exact declarations (reference, not a runnable script):

```text
export type BleWriteFn = (packet: number[]) => void
```

### TimedMidiListener

Source contract:

Listener for the timed channel: a parsed message plus its reconstructed source
 timing. Register with `onTimedMessage()`; only `feedPacketTimed()` drives it.

 @param msg The same {@link MidiMessage} object already handed to the
 `onMessage()` listeners.
 @param sourceMs The sender's own BLE-MIDI timestamp in milliseconds, unwrapped
 past the 13-bit counter's 8192 ms rollover. This is the timestamp of the frame
 that actually carried `msg`, never a neighbouring message's: a message is only
 ever paired with the timestamp of the frame it came out of. Monotonic within a
 connection and anchored at the first message's counter reading, so it is an
 elapsed offset rather than a wall clock, and `reset()` restarts it.
 @param arrivalNs The `arrivalNs` argument of the `feedPacketTimed()` call that
 produced this message, forwarded unchanged: nanoseconds on the local receive
 clock, shared by every message that arrived in the same packet.

Exact declarations (reference, not a runnable script):

```text
export type TimedMidiListener = (msg: MidiMessage, sourceMs: number, arrivalNs: number) => void
```

### BleMidiTransport

Source contract:

BLE-MIDI de-framer. Strips the BLE-MIDI framing off a GATT characteristic
 value and runs the recovered bytes through {@link MidiParser}, which owns every
 MIDI-level rule; this class only handles the framing. It implements the
 `MidiTransport` seam, so a lens written against that interface is unchanged
 when this replaces `MockMidiTransport`.

 Typical use from a lens-side Bluetooth adapter: construct with a write sink,
 register `onMessage()`, call `start()`, then call `feedPacket()` for every GATT
 notification and `stop()` on disconnect. Feeding does not require `start()`;
 `connected` is reported state, not a gate. Nothing here touches a Lens Studio
 global, so it also runs under plain node.

 Framing rules worth knowing as a caller:

 - A packet starts with a header byte that has bit 7 set. A packet whose first
   byte has bit 7 clear is not BLE-MIDI and is rejected whole, as is any packet
   shorter than 2 bytes.
 - Each message in a packet is preceded by a timestamp byte, which also has bit
   7 set. A timestamp byte whose low 7 bits are 0x77 is itself 0xF7 and is read
   as a timestamp, not as end-of-SysEx.
 - Running status does not carry across packets: a packet whose first message
   omits its status byte is dropped. Within one packet it does apply, including
   the chord encoding where later notes reuse both the status byte and the
   preceding timestamp.
 - A SysEx frame can span packets, so an unterminated one persists as instance
   state. It aborts on the next well-formed non-realtime status byte instead of
   waiting indefinitely for a literal 0xF7. Realtime bytes (0xF8-0xFF)
   interleaved inside it pass through as their own messages and do not abort it.

Exact declarations (reference, not a runnable script):

```text
constructor(write: BleWriteFn = () => {})

start(): void

stop(): void

reset(): void

feedPacket(packet: number[] | Uint8Array): void

onTimedMessage(listener: TimedMidiListener): void

feedPacketTimed(packet: number[] | Uint8Array, arrivalNs: number): void

send(bytes: number[]): void

sendSysEx(payload: number[]): void
```

## Transports/MidiTransport

Import `Midi.lspkg/Transports/MidiTransport`.

### MidiListener

Source contract:

Callback for one inbound message, registered with {@link MidiTransport.onMessage}.
 Called once per message, in arrival order, synchronously while the transport
 decodes.

Exact declarations (reference, not a runnable script):

```text
export type MidiListener = (msg: MidiMessage) => void
```

### MidiTransport

Source contract:

The seam a lens reads MIDI through, so the source can change without the lens
 changing. Extend {@link BaseMidiTransport} to implement it and only `send`,
 `sendSysEx`, `start` and `stop` are left to supply.

 How bytes get *in* is outside the seam, since it differs per link. Inbound is
 listener-driven; outbound is `send`/`sendSysEx`. A consumer gets fully parsed
 {@link MidiMessage} values, one listener call each, and must not assume the
 transport can transmit: a receive-only transport may no-op both send methods.

Exact declarations (reference, not a runnable script):

```text
onMessage(listener: MidiListener): void

send(bytes: number[]): void

sendSysEx(payload: number[]): void

start(): void

stop(): void

readonly connected: boolean
```

### BaseMidiTransport

Source contract:

Shared base for {@link MidiTransport} implementations. Supplies the listener
 registry, the `connected` getter over the protected `isConnected` flag, and the
 protected {@link BaseMidiTransport.emit} a subclass calls per decoded message.

 Listener semantics a subclass inherits: delivery is synchronous and in
 registration order, on the stack of whatever called `emit()`. The list is live
 rather than snapshotted, so a listener registering during delivery also
 receives the message being delivered. Exceptions are not caught, so a throwing
 listener stops those after it and propagates out of the feed call.

Exact declarations (reference, not a runnable script):

```text
onMessage(listener: MidiListener): void

get connected(): boolean

abstract send(bytes: number[]): void

abstract sendSysEx(payload: number[]): void

abstract start(): void

abstract stop(): void
```

## Transports/MockMidiTransport

Import `Midi.lspkg/Transports/MockMidiTransport`.

### MockMidiTransport

Source contract:

Synthetic transport for building and demoing a lens in Lens Studio Preview with
 no instrument attached. Drive {@link tick} from the lens UpdateEvent and it
 generates a MIDI clock plus pad hits through the same {@link BaseMidiTransport}
 listener path a real device uses. It receives only, so `send()` and
 `sendSysEx()` are no-ops.

 Once {@link start} has run it emits, per {@link MidiKind}:
 - `Start` (raw `[0xFA]`) on `start()` and `Stop` (raw `[0xFC]`) on `stop()`.
 - `Clock` (raw `[0xF8]`) at 24 pulses per quarter note for the current BPM.
 - `NoteOn` on every 12th clock, that is every eighth note: channel 9 (the
   drum channel, 0-based), `data1` note 36-51 (the 16 MPC bank-A pads), `data2`
   velocity 80-127. No `NoteOff` is ever emitted, so a consumer that needs note
   length has to decide it itself.

 Pad choice and velocity come from a fixed-seed generator rather than
 `Math.random`, so the same BPM and the same sequence of `tick()` deltas give
 byte-identical output every run, which is what makes a preview repeatable.

Exact declarations (reference, not a runnable script):

```text
constructor(bpm = 120)

start(): void

stop(): void

setBpm(bpm: number): void

tick(dt: number): void

send(_bytes: number[]): void

sendSysEx(_payload: number[]): void
```

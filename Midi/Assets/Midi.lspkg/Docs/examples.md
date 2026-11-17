# Midi examples

[← Agent usage index](../README.md)

## Use when

Use mock MIDI, parse bytes or wire a timed BLE notification without inventing a hardware connection.

## Hardware-free mock

```typescript
import {MockMidiTransport} from "Midi.lspkg/Transports/MockMidiTransport"
import {MidiKind, midiNoteName} from "Midi.lspkg/Core/MidiTypes"

@component
export class MockMidiNotes extends BaseScriptComponent {
  private midi = new MockMidiTransport(120)
  onAwake(): void {
    this.midi.onMessage((msg) => {
      if (msg.kind === MidiKind.NoteOn && msg.data1 !== undefined) print(midiNoteName(msg.data1))
    })
    this.createEvent("OnStartEvent").bind(() => this.midi.start())
    this.createEvent("UpdateEvent").bind(() => this.midi.tick(getDeltaTime()))
    this.createEvent("OnDestroyEvent").bind(() => this.midi.stop())
  }
}
```

## Raw MIDI parser

```typescript
import {MidiParser} from "Midi.lspkg/Core/MidiParser"
const messages = new MidiParser().feed([0x90, 60, 100, 60, 0])
// NoteOn C4 then velocity-zero NoteOff via running status.
```

## Timed BLE seam

```typescript
import {BleMidiTransport} from "Midi.lspkg/Transports/BleMidiTransport"
const midi = new BleMidiTransport()
midi.onMessage((msg) => print(msg.kind))
midi.onTimedMessage((msg, sourceMs, arrivalNs) => print(`${msg.kind} source=${sourceMs}ms arrival=${arrivalNs}ns`))
midi.start()
function onGattNotification(bytes: Uint8Array): void {
  midi.feedPacketTimed(bytes, getRealTimeNanos())
}
// The Lens-owned Bluetooth adapter calls onGattNotification. This does not connect hardware.
```

Drag `Midi.lspkg/Midi__PLACE_IN_SCENE.prefab` for the UIKit mock instrument. To drive its public buttons from code, wire MidiExamplesPanel and call startTransport()/stopTransport() after OnAwake creates the transport. Its panel builds its own UI in `onAwake()`, including a short built-in explanation text. The prefab also carries the `Guide` and the `ExampleCarousel` (scripts in `Example/`); see [components](components.md#prefab-midiexamples__place_in_sceneprefab).

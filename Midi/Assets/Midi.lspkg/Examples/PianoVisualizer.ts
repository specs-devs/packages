// PianoVisualizer — minimal end-to-end consumer example for Midi.lspkg.
//
// Product setup: pair a BLE-MIDI keyboard (Korg microKEY Air, CME Xkey Air,
// Teenage Engineering OP-1 Field, ...) with the Specs device. You play keys;
// the SceneObject this component sits on grows with how many keys are held.
//
// The package does NOT scan or pair — the lens owns the Bluetooth link and
// hands raw GATT packets to feedPacket(). Everything below that line
// (de-framing, running status, timestamps) is the package's job.
import {BleMidiTransport} from "../Transports/BleMidiTransport"
import {MidiKind, midiNoteName} from "../Core/MidiTypes"
import type {MidiMessage} from "../Core/MidiTypes"

@component
export class PianoVisualizer extends BaseScriptComponent {
  private midi: BleMidiTransport = new BleMidiTransport()
  private held: Set<number> = new Set<number>() // note numbers currently pressed

  onAwake() {
    // React to what the keyboard plays. Register before start().
    this.midi.onMessage((msg: MidiMessage) => {
      /* data1 and data2 are optional on MidiMessage, since realtime and SysEx
         kinds carry neither. Bail once rather than asserting at each use. */
      if (msg.data1 === undefined) {
        return
      }
      if (msg.kind === MidiKind.NoteOn) {
        // A key went down. data1 = which key, data2 = velocity. A velocity-0
        // note-on is already normalized to NoteOff by the parser.
        this.held.add(msg.data1)
        print(`down ${midiNoteName(msg.data1)} vel ${msg.data2 ?? 0}`)
      } else if (msg.kind === MidiKind.NoteOff) {
        this.held.delete(msg.data1)
      }
    })

    this.midi.start()

    // Size the object by how many keys are held: 1 key -> 1.3x, 4-chord -> 2.2x.
    this.createEvent("UpdateEvent").bind(() => {
      const s = 1 + this.held.size * 0.3
      this.getTransform().setLocalScale(new vec3(s, s, s))
    })
  }

  // The one seam the lens owns: your Bluetooth adapter connects to the
  // keyboard's BLE-MIDI GATT characteristic and forwards each notification
  // payload here, unmodified.
  onBlePacket(bytes: Uint8Array) {
    this.midi.feedPacket(bytes)
  }
}

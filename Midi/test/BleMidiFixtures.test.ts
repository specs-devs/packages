// BLE-MIDI real-capture replay regression.
//   node --experimental-strip-types --import ./_register.mjs BleMidiFixtures.test.ts
//
// Replays real GATT characteristic notifications captured on-device from a
// Teenage Engineering OP-1 Field (2026-08-05, lens/captures/) through
// BleMidiTransport and asserts the de-framed events. This closes the honest
// caveat that the other de-framer tests are synthetic: these are the exact
// bytes a real Spectacles BLE stack delivered.
//
// The expected sequence (fixtures/op1f-notes.ts, OP1F_EXPECTED) is produced by
// an INDEPENDENT spec deframer, so a pass means BleMidiTransport agrees with a
// second implementation on real bytes, not merely with itself. A few packets
// are additionally decoded by hand inline (test 4) as a human-independent
// anchor against a shared-bug false pass.
//
// Phase 1 asserts note/velocity/CC identity and framing only. It deliberately
// does NOT assert timestamp accuracy or reconstructed source timing (Phase 2 /
// TIME-01).
//
// Coverage boundary of THIS real capture (free playing on an OP-1 Field): every
// packet is a single channel-voice message with an explicit status byte, so it
// exercises the common note path only. It does NOT exercise within-notification
// running status, multiple MIDI messages packed into one notification, note-on
// velocity 0 used as note-off, Control Change, realtime, or SysEx. Those framing
// paths are covered by the synthetic vectors in BleMidiTransport.test.ts and
// remain real-data-unverified until a capture containing them exists.

import {BleMidiTransport} from "../Assets/Midi.lspkg/Transports/BleMidiTransport"
import {MidiKind} from "../Assets/Midi.lspkg/Core/MidiTypes"
import type {MidiMessage} from "../Assets/Midi.lspkg/Core/MidiTypes"
import {OP1F_NOTE_PACKETS, OP1F_EXPECTED, OP1F_STATS} from "./fixtures/op1f-notes"

let passed = 0
let failed = 0
function eq(a: unknown, e: unknown, label: string): void {
  if (JSON.stringify(a) === JSON.stringify(e)) passed++
  else {
    failed++
    console.error(`FAIL ${label}\n  exp ${JSON.stringify(e)}\n  got ${JSON.stringify(a)}`)
  }
}

// Replay a full packet sequence through one fresh transport (as the lens does:
// one BleMidiTransport for the connection, packets fed in arrival order).
function replay(packets: number[][]): MidiMessage[] {
  const msgs: MidiMessage[] = []
  const t = new BleMidiTransport()
  t.onMessage((m) => msgs.push(m))
  t.start()
  for (const p of packets) t.feedPacket(p)
  return msgs
}

const KIND: Record<string, string> = {
  on: MidiKind.NoteOn,
  off: MidiKind.NoteOff,
  cc: MidiKind.ControlChange
}

// 1. Full replay agrees with the independent spec decode, event for event.
//    Equal length proves each captured packet produced exactly one message on
//    the real stream (no drops, merges, or duplicates).
{
  const msgs = replay(OP1F_NOTE_PACKETS)
  eq(msgs.length, OP1F_EXPECTED.length, "fixture replay message count")
  const got = msgs.map((m) => ({kind: m.kind, channel: m.channel, data1: m.data1, data2: m.data2}))
  const exp = OP1F_EXPECTED.map((e) => ({kind: KIND[e.kind], channel: e.channel, data1: e.data1, data2: e.data2}))
  eq(got, exp, "fixture replay full event sequence")
}

// 2. Structural invariants of the real capture (channel-0 note play, fixed
//    velocity from this instrument, notes within the played range).
{
  const msgs = replay(OP1F_NOTE_PACKETS)
  eq(
    msgs.every((m) => m.kind === MidiKind.NoteOn || m.kind === MidiKind.NoteOff),
    true,
    "only note on/off"
  )
  eq(
    msgs.every((m) => m.channel === 0),
    true,
    "all channel 0"
  )
  eq(
    msgs.every((m) => m.data1 !== undefined && m.data1 >= OP1F_STATS.noteMin && m.data1 <= OP1F_STATS.noteMax),
    true,
    "notes in captured range"
  )
  eq(
    msgs.filter((m) => m.kind === MidiKind.NoteOn).every((m) => m.data2 === 127),
    true,
    "note-on velocity 127"
  )
  eq(
    msgs.filter((m) => m.kind === MidiKind.NoteOff).every((m) => m.data2 === 0),
    true,
    "note-off velocity 0"
  )
  eq(msgs.filter((m) => m.kind === MidiKind.NoteOn).length, OP1F_STATS.noteOn, "note-on count")
  eq(msgs.filter((m) => m.kind === MidiKind.NoteOff).length, OP1F_STATS.noteOff, "note-off count")
}

// 3. First three real packets: three consecutive note-ons (71, 69, 65) with no
//    interleaved note-off, the start of a played cluster. NOTE: these are three
//    SEPARATE single-message packets and the de-framer does no voice tracking
//    (polyphony is the consumer's concern), so this asserts per-packet note-on
//    decode and order, not any de-framer overlap logic.
{
  const msgs = replay(OP1F_NOTE_PACKETS.slice(0, 3))
  eq(msgs.length, 3, "first three note-ons: count")
  eq(
    msgs.every((m) => m.kind === MidiKind.NoteOn),
    true,
    "first three note-ons: all on"
  )
  eq(
    msgs.map((m) => m.data1),
    [71, 69, 65],
    "first three note-ons: notes (G4, A4, F4)"
  )
}

// 4. Hand-decoded spot checks. Decoded here directly from the BLE-MIDI spec,
//    independent of the generated fixture: drop the header byte, drop the
//    per-message timestamp byte (bit 7 set), and the remaining status + data
//    is the MIDI message. Guards against a shared bug between the generator's
//    decoder and BleMidiTransport.
{
  // [0x97, 0x9a, 0x90, 0x47, 0x7f] = header, timestamp, NoteOn ch0 note 0x47 (71) vel 0x7f (127)
  const msgs = replay([[0x97, 0x9a, 0x90, 0x47, 0x7f]])
  eq(
    [msgs[0].kind, msgs[0].channel, msgs[0].data1, msgs[0].data2],
    [MidiKind.NoteOn, 0, 71, 127],
    "spot NoteOn 71 vel 127"
  )
}
{
  // [0x99, 0xa0, 0x80, 0x47, 0x00] = header, timestamp, NoteOff ch0 note 0x47 (71) vel 0
  const msgs = replay([[0x99, 0xa0, 0x80, 0x47, 0x00]])
  eq([msgs[0].kind, msgs[0].channel, msgs[0].data1, msgs[0].data2], [MidiKind.NoteOff, 0, 71, 0], "spot NoteOff 71")
}

console.log(`\n${passed} passed, ${failed} failed`)
process.exit(failed === 0 ? 0 : 1)

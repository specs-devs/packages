// Parser unit tests. Run:
//   node --experimental-strip-types --import ./_register.mjs MidiParser.test.ts
// (from this test/ directory)

import {MidiParser} from "../Assets/Midi.lspkg/Core/MidiParser"
import {MidiKind} from "../Assets/Midi.lspkg/Core/MidiTypes"

let passed = 0
let failed = 0

function eq(actual: unknown, expected: unknown, label: string): void {
  const a = JSON.stringify(actual)
  const e = JSON.stringify(expected)
  if (a === e) {
    passed++
  } else {
    failed++
    console.error(`FAIL ${label}\n  expected ${e}\n  actual   ${a}`)
  }
}

function kinds(msgs: {kind: MidiKind}[]): MidiKind[] {
  return msgs.map((m) => m.kind)
}

// 1. Basic note on
{
  const p = new MidiParser()
  const m = p.feed([0x90, 60, 100])
  eq(m.length, 1, "noteOn count")
  eq(m[0].kind, MidiKind.NoteOn, "noteOn kind")
  eq([m[0].channel, m[0].data1, m[0].data2], [0, 60, 100], "noteOn fields")
}

// 2. Note-on velocity 0 is a note-off
{
  const p = new MidiParser()
  const m = p.feed([0x91, 62, 0])
  eq(m[0].kind, MidiKind.NoteOff, "vel0 -> noteOff")
  eq(m[0].channel, 1, "vel0 channel")
}

// 3. Running status: three note-ons under one 0x90
{
  const p = new MidiParser()
  const m = p.feed([0x90, 60, 100, 62, 90, 64, 80])
  eq(m.length, 3, "running status count")
  eq(kinds(m), [MidiKind.NoteOn, MidiKind.NoteOn, MidiKind.NoteOn], "running status kinds")
  eq([m[2].data1, m[2].data2], [64, 80], "running status third note")
}

// 4. Realtime clock interleaved mid-message must not corrupt the note
{
  const p = new MidiParser()
  const m = p.feed([0x90, 60, 0xf8, 100])
  eq(kinds(m), [MidiKind.Clock, MidiKind.NoteOn], "clock mid-message order")
  eq([m[1].data1, m[1].data2], [60, 100], "note survives interleaved clock")
}

// 5. Control change + program change (1 data byte) + running status
{
  const p = new MidiParser()
  const cc = p.feed([0xb0, 7, 127])
  eq(cc[0].kind, MidiKind.ControlChange, "cc kind")
  const pc = p.feed([0xc0, 5, 6])
  eq(pc.length, 2, "program change running status count")
  eq([pc[0].kind, pc[0].data1], [MidiKind.ProgramChange, 5], "pc first")
  eq([pc[1].kind, pc[1].data1], [MidiKind.ProgramChange, 6], "pc running status")
}

// 6. Transport realtime messages
{
  const p = new MidiParser()
  const m = p.feed([0xfa, 0xf8, 0xfc])
  eq(kinds(m), [MidiKind.Start, MidiKind.Clock, MidiKind.Stop], "transport realtime")
}

// 7. SysEx single chunk with interleaved clock
{
  const p = new MidiParser()
  const m = p.feed([0xf0, 0x47, 0x01, 0xf8, 0x02, 0xf7])
  eq(kinds(m), [MidiKind.Clock, MidiKind.SysEx], "sysex + interleaved clock")
  eq(m[1].sysex, [0xf0, 0x47, 0x01, 0x02, 0xf7], "sysex bytes exclude realtime")
}

// 8. SysEx split across feeds
{
  const p = new MidiParser()
  const a = p.feed([0xf0, 0x47, 0x10])
  eq(a.length, 0, "sysex partial yields nothing")
  const b = p.feed([0x11, 0x12, 0xf7])
  eq(b.length, 1, "sysex completes on second chunk")
  eq(b[0].sysex, [0xf0, 0x47, 0x10, 0x11, 0x12, 0xf7], "sysex reassembled")
}

// 9. Pitch bend center and full
{
  const p = new MidiParser()
  const center = p.feed([0xe0, 0, 64]) // 0x2000 -> 0
  eq(center[0].bend, 0, "pitchbend center")
  const max = p.feed([0xe0, 127, 127]) // 0x3FFF -> 8191
  eq(max[0].bend, 8191, "pitchbend max")
}

// 10. Song position pointer (14-bit)
{
  const p = new MidiParser()
  const m = p.feed([0xf2, 0x00, 0x08]) // 8 << 7 = 1024
  eq([m[0].kind, m[0].songPosition], [MidiKind.SongPosition, 1024], "song position")
}

// 11. System-common (tune request) emits once and clears running status,
// so the trailing data bytes are dropped rather than forming a note.
{
  const p = new MidiParser()
  p.feed([0x90, 60, 100]) // arm running status
  const m = p.feed([0xf6, 62, 63]) // tune request (Other); 62,63 become stray
  eq(m.length, 1, "tune request emits exactly one message")
  eq(m[0].kind, MidiKind.Other, "tune request kind Other")
}

// 12. A full bar of clock produces 24 clock ticks per quarter
{
  const p = new MidiParser()
  const ticks = new Array(24).fill(0xf8)
  const m = p.feed(ticks)
  eq(m.length, 24, "clock tick count")
  eq(
    m.every((x) => x.kind === MidiKind.Clock),
    true,
    "all clock"
  )
}

// 28. An unterminated SysEx must not buffer without limit. A device that never
//     sends F7, or one glitching bit 7 low, would otherwise grow the buffer for
//     as long as it streams.
{
  const p = new MidiParser()
  p.feed([0xf0])
  for (let i = 0; i < 5; i++) {
    p.feed(new Array(20000).fill(0x01))
  }
  const buffered = (p as unknown as {sysex: number[]}).sysex.length
  eq(buffered <= 65536, true, `unterminated sysex is capped (buffered ${buffered})`)

  // Past the cap the frame is abandoned, not emitted truncated.
  const closed = p.feed([0xf7])
  eq(closed.length, 0, 'overflowed sysex frame is dropped rather than emitted short')

  // A normal frame after the overflow still parses.
  const good = p.feed([0xf0, 0x7e, 0x01, 0xf7])
  eq(kinds(good), [MidiKind.SysEx], 'parser recovers for the next sysex frame')
}

console.log(`\n${passed} passed, ${failed} failed`)
process.exit(failed === 0 ? 0 : 1)

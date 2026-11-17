// BLE-MIDI de-framing tests.
//   node --experimental-strip-types --import ./_register.mjs BleMidiTransport.test.ts

import {BleMidiTransport} from "../Assets/Midi.lspkg/Transports/BleMidiTransport"
import {MidiKind} from "../Assets/Midi.lspkg/Core/MidiTypes"
import type {MidiMessage} from "../Assets/Midi.lspkg/Core/MidiTypes"

let passed = 0
let failed = 0
function eq(a: unknown, e: unknown, label: string): void {
  if (JSON.stringify(a) === JSON.stringify(e)) passed++
  else {
    failed++
    console.error(`FAIL ${label}\n  exp ${JSON.stringify(e)}\n  got ${JSON.stringify(a)}`)
  }
}

function collect(): {t: BleMidiTransport; msgs: MidiMessage[]} {
  const msgs: MidiMessage[] = []
  const t = new BleMidiTransport()
  t.onMessage((m) => msgs.push(m))
  t.start()
  return {t, msgs}
}

const H = 0x80 // header (ts high = 0)
const TS = 0x80 // timestamp (ts low = 0)

// 1. Single note-on: header, ts, 0x90 60 100
{
  const {t, msgs} = collect()
  t.feedPacket([H, TS, 0x90, 60, 100])
  eq(msgs.length, 1, "ble noteOn count")
  eq([msgs[0].kind, msgs[0].data1, msgs[0].data2], [MidiKind.NoteOn, 60, 100], "ble noteOn fields")
}

// 2. Two messages in one packet, each with its own timestamp
{
  const {t, msgs} = collect()
  t.feedPacket([H, TS, 0x99, 36, 120, TS, 0x99, 38, 90])
  eq(msgs.length, 2, "ble two messages")
  eq([msgs[0].data1, msgs[1].data1], [36, 38], "ble two notes")
}

// 3. Running status: status omitted on the second (still preceded by a timestamp)
{
  const {t, msgs} = collect()
  // 0x90 60 100  then  ts, 62, 80  (running status reuse)
  t.feedPacket([H, TS, 0x90, 60, 100, TS, 62, 80])
  eq(msgs.length, 2, "ble running status count")
  eq([msgs[1].kind, msgs[1].data1, msgs[1].data2], [MidiKind.NoteOn, 62, 80], "ble running status note")
}

// 4. Realtime clock interleaved with its own timestamp
{
  const {t, msgs} = collect()
  t.feedPacket([H, TS, 0xf8, TS, 0x90, 60, 100])
  eq(
    msgs.map((m) => m.kind),
    [MidiKind.Clock, MidiKind.NoteOn],
    "ble realtime + note order"
  )
}

// 5. SysEx split across two packets (F0 ... continues ... F7)
{
  const {t, msgs} = collect()
  t.feedPacket([H, TS, 0xf0, 0x47, 0x10]) // start, no F7 yet
  eq(msgs.length, 0, "ble sysex partial")
  t.feedPacket([H, 0x11, 0x12, TS, 0xf7]) // continuation bytes, then ts+F7
  eq(msgs.length, 1, "ble sysex completes")
  eq(msgs[0].kind, MidiKind.SysEx, "ble sysex kind")
  eq(msgs[0].sysex, [0xf0, 0x47, 0x10, 0x11, 0x12, 0xf7], "ble sysex bytes")
}

// 6. A quarter-note of clock (24 ticks), each timestamped
{
  const {t, msgs} = collect()
  const pkt = [H]
  for (let i = 0; i < 24; i++) pkt.push(TS, 0xf8)
  t.feedPacket(pkt)
  eq(msgs.length, 24, "ble 24 clock ticks")
  eq(
    msgs.every((m) => m.kind === MidiKind.Clock),
    true,
    "ble all clock"
  )
}

// 7. Too-short packet is ignored
{
  const {t, msgs} = collect()
  t.feedPacket([H])
  eq(msgs.length, 0, "ble short packet ignored")
}

// 8. Outbound encode wraps in header+timestamp
{
  const sent: number[][] = []
  const t = new BleMidiTransport((p) => sent.push(p))
  t.start()
  t.send([0xb0, 7, 127])
  eq(sent[0], [0x80, 0x80, 0xb0, 7, 127], "ble send framing")
  t.sendSysEx([0x7e, 0x7f, 0x06, 0x01])
  eq(sent[1], [0x80, 0x80, 0xf0, 0x7e, 0x7f, 0x06, 0x01, 0x80, 0xf7], "ble sysex framing")
}

// --- onTimedMessage: parallel timed channel (Phase 2, TIME-01) --------------
// Additive only: onMessage/feedPacket/emit above are untouched (IN-02).

// 9. Two single-note packets from the real capture (op1f-notes-2026-08-05.raw.txt:1-2)
//    fed via feedPacketTimed emit two NoteOn on onTimedMessage whose
//    reconstructed sourceMs differ by 148 ms (raw13 2970 then 3118).
{
  const t = new BleMidiTransport()
  const timed: {sourceMs: number; arrivalNs: number}[] = []
  t.onTimedMessage((m, sourceMs, arrivalNs) => timed.push({sourceMs, arrivalNs}))
  t.start()
  t.feedPacketTimed([0x97, 0x9a, 0x90, 0x47, 0x7f], 1_000_000_000)
  t.feedPacketTimed([0x98, 0xae, 0x90, 0x45, 0x7f], 1_148_000_000)
  eq(timed.length, 2, "timed real-capture packets: two callbacks")
  eq(timed[1].sourceMs - timed[0].sourceMs, 148, "timed real-capture packets: 148 ms reconstructed delta")
}

// 10. Synthetic running-status chord: one timestamp byte, then several note-on
//     data pairs sharing that status (and its timestamp, per the BLE-MIDI
//     chord encoding). All chord notes carry the SAME sourceMs.
{
  const t = new BleMidiTransport()
  const timed: {data1: number | undefined; sourceMs: number}[] = []
  t.onTimedMessage((m, sourceMs) => timed.push({data1: m.data1, sourceMs}))
  t.start()
  t.feedPacketTimed([H, TS, 0x90, 60, 100, 62, 100, 64, 100], 2_000_000_000)
  eq(
    timed.map((x) => x.data1),
    [60, 62, 64],
    "timed chord: three notes"
  )
  eq(new Set(timed.map((x) => x.sourceMs)).size, 1, "timed chord: all notes share one sourceMs")
}

// 11. Realtime byte (0xF8) still emits on the existing onMessage path but
//     produces no onTimedMessage callback (its timestamps entry is undefined).
{
  const t = new BleMidiTransport()
  const msgs: MidiMessage[] = []
  const timed: MidiMessage[] = []
  t.onMessage((m) => msgs.push(m))
  t.onTimedMessage((m) => timed.push(m))
  t.start()
  t.feedPacketTimed([H, TS, 0xf8, TS, 0x90, 60, 100], 3_000_000_000)
  eq(
    msgs.map((m) => m.kind),
    [MidiKind.Clock, MidiKind.NoteOn],
    "timed realtime: onMessage still sees clock + note"
  )
  eq(
    timed.map((m) => m.kind),
    [MidiKind.NoteOn],
    "timed realtime: onTimedMessage skips the realtime byte"
  )
}

// 12. Regression: onMessage listeners receive exactly the same MidiMessage
//     sequence via feedPacketTimed as via feedPacket for the same bytes.
{
  const viaPacket = collect()
  viaPacket.t.feedPacket([H, TS, 0xf8, TS, 0x90, 60, 100])
  const viaTimed = collect()
  viaTimed.t.feedPacketTimed([H, TS, 0xf8, TS, 0x90, 60, 100], 4_000_000_000)
  eq(viaTimed.msgs, viaPacket.msgs, "timed regression: onMessage sequence unchanged by feedPacketTimed")
}

// 13. arrivalNs is forwarded unchanged to every onTimedMessage callback for one
//     packet (bundled messages share one arrival reading).
{
  const t = new BleMidiTransport()
  const arrivals: number[] = []
  t.onTimedMessage((m, sourceMs, arrivalNs) => arrivals.push(arrivalNs))
  t.start()
  t.feedPacketTimed([H, TS, 0x90, 60, 100, 62, 100], 5_123_456_789)
  eq(arrivals, [5_123_456_789, 5_123_456_789], "timed chord: same arrivalNs forwarded to every callback")
}

// 14. Malformed/truncated packet: a timestamp byte with no following message
//     byte, and a status byte with no data bytes at all, must not throw and
//     must not emit a timed callback (T-02-01, out-of-bounds-read guard).
{
  const t = new BleMidiTransport()
  const timed: MidiMessage[] = []
  t.onTimedMessage((m) => timed.push(m))
  t.start()
  let threw = false
  try {
    t.feedPacketTimed([H, TS], 6_000_000_000)
    t.feedPacketTimed([H, TS, 0x90], 6_000_000_000)
  } catch {
    threw = true
  }
  eq(threw, false, "timed truncated packet: does not throw")
  eq(timed.length, 0, "timed truncated packet: no timed callback from incomplete data")
}

// --- reset(): de-framer state clearing across a reconnect ------------------

/* 15. A connection dropped mid-SysEx leaves the de-framer open. The hardened
   deframe() (see the "unterminated SysEx" tests below) now aborts an open
   SysEx on the next well-formed non-realtime status byte on its own, so a
   plain reconnect note-on self-heals even without reset() (this is the same
   recovery test 22 exercises directly). reset() still gives immediate,
   explicit recovery instead of depending on what the next message happens to
   contain, and it is the only thing that clears the source-clock unwrapper
   (test 18) - this test just confirms calling it is correct and harmless. */
{
  const noReset = collect()
  noReset.t.feedPacket([H, TS, 0xf0, 0x47, 0x10]) // SysEx opens, connection drops here
  noReset.t.feedPacket([H, TS, 0x90, 60, 100]) // next session's first note-on
  eq(noReset.msgs.length, 1, "ble reset: hardened de-framer self-heals even without reset")

  const withReset = collect()
  withReset.t.feedPacket([H, TS, 0xf0, 0x47, 0x10])
  withReset.t.reset()
  withReset.t.feedPacket([H, TS, 0x90, 60, 100])
  eq(withReset.msgs.length, 1, "ble reset: next note-on parses after reset")
  eq(
    [withReset.msgs[0].kind, withReset.msgs[0].data1, withReset.msgs[0].data2],
    [MidiKind.NoteOn, 60, 100],
    "ble reset: recovered note-on fields"
  )
}

/* 16. stop() clears the same state (stop means the connection is over), so a
   stop mid-SysEx leaves nothing for the next start() to trip over. */
{
  const {t, msgs} = collect()
  t.feedPacket([H, TS, 0xf0, 0x47, 0x10])
  t.stop()
  eq(t.connected, false, "ble stop: reports disconnected")
  eq(msgs.length, 0, "ble stop: partial SysEx is dropped, not emitted")
  t.start()
  t.feedPacket([H, TS, 0x90, 60, 100])
  eq(msgs.length, 1, "ble stop: next note-on parses after stop then start")
  eq([msgs[0].kind, msgs[0].data1], [MidiKind.NoteOn, 60], "ble stop: recovered note-on fields")
}

// 17. reset() on a fresh transport emits nothing and leaves decoding intact.
{
  const {t, msgs} = collect()
  t.reset()
  t.reset()
  eq(msgs.length, 0, "ble fresh reset: emits nothing")
  t.feedPacket([H, TS, 0x90, 60, 100])
  eq(msgs.length, 1, "ble fresh reset: still decodes")
  eq([msgs[0].kind, msgs[0].data1, msgs[0].data2], [MidiKind.NoteOn, 60, 100], "ble fresh reset: note-on fields")
}

// 18. reset() also clears the source-clock unwrapper: without it, session two
//     below would inherit session one's stale wrap boundary and start offset
//     by thousands of ms instead of at its own first timestamp.
{
  const t = new BleMidiTransport()
  const timed: number[] = []
  t.onTimedMessage((_m, sourceMs) => timed.push(sourceMs))

  // Session one, late in the counter's range, with real elapsed arrival time.
  t.feedPacketTimed([0x80 | 0x3f, 0x80 | 0x7f, 0x90, 60, 100], 10_000_000_000)
  const firstSession = timed[0]
  eq(firstSession > 8000, true, `session one lands late in the wrap window (${firstSession})`)

  // Connection drops, transport is reused.
  t.stop()
  t.start()

  /* Session two: a fresh peripheral whose counter starts near zero. Arrival
     time keeps advancing, since the local clock does not restart. */
  t.feedPacketTimed([0x80, 0x80 | 0x0a, 0x90, 62, 100], 20_000_000_000)
  const secondSession = timed[1]
  eq(secondSession, 10, "after reset, session two starts at its own timestamp")
  eq(
    secondSession < firstSession,
    true,
    `session two is not offset by session one (${secondSession} vs ${firstSession})`
  )
}

// --- Robustness: malformed header (bit7 clear) ------------------------------
// Per the BLE-MIDI spec (Apple/MMA) the header byte is always 0b10dddddd,
// bit7 set. A header with bit7 clear is not a real BLE-MIDI packet at all.
// Without the guard, deframe() still reads the header's low 6 bits as a
// timestamp and decodes the rest of the packet into a message that looks
// real (verified below: this exact packet decodes to a NoteOn if the header
// check is skipped).

// 19. Malformed header (bit7 clear) is rejected: feedPacket emits nothing.
{
  const {t, msgs} = collect()
  t.feedPacket([0x00, TS, 0x90, 60, 100]) // bad header, otherwise a valid NoteOn
  eq(msgs.length, 0, "ble bad header: feedPacket emits nothing")
}

// 20. Same malformed header on feedPacketTimed: no onMessage, no
//     onTimedMessage, and (the AirChords failure mode this closes) no
//     garbage sourceMs handed to SourceClockUnwrapper.
{
  const t = new BleMidiTransport()
  const msgs: MidiMessage[] = []
  const timed: {sourceMs: number}[] = []
  t.onMessage((m) => msgs.push(m))
  t.onTimedMessage((m, sourceMs) => timed.push({sourceMs}))
  t.start()
  t.feedPacketTimed([0x00, TS, 0x90, 60, 100], 7_000_000_000)
  eq(msgs.length, 0, "ble bad header timed: onMessage emits nothing")
  eq(timed.length, 0, "ble bad header timed: onTimedMessage emits nothing")
}

// 21. A valid header (bit7 set) with the same payload still decodes normally,
//     confirming test 19/20 fail because of the header bit, not the payload.
{
  const {t, msgs} = collect()
  t.feedPacket([H, TS, 0x90, 60, 100])
  eq(msgs.length, 1, "ble valid header control: same payload still decodes")
}

// --- Robustness: unterminated SysEx must not wedge the transport -----------
// inSysex is instance state that spans packets (correct per spec), but a
// dropped/truncated SysEx frame must not silence the link forever. MidiParser
// already aborts an open SysEx on any non-realtime status byte (see
// MidiParser.ts); these tests prove that byte now reaches the parser instead
// of being swallowed by deframe() as a fake timestamp.

// 22. SysEx opened, never closed, then a normal timestamped NoteOn arrives in
//     a later packet with no intervening F7. Before the fix this NoteOn was
//     silently eaten (treated as two more interleaved timestamps, then two
//     bytes of "SysEx data"); after the fix, the non-realtime status byte
//     aborts the open SysEx and the NoteOn is decoded and emitted normally.
{
  const {t, msgs} = collect()
  t.feedPacket([H, TS, 0xf0, 0x47, 0x10]) // SysEx start, no F7 ever
  eq(msgs.length, 0, "ble unterminated sysex: no message yet")
  t.feedPacket([H, TS, 0x90, 60, 100]) // no F7 anywhere; a fresh timestamped NoteOn
  eq(msgs.length, 1, "ble unterminated sysex: abort byte still emits")
  const recovered = msgs[0] as MidiMessage | undefined
  eq(
    recovered ? [recovered.kind, recovered.data1, recovered.data2] : "no message",
    [MidiKind.NoteOn, 60, 100],
    "ble unterminated sysex: recovered NoteOn fields"
  )
}

// 23. The transport is not just recovering once: it is fully de-wedged. A
//     further ordinary packet keeps decoding normally.
{
  const {t, msgs} = collect()
  t.feedPacket([H, TS, 0xf0, 0x47, 0x10])
  t.feedPacket([H, TS, 0x90, 60, 100])
  t.feedPacket([H, TS, 0x99, 62, 90])
  eq(msgs.length, 2, "ble unterminated sysex: transport stays de-wedged for later packets")
  eq(
    msgs.map((m) => m.data1),
    [60, 62],
    "ble unterminated sysex: both recovered notes"
  )
}

// 24. Realtime bytes are legal INSIDE an open SysEx and must still pass
//     through (their own message, interleaved) without aborting it. A
//     correctly-terminated SysEx with an interleaved Clock byte must emit
//     both the Clock (order-preserved) and the SysEx, matching MidiParser's
//     own "realtime never disturbs SysEx" rule. Before the fix, the
//     interleaved 0xF8 was swallowed as a second "timestamp" and never
//     reached the parser at all (verified: without the fix this packet
//     decodes to a single SysEx message with no Clock).
{
  const {t, msgs} = collect()
  t.feedPacket([H, TS, 0xf0, 0x47, TS, 0xf8, 0x10, TS, 0xf7])
  eq(
    msgs.map((m) => m.kind),
    [MidiKind.Clock, MidiKind.SysEx],
    "ble sysex with interleaved realtime: both messages, in order"
  )
  const sysexMsg = msgs.find((m) => m.kind === MidiKind.SysEx)
  eq(
    sysexMsg?.sysex,
    [0xf0, 0x47, 0x10, 0xf7],
    "ble sysex with interleaved realtime: sysex bytes exclude the realtime byte"
  )
}

// 25. A timestamp byte whose low 7 bits are 0x77 is itself 0xF7, and must be
//     read as a timestamp, not as EOX. Reading it as EOX closes the SysEx a
//     byte early, then consumes the real EOX as the next message's timestamp,
//     which desyncs the remainder of the packet. Here the note-on after the
//     SysEx is the canary: before the fix it never arrived at all.
{
  const TS_F7 = 0xf7 // timestamp, ts low = 0x77 (119 ms)
  const {t, msgs} = collect()
  t.feedPacket([H, TS, 0xf0, 0x01, 0x02, TS_F7, 0xf7, TS, 0x90, 60, 100])
  eq(
    msgs.map((m) => m.kind),
    [MidiKind.SysEx, MidiKind.NoteOn],
    "ble 0xF7 timestamp: sysex closes, following note survives"
  )
  const sysexMsg = msgs.find((m) => m.kind === MidiKind.SysEx)
  eq(sysexMsg?.sysex, [0xf0, 0x01, 0x02, 0xf7], "ble 0xF7 timestamp: sysex payload excludes the timestamp byte")
  const noteMsg = msgs.find((m) => m.kind === MidiKind.NoteOn)
  eq([noteMsg?.data1, noteMsg?.data2], [60, 100], "ble 0xF7 timestamp: note-on bytes intact")
}

// --- Timed-channel pairing: segments, not array indices --------------------
// deframe() used to return two parallel arrays (raw bytes, and one timestamp
// per FRAMED message) and feedPacketTimed() paired them by index against what
// MidiParser emitted (one message per COMPLETED message). Those counts diverge
// the moment a packet contains an incomplete or interrupted message, and every
// later message in the packet is then mis-attributed. deframe() now returns
// segments (one framed message's bytes plus its own timestamp) and
// feedPacketTimed() feeds them one at a time, so a message can only ever be
// paired with the timestamp of the frame that carried it.

/* 26. A note-on interrupted by a realtime clock before its second data byte,
   which is legal BLE-MIDI framing. The de-framer recovers
   [0x90 0x3c | 0xf8 | 0x64]: the clock completes on its own and the trailing
   data byte completes the note-on, so both are emitted.
   The clock must carry no source timestamp, and the note-on must report the
   frame it actually arrived on (raw13 1) rather than the clock's.
   This previously dropped the note-on entirely: deframe() re-inserted the
   running-status byte ahead of the trailing 0x64, because 0x64 is a bit7-clear
   byte reached with `running` still armed, and that re-inserted 0x90 reset
   MidiParser's half-collected note-on and discarded the 0x3c. The de-framer
   now tracks how many data bytes the in-flight message still needs and emits a
   bare continuation byte on its own. */
{
  const PKT = [0x80, 0x81, 0x90, 0x3c, 0x82, 0xf8, 0x64]

  // feedPacket(): frozen, and identical before and after the segment change.
  const viaPacket = collect()
  viaPacket.t.feedPacket(PKT)
  eq(
    viaPacket.msgs.map((m) => m.kind),
    [MidiKind.Clock, MidiKind.NoteOn],
    "timed interrupted note-on: feedPacket completes the interrupted note-on"
  )

  const t = new BleMidiTransport()
  const msgs: MidiMessage[] = []
  const timed: {kind: string; sourceMs: number}[] = []
  t.onMessage((m) => msgs.push(m))
  t.onTimedMessage((m, sourceMs) => timed.push({kind: m.kind, sourceMs}))
  t.start()
  t.feedPacketTimed(PKT, 1_000_000_000)
  eq(
    msgs.map((m) => m.kind),
    [MidiKind.Clock, MidiKind.NoteOn],
    "timed interrupted note-on: onMessage sees the clock and the completed note-on"
  )
  eq(
    timed,
    [{kind: MidiKind.NoteOn, sourceMs: 1}],
    "timed interrupted note-on: the note-on reports its own frame, the clock is unpaired"
  )
}

/* 27. Same interruption, then a second note-on that arrives whole, then a
   Start. Both note-ons must report their own frame (raw13 1 and 3), and both
   realtime bytes must report none. Two separate bugs converged here. Index
   pairing got three things wrong at once: the Clock stole the interrupted
   note-on's timestamp, the whole note-on was handed the Clock's `undefined`
   and vanished from the timed channel, and the Start inherited a timestamp it
   never carried. On top of that the interrupted note-on was dropped outright,
   so onMessage saw three messages where the packet framed four. */
{
  const t = new BleMidiTransport()
  const msgs: MidiMessage[] = []
  const timed: {kind: string; data1: number | undefined; sourceMs: number}[] = []
  t.onMessage((m) => msgs.push(m))
  t.onTimedMessage((m, sourceMs) => timed.push({kind: m.kind, data1: m.data1, sourceMs}))
  t.start()
  t.feedPacketTimed([0x80, 0x81, 0x90, 0x3c, 0x82, 0xf8, 0x64, 0x83, 0x90, 0x40, 0x50, 0x84, 0xfa], 1_000_000_000)
  eq(
    msgs.map((m) => m.kind),
    [MidiKind.Clock, MidiKind.NoteOn, MidiKind.NoteOn, MidiKind.Start],
    "timed interrupted chain: both note-ons survive, in framing order"
  )
  eq(
    timed,
    [
      {kind: MidiKind.NoteOn, data1: 0x3c, sourceMs: 1},
      {kind: MidiKind.NoteOn, data1: 0x40, sourceMs: 3}
    ],
    "timed interrupted chain: each note-on is paired with its own frame"
  )
}

/* 28. A realtime byte interleaved inside an open SysEx. Neither the Clock nor
   the SysEx carries a source timestamp (a SysEx frame can span packets and
   arrival readings), so the timed channel stays empty for that packet, and the
   note-on in the NEXT packet must still report its own timestamp (raw13 4)
   rather than one shifted by the SysEx's byte-level segments. */
{
  const t = new BleMidiTransport()
  const msgs: MidiMessage[] = []
  const timed: {kind: string; data1: number | undefined; sourceMs: number}[] = []
  t.onMessage((m) => msgs.push(m))
  t.onTimedMessage((m, sourceMs) => timed.push({kind: m.kind, data1: m.data1, sourceMs}))
  t.start()
  // header, ts=1, F0, 0x47, ts=2, F8, 0x10, ts=3, F7
  t.feedPacketTimed([0x80, 0x81, 0xf0, 0x47, 0x82, 0xf8, 0x10, 0x83, 0xf7], 1_000_000_000)
  eq(
    msgs.map((m) => m.kind),
    [MidiKind.Clock, MidiKind.SysEx],
    "timed realtime in sysex: clock and sysex both emitted"
  )
  eq(timed, [], "timed realtime in sysex: neither the interleaved clock nor the sysex is paired")
  t.feedPacketTimed([0x80, 0x84, 0x90, 0x3c, 0x64], 1_010_000_000)
  eq(
    timed,
    [{kind: MidiKind.NoteOn, data1: 60, sourceMs: 4}],
    "timed realtime in sysex: the following note-on still reports its own timestamp"
  )
}

/* 29. Realtime inside an open SysEx, the SysEx closing, then a truncated
   note-on, then a trailing Clock. The trailing Clock is the canary: index
   pairing handed it the truncated note-on's timestamp (raw13 4), because that
   note-on pushed a timestamp entry while completing no message. Nothing in
   this packet may be paired. */
{
  const t = new BleMidiTransport()
  const msgs: MidiMessage[] = []
  const timed: {kind: string; sourceMs: number}[] = []
  t.onMessage((m) => msgs.push(m))
  t.onTimedMessage((m, sourceMs) => timed.push({kind: m.kind, sourceMs}))
  t.start()
  // header, ts=1, F0, 0x47, ts=2, F8, ts=3, F7, ts=4, 0x90, 0x3c (no velocity), ts=5, F8
  t.feedPacketTimed([0x80, 0x81, 0xf0, 0x47, 0x82, 0xf8, 0x83, 0xf7, 0x84, 0x90, 0x3c, 0x85, 0xf8], 1_000_000_000)
  eq(
    msgs.map((m) => m.kind),
    [MidiKind.Clock, MidiKind.SysEx, MidiKind.Clock],
    "timed sysex then truncated note: onMessage sequence unchanged"
  )
  eq(timed, [], "timed sysex then truncated note: trailing clock does not inherit the truncated note-on timestamp")
}

/* 30. Alignment must still hold for ordinary traffic: three complete messages
   in one packet, each with its own timestamp byte at a DISTINCT raw13 (1, 10,
   20), so a one-off shift in either direction would show up as a wrong
   sourceMs rather than merely a wrong count. This case was already correct
   under index pairing; it is here to prove segment feeding did not break it. */
{
  const t = new BleMidiTransport()
  const timed: {kind: string; data1: number | undefined; sourceMs: number}[] = []
  t.onTimedMessage((m, sourceMs) => timed.push({kind: m.kind, data1: m.data1, sourceMs}))
  t.start()
  // ts=1 NoteOn 60 100, ts=10 CC 7 127, ts=20 NoteOff 60 0
  t.feedPacketTimed([0x80, 0x81, 0x90, 0x3c, 0x64, 0x8a, 0xb0, 0x07, 0x7f, 0x94, 0x80, 0x3c, 0x00], 1_000_000_000)
  eq(
    timed,
    [
      {kind: MidiKind.NoteOn, data1: 60, sourceMs: 1},
      {kind: MidiKind.ControlChange, data1: 7, sourceMs: 10},
      {kind: MidiKind.NoteOff, data1: 60, sourceMs: 20}
    ],
    "timed multi-message alignment: each message keeps its own distinct sourceMs"
  )
}

/* 31. Continuation-byte handling beyond the note-on case in 26 and 27. A
   message is only continued when it is genuinely mid-collection, so the
   de-framer has to tell "this bare byte finishes the message already in
   flight" from "this bare byte starts a new running-status message". */
{
  // 31a. A control change interrupted before its value byte. Same two-data-byte
  //      shape as a note-on, but a different status nibble.
  {
    const c = collect()
    c.t.feedPacket([0x80, 0x81, 0xb0, 0x07, 0x82, 0xf8, 0x40])
    eq(
      c.msgs.map((m) => [m.kind, m.data1, m.data2]),
      [
        [MidiKind.Clock, undefined, undefined],
        [MidiKind.ControlChange, 0x07, 0x40]
      ],
      "continuation: interrupted control change completes"
    )
  }

  // 31b. A program change interrupted before its ONLY data byte. Exercises the
  //      one-data-byte deficit, where the message completes on the first
  //      continuation byte rather than needing a second.
  {
    const c = collect()
    c.t.feedPacket([0x80, 0x81, 0xc0, 0x82, 0xf8, 0x2a])
    eq(
      c.msgs.map((m) => [m.kind, m.data1]),
      [
        [MidiKind.Clock, undefined],
        [MidiKind.ProgramChange, 0x2a]
      ],
      "continuation: interrupted program change completes on one byte"
    )
  }

  // 31c. Two realtime bytes interleaved back to back inside one interrupted
  //      note-on. Neither may consume the outstanding data byte.
  {
    const c = collect()
    c.t.feedPacket([0x80, 0x81, 0x90, 0x3c, 0x82, 0xf8, 0x83, 0xfe, 0x64])
    eq(
      c.msgs.map((m) => m.kind),
      [MidiKind.Clock, MidiKind.Other, MidiKind.NoteOn],
      "continuation: survives two interleaved realtime bytes"
    )
  }

  // 31d. Once the message is complete, running status is still armed, so a
  //      further bare byte is a NEW message (the chord path), not a
  //      continuation. This is the case the deficit check must not swallow.
  {
    const c = collect()
    c.t.feedPacket([0x80, 0x81, 0x90, 0x3c, 0x64, 0x40, 0x50])
    eq(
      c.msgs.map((m) => [m.kind, m.data1, m.data2]),
      [
        [MidiKind.NoteOn, 0x3c, 0x64],
        [MidiKind.NoteOn, 0x40, 0x50]
      ],
      "continuation: a complete message still yields to running status for a chord"
    )
  }

  // 31e. A partial message does not survive into the next packet, because
  //      running status does not carry across packets in BLE MIDI. The orphaned
  //      byte must be dropped, not attached to whatever arrives next.
  {
    const c = collect()
    c.t.feedPacket([0x80, 0x81, 0x90, 0x3c, 0x82, 0xf8])
    c.t.feedPacket([0x80, 0x81, 0x64])
    eq(
      c.msgs.map((m) => m.kind),
      [MidiKind.Clock],
      "continuation: a partial message does not cross a packet boundary"
    )
  }
}

/* 32. A running-status message interrupted by a realtime byte must still
   complete. consumeStatus() records its shortfall in pendingNeed, but the two
   running-status branches used to zero it unconditionally, so the continuation
   byte after the realtime message was read as the start of a new message and
   the interrupted one was dropped. */
{
  // 32a. Chord encoding: no timestamp byte of its own.
  {
    const c = collect()
    c.t.feedPacket([0x80, 0x81, 0x90, 0x3c, 0x64, 0x40, 0x82, 0xf8, 0x50])
    eq(
      c.msgs.map((m) => [m.kind, m.data1, m.data2]),
      [
        [MidiKind.NoteOn, 0x3c, 0x64],
        [MidiKind.Clock, undefined, undefined],
        [MidiKind.NoteOn, 0x40, 0x50]
      ],
      'interrupted chord note completes after the realtime byte'
    )
  }

  // 32b. Running status carrying its own timestamp byte.
  {
    const c = collect()
    c.t.feedPacket([0x80, 0x81, 0x90, 0x3c, 0x64, 0x82, 0x40, 0x83, 0xf8, 0x50])
    eq(
      c.msgs.map((m) => [m.kind, m.data1, m.data2]),
      [
        [MidiKind.NoteOn, 0x3c, 0x64],
        [MidiKind.Clock, undefined, undefined],
        [MidiKind.NoteOn, 0x40, 0x50]
      ],
      'interrupted timestamped running-status note completes'
    )
  }

  // 32c. The uninterrupted chord path is unchanged.
  {
    const c = collect()
    c.t.feedPacket([0x80, 0x81, 0x90, 0x3c, 0x64, 0x40, 0x50])
    eq(
      c.msgs.map((m) => [m.kind, m.data1, m.data2]),
      [
        [MidiKind.NoteOn, 0x3c, 0x64],
        [MidiKind.NoteOn, 0x40, 0x50]
      ],
      'uninterrupted chord still emits both notes'
    )
  }
}

console.log(`\n${passed} passed, ${failed} failed`)
process.exit(failed === 0 ? 0 : 1)

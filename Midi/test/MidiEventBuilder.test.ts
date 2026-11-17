// MidiEventBuilder tests: the message builders and the seeded fault scheduler
// that LeafMidiInteractor.play() paces through.
//   node --experimental-strip-types --import ./_register.mjs MidiEventBuilder.test.ts

import {MidiKind} from "../Assets/Midi.lspkg/Core/MidiTypes"
import type {TimedEvent} from "../Assets/Midi.lspkg/Testing/MidiEventBuilder"
import {
  applyFaults,
  clockMessage,
  controlChangeMessage,
  noteOffMessage,
  noteOnMessage,
  sustainPedalMessage
} from "../Assets/Midi.lspkg/Testing/MidiEventBuilder"

let passed = 0
let failed = 0

function eq(actual: unknown, expected: unknown, label: string): void {
  const a = JSON.stringify(actual)
  const e = JSON.stringify(expected)
  if (a === e) {
    passed++
  } else {
    failed++
    console.error(`FAIL ${label} (got ${a}, want ${e})`)
  }
}

function ok(cond: boolean, label: string): void {
  if (cond) {
    passed++
  } else {
    failed++
    console.error(`FAIL ${label}`)
  }
}

const CHANNEL = 9

// 1. Builders carry both the parsed fields and the exact raw bytes.
eq(
  noteOnMessage(60, 100, CHANNEL),
  {kind: MidiKind.NoteOn, channel: 9, data1: 60, data2: 100, raw: [0x99, 60, 100]},
  "noteOn"
)
eq(
  noteOffMessage(60, 0, CHANNEL),
  {kind: MidiKind.NoteOff, channel: 9, data1: 60, data2: 0, raw: [0x89, 60, 0]},
  "noteOff"
)
eq(noteOnMessage(60).raw, [0x90, 60, 100], "noteOn defaults to channel 0, velocity 100")
eq(controlChangeMessage(1, 40, 2).raw, [0xb2, 1, 40], "controlChange")
eq(sustainPedalMessage(true).raw, [0xb0, 64, 127], "sustain pedal down is CC 64 = 127")
eq(sustainPedalMessage(false).raw, [0xb0, 64, 0], "sustain pedal up is CC 64 = 0")
eq(clockMessage(), {kind: MidiKind.Clock, raw: [0xf8]}, "clock")

const five: TimedEvent[] = [60, 61, 62, 63, 64].map((n, i) => ({atMs: i * 10, msg: noteOnMessage(n, 100, CHANNEL)}))
const four: TimedEvent[] = [70, 71, 72, 73].map((n, i) => ({atMs: i * 10, msg: noteOnMessage(n, 100, CHANNEL)}))
const notes = (events: TimedEvent[]) => events.map((e) => e.msg.data1)

// 2. No fault config is a sorted copy; the input is not mutated.
const unsorted: TimedEvent[] = [four[2], four[0], four[3], four[1]]
eq(notes(applyFaults(unsorted)), [70, 71, 72, 73], "no fault sorts by time")
eq(notes(unsorted), [72, 70, 73, 71], "input left unmutated")

// 3. A partial drop is reproducible, and a different seed drops a different set.
eq(notes(applyFaults(five, {dropProbability: 0.5, seed: 7})), [62, 63, 64], "drop seed 7")
eq(notes(applyFaults(five, {dropProbability: 0.5, seed: 7})), [62, 63, 64], "drop seed 7 repeats")
eq(notes(applyFaults(five, {dropProbability: 0.5, seed: 3})), [60, 64], "drop seed 3")
eq(applyFaults(five, {dropProbability: 1, seed: 7}).length, 0, "drop probability 1 drops everything")

// 4. Consecutive swaps move 70 two slots later; the slot times stay put.
const reordered = applyFaults(four, {reorderProbability: 0.5, seed: 7})
eq(notes(reordered), [71, 72, 70, 73], "reorder seed 7")
eq(
  reordered.map((e) => e.atMs),
  [0, 10, 20, 30],
  "reorder swaps payloads, not times"
)

// 5. Drift stretches event times without reordering them.
const drifted = applyFaults(four, {driftPpm: 100_000})
eq(notes(drifted), [70, 71, 72, 73], "drift keeps order")
ok(Math.abs(drifted[1].atMs - 11) < 1e-3, "drift stretches 10ms to 11ms at 100000 ppm")
ok(Math.abs(drifted[3].atMs - 33) < 1e-3, "drift stretches 30ms to 33ms at 100000 ppm")

// 6. Jitter is reproducible and stays within +/- jitterMs, never negative.
const jitterMs = 5
const first = applyFaults(four, {jitterMs, seed: 7})
const second = applyFaults(four, {jitterMs, seed: 7})
eq(
  first.map((e) => e.atMs),
  second.map((e) => e.atMs),
  "jitter seed 7 repeats"
)
for (let i = 0; i < four.length; i++) {
  ok(first[i].atMs <= four[i].atMs + jitterMs + 1e-3, `jitter upper bound, event ${i}`)
  ok(first[i].atMs >= Math.max(0, four[i].atMs - jitterMs) - 1e-3, `jitter lower bound, event ${i}`)
}

console.log(`\n${passed} passed, ${failed} failed`)
process.exit(failed === 0 ? 0 : 1)

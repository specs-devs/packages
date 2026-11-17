// MidiTypes helper tests. Covers midiNoteName(), the helper reconciled into the
// canonical core during packaging (it previously lived only in a consumer copy).
//   node --experimental-strip-types --import ./_register.mjs MidiTypes.test.ts

import {midiNoteName, isDataByte, isStatus, MPC_AKAI_SYSEX_ID} from "../Assets/Midi.lspkg/Core/MidiTypes"

let passed = 0
let failed = 0

function eq(actual: string, expected: string, label: string): void {
  if (actual === expected) {
    passed++
  } else {
    failed++
    console.error(`FAIL ${label} (got ${actual}, want ${expected})`)
  }
}

function eqNum(actual: number, expected: number, label: string): void {
  if (actual === expected) {
    passed++
  } else {
    failed++
    console.error(`FAIL ${label} (got 0x${actual.toString(16)}, want 0x${expected.toString(16)})`)
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

// 1. Standard MIDI convention: note 60 is middle C (C4).
eq(midiNoteName(60), "C4", "note 60 is C4")
eq(midiNoteName(69), "A4", "note 69 is A4 (concert A)")
eq(midiNoteName(61), "C#4", "note 61 is C#4")
eq(midiNoteName(62), "D4", "note 62 is D4")
eq(midiNoteName(59), "B3", "note 59 is B3")

// 2. Full range boundaries.
eq(midiNoteName(0), "C-1", "note 0 is C-1 (low bound)")
eq(midiNoteName(127), "G9", "note 127 is G9 (high bound)")

// 3. Piano range anchors.
eq(midiNoteName(21), "A0", "note 21 is A0 (lowest piano key)")
eq(midiNoteName(108), "C8", "note 108 is C8 (highest piano key)")

// 4. Every pitch class in octave 4 (notes 60..71) renders with the octave suffix 4.
const names4 = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]
for (let i = 0; i < 12; i++) {
  eq(midiNoteName(60 + i), `${names4[i]}4`, `note ${60 + i} pitch class`)
}

// 5. isDataByte sanity (data bytes have the high bit clear).
ok(isDataByte(0x00), "isDataByte 0x00")
ok(isDataByte(0x7f), "isDataByte 0x7f")
ok(!isDataByte(0x80), "isDataByte 0x80 is a status byte")
ok(!isDataByte(0xf8), "isDataByte 0xf8 is a realtime status byte")

// 6. Out-of-range integers. midiNoteName never throws; it extends the naming
// scheme modularly outside MIDI's 0..127. Pin that documented behavior so a
// future change that starts rejecting or clamping is a deliberate, visible one.
eq(midiNoteName(128), "G#9", "note 128 extends modularly past the high bound")
eq(midiNoteName(-1), "B-2", "note -1 extends modularly below the low bound")
eq(midiNoteName(-12), "C-2", "note -12 is pitch class C, one octave below note 0")

// 7. isStatus boundaries, and that it is the exact complement of isDataByte.
// Both are @internal, but they encode the MIDI bit-7 rule the whole de-framer
// rests on, so pin it. The complement sweep is the real test: a change to
// either predicate that breaks the partition fails here rather than surfacing
// as mis-parsed bytes somewhere downstream.
ok(!isStatus(0x00), "isStatus 0x00 is a data byte")
ok(!isStatus(0x7f), "isStatus 0x7f is the highest data byte")
ok(isStatus(0x80), "isStatus 0x80 is the lowest status byte")
ok(isStatus(0x90), "isStatus 0x90 note-on is a status byte")
ok(isStatus(0xf0), "isStatus 0xf0 sysex start is a status byte")
ok(isStatus(0xf8), "isStatus 0xf8 realtime clock is a status byte")
ok(isStatus(0xff), "isStatus 0xff is a status byte")

let partitioned = true
for (let b = 0; b <= 0xff; b++) {
  if (isStatus(b) === isDataByte(b)) {
    partitioned = false
    break
  }
}
ok(partitioned, "isStatus and isDataByte partition every byte 0x00-0xff")

// 8. MPC_AKAI_SYSEX_ID. Pin the value, since it is a published constant a
// consumer would compare against, and assert the invariant that actually
// matters: a manufacturer id sits in the SysEx payload, so it has to be a data
// byte. A value with bit 7 set would be read as a status byte and truncate the
// frame. test/MidiParser.test.ts already parses a real [0xf0, 0x47, ...] frame.
eqNum(MPC_AKAI_SYSEX_ID, 0x47, "MPC_AKAI_SYSEX_ID is Akai id 0x47")
ok(isDataByte(MPC_AKAI_SYSEX_ID), "MPC_AKAI_SYSEX_ID is a data byte, not a status byte")
ok(MPC_AKAI_SYSEX_ID >= 0 && MPC_AKAI_SYSEX_ID <= 0x7f, "MPC_AKAI_SYSEX_ID is in the 7-bit MIDI range")

console.log(`\n${passed} passed, ${failed} failed`)
process.exit(failed === 0 ? 0 : 1)

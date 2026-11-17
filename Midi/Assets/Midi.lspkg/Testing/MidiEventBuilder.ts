import type {MidiMessage} from "../Core/MidiTypes"
import {MidiKind} from "../Core/MidiTypes"

const NOTE_ON_STATUS = 0x90
const NOTE_OFF_STATUS = 0x80
const CC_STATUS = 0xb0
const SUSTAIN_CC = 64

/** Build a Note On for a channel (0-15). velocity 0 reads as a Note Off. */
export function noteOnMessage(note: number, velocity = 100, channel = 0): MidiMessage {
  return {
    kind: MidiKind.NoteOn,
    channel,
    data1: note,
    data2: velocity,
    raw: [NOTE_ON_STATUS | channel, note, velocity]
  }
}

/** Build a Note Off for a channel (0-15). */
export function noteOffMessage(note: number, velocity = 0, channel = 0): MidiMessage {
  return {
    kind: MidiKind.NoteOff,
    channel,
    data1: note,
    data2: velocity,
    raw: [NOTE_OFF_STATUS | channel, note, velocity]
  }
}

/** Build a Control Change (cc 0-127, value 0-127) for a channel (0-15). */
export function controlChangeMessage(cc: number, value: number, channel = 0): MidiMessage {
  return {
    kind: MidiKind.ControlChange,
    channel,
    data1: cc,
    data2: value,
    raw: [CC_STATUS | channel, cc, value]
  }
}

/** Sustain pedal (CC 64): down is value 127, up is value 0. */
export function sustainPedalMessage(down: boolean, channel = 0): MidiMessage {
  return controlChangeMessage(SUSTAIN_CC, down ? 127 : 0, channel)
}

/** Build a MIDI Clock tick (24 per quarter note). */
export function clockMessage(): MidiMessage {
  return {kind: MidiKind.Clock, raw: [0xf8]}
}

/** One scheduled event: a message and the millisecond offset it fires at. */
export interface TimedEvent {
  atMs: number
  msg: MidiMessage
}

/**
 * Optional timing/ordering faults to exercise a lens under bad link conditions.
 * All perturbation is seeded, so a run is reproducible.
 */
export interface FaultConfig {
  /** Uniform +/- jitter added to each event time, in ms. */
  jitterMs?: number
  /** Clock drift in parts-per-million, applied cumulatively to event time. */
  driftPpm?: number
  /**
   * Per-adjacent-pair probability [0..1] of swapping arrival order. Applied as
   * one left-to-right sweep, so consecutive swaps can move an event more than
   * one slot in a single call.
   */
  reorderProbability?: number
  /** Per-event probability [0..1] of dropping the event entirely. */
  dropProbability?: number
  /** PRNG seed. Same seed plus same input gives the same perturbation. */
  seed?: number
}

/** Deterministic PRNG (mulberry32) so faulted runs are reproducible. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * Apply timing and ordering faults to a schedule. With no fault config this is
 * a stable copy sorted by time.
 *
 * @param events - scheduled events, not required to be pre-sorted
 * @returns a new array sorted by perturbed time; the input is not mutated
 */
export function applyFaults(events: TimedEvent[], fault?: FaultConfig): TimedEvent[] {
  const ordered = events.map((e) => ({atMs: e.atMs, msg: e.msg})).sort((a, b) => a.atMs - b.atMs)

  if (fault === undefined) {
    return ordered
  }

  const rand = mulberry32(fault.seed ?? 1)
  const jitterMs = fault.jitterMs ?? 0
  const driftPpm = fault.driftPpm ?? 0
  const dropP = fault.dropProbability ?? 0
  const reorderP = fault.reorderProbability ?? 0

  const kept: TimedEvent[] = []
  for (const e of ordered) {
    if (dropP > 0 && rand() < dropP) {
      continue
    }
    let t = e.atMs * (1 + driftPpm / 1_000_000)
    if (jitterMs > 0) {
      t += (rand() * 2 - 1) * jitterMs
    }
    kept.push({atMs: Math.max(0, t), msg: e.msg})
  }

  if (reorderP > 0) {
    for (let i = 0; i < kept.length - 1; i++) {
      if (rand() < reorderP) {
        /* Swap payloads, not slot times, so the sort below cannot undo this. */
        const tmp = kept[i].msg
        kept[i].msg = kept[i + 1].msg
        kept[i + 1].msg = tmp
      }
    }
  }

  return kept.sort((a, b) => a.atMs - b.atMs)
}

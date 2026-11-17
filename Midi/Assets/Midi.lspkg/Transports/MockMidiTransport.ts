import {BaseMidiTransport} from "./MidiTransport"
import {MidiKind} from "../Core/MidiTypes"
import type {MidiMessage} from "../Core/MidiTypes"

const PAD_BASE_NOTE = 36 // GM/MPC bank-A pad 1
const PAD_COUNT = 16

/**
 * Synthetic transport for building and demoing a lens in Lens Studio Preview with
 * no instrument attached. Drive {@link tick} from the lens UpdateEvent and it
 * generates a MIDI clock plus pad hits through the same {@link BaseMidiTransport}
 * listener path a real device uses. It receives only, so `send()` and
 * `sendSysEx()` are no-ops.
 *
 * Once {@link start} has run it emits, per {@link MidiKind}:
 * - `Start` (raw `[0xFA]`) on `start()` and `Stop` (raw `[0xFC]`) on `stop()`.
 * - `Clock` (raw `[0xF8]`) at 24 pulses per quarter note for the current BPM.
 * - `NoteOn` on every 12th clock, that is every eighth note: channel 9 (the
 *   drum channel, 0-based), `data1` note 36-51 (the 16 MPC bank-A pads), `data2`
 *   velocity 80-127. No `NoteOff` is ever emitted, so a consumer that needs note
 *   length has to decide it itself.
 *
 * Pad choice and velocity come from a fixed-seed generator rather than
 * `Math.random`, so the same BPM and the same sequence of `tick()` deltas give
 * byte-identical output every run, which is what makes a preview repeatable.
 */
export class MockMidiTransport extends BaseMidiTransport {
  private bpm: number
  private clockAccum: number = 0 // seconds accumulated toward the next clock tick
  private beatClock: number = 0 // total clock ticks emitted
  private running: boolean = false
  // deterministic pseudo-random so previews are repeatable (no Math.random)
  private lcg: number = 0x2545f4914f6cdd1d

  /** @param bpm Tempo of the generated clock in beats per minute, default 120. */
  constructor(bpm = 120) {
    super()
    this.bpm = bpm
  }

  /**
   * Marks the transport connected, starts generation, and emits `Start`. `tick()`
   * does nothing until this is called. Calling it again after `stop()` resumes
   * from the existing clock count and pad sequence rather than restarting them.
   */
  start(): void {
    this.isConnected = true
    this.running = true
    this.emit({kind: MidiKind.Start, raw: [0xfa]})
  }

  /**
   * Halts generation and emits `Stop`. `connected` is left as it was, so it stays
   * true after a `start()`/`stop()` pair.
   */
  stop(): void {
    this.running = false
    this.emit({kind: MidiKind.Stop, raw: [0xfc]})
  }

  /**
   * Sets the tempo used by later `tick()` calls. Takes effect on the next call and
   * does not reset the clock count or the accumulated fraction of a pulse, so
   * beat phase carries across a tempo change.
   */
  setBpm(bpm: number): void {
    this.bpm = bpm
  }

  /**
   * Advances the generator by `dt` and emits everything that fell due. Emits every
   * clock pulse contained in `dt`, not just one, so a long frame or a resumed
   * preview produces a burst of `Clock` messages rather than dropping them.
   *
   * @param dt Seconds since the previous call, i.e. the lens frame delta. Ignored
   * entirely until `start()` has been called.
   */
  tick(dt: number): void {
    /* A non-positive bpm makes secondsPerClock negative, and the loop below
       subtracts it, so clockAccum grows and the condition never fails. That is
       an unbounded loop on the main thread, which freezes Preview. bpm 0 is
       already inert via Infinity, but guard both so the invariant is explicit. */
    if (!this.running || this.bpm <= 0) {
      return
    }
    const secondsPerClock = 60 / (this.bpm * 24) // 24 PPQN
    this.clockAccum += dt
    while (this.clockAccum >= secondsPerClock) {
      this.clockAccum -= secondsPerClock
      this.beatClock++
      this.emit({kind: MidiKind.Clock, raw: [0xf8]})
      // On each quarter-note (every 24 ticks) fire a pad, and add offbeat hits.
      if (this.beatClock % 24 === 0) {
        this.firePad(this.pickPad())
      } else if (this.beatClock % 12 === 0) {
        this.firePad(this.pickPad())
      }
    }
  }

  private firePad(pad: number): void {
    const note = PAD_BASE_NOTE + pad
    const vel = 80 + (this.next() % 48) // 80..127
    const on: MidiMessage = {kind: MidiKind.NoteOn, channel: 9, data1: note, data2: vel, raw: [0x99, note, vel]}
    this.emit(on)
  }

  private pickPad(): number {
    return this.next() % PAD_COUNT
  }

  private next(): number {
    // xorshift-ish on a bigint-free 32-bit state
    let x = this.lcg & 0xffffffff
    x ^= (x << 13) & 0xffffffff
    x ^= x >>> 17
    x ^= (x << 5) & 0xffffffff
    this.lcg = x >>> 0
    return this.lcg
  }

  send(_bytes: number[]): void {
    // no-op: the mock has no real device to receive
  }

  sendSysEx(_payload: number[]): void {
    // no-op
  }
}

import {CLOCKS_PER_QUARTER, MidiKind} from "../Core/MidiTypes"
import type {MidiMessage} from "../Core/MidiTypes"

const BEATS_PER_BAR = 4 // assume 4/4; the MPC does not broadcast meter over clock

/**
 * Derives musical time from a MIDI clock stream: a tempo estimate plus beat and
 * bar position. Driven entirely by {@link ClockTracker.handle}.
 *
 * Assumes {@link CLOCKS_PER_QUARTER} (24) pulses per quarter note and a 4/4 bar,
 * since a MIDI clock stream carries no meter.
 */
export class ClockTracker {
  private ticks: number = 0
  private runningState: boolean = false
  /* Recent clock arrivals, one quarter-note deep. Averaging across the window
     rather than per-tick keeps jittery arrival times from biasing the tempo. */
  private readonly windowTicks: number = CLOCKS_PER_QUARTER
  private times: number[] = []

  constructor() {}

  /** True after `Start` or `Continue`, false after `Stop`. */
  get running(): boolean {
    return this.runningState
  }

  /**
   * `Clock` messages counted while running, since the last `Start` or `reset()`.
   * Clocks arriving while stopped still update {@link bpm} but do not advance
   * the position, so `Continue` resumes where `Stop` left off.
   */
  get tickCount(): number {
    return this.ticks
  }

  /**
   * Tempo in beats per minute, averaged over the last quarter note of clocks.
   * 0 until two `Clock` messages have arrived, or if that window spans no time.
   */
  get bpm(): number {
    if (this.times.length < 2) {
      return 0
    }
    const span = this.times[this.times.length - 1] - this.times[0]
    const intervals = this.times.length - 1
    if (span <= 0) {
      return 0
    }
    const avgInterval = span / intervals
    return 60 / (avgInterval * CLOCKS_PER_QUARTER)
  }

  /** Position within the current quarter note, 0 to just under 1. */
  get quarterPhase(): number {
    return (this.ticks % CLOCKS_PER_QUARTER) / CLOCKS_PER_QUARTER
  }

  /** Which beat of the bar, 0 to 3. */
  get beatInBar(): number {
    return Math.floor(this.ticks / CLOCKS_PER_QUARTER) % BEATS_PER_BAR
  }

  /** Position within the current bar, 0 to just under 1. */
  get barPhase(): number {
    const ticksPerBar = CLOCKS_PER_QUARTER * BEATS_PER_BAR
    return (this.ticks % ticksPerBar) / ticksPerBar
  }

  /**
   * Feeds one message plus the time it arrived. Only `Clock`, `Start`,
   * `Continue` and `Stop` have any effect. `Start` rewinds `tickCount`,
   * `Continue` keeps it, and `Stop` leaves both it and the tempo estimate.
   *
   * @param nowSec - arrival time in seconds, not milliseconds.
   */
  handle(msg: MidiMessage, nowSec: number): void {
    switch (msg.kind) {
      case MidiKind.Start:
        this.runningState = true
        this.ticks = 0
        this.times = []
        break
      case MidiKind.Continue:
        this.runningState = true
        /* Keep the tempo window only if clock actually kept arriving through the
           pause. A master may send clock while stopped, in which case the window
           is still valid and bpm survives the resume, but it may also go silent,
           and then the window straddles the silence and would measure one huge
           interval as the tempo. */
        if (!this.clockIsCurrent(nowSec)) {
          this.times = []
        }
        break
      case MidiKind.Stop:
        this.runningState = false
        break
      case MidiKind.Clock:
        this.times.push(nowSec)
        // keep one quarter-note of history (windowTicks intervals => +1 samples)
        if (this.times.length > this.windowTicks + 1) {
          this.times.shift()
        }
        /* Position only advances while running. A master keeps sending clock
           when stopped to hold tempo sync, so `times` above still updates and
           bpm keeps tracking, but the beat and bar position must not roll
           forward or `Continue` would resume in the wrong place. */
        if (this.runningState) {
          this.ticks++
        }
        break
      default:
        break
    }
  }

  /**
   * Whether the newest clock arrival is recent enough to still describe the
   * current tempo, judged against the window's own average interval rather than
   * a fixed tempo, so it holds at any bpm.
   */
  private clockIsCurrent(nowSec: number): boolean {
    if (this.times.length < 2) {
      return false
    }
    const last = this.times[this.times.length - 1]
    const avgInterval = (last - this.times[0]) / (this.times.length - 1)
    if (avgInterval <= 0) {
      return false
    }
    return nowSec - last <= avgInterval * 2
  }

  /** Returns everything to the initial state, `running` included. */
  reset(): void {
    this.ticks = 0
    this.times = []
    this.runningState = false
  }
}

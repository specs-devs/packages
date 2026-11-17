const WRAP_MS = 8192 // 2^13, the BLE-MIDI 13-bit millisecond counter period

/**
 * Reconstructs a monotonic, unbounded millisecond timeline from the 13-bit
 * BLE-MIDI timestamp, which wraps every 8192 ms. No musical analysis: that is
 * {@link ClockTracker}'s job.
 *
 * Keep one instance per BLE connection, and call {@link reset} on disconnect.
 * The timeline is seeded on the first call, so only differences between returned
 * values are meaningful.
 */
export class SourceClockUnwrapper {
  private lastRaw13: number | null = null
  private lastArrivalMs: number | null = null
  private accumulatedMs: number = 0

  /**
   * Places one timestamped message on the reconstructed timeline.
   *
   * Elapsed wraps are estimated from the arrival gap rather than the sign of the
   * raw delta, because a silent gap can span several wraps. That stays correct
   * while the arrival clock is within half a wrap period (4096 ms) of true
   * elapsed time.
   *
   * The result is non-decreasing rather than strictly increasing. A backward step
   * in `raw13` that the arrival gap does not explain as a wrap (102 then 100, or a
   * drop across two messages sharing one arrival reading) reports no advance.
   *
   * @param raw13 - 13-bit BLE-MIDI timestamp. Outside 0-8191 it is normalized
   * modulo 8192 rather than rejected.
   * @param arrivalMs - local arrival reading in **milliseconds**, monotonic and
   * non-wrapping. `BleMidiTransport` works in nanoseconds and divides by 1e6
   * before calling in.
   * @returns position on the reconstructed timeline, in milliseconds.
   */
  unwrap(raw13: number, arrivalMs: number): number {
    const r = ((raw13 % WRAP_MS) + WRAP_MS) % WRAP_MS
    if (this.lastRaw13 === null || this.lastArrivalMs === null) {
      this.accumulatedMs = r
      this.lastRaw13 = r
      this.lastArrivalMs = arrivalMs
      return this.accumulatedMs
    }
    const naiveDelta = (((r - this.lastRaw13) % WRAP_MS) + WRAP_MS) % WRAP_MS
    const arrivalDelta = arrivalMs - this.lastArrivalMs
    /* Clamp the summed delta, not the wrap count: clamping the count turns a
       small backward step in raw13 into a near-full-period forward jump. */
    const estimatedWraps = Math.round((arrivalDelta - naiveDelta) / WRAP_MS)
    this.accumulatedMs += Math.max(0, naiveDelta + estimatedWraps * WRAP_MS)
    this.lastRaw13 = r
    this.lastArrivalMs = arrivalMs
    return this.accumulatedMs
  }

  /** Forgets the connection and restarts the timeline at 0. */
  reset(): void {
    this.lastRaw13 = null
    this.lastArrivalMs = null
    this.accumulatedMs = 0
  }
}

// SourceClockUnwrapper unit tests: pure 13-bit BLE-MIDI timestamp rollover
// unwrap. No Lens Studio globals; arrivalMs is always an injected parameter.
//   node --experimental-strip-types --import ./_register.mjs SourceClockUnwrapper.test.ts

import {SourceClockUnwrapper} from "../Assets/Midi.lspkg/Timing/SourceClockUnwrapper"

let passed = 0
let failed = 0
function eq(a: unknown, e: unknown, label: string): void {
  if (JSON.stringify(a) === JSON.stringify(e)) passed++
  else {
    failed++
    console.error(`FAIL ${label}\n  exp ${JSON.stringify(e)}\n  got ${JSON.stringify(a)}`)
  }
}

// 1. First sample seeds the accumulator.
{
  const u = new SourceClockUnwrapper()
  eq(u.unwrap(2970, 1000), 2970, "seed returns raw13 unchanged")
}

// 2. No-wrap forward delta: real capture worked example
//    (lens/captures/op1f-notes-2026-08-05.raw.txt:1-2), raw13 2970 then 3118,
//    148 ms apart.
{
  const u = new SourceClockUnwrapper()
  u.unwrap(2970, 1000)
  eq(u.unwrap(3118, 1150), 3118, "no-wrap forward delta matches real capture (148 ms)")
}

// 3. Single wrap disambiguated by the arrival clock: raw counter drops from
//    near-max (8100) to 50 across an arrival gap just over one wrap period
//    (8200 ms). naiveDelta = (50 - 8100) mod 8192 = 142;
//    estimatedWraps = round((8200 - 142) / 8192) = 1.
{
  const u = new SourceClockUnwrapper()
  u.unwrap(8100, 1000)
  eq(u.unwrap(50, 1000 + 8200), 8100 + 142 + 8192, "single wrap resolved from arrival delta")
}

// 4. Multi-wrap: a small raw delta (50) but a large arrival gap (~17000 ms)
//    implies two whole wraps elapsed. estimatedWraps = round((17000 - 50) / 8192) = 2.
{
  const u = new SourceClockUnwrapper()
  u.unwrap(100, 1000)
  eq(u.unwrap(150, 1000 + 17000), 100 + 50 + 2 * 8192, "multi-wrap (2) resolved from arrival delta")
}

// 5. Monotonic: a synthetic scale run of in-range raw13 values with modest
//    arrival gaps never produces a non-increasing step.
{
  const u = new SourceClockUnwrapper()
  const raws = [10, 200, 400, 8000, 100, 300, 8100, 50, 4000]
  let t = 0
  let prev = -1
  let monotonic = true
  for (const r of raws) {
    t += 300 // modest arrival gap, well under one wrap period
    const out = u.unwrap(r, t)
    if (out < prev) monotonic = false
    prev = out
  }
  eq(monotonic, true, "monotonic non-decreasing across a synthetic scale run")
}

// 6. Bounds: raw13 is normalized modulo 8192 (defensive against an
//    out-of-range caller value), and a degenerate arrival delta of 0 does not
//    throw and does not fabricate a backward step.
{
  const u = new SourceClockUnwrapper()
  eq(u.unwrap(8300, 1000), 8300 % 8192, "raw13 out of range is normalized modulo 8192 on seed")
}
{
  const u = new SourceClockUnwrapper()
  const first = u.unwrap(100, 1000)
  let threw = false
  let second = -1
  try {
    second = u.unwrap(50, 1000) // arrival delta of 0, raw counter appears to drop
  } catch {
    threw = true
  }
  eq(threw, false, "zero arrival delta does not throw")
  eq(second >= first, true, "zero arrival delta does not fabricate a backward step")
}

// A small backward step in raw13 must not be mistaken for a near-full wrap
// forward. 102 -> 100 makes naiveDelta 8190, so clamping the wrap estimate to
// 0 (rather than clamping the summed delta) advanced the clock 8190 ms on a
// 2 ms backward jitter, which destroys any downstream tempo estimate. The
// step is held at 0 rather than going negative: this clock is monotonic.
{
  const u = new SourceClockUnwrapper()
  const first = u.unwrap(102, 1000)
  const second = u.unwrap(100, 1002)
  eq(second - first < 100, true, "small backward raw13 jitter does not spike the clock")
  eq(second >= first, true, "small backward raw13 jitter stays monotonic")
}

console.log(`\n${passed} passed, ${failed} failed`)
process.exit(failed === 0 ? 0 : 1)

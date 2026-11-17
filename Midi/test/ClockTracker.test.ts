// ClockTracker + MockMidiTransport integration tests.
//   node --experimental-strip-types --import ./_register.mjs ClockTracker.test.ts

import {ClockTracker} from "../Assets/Midi.lspkg/Timing/ClockTracker"
import {MockMidiTransport} from "../Assets/Midi.lspkg/Transports/MockMidiTransport"
import {MidiParser} from "../Assets/Midi.lspkg/Core/MidiParser"
import {MidiKind} from "../Assets/Midi.lspkg/Core/MidiTypes"
import type {MidiMessage} from "../Assets/Midi.lspkg/Core/MidiTypes"

let passed = 0
let failed = 0

function ok(cond: boolean, label: string): void {
  if (cond) {
    passed++
  } else {
    failed++
    console.error(`FAIL ${label}`)
  }
}

function near(actual: number, expected: number, tol: number, label: string): void {
  ok(Math.abs(actual - expected) <= tol, `${label} (got ${actual.toFixed(2)}, want ~${expected})`)
}

// 1. BPM estimate from hand-fed clock at exactly 120 bpm
{
  const t = new ClockTracker(0.3)
  const secondsPerClock = 60 / (120 * 24)
  t.handle({kind: MidiKind.Start, raw: [0xfa]}, 0)
  let now = 0
  for (let i = 0; i < 96; i++) {
    now += secondsPerClock
    t.handle({kind: MidiKind.Clock, raw: [0xf8]}, now)
  }
  near(t.bpm, 120, 0.5, "clock 120 bpm estimate")
  ok(t.running, "running after start")
  ok(t.tickCount === 96, "tick count 96")
  ok(t.beatInBar === 0, "beatInBar wraps to 0 at bar boundary")
}

// 2. quarterPhase advances 0 -> ~0.5 -> back toward 0
{
  const t = new ClockTracker()
  t.handle({kind: MidiKind.Start, raw: [0xfa]}, 0)
  for (let i = 0; i < 12; i++) {
    t.handle({kind: MidiKind.Clock, raw: [0xf8]}, i * 0.02)
  }
  near(t.quarterPhase, 0.5, 0.01, "quarterPhase at half beat")
}

// 3. Stop halts running
{
  const t = new ClockTracker()
  t.handle({kind: MidiKind.Start, raw: [0xfa]}, 0)
  t.handle({kind: MidiKind.Stop, raw: [0xfc]}, 1)
  ok(!t.running, "stopped")
}

// 4. Mock transport drives real clock + pad events through the parser-free path,
//    and the tracker locks onto the mock's BPM.
{
  const mock = new MockMidiTransport(140)
  const t = new ClockTracker(0.3)
  let now = 0
  let padHits = 0
  mock.onMessage((m: MidiMessage) => {
    t.handle(m, now)
    if (m.kind === MidiKind.NoteOn) {
      padHits++
    }
  })
  mock.start()
  // Step at ~1ms (message-arrival resolution, how a BLE/USB callback delivers
  // clock in the real lens) rather than a 16.7ms render frame, which would
  // quantize the fake clock and cap BPM resolution to ~+-4bpm.
  const dt = 1 / 1000
  for (let i = 0; i < 4000; i++) {
    now += dt
    mock.tick(dt)
  }
  near(t.bpm, 140, 1, "mock transport 140 bpm lock")
  ok(padHits > 0, "mock produced pad hits")
  ok(t.running, "mock running")
}

// 5. Mock output round-trips through the byte parser (serialize raw -> parse)
{
  const mock = new MockMidiTransport(120)
  const parser = new MidiParser()
  const raw: number[] = []
  mock.onMessage((m: MidiMessage) => raw.push(...m.raw))
  mock.start()
  let now = 0
  const dt = 1 / 60
  for (let i = 0; i < 120; i++) {
    now += dt
    mock.tick(dt)
  }
  const reparsed = parser.feed(raw)
  const clocks = reparsed.filter((m) => m.kind === MidiKind.Clock).length
  ok(clocks > 0, "reparsed clocks from mock raw bytes")
}

// 6. A non-positive bpm cannot hang tick(). secondsPerClock goes negative, and
//    the drain loop subtracts it, so clockAccum grows without bound and the loop
//    never exits. That is a freeze on the main thread, not a slow frame.
{
  for (const bpm of [-120, -0.001, 0]) {
    const mock = new MockMidiTransport(bpm)
    const seen: MidiMessage[] = []
    mock.onMessage((m: MidiMessage) => seen.push(m))
    mock.start()
    // start() may emit on its own, so measure only what tick() adds.
    const before = seen.length
    // Without the guard this call does not return for bpm < 0.
    mock.tick(1)
    ok(seen.length === before, `bpm ${bpm} tick returns and adds nothing`)
  }
  // A valid bpm still drives the clock, so the guard is not just short-circuiting.
  const good = new MockMidiTransport(120)
  const got: MidiMessage[] = []
  good.onMessage((m: MidiMessage) => got.push(m))
  good.start()
  const before = got.length
  good.tick(1)
  ok(got.length > before, "bpm 120 still emits after the guard")
}

// 7. Position freezes while stopped, but tempo sync keeps tracking. A master
//    keeps sending clock when stopped, so bpm must survive while beat and bar
//    position must not roll forward, or Continue resumes in the wrong place.
{
  const t = new ClockTracker()
  const clock = (): MidiMessage => ({kind: MidiKind.Clock, raw: [0xf8]})
  let now = 0
  const tick = (): void => {
    now += 1 / 48 // 24 PPQN at 120 bpm
    t.handle(clock(), now)
  }

  t.handle({kind: MidiKind.Start, raw: [0xfa]}, now)
  for (let i = 0; i < 24; i++) tick()
  const atStop = t.tickCount
  const bpmAtStop = t.bpm
  ok(atStop === 24, `24 clocks while running advance the position (got ${atStop})`)

  t.handle({kind: MidiKind.Stop, raw: [0xfc]}, now)
  for (let i = 0; i < 48; i++) tick()
  ok(t.tickCount === atStop, `position frozen while stopped (still ${t.tickCount})`)
  near(t.bpm, bpmAtStop, 2, 'bpm keeps tracking while stopped')

  // Continue resumes from where Stop left off rather than jumping forward.
  t.handle({kind: MidiKind.Continue, raw: [0xfb]}, now)
  for (let i = 0; i < 12; i++) tick()
  ok(t.tickCount === atStop + 12, `Continue resumes from the paused position (got ${t.tickCount})`)
}

// 8. Continue keeps the tempo window when clock kept arriving through the pause,
//    and discards it when the master went silent. Clearing unconditionally threw
//    away the tempo that section 7 preserves; keeping unconditionally would
//    measure the silence as one enormous interval.
{
  const clock = (): MidiMessage => ({kind: MidiKind.Clock, raw: [0xf8]})

  // 8a. Clock kept arriving while stopped, so bpm survives the resume.
  {
    const t = new ClockTracker()
    let now = 0
    const tick = (): void => {
      now += 1 / 48
      t.handle(clock(), now)
    }
    t.handle({kind: MidiKind.Start, raw: [0xfa]}, now)
    for (let i = 0; i < 24; i++) tick()
    t.handle({kind: MidiKind.Stop, raw: [0xfc]}, now)
    for (let i = 0; i < 24; i++) tick()
    t.handle({kind: MidiKind.Continue, raw: [0xfb]}, now)
    near(t.bpm, 120, 2, 'Continue keeps a still-current tempo window')
  }

  // 8b. Master went silent while stopped, so the stale window is discarded
  //     rather than used to measure the gap.
  {
    const t = new ClockTracker()
    let now = 0
    const tick = (): void => {
      now += 1 / 48
      t.handle(clock(), now)
    }
    t.handle({kind: MidiKind.Start, raw: [0xfa]}, now)
    for (let i = 0; i < 24; i++) tick()
    t.handle({kind: MidiKind.Stop, raw: [0xfc]}, now)
    now += 30 // silence
    t.handle({kind: MidiKind.Continue, raw: [0xfb]}, now)
    ok(t.bpm === 0, 'Continue discards a stale window instead of measuring the silence')
    for (let i = 0; i < 3; i++) tick()
    near(t.bpm, 120, 2, 'tempo recovers cleanly after a silent pause')
  }
}

console.log(`\n${passed} passed, ${failed} failed`)
process.exit(failed === 0 ? 0 : 1)

// LeafMidiInteractor tests: the scenario-facing API, delivered through the
// transport it owns. Leaf.lspkg imports resolve to the node stand-ins in stubs/.
//   node --experimental-strip-types --import ./_register.mjs LeafMidiInteractor.test.ts

import {LeafLifecycle} from "Leaf.lspkg/Utils/common/LeafLifecycle"
import type {FaultConfig, MidiMessage} from "../Assets/Midi.lspkg/Testing/LeafMidiInteractor"
import {
  LeafMidiInteractor,
  LeafMidiTransport,
  MidiKind,
  noteOffMessage,
  noteOnMessage
} from "../Assets/Midi.lspkg/Testing/LeafMidiInteractor"

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

function drive(fault?: FaultConfig): {interactor: LeafMidiInteractor; received: MidiMessage[]} {
  const interactor = new LeafMidiInteractor({channel: CHANNEL, fault})
  const received: MidiMessage[] = []
  interactor.transport.onMessage((m) => received.push(m))
  return {interactor, received}
}

const last = (received: MidiMessage[]) => received[received.length - 1]
const kinds = (msgs: MidiMessage[]) => msgs.map((m) => m.kind)
const notes = (msgs: MidiMessage[]) => msgs.map((m) => m.data1)

// 1. Immediate events.
{
  const {interactor, received} = drive()

  interactor.start()
  ok(interactor.transport.connected, "start() connects")
  eq(received[0].kind, MidiKind.Start, "start() emits Start")
  interactor.start()
  eq(received.length, 1, "start() is idempotent")

  interactor.noteOn(60, 100)
  eq(
    [received[1].kind, received[1].data1, received[1].data2, received[1].channel],
    [MidiKind.NoteOn, 60, 100, CHANNEL],
    "noteOn"
  )

  interactor.chord([62, 64, 67])
  eq(notes(received.slice(-3)), [62, 64, 67], "chord")

  interactor.controlChange(1, 40)
  eq(
    [last(received).kind, last(received).data1, last(received).data2],
    [MidiKind.ControlChange, 1, 40],
    "controlChange"
  )

  interactor.pedal(true)
  eq([last(received).data1, last(received).data2], [64, 127], "pedal down")
  interactor.pedal(false)
  eq([last(received).data1, last(received).data2], [64, 0], "pedal up")

  interactor.clock()
  eq(last(received).kind, MidiKind.Clock, "clock")

  const beforeNote = received.length
  await interactor.note(72, 20)
  eq(kinds(received.slice(beforeNote)), [MidiKind.NoteOn, MidiKind.NoteOff], "note() holds then releases")
  eq(notes(received.slice(beforeNote)), [72, 72], "note() releases the same note")

  const beforeInstant = received.length
  await interactor.note(74, 0)
  eq(kinds(received.slice(beforeInstant)), [MidiKind.NoteOn, MidiKind.NoteOff], "note() with 0ms fires both")

  interactor.stop()
  ok(!interactor.transport.connected, "stop() disconnects")
  eq(last(received).kind, MidiKind.Stop, "stop() emits Stop")
  const afterStop = received.length
  interactor.stop()
  eq(received.length, afterStop, "stop() is idempotent")

  // 60, 62, 64 and 67 are still held, so detach() releases them.
  interactor.detach()
  eq(
    kinds(received.slice(afterStop)),
    [MidiKind.NoteOff, MidiKind.NoteOff, MidiKind.NoteOff, MidiKind.NoteOff],
    "detach() releases held notes"
  )
  eq(notes(received.slice(afterStop)), [60, 62, 64, 67], "detach() releases the right notes")
}

// 2. Timed sequences and fault overrides.
{
  const {interactor, received} = drive()
  interactor.start()

  const before = received.length
  await interactor.play([
    {atMs: 0, msg: noteOnMessage(70, 100, CHANNEL)},
    {atMs: 20, msg: noteOffMessage(70, 0, CHANNEL)}
  ])
  eq(kinds(received.slice(before)), [MidiKind.NoteOn, MidiKind.NoteOff], "play() delivers in order")
  eq(notes(received.slice(before)), [70, 70], "play() delivers the scheduled notes")

  const beforeDrop = received.length
  await interactor.play(
    [
      {atMs: 0, msg: noteOnMessage(72, 100, CHANNEL)},
      {atMs: 10, msg: noteOnMessage(73, 100, CHANNEL)}
    ],
    {dropProbability: 1, seed: 7}
  )
  eq(received.length, beforeDrop, "play() per-call fault override applies")
  interactor.detach()

  const configured = drive({dropProbability: 1, seed: 7})
  configured.interactor.start()
  const beforeConfigured = configured.received.length
  await configured.interactor.play([{atMs: 0, msg: noteOnMessage(75, 100, CHANNEL)}])
  eq(configured.received.length, beforeConfigured, "play() falls back to the constructor fault")
  configured.interactor.detach()
}

// 3. Outbound bytes are recorded, not echoed to listeners.
{
  const {interactor, received} = drive()
  interactor.start()
  const before = received.length
  interactor.transport.send([0x99, 60, 100])
  interactor.transport.sendSysEx([0x7e, 0x00, 0x06, 0x01])
  eq(
    interactor.transport.sent,
    [
      [0x99, 60, 100],
      [0xf0, 0x7e, 0x00, 0x06, 0x01, 0xf7]
    ],
    "outbound bytes recorded"
  )
  eq(received.length, before, "outbound bytes not echoed")
  interactor.detach()
}

// 4. Teardown mid-note() releases the note, and every emitter is silent after.
{
  const {interactor, received} = drive()
  interactor.start()
  const before = received.length

  const pending = interactor.note(60, 200)
  interactor.detach()
  await pending
  eq(
    kinds(received.slice(before)),
    [MidiKind.NoteOn, MidiKind.NoteOff, MidiKind.Stop],
    "detach() mid-note() releases then stops"
  )
  eq(received.slice(before)[1].data1, 60, "detach() mid-note() releases the held note")

  const afterDetach = received.length
  interactor.start()
  interactor.noteOn(61)
  interactor.noteOff(61)
  interactor.chord([62, 63])
  interactor.controlChange(1, 40)
  interactor.pedal(true)
  interactor.clock()
  await interactor.note(64, 0)
  await interactor.play([{atMs: 0, msg: noteOnMessage(65, 100, CHANNEL)}])
  eq(received.length, afterDetach, "every emitter is silent after detach()")
}

// 5. start() refuses an unconsumed transport.
{
  const interactor = new LeafMidiInteractor({channel: CHANNEL})
  let threw = false
  try {
    interactor.start()
  } catch {
    threw = true
  }
  ok(threw, "start() throws with no listener")
  ok(!interactor.transport.connected, "start() leaves the transport disconnected when it throws")
  interactor.detach()
}

// 6. A second interactor does not inherit the first's state.
{
  const first = drive()
  first.interactor.start()
  first.interactor.noteOn(60)
  first.interactor.transport.send([0x99, 60, 100])
  first.interactor.detach()
  const firstCount = first.received.length

  const second = drive()
  eq(second.received.length, 0, "fresh interactor has no events")
  eq(second.interactor.transport.sent.length, 0, "fresh interactor has no outbound bytes")
  ok(!second.interactor.transport.connected, "fresh interactor is disconnected")
  second.interactor.start()
  second.interactor.noteOn(61)
  eq(second.received.length, 2, "fresh interactor delivers")
  eq(first.received.length, firstCount, "detached interactor stays silent")
  second.interactor.detach()
}

// 7. LeafLifecycle cleanup detaches a live interactor and unsubscribes it.
{
  const lifecycle = LeafLifecycle.getInstance()
  const baseline = lifecycle.subscriberCount
  const {interactor, received} = drive()
  eq(lifecycle.subscriberCount, baseline + 1, "constructor subscribes to cleanup")
  interactor.start()
  interactor.noteOn(66)
  const before = received.length
  lifecycle.invokeCleanup()
  eq(kinds(received.slice(before)), [MidiKind.NoteOff, MidiKind.Stop], "cleanup releases held notes and stops")
  eq(lifecycle.subscriberCount, baseline, "detach() unsubscribes from cleanup")
  interactor.noteOn(67)
  eq(received.length, before + 2, "interactor is silent after cleanup")
}

// 8. Delivery walks the live listener list, as BaseMidiTransport does: a
// listener registered during delivery also receives the message in flight.
{
  const transport = new LeafMidiTransport()
  const late: MidiMessage[] = []
  let registered = false
  transport.onMessage(() => {
    if (!registered) {
      registered = true
      transport.onMessage((m) => late.push(m))
    }
  })
  transport.deliver(noteOnMessage(60, 100, CHANNEL))
  eq(notes(late), [60], "listener added mid-delivery receives the message in flight")
  eq(transport.listenerCount, 2, "listener added mid-delivery stays subscribed")
}

console.log(`\n${passed} passed, ${failed} failed`)
process.exit(failed === 0 ? 0 : 1)

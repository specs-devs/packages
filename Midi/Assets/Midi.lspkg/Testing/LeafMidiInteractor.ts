import {LeafLifecycle} from "Leaf.lspkg/Utils/common/LeafLifecycle"
import {Logger} from "Leaf.lspkg/Utils/common/Logger"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import type {MidiMessage} from "../Core/MidiTypes"
import {MidiKind} from "../Core/MidiTypes"
import {LeafMidiTransport} from "./LeafMidiTransport"
import type {FaultConfig, TimedEvent} from "./MidiEventBuilder"
import * as build from "./MidiEventBuilder"

export {MidiKind} from "../Core/MidiTypes"
export type {MidiMessage} from "../Core/MidiTypes"
export type {MidiListener, MidiTransport} from "../Transports/MidiTransport"
export {LeafMidiTransport} from "./LeafMidiTransport"
export {
  applyFaults,
  clockMessage,
  controlChangeMessage,
  noteOffMessage,
  noteOnMessage,
  sustainPedalMessage
} from "./MidiEventBuilder"
export type {FaultConfig, TimedEvent} from "./MidiEventBuilder"

export interface LeafMidiInteractorOptions {
  /** Default MIDI channel (0-15) for the note/cc helpers. */
  channel?: number
  /** Default Note On velocity (0-127). */
  defaultVelocity?: number
  /** Default faults applied to play() sequences (per-call override wins). */
  fault?: FaultConfig
}

const DEFAULT_CHANNEL = 0
const DEFAULT_VELOCITY = 100

const LOG = new Logger("LeafMidiInteractor")

/**
 * Drives synthetic MIDI into a lens for LEAF scenarios, at the same seam a real
 * transport feeds. Owns a LeafMidiTransport, exposed as .transport, that the
 * lens consumes exactly like a real one. Detaches automatically when the
 * scenario completes.
 */
export class LeafMidiInteractor {
  readonly transport: LeafMidiTransport
  private lifecycle = LeafLifecycle.getInstance()
  private detached = false
  private heldNotes = new Set<number>()
  private channel: number
  private velocity: number
  private fault?: FaultConfig

  private destroyCallback = () => {
    this.detach()
  }

  constructor(options?: LeafMidiInteractorOptions) {
    this.transport = new LeafMidiTransport()
    this.channel = options?.channel ?? DEFAULT_CHANNEL
    this.velocity = options?.defaultVelocity ?? DEFAULT_VELOCITY
    this.fault = options?.fault
    this.lifecycle.onCleanup.add(this.destroyCallback)
  }

  /**
   * Mark the transport connected and emit a MIDI Start. No-op if already
   * started. Throws if nothing is consuming .transport, since events delivered
   * to no listener would make a scenario pass without testing anything.
   */
  start(): void {
    if (this.detached || this.transport.connected) {
      return
    }
    if (this.transport.listenerCount === 0) {
      throw new Error(
        "LeafMidiInteractor.start(): nothing is consuming .transport. Point the lens under test at interactor.transport first."
      )
    }
    this.transport.start()
  }

  /** Emit a MIDI Stop, if the transport was started. */
  stop(): void {
    if (this.detached) {
      return
    }
    if (this.transport.connected) {
      this.transport.stop()
    }
  }

  /* Single choke point so detach() silences every emitter. */
  private deliver(msg: MidiMessage): void {
    if (this.detached) {
      return
    }
    this.trackHeldNote(msg)
    this.transport.deliver(msg)
  }

  private trackHeldNote(msg: MidiMessage): void {
    if (msg.data1 === undefined) {
      return
    }
    const key = ((msg.channel ?? 0) << 8) | msg.data1
    /* A Note On with velocity 0 is a Note Off. */
    const isNoteOn = msg.kind === MidiKind.NoteOn && (msg.data2 ?? 0) > 0
    if (isNoteOn) {
      this.heldNotes.add(key)
    } else if (msg.kind === MidiKind.NoteOff || msg.kind === MidiKind.NoteOn) {
      this.heldNotes.delete(key)
    }
  }

  /**
   * Deliver a Note Off for every note still held. Called from detach() so a
   * note started before teardown cannot outlive the scenario that played it.
   */
  private releaseHeldNotes(): void {
    const held = Array.from(this.heldNotes)
    this.heldNotes.clear()
    for (const key of held) {
      this.transport.deliver(build.noteOffMessage(key & 0xff, 0, key >> 8))
    }
  }

  /** Deliver a single Note On immediately. */
  noteOn(note: number, velocity?: number): void {
    const vel = velocity ?? this.velocity
    this.deliver(build.noteOnMessage(note, vel, this.channel))
  }

  /** Deliver a single Note Off immediately. */
  noteOff(note: number, velocity = 0): void {
    this.deliver(build.noteOffMessage(note, velocity, this.channel))
  }

  /**
   * Play a note: Note On now, Note Off after durationMs. A non-positive
   * durationMs fires the Note Off immediately (no wait).
   */
  async note(note: number, durationMs = 100, velocity?: number): Promise<void> {
    this.noteOn(note, velocity)
    if (durationMs > 0) {
      await sleep(durationMs)
    }
    if (this.detached) {
      return
    }
    this.noteOff(note)
  }

  /** Deliver several Note Ons at once (a chord). */
  chord(notes: number[], velocity?: number): void {
    const vel = velocity ?? this.velocity
    for (const n of notes) {
      this.deliver(build.noteOnMessage(n, vel, this.channel))
    }
  }

  /** Deliver a control change (e.g. mod wheel, expression). */
  controlChange(cc: number, value: number): void {
    this.deliver(build.controlChangeMessage(cc, value, this.channel))
  }

  /** Sustain pedal down or up (CC 64). */
  pedal(down: boolean): void {
    this.deliver(build.sustainPedalMessage(down, this.channel))
  }

  /** Emit one MIDI clock tick (24 per quarter note). */
  clock(): void {
    this.deliver(build.clockMessage())
  }

  /**
   * Play a timed sequence. Events are delivered in perturbed-time order after
   * applying the fault config (jitter/drift/reorder/drop), pacing real time
   * between them with sleep so the lens sees realistic spacing.
   *
   * @param events - scheduled events with millisecond offsets
   * @param fault - per-call fault override; falls back to the interactor's
   *   configured fault, then to none
   */
  async play(events: TimedEvent[], fault = this.fault): Promise<void> {
    const scheduled = build.applyFaults(events, fault)
    let lastMs = 0
    for (const e of scheduled) {
      const waitMs = e.atMs - lastMs
      if (waitMs > 0) {
        await sleep(waitMs)
      }
      // Never deliver after detach() tore us down mid-wait.
      if (this.detached) {
        return
      }
      lastMs = e.atMs
      this.deliver(e.msg)
    }
    LOG.debug(`play delivered ${scheduled.length} event(s)`)
  }

  /**
   * Release any held notes, emit a MIDI Stop, unsubscribe from the lifecycle,
   * and stop driving. Also called automatically by LeafLifecycle when the
   * scenario completes.
   */
  detach(): void {
    if (this.detached) {
      return
    }
    this.releaseHeldNotes()
    if (this.transport.connected) {
      this.transport.stop()
    }
    this.lifecycle.onCleanup.remove(this.destroyCallback)
    this.detached = true
    LOG.info("Detached MIDI mock")
  }
}

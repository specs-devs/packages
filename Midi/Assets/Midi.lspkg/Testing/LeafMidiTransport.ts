import type {MidiMessage} from "../Core/MidiTypes"
import {MidiKind} from "../Core/MidiTypes"
import type {MidiListener, MidiTransport} from "../Transports/MidiTransport"

/**
 * A MidiTransport that LeafMidiInteractor drives directly. The lens under test
 * consumes it exactly like a real transport, while the interactor injects
 * events through deliver(). Outbound send()/sendSysEx() are recorded so a
 * scenario can assert what the lens sent back to the instrument.
 */
export class LeafMidiTransport implements MidiTransport {
  private listeners: MidiListener[] = []
  private connectedState = false

  /** Bytes the lens sent outward, in call order, for assertions. */
  readonly sent: number[][] = []

  onMessage(listener: MidiListener): void {
    this.listeners.push(listener)
  }

  /** Inject one parsed event into every subscribed listener. */
  deliver(msg: MidiMessage): void {
    for (let i = 0; i < this.listeners.length; i++) {
      this.listeners[i](msg)
    }
  }

  send(bytes: number[]): void {
    this.sent.push(bytes.slice())
  }

  sendSysEx(payload: number[]): void {
    this.sent.push([0xf0, ...payload, 0xf7])
  }

  start(): void {
    this.connectedState = true
    this.deliver({kind: MidiKind.Start, raw: [0xfa]})
  }

  stop(): void {
    // Clear before emitting so a Stop handler reads connected as false.
    this.connectedState = false
    this.deliver({kind: MidiKind.Stop, raw: [0xfc]})
  }

  get connected(): boolean {
    return this.connectedState
  }

  /** Subscribed listener count, so the interactor can detect an unused transport. */
  get listenerCount(): number {
    return this.listeners.length
  }
}

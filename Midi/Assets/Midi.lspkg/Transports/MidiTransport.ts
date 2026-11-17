import type {MidiMessage} from "../Core/MidiTypes"

/**
 * Callback for one inbound message, registered with {@link MidiTransport.onMessage}.
 * Called once per message, in arrival order, synchronously while the transport
 * decodes.
 */
export type MidiListener = (msg: MidiMessage) => void

/**
 * The seam a lens reads MIDI through, so the source can change without the lens
 * changing. Extend {@link BaseMidiTransport} to implement it and only `send`,
 * `sendSysEx`, `start` and `stop` are left to supply.
 *
 * How bytes get *in* is outside the seam, since it differs per link. Inbound is
 * listener-driven; outbound is `send`/`sendSysEx`. A consumer gets fully parsed
 * {@link MidiMessage} values, one listener call each, and must not assume the
 * transport can transmit: a receive-only transport may no-op both send methods.
 */
export interface MidiTransport {
  /**
   * Registers a listener for every inbound message. Register before `start()` so
   * nothing is missed. The interface has no unsubscribe: a listener stays for the
   * life of the transport.
   */
  onMessage(listener: MidiListener): void
  /**
   * Sends one outbound MIDI message: a status byte plus its data bytes (for
   * example `[0xB0, 7, 127]`, a control change on channel 0), or a single
   * system-realtime status byte. The bytes are forwarded as given with only the
   * link's own framing added around them, so they must already be legal MIDI
   * (status 0x80-0xFF, data bytes 0x00-0x7F).
   */
  send(bytes: number[]): void
  /**
   * Sends a SysEx frame. Pass the payload alone and the transport supplies the
   * 0xF0 and 0xF7 delimiters, so `sendSysEx([0x7e, 0x7f, 0x06, 0x01])` goes out
   * as the frame `F0 7E 7F 06 01 F7`.
   */
  sendSysEx(payload: number[]): void
  /** Opens the transport. `connected` becomes true. */
  start(): void
  /** Closes the transport. */
  stop(): void
  /**
   * Whether the transport considers itself open. False until `start()`. Whether
   * `stop()` clears it is implementation-defined. There is no change event.
   */
  readonly connected: boolean
}

/**
 * Shared base for {@link MidiTransport} implementations. Supplies the listener
 * registry, the `connected` getter over the protected `isConnected` flag, and the
 * protected {@link BaseMidiTransport.emit} a subclass calls per decoded message.
 *
 * Listener semantics a subclass inherits: delivery is synchronous and in
 * registration order, on the stack of whatever called `emit()`. The list is live
 * rather than snapshotted, so a listener registering during delivery also
 * receives the message being delivered. Exceptions are not caught, so a throwing
 * listener stops those after it and propagates out of the feed call.
 */
export abstract class BaseMidiTransport implements MidiTransport {
  private listeners: MidiListener[] = []
  protected isConnected = false

  onMessage(listener: MidiListener): void {
    this.listeners.push(listener)
  }

  /** Delivers one message to every registered listener. Called by subclasses. */
  protected emit(msg: MidiMessage): void {
    for (let i = 0; i < this.listeners.length; i++) {
      this.listeners[i](msg)
    }
  }

  get connected(): boolean {
    return this.isConnected
  }

  abstract send(bytes: number[]): void
  abstract sendSysEx(payload: number[]): void
  abstract start(): void
  abstract stop(): void
}

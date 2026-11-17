import {BaseMidiTransport} from "./MidiTransport"
import {MidiParser} from "../Core/MidiParser"
import {channelVoiceDataLen, isDataByte, systemCommonDataLen} from "../Core/MidiTypes"
import type {MidiMessage} from "../Core/MidiTypes"
import {SourceClockUnwrapper} from "../Timing/SourceClockUnwrapper"

/**
 * Sink for outbound BLE-MIDI packets: write these bytes to the peripheral's MIDI
 * GATT characteristic. Pass one to the {@link BleMidiTransport} constructor.
 *
 * Called synchronously from `send()` and `sendSysEx()`, once per call, with a
 * fully framed packet (header byte, timestamp byte, then the MIDI message) and
 * never with a bare MIDI message. Neither caller checks `connected` first, so
 * guard on your side if a write before `start()` or after `stop()` matters.
 *
 * @param packet Framed packet bytes, each 0-255.
 */
export type BleWriteFn = (packet: number[]) => void

/**
 * Listener for the timed channel: a parsed message plus its reconstructed source
 * timing. Register with `onTimedMessage()`; only `feedPacketTimed()` drives it.
 *
 * @param msg The same {@link MidiMessage} object already handed to the
 * `onMessage()` listeners.
 * @param sourceMs The sender's own BLE-MIDI timestamp in milliseconds, unwrapped
 * past the 13-bit counter's 8192 ms rollover. This is the timestamp of the frame
 * that actually carried `msg`, never a neighbouring message's: a message is only
 * ever paired with the timestamp of the frame it came out of. Monotonic within a
 * connection and anchored at the first message's counter reading, so it is an
 * elapsed offset rather than a wall clock, and `reset()` restarts it.
 * @param arrivalNs The `arrivalNs` argument of the `feedPacketTimed()` call that
 * produced this message, forwarded unchanged: nanoseconds on the local receive
 * clock, shared by every message that arrived in the same packet.
 */
export type TimedMidiListener = (msg: MidiMessage, sourceMs: number, arrivalNs: number) => void

/* One framed message's recovered MIDI bytes plus the raw 13-bit BLE-MIDI
   timestamp its frame carried. raw13 is undefined where this channel reports no
   source timestamp: realtime bytes, and SysEx, which can span packets and
   arrival readings.

   Concatenating every segment's bytes in packet order reproduces the raw MIDI
   byte stream exactly, and no segment straddles two framed messages, so feeding
   one segment at a time pairs a timestamp with the messages that segment
   completed. */
interface DeframedSegment {
  bytes: number[]
  raw13: number | undefined
}

/**
 * BLE-MIDI de-framer. Strips the BLE-MIDI framing off a GATT characteristic
 * value and runs the recovered bytes through {@link MidiParser}, which owns every
 * MIDI-level rule; this class only handles the framing. It implements the
 * `MidiTransport` seam, so a lens written against that interface is unchanged
 * when this replaces `MockMidiTransport`.
 *
 * Typical use from a lens-side Bluetooth adapter: construct with a write sink,
 * register `onMessage()`, call `start()`, then call `feedPacket()` for every GATT
 * notification and `stop()` on disconnect. Feeding does not require `start()`;
 * `connected` is reported state, not a gate. Nothing here touches a Lens Studio
 * global, so it also runs under plain node.
 *
 * Framing rules worth knowing as a caller:
 *
 * - A packet starts with a header byte that has bit 7 set. A packet whose first
 *   byte has bit 7 clear is not BLE-MIDI and is rejected whole, as is any packet
 *   shorter than 2 bytes.
 * - Each message in a packet is preceded by a timestamp byte, which also has bit
 *   7 set. A timestamp byte whose low 7 bits are 0x77 is itself 0xF7 and is read
 *   as a timestamp, not as end-of-SysEx.
 * - Running status does not carry across packets: a packet whose first message
 *   omits its status byte is dropped. Within one packet it does apply, including
 *   the chord encoding where later notes reuse both the status byte and the
 *   preceding timestamp.
 * - A SysEx frame can span packets, so an unterminated one persists as instance
 *   state. It aborts on the next well-formed non-realtime status byte instead of
 *   waiting indefinitely for a literal 0xF7. Realtime bytes (0xF8-0xFF)
 *   interleaved inside it pass through as their own messages and do not abort it.
 */
export class BleMidiTransport extends BaseMidiTransport {
  private parser: MidiParser = new MidiParser()
  private running: number = 0 // running-status byte within a packet
  private inSysex: boolean = false // SysEx spans packets, so this is transport state
  private pendingNeed: number = 0 // data bytes the in-flight channel-voice message still needs
  private pendingRaw13: number | undefined // the frame that message pairs on

  /* `running`/`inSysex` above are shared by both feed paths through the one
     deframe() below. Only one feed path runs per transport instance, so a
     single state pair is safe (no coexistence-corruption risk). */
  private readonly write: BleWriteFn
  private timedListeners: TimedMidiListener[] = []
  private readonly unwrapper: SourceClockUnwrapper = new SourceClockUnwrapper()

  /**
   * @param write Sink for outbound packets. Defaults to a no-op, which is what a
   * receive-only lens wants: `send()` and `sendSysEx()` then discard their output
   * instead of failing.
   */
  constructor(write: BleWriteFn = () => {}) {
    super()
    this.write = write
  }

  /**
   * Marks the transport connected, so `connected` reads true. Nothing else: it
   * does not clear de-framer state (use {@link BleMidiTransport.reset}) and it is
   * not a prerequisite for feeding packets.
   */
  start(): void {
    this.isConnected = true
  }

  /**
   * Marks the transport disconnected and calls {@link BleMidiTransport.reset}, so
   * a message or SysEx frame left half-received by the dead connection is dropped
   * rather than emitted. Outbound `send()` is not blocked afterwards.
   */
  stop(): void {
    this.isConnected = false
    this.reset()
  }

  /**
   * Clears all per-connection state: the open-SysEx flag, the within-packet
   * running status, the {@link MidiParser}'s partial message and SysEx buffers,
   * and the source-clock unwrapper's wrap position. Emits nothing even if a
   * message was half-collected, and is safe to call repeatedly or on a fresh
   * transport.
   *
   * Call it on reconnect. The de-framer recovers from a dropped SysEx on its own
   * at the next non-realtime status byte, but only `reset()` clears the unwrapper,
   * so without it the new session's `sourceMs` values are anchored to the old
   * session's wrap boundary.
   */
  reset(): void {
    this.inSysex = false
    this.running = 0
    this.pendingNeed = 0
    this.pendingRaw13 = undefined
    this.parser.reset()
    this.unwrapper.reset() // also per-connection state; see SourceClockUnwrapper.reset()
  }

  /**
   * Decodes one BLE-MIDI packet and delivers every message it completes to the
   * `onMessage()` listeners, in packet order. A message split across packets (a
   * SysEx frame) is emitted on the packet that finishes it.
   *
   * This path does not drive `onTimedMessage()`; use
   * {@link BleMidiTransport.feedPacketTimed} for that.
   *
   * @param packet One GATT characteristic value. Packets shorter than 2 bytes, or
   * whose header byte has bit 7 clear, emit nothing. Malformed or truncated
   * content is dropped rather than throwing.
   */
  feedPacket(packet: number[] | Uint8Array): void {
    const pkt = Array.from(packet)
    if (pkt.length < 2) {
      return
    }
    /* Feed the concatenation of every segment in one parser.feed() call: this
       path ignores the segment boundaries entirely, so its emitted-message
       stream is exactly what a single flat byte array produced. */
    const segments = this.deframe(pkt)
    const raw: number[] = []
    for (let i = 0; i < segments.length; i++) {
      const bytes = segments[i].bytes
      for (let j = 0; j < bytes.length; j++) {
        raw.push(bytes[j])
      }
    }
    if (raw.length > 0) {
      const msgs = this.parser.feed(raw)
      for (let i = 0; i < msgs.length; i++) {
        this.emit(msgs[i])
      }
    }
  }

  /**
   * Registers a listener on the timed channel, which pairs each message whose
   * frame carried a timestamp with that frame's own reconstructed source
   * timestamp. Purely additive: `onMessage()` listeners are
   * unaffected, and nothing here fires unless packets arrive through
   * `feedPacketTimed()`.
   *
   * Listeners are called in registration order and cannot be unregistered.
   */
  onTimedMessage(listener: TimedMidiListener): void {
    this.timedListeners.push(listener)
  }

  /**
   * Decodes one BLE-MIDI packet and, on top of the ordinary `onMessage()`
   * delivery, reconstructs each message's source timestamp for the
   * `onTimedMessage()` listeners. The `onMessage()` stream is identical to what
   * `feedPacket()` would produce for the same bytes.
   *
   * Not every message reaches the timed channel. Realtime bytes (0xF8-0xFF) and
   * SysEx carry no reconstructed source timestamp, so they are emitted on
   * `onMessage()` only. A running-status message that omits even its own
   * timestamp byte (the BLE-MIDI chord encoding) inherits the preceding
   * message's, so all notes of a chord report one `sourceMs`.
   *
   * Each message is paired with the timestamp of the frame it came out of, which
   * is decided structurally rather than by counting: a frame that completes no
   * message (a note-on cut short by an interleaved realtime byte, so its second
   * data byte never arrives) contributes no pairing at all, and does not shift
   * the timestamps of the messages after it in the packet.
   *
   * @param packet One GATT characteristic value, subject to the same
   * 2-byte-minimum and header-bit checks as `feedPacket()`.
   * @param arrivalNs Local arrival time in nanoseconds, read once when the GATT
   * notification was received (Lens Studio's `getRealTimeNanos()`). One reading
   * covers the whole packet: it is forwarded unchanged to every timed callback
   * for these bytes, matching the fact that BLE delivered them together. It also
   * drives the rollover estimate, so it must be monotonic across calls.
   */
  feedPacketTimed(packet: number[] | Uint8Array, arrivalNs: number): void {
    const pkt = Array.from(packet)
    if (pkt.length < 2) {
      return
    }
    /* Feed one segment at a time and pair whatever messages that call emits
       with that segment's own timestamp. A segment that completes no message
       (a note-on cut short by an interleaved realtime byte, a SysEx payload
       byte) contributes no pairing, and its timestamp is not misread as the
       next message's. Safe because MidiParser is a streaming parser that
       carries running status, the partial message and an open SysEx across
       feed() calls, which is the same property feedPacket() relies on across
       packets: the emitted-message sequence depends on byte order, not on where
       the feed() boundaries fall. */
    const segments = this.deframe(pkt)
    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i]
      const msgs = this.parser.feed(seg.bytes)
      if (msgs.length === 0) {
        continue
      }
      /* One unwrap per segment. A segment carrying a timestamp completes at most
         one message, and the chord encoding puts each chord note in its own
         segment, so this is the same per-message unwrap sequence as before for
         any packet whose messages were aligned to begin with. */
      const sourceMs = seg.raw13 === undefined ? undefined : this.unwrapper.unwrap(seg.raw13, arrivalNs / 1e6)
      for (let j = 0; j < msgs.length; j++) {
        this.emit(msgs[j]) // unchanged existing path
        if (sourceMs === undefined) {
          continue
        }
        for (let k = 0; k < this.timedListeners.length; k++) {
          this.timedListeners[k](msgs[j], sourceMs, arrivalNs)
        }
      }
    }
  }

  /* Strip header + timestamp bytes, recovering the raw MIDI byte stream as an
     ordered list of {@link DeframedSegment}: the bytes of one framed message plus
     the reconstructed raw 13-bit BLE-MIDI timestamp its frame carried, or
     undefined where this channel reports no source timestamp (realtime bytes;
     SysEx, which can span packets and arrival readings). A running-status message
     that omits even its own timestamp byte (the canonical BLE-MIDI chord
     encoding) inherits the immediately preceding message's raw13.

     Segments keep the timestamp pairing structural rather than positional, which
     matters because MidiParser emits one message per completed message, not one
     per framed message. */
  private deframe(pkt: number[]): DeframedSegment[] {
    const segments: DeframedSegment[] = []
    let lastRaw13: number | undefined
    const header = pkt[0]
    if (!(header & 0x80)) {
      // Not BLE-MIDI framing: the header byte must have bit7 set (0b10dddddd).
      return []
    }
    let i = 1 // skip header
    /* running status does not carry across packets in BLE MIDI, but an open
       SysEx does - this.inSysex is instance state, reset it only on F7 (or
       on an aborting status byte, see the inSysex branch below). */
    this.running = 0
    this.pendingNeed = 0
    this.pendingRaw13 = undefined

    /* Consumes the status byte `s` at pkt[i] plus its data bytes, and returns
       the index to resume at. Shared by the normal flow and the SysEx abort. */
    const consumeStatus = (s: number, raw13: number): number => {
      if (s >= 0xf8) {
        // realtime, no reconstructed timestamp on this channel
        segments.push({bytes: [s], raw13: undefined})
        return i + 1
      }
      if (s === 0xf0) {
        segments.push({bytes: [0xf0], raw13: undefined})
        this.running = 0
        this.pendingNeed = 0
        this.inSysex = true
        return i + 1
      }
      const bytes = [s]
      lastRaw13 = raw13
      this.running = s < 0xf0 ? s : 0
      const need = s < 0xf0 ? channelVoiceDataLen(s) : systemCommonDataLen(s)
      let j = i + 1
      for (let k = 0; k < need; k++) {
        if (j < pkt.length && isDataByte(pkt[j])) {
          bytes.push(pkt[j])
          j++
        }
      }
      /* A message can run out of packet bytes mid-collection when a realtime
         byte with its own timestamp interrupts it. Remember the shortfall so a
         later bare data byte completes this message instead of starting a new
         running-status one, and remember the frame it pairs on. */
      this.pendingNeed = need - (bytes.length - 1)
      this.pendingRaw13 = raw13
      segments.push({bytes, raw13})
      return j
    }

    while (i < pkt.length) {
      const b = pkt[i]
      if (this.inSysex) {
        if (!(b & 0x80)) {
          /* Plain SysEx payload byte, one per segment. It completes no message,
             so it can carry no pairing and its own raw13 would be moot; keeping
             segments one-message-wide is what makes the pairing structural. */
          segments.push({bytes: [b], raw13: undefined})
          i++
          continue
        }
        /* b has bit7 set. Per BLE-MIDI framing, every message interleaved
           inside a SysEx (a realtime byte, or the terminating F7) is
           preceded by its own timestamp byte, so a bit7 byte reached here
           with no message already in progress is always a timestamp, never
           a status byte itself, exactly the convention the non-SysEx path
           below relies on. Peek at what it precedes to decide realtime
           passthrough vs termination vs abort.

           0xF7 gets no special case ahead of this: a timestamp whose low 7
           bits are 0x77 IS 0xF7, so reading it as EOX closes the SysEx one
           byte early and then eats the real EOX as the next timestamp,
           desyncing the rest of the packet. 1 in 128 timestamps hits it. */
        const raw13 = ((header & 0x3f) << 7) | (b & 0x7f)
        i++
        if (i >= pkt.length) {
          break // dangling timestamp, nothing follows
        }
        const s = pkt[i]
        if (s === 0xf7) {
          /* Closes the frame, so this is the segment the SysEx message is
             emitted on, and it deliberately carries no timestamp. */
          segments.push({bytes: [0xf7], raw13: undefined})
          this.inSysex = false
          i++
          continue
        }
        if (s >= 0xf8) {
          // Realtime is legal inside an open SysEx and must not abort it.
          segments.push({bytes: [s], raw13: undefined})
          i++
          continue
        }
        if (s & 0x80) {
          /* A genuine timestamp really did precede s (that is how BLE-MIDI
             frames every message, including whatever the sender emits after
             a SysEx it never got to close), so this is a real status byte,
             not more SysEx payload. MidiParser already applies the MIDI 1.0
             rule that any non-realtime status aborts an open SysEx; this
             de-framer previously never let such a byte through to trigger
             it. Abort here and hand s (with its own raw13) to the same
             status-byte handling a fresh message gets. */
          this.inSysex = false
          i = consumeStatus(s, raw13)
          continue
        }
        /* s has bit7 clear: a plain data byte directly after what looked
           like a timestamp. Not valid framing for SysEx continuation (a
           plain payload byte needs no timestamp of its own), so the
           presumed timestamp was spurious; drop it and let s be
           re-examined as ordinary SysEx data on the next iteration. */
        continue
      }
      if (!(b & 0x80)) {
        /* A bare data byte belonging to a message that is still mid-collection.
           Re-inserting the running-status byte here would reset MidiParser's
           half-collected message and discard the data bytes already gathered,
           silently dropping the message. Emit the byte on its own so the
           message completes, and pair it with the frame the message arrived on. */
        if (this.pendingNeed > 0) {
          const bytes = [b]
          i++
          this.pendingNeed--
          while (this.pendingNeed > 0 && i < pkt.length && isDataByte(pkt[i])) {
            bytes.push(pkt[i])
            i++
            this.pendingNeed--
          }
          segments.push({bytes, raw13: this.pendingNeed === 0 ? this.pendingRaw13 : undefined})
          continue
        }
        // running-status data byte with no timestamp byte of its own (chord)
        if (this.running !== 0) {
          const bytes = [this.running, b]
          i++
          const need = channelVoiceDataLen(this.running)
          for (let k = 1; k < need; k++) {
            if (i < pkt.length && isDataByte(pkt[i])) {
              bytes.push(pkt[i])
              i++
            }
          }
          /* Record any shortfall, as consumeStatus does: a realtime byte can
             interrupt this message before its data bytes arrive. */
          this.pendingNeed = need - (bytes.length - 1)
          this.pendingRaw13 = lastRaw13
          segments.push({bytes, raw13: lastRaw13})
        } else {
          i++ // stray, drop
        }
        continue
      }
      // b has bit7 set: it's a timestamp byte; the following byte is the message.
      const raw13 = ((header & 0x3f) << 7) | (b & 0x7f)
      i++
      if (i >= pkt.length) {
        break
      }
      const s = pkt[i]
      if (!(s & 0x80)) {
        // running status: no status byte, but a genuine timestamp byte for this message
        if (this.running !== 0) {
          const bytes = [this.running, s]
          lastRaw13 = raw13
          i++
          const need = channelVoiceDataLen(this.running)
          for (let k = 1; k < need; k++) {
            if (i < pkt.length && isDataByte(pkt[i])) {
              bytes.push(pkt[i])
              i++
            }
          }
          this.pendingNeed = need - (bytes.length - 1)
          this.pendingRaw13 = raw13
          segments.push({bytes, raw13})
        } else {
          i++
        }
        continue
      }
      // s is a status byte
      i = consumeStatus(s, raw13)
    }
    return segments
  }

  private encode(bytes: number[]): number[] {
    /* Minimal BLE-MIDI encode: header + single timestamp + message. Timestamp
       low/high are cosmetic here (0), which real stacks accept for output. */
    return [0x80, 0x80, ...bytes]
  }

  /**
   * Frames one MIDI message and hands it to the write sink. The frame is a header
   * byte, a single timestamp byte, then the bytes given; both framing bytes are
   * 0x80, that is timestamp 0, which real stacks accept on output.
   *
   * @param bytes One complete MIDI message, status byte first, for example
   * `[0xB0, 7, 127]` for a volume control change on channel 0. Not validated and
   * not gated on `connected`.
   */
  send(bytes: number[]): void {
    this.write(this.encode(bytes))
  }

  /**
   * Frames a SysEx message and hands it to the write sink, with its own timestamp
   * byte before the terminating 0xF7 as BLE-MIDI requires.
   *
   * @param payload The SysEx body, with or without the enclosing 0xF0 and 0xF7:
   * `[0x7E, 0x7F, 0x06, 0x01]` and `[0xF0, 0x7E, 0x7F, 0x06, 0x01, 0xF7]` produce
   * the same packet. A payload starting with 0xF0 is taken to be already framed,
   * so its last byte is treated as the terminator and replaced; pass such a
   * payload complete, or 0xF0-first but unterminated input silently loses its
   * final data byte.
   */
  sendSysEx(payload: number[]): void {
    const framed = payload[0] === 0xf0 ? payload : [0xf0, ...payload, 0xf7]
    // header, ts, F0, data..., ts, F7
    const body = framed.slice(1, framed.length - 1)
    this.write([0x80, 0x80, 0xf0, ...body, 0x80, 0xf7])
  }
}

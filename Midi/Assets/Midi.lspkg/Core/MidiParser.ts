import type {MidiMessage} from "./MidiTypes"
import {MidiKind, channelVoiceDataLen, isDataByte, isRealtime, systemCommonDataLen} from "./MidiTypes"

/**
 * Incremental MIDI byte-stream parser: feed it raw MIDI bytes as they arrive and
 * it returns {@link MidiMessage} objects. It owns every MIDI-level rule, so a
 * transport does not have to; `BleMidiTransport` strips BLE-MIDI framing and
 * hands the recovered bytes straight to this class.
 *
 * The rules it implements:
 *
 * - Running status. A channel-voice status byte (0x80-0xEF) arms itself for
 *   reuse, so each bare pair of data bytes after it produces another message of
 *   the same kind and channel. That arming survives across `feed()` calls. Any
 *   system byte 0xF0-0xF7 clears it.
 * - System realtime (0xF8-0xFF). Emitted as its own single-byte message the
 *   moment it arrives, even between the bytes of another message or inside a
 *   SysEx frame, and it disturbs neither the message being collected nor running
 *   status.
 * - SysEx. 0xF0 opens the frame and 0xF7 closes it, and the frame may span any
 *   number of `feed()` calls. Interleaved realtime bytes are excluded from the
 *   collected payload. Any other status byte aborts the frame and discards it,
 *   per MIDI 1.0.
 *
 * Uninterpretable input is dropped silently, never thrown: a data byte with no
 * status byte and no armed running status, a 0xF7 with no open SysEx, and the
 * bytes of a message that never completes.
 *
 * Pure logic with no Lens Studio globals.
 */
/** Cap on one buffered SysEx frame. A frame this large is a malfunctioning
 * device, not a message worth keeping. */
const MAX_SYSEX_BYTES = 65536

export class MidiParser {
  private runningStatus: number = 0 // last channel-voice status, 0 = none
  private pending: number = 0 // status byte currently collecting data (channel or common)
  private need: number = 0 // data bytes still expected for `pending`
  private data: number[] = []
  private inSysex: boolean = false
  private sysex: number[] = []
  private sysexOverflow: boolean = false

  /**
   * Parses the next chunk of the byte stream, carrying any unfinished message
   * over to the following call.
   *
   * @param bytes Raw MIDI bytes with no BLE-MIDI framing. The buffer may cut a
   * message or a SysEx frame at any byte; the remainder carries into the next
   * call.
   * @returns The messages these bytes completed, in the order they completed.
   * Empty if the bytes only advanced something already in progress. See
   * {@link MidiMessage} for which fields each kind populates.
   */
  feed(bytes: number[] | Uint8Array): MidiMessage[] {
    const out: MidiMessage[] = []
    for (let i = 0; i < bytes.length; i++) {
      this.step(bytes[i], out)
    }
    return out
  }

  /**
   * Drops all parse state: running status, the message being collected, and any
   * open SysEx frame. Returns and emits nothing, so a half-collected message is
   * discarded rather than flushed.
   *
   * Call it whenever the byte stream is discontinuous, such as a BLE reconnect,
   * so leftovers from the old stream cannot merge into the new one.
   */
  reset(): void {
    this.runningStatus = 0
    this.pending = 0
    this.need = 0
    this.data = []
    this.inSysex = false
    this.sysex = []
  }

  private step(b: number, out: MidiMessage[]): void {
    /* System realtime: single byte, may interrupt anything, never disturbs
       running status or an in-progress message/SysEx. */
    if (isRealtime(b)) {
      out.push(this.realtime(b))
      return
    }

    if (isDataByte(b)) {
      if (this.inSysex) {
        /* A device that never sends its F7, or one glitching bit 7 low, would
           otherwise buffer without limit. Past the cap the frame is abandoned
           rather than emitted truncated, since a partial SysEx is not a
           meaningful message. */
        if (this.sysex.length >= MAX_SYSEX_BYTES) {
          this.sysexOverflow = true
          return
        }
        this.sysex.push(b)
        return
      }
      if (this.pending === 0) {
        /* No status to attach to (or first data after a 0-arg status). Try
           running status for channel-voice continuation. */
        if (this.runningStatus !== 0) {
          this.pending = this.runningStatus
          this.need = channelVoiceDataLen(this.runningStatus)
        } else {
          return // stray data byte, ignore
        }
      }
      this.data.push(b)
      if (this.data.length >= this.need) {
        out.push(this.buildChannelOrCommon())
        /* For channel-voice, keep running status so the next data byte reuses
           it. For system-common, running status was already cleared on the
           status byte, so start fresh. */
        this.data = []
        if (this.pending >= 0xf0) {
          this.pending = 0
        } else {
          this.pending = 0 // wait for the next data byte to re-arm via runningStatus
        }
      }
      return
    }

    // Status byte (0x80..0xF7, non-realtime)
    if (b === 0xf0) {
      this.inSysex = true
      this.sysex = [0xf0]
      this.sysexOverflow = false
      this.runningStatus = 0
      this.pending = 0
      this.data = []
      return
    }
    if (b === 0xf7) {
      if (this.inSysex) {
        this.sysex.push(0xf7)
        if (!this.sysexOverflow) {
          out.push({kind: MidiKind.SysEx, sysex: this.sysex.slice(), raw: this.sysex.slice()})
        }
        this.sysexOverflow = false
      }
      this.inSysex = false
      this.sysex = []
      this.runningStatus = 0
      this.pending = 0
      this.data = []
      return
    }
    /* Any other status aborts an in-progress SysEx (spec: only realtime may
       interleave inside SysEx). */
    if (this.inSysex) {
      this.inSysex = false
      this.sysex = []
    }

    if (b < 0xf0) {
      // Channel-voice status: arms running status.
      this.runningStatus = b
      this.pending = b
      this.need = channelVoiceDataLen(b)
      this.data = []
      if (this.need === 0) {
        out.push(this.buildChannelOrCommon())
        this.pending = 0
      }
    } else {
      // System-common (0xF1..0xF6): clears running status, no reuse.
      this.runningStatus = 0
      this.pending = b
      this.need = systemCommonDataLen(b)
      this.data = []
      if (this.need === 0) {
        out.push(this.buildChannelOrCommon())
        this.pending = 0
      }
    }
  }

  private realtime(b: number): MidiMessage {
    const kind =
      b === 0xf8
        ? MidiKind.Clock
        : b === 0xfa
          ? MidiKind.Start
          : b === 0xfb
            ? MidiKind.Continue
            : b === 0xfc
              ? MidiKind.Stop
              : MidiKind.Other
    return {kind, raw: [b]}
  }

  private buildChannelOrCommon(): MidiMessage {
    const status = this.pending
    const d = this.data
    const raw = status >= 0x80 ? [status, ...d] : [...d]

    if (status < 0xf0) {
      const channel = status & 0x0f
      const hi = status & 0xf0
      switch (hi) {
        case 0x80:
          return {kind: MidiKind.NoteOff, channel, data1: d[0], data2: d[1], raw}
        case 0x90:
          // note-on with velocity 0 is a note-off by convention
          return {
            kind: d[1] === 0 ? MidiKind.NoteOff : MidiKind.NoteOn,
            channel,
            data1: d[0],
            data2: d[1],
            raw
          }
        case 0xa0:
          return {kind: MidiKind.PolyAftertouch, channel, data1: d[0], data2: d[1], raw}
        case 0xb0:
          return {kind: MidiKind.ControlChange, channel, data1: d[0], data2: d[1], raw}
        case 0xc0:
          return {kind: MidiKind.ProgramChange, channel, data1: d[0], raw}
        case 0xd0:
          return {kind: MidiKind.ChannelPressure, channel, data1: d[0], raw}
        case 0xe0:
          return {kind: MidiKind.PitchBend, channel, bend: ((d[1] << 7) | d[0]) - 8192, raw}
      }
    }
    if (status === 0xf2) {
      return {kind: MidiKind.SongPosition, songPosition: (d[1] << 7) | d[0], raw}
    }
    return {kind: MidiKind.Other, raw}
  }
}

/**
 * The message kinds this package emits, one per MIDI status it models.
 *
 * A const object plus a same-named string-literal union (below) rather than a TS
 * `enum`, so a single `import { MidiKind } from 'Midi.lspkg/Core/MidiTypes'` gives you
 * both the values and the type, and the module still runs under node's
 * strip-only type mode, which rejects runtime enums. The values are plain
 * strings, so comparing against `'noteOn'` directly also works.
 */
export const MidiKind = {
  NoteOff: "noteOff",
  NoteOn: "noteOn",
  PolyAftertouch: "polyAftertouch",
  ControlChange: "controlChange",
  ProgramChange: "programChange",
  ChannelPressure: "channelPressure",
  PitchBend: "pitchBend",
  SysEx: "sysEx",
  Clock: "clock", // 0xF8, 24 per quarter note
  Start: "start", // 0xFA
  Continue: "continue", // 0xFB
  Stop: "stop", // 0xFC
  SongPosition: "songPosition", // 0xF2
  Other: "other" // realtime/common we do not model explicitly
} as const

/** Union of the {@link MidiKind} values, e.g. `'noteOn' | 'clock' | ...`. */
export type MidiKind = (typeof MidiKind)[keyof typeof MidiKind]

/**
 * One parsed MIDI message. `kind` and `raw` are always set; which of the
 * optional fields are populated depends on `kind`, and a field not listed for a
 * kind is absent rather than zero:
 *
 * - `NoteOff`, `NoteOn`, `PolyAftertouch`, `ControlChange`: `channel`, `data1`, `data2`
 * - `ProgramChange`, `ChannelPressure`: `channel`, `data1` (single-data-byte statuses)
 * - `PitchBend`: `channel` and `bend`, never `data1`/`data2`
 * - `SysEx`: `sysex` (and `raw` holds the same bytes)
 * - `SongPosition`: `songPosition` only, no `channel`
 * - `Clock`, `Start`, `Continue`, `Stop`: nothing beyond `kind` and a 1-byte `raw`
 * - `Other`: nothing beyond `kind` and `raw` (unmodelled system-common such as
 *   0xF1/0xF3/0xF6, plus realtime bytes other than clock and transport)
 *
 * A Note On with velocity 0 is reported as `kind: NoteOff` with `data2 === 0`,
 * the conventional running-note-off encoding, so consumers do not need to
 * special-case it.
 */
export interface MidiMessage {
  kind: MidiKind
  // Channel-voice fields. Which of these a kind sets varies; see above.
  channel?: number // 0-15
  data1?: number // note / cc number / program, 0-127
  data2?: number // velocity / cc value, 0-127
  // Aggregates
  bend?: number // pitch bend, -8192..8191 (PitchBend only)
  sysex?: number[] // full frame incl. 0xF0..0xF7 (SysEx only)
  songPosition?: number // 14-bit MIDI beats (SongPosition only)
  /**
   * The bytes of this message: status byte followed by its data bytes, a single
   * byte for realtime, or the whole frame for SysEx. Under running status the
   * status byte the sender omitted is filled back in, so `raw` can be one byte
   * longer than what arrived on the wire. Realtime bytes that interleaved inside
   * this message are reported as their own messages and excluded here.
   */
  raw: number[]
}

// Status byte helpers
/**
 * True for a status byte (bit 7 set, 0x80-0xFF).
 *
 * Note for BLE-MIDI callers: timestamp bytes also have bit 7 set, so inside a
 * packet this predicate alone cannot tell status from timestamp. `BleMidiTransport`
 * disambiguates using expected message lengths.
 *
 * @internal Exported for tests only. Nothing in this package calls it, so it is
 * not part of the supported surface and may be removed without a major bump.
 */
export const isStatus = (b: number): boolean => b >= 0x80
/**
 * True for a system-realtime status byte (0xF8-0xFF). These are single bytes
 * that may appear anywhere, including between the bytes of another message and
 * inside a SysEx frame, and they never disturb running status.
 */
export const isRealtime = (b: number): boolean => b >= 0xf8
/** True for a data byte (bit 7 clear, 0x00-0x7F). */
export const isDataByte = (b: number): boolean => b < 0x80

/**
 * How many data bytes follow a channel-voice status byte, excluding the status
 * byte itself. Keyed on the high nibble, so the channel (low nibble, 0-15) is
 * ignored.
 *
 * @param status Status byte, e.g. 0x93 for note on channel 3.
 * @returns 2 for note off/note on/poly aftertouch/control change/pitch bend, 1
 * for program change and channel pressure, 0 for anything else (including
 * system bytes 0xF0-0xFF, which this function does not describe).
 */
export function channelVoiceDataLen(status: number): number {
  switch (status & 0xf0) {
    case 0x80: // note off
    case 0x90: // note on
    case 0xa0: // poly aftertouch
    case 0xb0: // control change
    case 0xe0: // pitch bend
      return 2
    case 0xc0: // program change
    case 0xd0: // channel pressure
      return 1
    default:
      return 0
  }
}

/**
 * How many data bytes follow a system-common status byte, excluding the status
 * byte itself. Matches the whole byte, not a nibble.
 *
 * @param status Status byte in the 0xF1-0xF7 range.
 * @returns 2 for song position pointer (0xF2), 1 for MTC quarter frame (0xF1)
 * and song select (0xF3), 0 for everything else. SysEx (0xF0/0xF7) and realtime
 * (0xF8-0xFF) also return 0 because they are not fixed-length; handle those
 * before calling this.
 */
export function systemCommonDataLen(status: number): number {
  switch (status) {
    case 0xf1: // MTC quarter frame
    case 0xf3: // song select
      return 1
    case 0xf2: // song position pointer
      return 2
    default: // 0xf6 tune request, others
      return 0
  }
}

/**
 * Akai's MIDI manufacturer id, the first payload byte after 0xF0 in an Akai
 * SysEx frame. Provided for consumers that route SysEx by vendor; nothing in
 * this package matches on it.
 *
 * @internal Exported for tests only. No consumer in this package reads it, so
 * it is not part of the supported surface and may be removed without a major
 * bump. Promote it deliberately if a lens starts routing SysEx by vendor.
 */
export const MPC_AKAI_SYSEX_ID = 0x47 // Akai manufacturer id, for SysEx routing later
/**
 * MIDI clock resolution: 24 clock pulses per quarter note (PPQN). `ClockTracker`
 * uses it to turn clock arrival intervals into BPM and to derive beat and bar
 * phase.
 */
export const CLOCKS_PER_QUARTER = 24

const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]

/**
 * Formats a MIDI note number as a pitch name plus octave, e.g. 60 -> `"C4"` and
 * 54 -> `"F#3"`.
 *
 * Uses the convention where note 60 is middle C and is named C4, which puts the
 * MIDI range at `"C-1"` (0) through `"G9"` (127); concert A (69) is `"A4"`.
 * Accidentals are always spelled as sharps, never flats.
 *
 * @param note MIDI note number, normally 0-127.
 * @returns Pitch name and octave. Never throws and never clamps: out-of-range
 * input keeps counting in the same scheme, so 128 is `"G#9"` and -1 is `"B-2"`.
 */
export function midiNoteName(note: number): string {
  const pitchClass = ((note % 12) + 12) % 12
  const octave = Math.floor(note / 12) - 1
  return `${NOTE_NAMES[pitchClass]}${octave}`
}

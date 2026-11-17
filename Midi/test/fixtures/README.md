# BLE-MIDI replay fixtures

Frozen real captures that lock the shared BLE de-framer (`../../BleMidiTransport.ts`)
against a real Spectacles BLE stack, replayed with no hardware in CI.

## op1f-notes.ts

- **Source device:** Teenage Engineering OP-1 Field (Phase 1 Q7 instrument), BLE-MIDI peripheral, addr `D8 E8 B1 88 8D 21`.
- **Host:** Spectacles, SpecsXMPC lens, on-device (`dumpRawPackets` on).
- **Captured:** 2026-08-05, from `lens/captures/op1f-notes-2026-08-05.raw.txt`.
- **Content:** 139 GATT characteristic notifications of free playing: single notes, ascending/descending runs, and overlapping notes (up to 3 voices at once). Channel 0, notes 53-76, note-on velocity 127 / note-off velocity 0. 70 note-ons, 69 note-offs (one note was still held when the capture ended).

`OP1F_NOTE_PACKETS` is the raw packets in arrival order. `OP1F_EXPECTED` is the
expected event sequence, decoded by `gen_op1f_notes.py`, an **independent** spec
deframer, **not** by the module under test, so the regression proves
`BleMidiTransport` agrees with a second implementation rather than with itself.
`BleMidiFixtures.test.ts` additionally hand-decodes two packets inline as a
human-independent anchor. Regenerate with:

```
python3 gen_op1f_notes.py ../../../captures/op1f-notes-2026-08-05.raw.txt > op1f-notes.ts
```

Never regenerate `OP1F_EXPECTED` from `BleMidiTransport` output; that would make
the regression circular. The generator is committed so the independence is
reproducible and enforceable.

## Coverage boundary of this capture

This was free playing on an OP-1 Field, and every one of the 139 packets is a
single channel-voice message (channel 0) with an explicit status byte, note-on
velocity 127 / note-off velocity 0. So the fixture exercises the **common note
path** of the de-framer with real bytes, and nothing more. It does **not**
exercise, and this capture does not prove:

- within-notification running status (no packet omits its status byte);
- multiple MIDI messages packed into one GATT notification (every notification is one message);
- note-on velocity 0 used as note-off (all note-offs are explicit `0x80`);
- Control Change / sustain pedal (CC64) - the OP-1 Field play emits notes, not CC;
- realtime (clock/start/stop) or SysEx.

Those framing paths are covered by the synthetic vectors in
`BleMidiTransport.test.ts` and remain **real-data-unverified** until a capture
that contains them exists. A CC / pedal take can be captured from a controller
that sends CC (e.g. the Alesis Recital via the WIDI bridge) and added as a
second fixture; a multi-message / running-status take would need an instrument
or bridge that batches events per notification.

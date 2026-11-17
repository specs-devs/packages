# Midi troubleshooting

[← Agent usage index](../README.md)

## Use when

Diagnose notes, clock values, callback order and connection assumptions.

| Symptom | Cause to check | Fix |
| --- | --- | --- |
| No real keyboard notes | Transport does not scan/pair/subscribe | Implement Lens-side Bluetooth GATT adapter and forward payloads |
| Raw bytes parse incorrectly | BLE header/timestamps passed to raw parser | Use BleMidiTransport for GATT BLE-MIDI packets |
| Notes doubled | Same packet fed to both BLE methods | Use exactly one feed path for each notification |
| Timed callback misses clock/SysEx | These lack reconstructed source timestamps | Use onMessage for realtime and SysEx |
| BPM off by powers of 1000 | Wrong units | ClockTracker seconds, source timestamp ms, feed arrival ns |
| held keys never release in mock | Mock emits no NoteOff | Define an explicit visual decay or use real note-off fixtures |
| connected true after mock stop | Mock intentionally preserves connection state | Track running via transport commands or ClockTracker |
| callbacks after one stop | No unsubscribe in seam | Retain one transport/listener set or gate consumer work |
| listener suppresses later callbacks | Exception propagates synchronously | Handle consumer exceptions before returning from listener |
| source timing jumps on reconnect | Unwrapper not reset | BleMidiTransport.stop/reset on disconnect/reconnect |
| SysEx output loses last byte | Payload begins F0 but lacks complete F7 terminator | Pass payload-only or complete F0..F7 frame |
| Demo panel's top (the "Midi" title) cut off on SPECS | Something lifted the panel high (e.g. a head-anchored QA carousel adds ~33 cm), so its top passes the ~±18° vertical field of view at 130 cm | Keep the panel near eye level: lower the instance (the demo scene uses y −15) or place it at z ≈ −110 without extra lift |
| Panel reads BPM 69–71 while `bpm` is 70 | The panel feeds `ClockTracker` with `getTime()`, so the mock's clocks are stamped per frame (several per frame at 60 fps) and the one-quarter-note window jitters by about a frame | Expected in the mock; for exact tempo use the `bpm` you set, or feed real arrival times from your transport |
| `BPM —` right after Stop | `ClockTracker.running` goes false on the mock's `Stop`; the panel then hides the estimate | Expected; Start emits `Start` and the estimate returns after two clocks |
| Old `GUIDE_ReadAndDisable` text in a scene instance | Instance made from an older prefab revision | Replace the instance with a fresh one from `Midi__PLACE_IN_SCENE.prefab`; this revision's guide is the `Guide` child driven by `Example/GuideDismissPanel` |
| Source README mentions missing release docs | Repository support files are not installed package assets | Use this revision's source contract; confirm release availability separately |

Preview-verified (2026-10-01): panel, pads, readout, Start/Stop. Device BLE, `PianoVisualizer` and the timed feed remain unverified. Mock guards nonpositive BPM; large elapsed dt emits a burst of every due pulse rather than dropping clocks.

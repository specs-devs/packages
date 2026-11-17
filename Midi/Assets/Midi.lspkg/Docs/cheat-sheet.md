# Midi cheat-sheet

[← Agent usage index](../README.md)

## Use when

Read first before choosing a transport or interpreting timestamps.

1. Register listeners before start; BaseMidiTransport delivery is synchronous and there is no unsubscribe. → [Components](components.md)
2. BLE-MIDI packets go to feedPacket/feedPacketTimed; raw MIDI bytes go to MidiParser.feed. → [Examples](examples.md)
3. Choose one BLE feed path per connection; do not feed identical notifications to both. → [Troubleshooting](troubleshooting.md)
4. feedPacketTimed arrivalNs is nanoseconds; sourceMs is reconstructed milliseconds; ClockTracker.handle uses seconds. → [Components](components.md)
5. Timed listeners omit realtime and SysEx messages; ordinary onMessage still receives them. → [API status](api-status.md)
6. MIDI channel is zero-based 0..15; note-on velocity 0 becomes NoteOff. → [Components](components.md)
7. Mock emits NoteOn but no NoteOff, and stop leaves connected true. → [Troubleshooting](troubleshooting.md)
8. BleMidiTransport start only sets reported state; the Lens owns Bluetooth and outgoing writes are not connection-gated. → [Examples](examples.md)
9. Reset connection state on reconnect; a stale clock or partial SysEx must not cross connections. → [Components](components.md)

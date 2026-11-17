# MocopiReceiver cheat sheet

[← Agent usage index](../README.md)

## Use when

Read before placing the demo or consuming controller callbacks.

1. Use the wired prefab; creating a bare ScriptComponent and casting it does not create a Mocopi class. → [Prefab setup](examples.md#prefab-setup)
2. Configure a valid ws/wss endpoint yourself. Basic-avatar prefab's URL contains an instructional prefix; the source default alone does not override it. → [Troubleshooting](troubleshooting.md)
3. Place first, then initialize with a skeleton. Avatar initialization requires PrefabPlacement and its instantiated prefab. → [Avatar API](components.md#mocopiavatarcontroller)
4. Main controller installs all WebSocket callback slots on Awake. Wrap existing slots on Start if consuming events; never silently replace frame routing. → [Callback wrapper](examples.md#observe-frame-receipt)
5. Frames received before skeleton are dropped by Main. Bone transforms use local coordinates, and automatic mapping clears previous manual mappings. → [Protocol](components.md#mocopidatatypes)
6. `smoothFactor` applies interpolation factor `1 - smoothFactor`; 0 means no interpolation and 1 freezes the current transform. Input values are not clamped. → [Source gaps](api-status.md#known-source-gaps)
7. `resetPose()` sets identity rotations, not captured bind pose. `resetAvatar()` clears initialization rather than resetting pose. → [Avatar API](components.md#mocopiavatarcontroller)
8. Stats/maps are live internal objects and FPS can stay stale after disconnect. Manual disconnect may restart reconnection through onclose. → [Client API](components.md#mocopiwebsocketclient)
9. Placement needs real surfaces: the Lens Studio Preview returns no WorldQuery hits, so the avatar never appears there. Verify placement on device. → [Troubleshooting](troubleshooting.md)

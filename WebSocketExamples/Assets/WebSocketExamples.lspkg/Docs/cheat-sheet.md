# WebSocketExamples cheat sheet

[← Agent usage index](../README.md)

## Use when

Read first before using the prefab or script APIs.

1. Configure **both** URLs (TextEcho and IMUData each have their own `ipAddress`). Both ship as `ws://YOUR-IP-ADDRESS/ws`; while that placeholder is set, neither script opens a socket (TextEcho only logs, IMUData shows `Setup required - set IP Address (see README)`). → [Components](components.md)
2. Assign InternetModule; IMUData also requires screenText and IMUCube. Awake asserts these references; local UI does not manufacture them. → [Components](components.md)
3. Wait for `getConnectionStatus().isConnected` before sending. There is no public connected event or automatic retry. → [Examples](examples.md)
4. SnapDecorators binds initialize/Update/cleanup; do not call lifecycle hooks to reconnect. `reconnect()` is the supported explicit API. → [Components](components.md)
5. CSV values are passed through in array order. The Arduino sensor emits X,Z,Y, but IMUCube applies slots as Euler X,Y,Z; no coordinate remapping/calibration occurs. → [Hardware](hardware.md)
6. Rotation applies immediately, position optionally lerps 50 cm ahead of the assigned camera. Public direct angles are only length-checked; validate finite values yourself. → [Examples](examples.md)
7. Disabling a carousel entry does not invoke OnDestroy cleanup. Sockets may remain live while hidden; async Blob callbacks and prior sockets have no generation guard. → [Troubleshooting](troubleshooting.md)
8. Arduino echo server handles text only, so expecting binary echo from that implementation is incorrect. → [Hardware](hardware.md)

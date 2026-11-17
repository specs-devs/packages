# WebSocketExamples API status

[← Agent usage index](../README.md)

## Use when

Distinguish source behavior from tutorial feature claims.

| Status | Surface | This revision |
|---|---|---|
| Current | TextEcho | Startup connection, text and binary sends, text/Blob receive, ready-checked custom text send, explicit reconnect/status. |
| Current | IMUData | Startup connection, CSV parsing, status Text, explicit reconnect/status. |
| Current | IMUCube | Immediate world Euler rotation, quaternion-derived rotation query/reset, optional position-only camera follow. |
| Current (unused) | GuideDismissPanel | UIKit guide copy/dismiss behavior, no public dismiss event. Ships in Scripts/ but the prefab doesn't use it (its Guide uses the demo copy in Example/). |
| External requirement | InternetModule, configured WebSocket server | No default server or local sensor simulation. |
| Reference source | Arduino echo/IMU and ESP-IDF echo | Must configure/build/flash deliberately; not hardware proof from Preview. |
| Not implemented | Automatic reconnect, backoff, connection/message public events, WebSocket authentication/discovery | Do not infer these from general feature wording. |
| Implementation gap | Input validation/lifecycle | NaN check is not finite check, direct IMUCube only checks length, stale async/socket callbacks not detached, no OnDisable cleanup. |

No explicitly deprecated or removed public API is marked in this revision. All three main scripts remain current examples; `initialize`, `onUpdate`, `cleanup` are public source hooks bound by decorators, not consumer lifecycle controls.

`getConnectionStatus()` declares boolean, but the source expression `this.socket && this.socket.readyState === 1` may produce undefined before any socket exists; treat it as a truthiness/readiness check. The saved prefab uses the `ws://YOUR-IP-ADDRESS/ws` placeholder on both scripts and assigns no camera to the cube. The original tutorial is preserved as reference, not a claim that every stronger validation/reliability description holds.

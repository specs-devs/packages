# MocopiReceiver API status

[← Agent usage index](../README.md)

## Use when

Check typed consumer names and known implementation constraints.

## Current

| Surface | Status |
|---|---|
| MocopiWebSocketClient | InternetModule WebSocket, JSON text/Blob parsing, callbacks and mutable statistics. |
| MocopiMainController | Overwrites callback slots on Awake; routes skeleton and frames to avatar. |
| MocopiAvatarController | Placement-prefab lookup, bone mapping, local transforms and smoothing. |
| PrefabPlacement / ResetButton | SurfacePlacement integration and reset trigger. |
| MocopiDataTypes | Protocol interfaces, union, stats and 27-name array. |

## Deprecated

| Surface | Evidence |
|---|---|
| None explicitly marked | No package deprecation annotations. `PrefabPlacement.mocopiMainController` is a private, autodetected field, not an input (older tutorial text showed it as `@input`). |

## Experimental

| Surface | Evidence |
|---|---|
| None explicitly marked in source | The original tutorial's Experimental Mode deployment advice was not revalidated; the guide now presents it as a historical note, not a requirement. |

## Known source gaps

- Basic avatar prefab URL begins `something like -`; configure it before connection QA.
- Main owns all callback fields and records skeleton-received before checking avatar initialization success. A skeleton arriving before placement can fail initialization without later automatic replay. Reinitializing clears manual mappings.
- Avatar/placement access private fields and cast helpers in existing source; no casts were added to consumers. Placement keeps an autodetected Main reference across prefab replacement; inspect stale/destroyed references in reset QA.
- WebSocket connect guards only connected state, not an in-flight socket. Disconnect does not suppress onclose reconnection and closes only connected sockets. Async Blob conversions have no frame-order queue. Unknown/invalid payloads are not comprehensively schema-validated.
- Stats and mapping getters return internal mutable objects. FPS uses last 30 timestamps and is not zeroed after a stale/disconnected stream. Skeleton/frame getter signatures do not advertise their initial null values.
- Smoothing is unclamped, per received frame, factor `1 - smoothFactor`; 1 freezes updates. Position updates write local transforms using avatarScale; conversion negates position X and quaternion W/X. ResetPose uses identity rotations/optional zero positions, not recorded bind pose.
- objectVisuals is marked allowUndefined but dereferenced without guard; SurfacePlacement singleton is acquired during field initialization. Full installed dependency/native compilation is required.

See [Components](components.md) for exact current APIs and [Guide](guide.md) for preserved original relay setup. Checked in the Lens Studio Preview (2026-10-01): clean compile, basic avatar renders and initializes. Placement needs a device (Preview gives no WorldQuery hits); relay/sensor streaming was not validated.

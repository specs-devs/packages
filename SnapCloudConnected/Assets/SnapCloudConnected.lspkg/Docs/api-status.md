# SnapCloudConnected API status

[← Agent usage index](../README.md)

## Use when

Check which members are current before you reuse code or call members not shown in the examples.

Verified against `Scripts/*.ts`, `SnapCloudRequirements.ts` and `Supabase/snapcloud-connected-setup.sql` in this package source.

## Current

| Surface | Members |
| --- | --- |
| `SnapCloudConnected` (component) | input `snapCloudRequirements`; `getSupabaseProject()`, `host()`, `join(code)`, `leave()`, `placeSurface()`, `confirmReady()`, `registerObject(id, object, ownerSeat)`, `unregisterObject(id)`, `ownsObject(id)`, `state`, `status`, `room`, `roomCode`, `seat`, `isHost`, `onStateChanged`, `onStatusChanged`, `onRoomChanged`, static `getInstance()` |
| `SnapCloudRequirements` (component) | inputs `supabaseProject`, `text`, `disableWarningsWhenConfigured`, `showSetupInstructions`, `enableDebugLogs`, `enableLogging`, `enableLoggingLifecycle`; `getSupabaseProject()`, `isConfigured()`, `getSupabaseUrl()`, `getSupabasePublicToken()`, `getSupabaseHeaders()`, `getRestApiUrl()`, `getStorageApiUrl()`, `getFunctionsApiUrl()`, `revalidate()`, `setDebugLogging(enabled)` |
| `ConnectedState` (enum) | `Offline`, `Connecting`, `Placing`, `Confirm`, `Waiting`, `Active` |
| `OWNER_ANYONE` (const) | `-1` |
| `SyncedTransforms` (component) | inputs `session`, `objects`, `owner`, `syncId`; `idOf(index)`, `isOwnedLocally(index)` |
| `ConnectedPairingUI` (component) | inputs only, including `enableLogging` (see [components](components.md#connectedpairingui)) |
| `ConnectedProtocol` (module) | `RoomInfo`, `RoomMember`, `TransformPose`, `TransformState`, `TransformRow`, `RoomStatus` (`"waiting" \| "active"`), `ROOM_CODE_PATTERN` (`/^[0-9]{4}$/`), `MAX_SYNCED_TRANSFORMS` (64), `MAX_ID_LENGTH` (80), `parseRoom`, `parseTransformRow`, `validPose`, `round(value, digits)`, `makeClientId()` (random 24-character id per Lens session) |
| SQL RPCs | `connected_create_room(p_client, p_max_players)`, `connected_join_room(p_code, p_client)`, `connected_set_ready(p_room, p_client, p_ready)`, `connected_heartbeat(p_room, p_client)`, `connected_publish(p_room, p_client, p_state)`, `connected_leave_room(p_room, p_client)` |

## Internal

`ConnectedRoomClient` (`Scripts/ConnectedRoomClient.ts`) is the transport that `SnapCloudConnected` uses. You can use it directly, but its API may change in a minor release. Its members:

| Member | Description |
| --- | --- |
| `new ConnectedRoomClient(url, publicToken, authMode, callbacks)` | `authMode` is a `ConnectedAuthMode`: `"snapchat-then-anonymous"`, `"snapchat"` or `"anonymous"`. `callbacks` is a `ConnectedRoomCallbacks` with `status(message)`, `log(message)`, `room(room)`, `transforms(row)` and `lost(reason)`. |
| `clientId` (readonly), `room` | This session's client id (`makeClientId()`) and the current `RoomInfo` or `null`. |
| `createRoom(maxPlayers)`, `joinRoom(code)` | Async. Sign in, then create or join a room; resolve to the `RoomInfo`. Both leave any current room first. |
| `refreshRoom()`, `refreshTransforms()` | Async. Re-read the room and the transform rows. |
| `setReady(ready)` | Async. Sets this player's ready flag. |
| `publish(state)` | Queues a `TransformState` to send; only the latest pending state is sent. |
| `tick(dt)` | Call every frame. Every 20 s it sends a heartbeat and uses it to re-sync the room and transforms. |
| `leave()` | Async. Leaves the room. |
| `destroy()` | Marks the client disposed and leaves the room. |

SQL functions such as `connected_touch_room`, `connected_drop_stale`, `connected_room_json`, `connected_seat` and `connected_validate_state` aren't granted to clients.

## Deprecated / Experimental / Removed

Deprecated: `SnapCloudConnected.supabaseProject`. Use `snapCloudRequirements` (a `SnapCloudRequirements` holding the project). The old input still works when `snapCloudRequirements` isn't wired.

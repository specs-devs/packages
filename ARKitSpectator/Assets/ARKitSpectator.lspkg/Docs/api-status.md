# ARKitSpectator API status

[← Agent usage index](../README.md)

## Use when

Check this before writing code against the package or reusing an older spectator example. It
covers the revision it ships with.

## Status meanings

- **Current**: supported public surface for new work.
- **Internal**: exported for the package's own use. It may change without notice; don't call it.
- **Removed**: not available in this revision.

## Current API

| Surface | Module (`ARKitSpectator.lspkg/Scripts/…`) |
|---|---|
| `ARKitSpectator` component: inputs; `roomCode`, `status`; `onRoomReady()`, `onRoomClosed()`, `setRoomData()`, `createRoom()`, `closeRoom()`, `buildState()` | `ARKitSpectator` |
| `SpectatorEntity` component: inputs; `id`; `setData()`, `getData()`, `playClip()`, `getClip()`, `getCustomData()`, `getPrimitive()`, `getColorHex()`; static `all` | `SpectatorEntity` |
| `SnapCloudRequirements` component: inputs; `getSupabaseProject()`, `isConfigured()`, `getSupabaseUrl()`, `getSupabasePublicToken()`, `getSupabaseHeaders()`, `getStorageApiUrl()`, `getRestApiUrl()`, `getFunctionsApiUrl()`, `setDebugLogging()`, `revalidate()` | `ARKitSpectator.lspkg/SnapCloudRequirements` (package root, not `Scripts/`) |
| Wire types `SpectatorState`, `SpectatorEntityState`, `SpectatorClip`, `SpectatorPrimitive`, `SpectatorRoomInfo` | `SpectatorProtocol` |
| `validateState()`, `validateEntity()`, `round()`, constants `MAX_ENTITIES`, `MAX_STATE_BYTES`, `MAX_ENTITY_DATA_BYTES`, `MAX_ROOM_DATA_BYTES`, `ROOM_CODE_PATTERN` | `SpectatorProtocol` |
| Prefab `ARKitSpectator__PLACE_IN_SCENE` | package root |
| Backend RPCs `spectator_create_room`, `spectator_join_room`, `spectator_publish`, `spectator_leave_room`; tables `spectator_rooms`, `spectator_members`, `spectator_states` | `supabase.zip` → `setup.sql` |

Details: [components](components.md), [protocol](protocol.md).

## Internal

| Surface | Note |
|---|---|
| `SpectatorRoomClient` (`Scripts/SpectatorRoomClient`) | Transport used by `ARKitSpectator`. Use the component's methods instead |
| `SpectatorAuthMode` type (`Scripts/SpectatorRoomClient`) | `"snapchat-then-anonymous" \| "snapchat" \| "anonymous"`; the same values as the `authMode` input |
| `SpectatorEntity.all` mutation | Read-only for consumers; entities register themselves in `onAwake` |
| SQL helpers `spectator_is_member`, `spectator_valid_vector`, `spectator_validate_state`, table `spectator_join_limits` | Used by RLS and the RPCs; not granted for direct use (except `spectator_is_member`, which RLS needs) |

## Experimental

Nothing is marked Experimental in this revision.

## Removed

This package is the generic version. The game prototype it was generalized from (the "MagicSpectator"
tabletop) had these surfaces, and none of them exist here:

| Removed | Replacement |
|---|---|
| Player seats, turns, phases, sessions (`magic_sessions`, `magic_set_ready`, `magic_advance_*`) | None. Host + read-only spectators only; put game state in room `data` |
| Per-seat boards (`magic_boards`, `magic_publish_board`) with `life` / `phase` / `handCount` | One `spectator_states` row per room via `spectator_publish` |
| Entity `defId` resolved through a bundled card catalog | `asset` URL on the entity |
| Yaw-only pose, `eventId` / `eventTime` cues, `focus`, `hp` | Quaternion `r`, `clip {name, loop, id}`, custom `data` |
| Hard-coded backend URL / key in the iOS app | iOS Settings / `SpectatorConfig.plist` (empty by default) |

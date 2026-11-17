# ARKitSpectator protocol and backend

[← Agent usage index](../README.md)

## Use when

Read when you build your own spectator client, read `data` on the phone, change limits, or need
to know exactly what leaves the Lens.

## Coordinate frame

- Positions `p` are **centimetres** in the Stage Origin's frame: `stage.getInvertedWorldTransform().multiplyPoint(worldPosition)`.
- Rotations `r` are quaternions `[x, y, z, w]`: `invert(stageWorldRotation) * worldRotation`.
- Scales `s` are `worldScale / stageWorldScale`, per axis.
- +Y is up, right-handed (Lens Studio convention, the same handedness as SceneKit). The iOS app
  only converts cm to m. It places the origin where the viewer taps, yawed so +Z faces the viewer.

## State (one per room)

```json
{"entities": [
  {"id": "robot", "name": "Robot", "p": [0, 0, -40], "r": [0, 0, 0, 1], "s": [1, 1, 1],
   "asset": "https://<project-host>/storage/v1/object/public/models/robot.glb",
   "primitive": "box", "color": "#14A08D", "visible": true,
   "clip": {"name": "Wave", "loop": false, "id": "3"}, "data": {"hp": 3}}],
 "data": {"round": 2}}
```

| Field | Rule (enforced by `spectator_validate_state` and `validateEntity`) |
|---|---|
| state keys | only `entities`, `data` |
| `entities` | array, ≤ 64, unique `id` |
| `id` | string, 1–80 characters |
| `name` | optional string, ≤ 80. Sent when the object name differs from the id |
| `p` / `r` / `s` | exactly 3 / 4 / 3 finite numbers, \|v\| ≤ 100000 / 1.01 / 1000 |
| `asset` | optional, starts with `https://`, ≤ 512 characters |
| `primitive` | optional: `box`, `sphere`, `cylinder`, `plane` or `none` |
| `color` | optional `#RRGGBB` or `#RRGGBBAA` |
| `visible` | optional boolean (omitted = visible) |
| `clip` | optional `{name: 1–80 characters, loop?: boolean, id?: ≤ 64 characters}` |
| `data` | optional JSON ≤ 2048 bytes (entity), ≤ 8192 bytes (room) |
| whole state | ≤ 131072 bytes |

Nothing else is sent: no camera frames, world anchors or device poses.

## RPCs (`setup.sql`)

| RPC | Caller | Returns / effect |
|---|---|---|
| `spectator_create_room()` | host | `{id, code, role: "host", expires_at}`. 4-digit code unique among active rooms. At most 5 active rooms per user, 24 h lifetime |
| `spectator_join_room(p_code text)` | spectator (code = exactly 4 digits) | `{id, code, role, expires_at}` or `{error}` (bad code, not found or expired, more than 20 attempts per minute). The host's own identity gets `role: "host"` |
| `spectator_publish(p_room uuid, p_revision bigint, p_state jsonb)` | host only | New revision. Raises `Revision conflict` if `p_revision` isn't the stored one, and `Only the room host may publish` for anyone else |
| `spectator_leave_room(p_room uuid)` | anyone | Removes the membership. The host leaving clears the state, expires the room and releases the code |

Codes come from a space of 10,000. Guessing is kept slow by the 20-attempts-per-minute throttle per identity, the
5-rooms-per-host limit and the 24 h lifetime. Anonymous identities are cheap to create, so treat a code as an invitation.

Reads: `select * from spectator_states where room_id = …`, allowed by RLS only to members of an
unexpired room. Live updates: Realtime **Postgres Changes** (`UPDATE` on `public.spectator_states`,
filter `room_id=eq.<id>`). Clients have no insert, update or delete rights on any table.

## Client behaviour (reference implementations)

- Lens (`SpectatorRoomClient`): `createClient(url, publicToken, {realtime: {heartbeatIntervalMs: 2500}})`.
  It publishes the newest pending state, adopts the stored revision on conflict (up to 3 retries),
  and pauses with a status message on other errors (the next change or the 10 s resend retries).
- iOS (`SpectatorSession.swift`): anonymous sign-in, join, Realtime subscription that decodes the
  row, and a recovery snapshot every 8 s. It accepts only increasing revisions. An empty snapshot
  means the room closed.

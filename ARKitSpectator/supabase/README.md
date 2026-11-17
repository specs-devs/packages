# ARKit Spectator — Snap Cloud backend

Install once per Snap Cloud project (the same project the Lens and the iPhone app use).

## Install

**Option A, SQL Editor:** open your project's dashboard → *SQL Editor*, paste `setup.sql` and run it.
It's safe to run again.

**Option B, CLI:** from the folder containing this `supabase/` directory:

```sh
supabase link --project-ref <your-project-ref>
supabase db push
```

Then, in *Authentication → Sign In / Providers*, enable **Anonymous Sign-Ins**. The iPhone app
signs in anonymously, and so does the Lens when Snapchat sign-in isn't available (Auth Mode on
`ARKitSpectator`).

`config.toml` is only for local development (`supabase start`); it doesn't change a hosted project.

## What it creates

| Object | Purpose |
| --- | --- |
| `spectator_rooms` | One row per room: 4-digit `code`, `host_id`, 24 h `expires_at` |
| `spectator_members` | Who is in a room (`host` / `spectator`) |
| `spectator_states` | The latest published scene state per room (`revision`, `state` jsonb). In the `supabase_realtime` publication |
| `spectator_join_limits` | Private per-user join-attempt counter |
| `spectator_create_room()` | Host: create a room, returns `{id, code, role, expires_at}` |
| `spectator_join_room(p_code)` | Spectator: join by code, returns the room or `{error}` |
| `spectator_publish(p_room, p_revision, p_state)` | Host: replace the state if `p_revision` matches; returns the new revision |
| `spectator_leave_room(p_room)` | Leave. If the host leaves, the room closes (state cleared, code released) |

## Security model

- Clients have **read-only** table access through row-level security, and only to rooms they are
  members of. There are no insert/update/delete grants: every write goes through the functions
  above, which take authority from the signed-in user (`auth.uid()`).
- Only the room's host can publish. Spectators and outsiders get `Only the room host may publish`.
- Every state is validated server-side: 64 entities, 128 KB per state, 2 KB `data` per entity,
  8 KB room `data`, only known fields, finite bounded numbers, https-only `asset` URLs.
- Limits: 5 active rooms per host, 24 h lifetime, 20 join attempts per user per minute. Failed
  guesses are returned as `{error}` rather than raised, so the counter isn't rolled back.
- Codes are 4 digits (10,000 possibilities), the same as Snap Cloud Connected. The join throttle, room limit and
  lifetime are what make that safe enough for an invitation code.
- Anonymous identities are cheap to create, so the per-user throttle isn't a service-wide abuse
  control. The 4-digit code is an invitation, not a password: don't stream anything private.
- Camera images, world anchors and device poses are never sent. Only the poses (and optional
  model URLs / JSON) of objects the Lens creator chose to stream, relative to the stage origin.

## Models (optional)

To stream your own glTF/GLB files, upload them to a **public** Storage bucket in the same project
and set `Asset Url` on a `SpectatorEntity` to `<bucket>/<path>` (for example `models/robot.glb`).
The Lens turns that into the bucket's public URL. The iPhone app accepts models from the project
host, plus any hosts you add in its Settings.

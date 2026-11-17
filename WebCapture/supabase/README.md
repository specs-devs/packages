# Web Capture — Snap Cloud backend

Install once per Snap Cloud project (the same project the Lens and the portal use). Only needed for
Snap Cloud mode; Local mode (the Lens Studio plugin) needs no backend.

## Install

**Option A, SQL Editor:** open your project's dashboard → *SQL Editor*, paste `setup.sql` and run it.
It's safe to run again.

**Option B, CLI:** from the folder containing this `supabase/` directory:

```sh
supabase link --project-ref <your-project-ref>
supabase db push
```

Then run `storage.sql` the same way. It creates the `webcapture` Storage bucket the Lens uploads full recordings to
(real meshes, textures and camera frames are bigger than the 6 MB a database row may hold).

If the Lens should sign in anonymously (Auth Mode *Anonymous only*, or the fallback when Snapchat
sign-in isn't available), enable *Authentication → Anonymous Sign-Ins*.

`config.toml` is only for local development (`supabase start`, moved to ports 55420–55422 so it can
run next to other local projects); it doesn't change a hosted project.

## What it creates

| Object | Purpose |
| --- | --- |
| `webcapture_sessions` | One row per running Lens: 6-character `code`, `owner_id`, `status` (live/ended), latest `scene` snapshot and `revision`, 7-day `expires_at` |
| `webcapture_recordings` | Recordings saved by the Lens (`data`, `webcapture/1`) and the portal's `edits` |
| `webcapture_*` functions | The only way in: the Lens creates/publishes/saves as the signed-in owner; the portal reads and saves edits with the session code. See the package's `Docs/protocol.md` |

## Security

Tables have no client grants. Lens writes are checked against `auth.uid()`; portal access needs the
session code (31⁶ ≈ 887 million codes) and can only read that session and save edits, never the
recorded tracks. Limits: scene ≤ 512 KB, recording ≤ 6 MB, edits ≤ 512 KB, 50 recordings per session,
10 open sessions per owner.

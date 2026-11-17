# SnapCloudConnected setup

[← Agent usage index](../README.md)

## Use when

Connect the package to a Snap Cloud project, or check what the backend does.

## Steps

1. **Credentials**: In Lens Studio, open **Window → Supabase**, sign in, then create or import a project and click **Import Credentials**. Assign the resulting `SupabaseProject` asset to **Supabase Project** on the `SnapCloudRequirements` object (first child of the prefab). Every script reads the project from there: `SnapCloudConnected.snapCloudRequirements` is wired to it in the prefab. Don't paste URLs or keys into scripts. The prefab ships with the project empty, so a fresh install first shows a red-framed **Credentials needed** panel (`CredentialsWarning`) listing what is missing. "Continue without credentials" closes it and the guide appears; once the project is assigned, the panel doesn't appear. This package uses no Remote Service Gateway tokens.
2. **Database**: In the Snap Cloud dashboard, open **SQL Editor**, paste `Supabase/snapcloud-connected-setup.sql` and run it. The script is idempotent: tables are created if missing, and functions and policies are replaced.
3. **Auth**: The default Auth Mode tries Snapchat sign-in first and falls back to anonymous sign-in. To use "Anonymous only", or to test where Snapchat sign-in is unavailable, enable **Anonymous Sign-Ins** in the project's Authentication settings.
4. **Realtime**: The script adds `connected_rooms` and `connected_transforms` to the `supabase_realtime` publication. No other change is needed.
5. **Project**: Use a Specs project with the SIK prefab, a Camera with Device Tracking (World), and Internet access.

Older scenes that assigned the project to `SnapCloudConnected.supabaseProject` still work: that input is deprecated and only used when `snapCloudRequirements` isn't wired.

## Backend contract

| Table | Key | Contents |
| --- | --- | --- |
| `connected_rooms` | `id` | `code` (4 digits, unique among live rooms), `host_id`, `max_players` (2–4), `status` (`waiting`/`active`), `revision`, `expires_at` (+24 h) |
| `connected_members` | (`room_id`, `seat`) | `user_id`, `client_id` (per Lens session), `ready`, `last_seen` |
| `connected_transforms` | (`room_id`, `seat`) | `revision`, `state` = `{"entities":[{"id","p","r","s","o"?}]}` |
| `connected_join_limits` | `user_id` | Private join attempt counter |

- **RLS**: Authenticated members can `select` their own rooms' rows. Clients have no insert/update/delete grants.
- **RPCs** (SECURITY DEFINER, caller from `auth.uid()` plus `p_client`): `connected_create_room`, `connected_join_room` (returns `{error}` for wrong codes, a full room or rate limits), `connected_set_ready`, `connected_heartbeat`, `connected_publish` (own seat only), `connected_leave_room` (deletes the room when it is empty).
- **Limits**: 5 live rooms per host, 24 h lifetime, 20 join attempts per user per minute, 64 transforms and 64 KB per state, positions within ±1 km, scale within ±1000. A seat is freed after 2 minutes without a heartbeat. The client sends a heartbeat every 20 s.
- **Wire format**: `p` is the position in cm, `r` is a quaternion `[x, y, z, w]` and `s` is the per-axis scale, all relative to the sender's seat frame. `o` is the ownership stamp for `Anyone` objects.
- **Coexistence**: Every object is prefixed `connected_`, so the script never touches tables of other packages (for example ARKit Spectator's `spectator_*`).

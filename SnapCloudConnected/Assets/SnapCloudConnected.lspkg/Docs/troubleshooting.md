# SnapCloudConnected troubleshooting

[← Agent usage index](../README.md)

## Use when

Something in pairing, placement or sync doesn't behave as expected.

| Symptom | Cause | Fix |
| --- | --- | --- |
| Red **Credentials needed** panel before the guide | `SnapCloudRequirements.supabaseProject` is empty (the prefab ships without credentials). | Import credentials (Window → Supabase) and assign the asset on `SnapCloudRequirements`. "Continue without credentials" closes the panel; the demo then stays Offline. |
| Status: "Add your Snap Cloud project: assign a SupabaseProject on SnapCloudRequirements…" (shown from the start; Host and Join return to it) | No project on `SnapCloudRequirements` (or, when `snapCloudRequirements` isn't wired, on the deprecated `SnapCloudConnected.supabaseProject`). | Import credentials (Window → Supabase) and assign the asset on `SnapCloudRequirements`. |
| A keypad press right after tapping Join, Back or Host is ignored | `ConnectedPairingUI` ignores presses for 0.35 s after a page appears. Pages swap under the hand (the Join button and keys 3/6 share a spot), and the gesture that opened a page used to type a digit. | Expected. Press again. |
| Other UI right behind the pairing panel can't be pinched | The panel's UI Kit Frame has an interaction plane, and its collider extends `nearFieldExitDepth` in front of and behind the frame. | Keep other panels out of that volume (above, beside, or clearly below the 26 × 27 cm frame), or move `PairingPanel`. |
| "Snap Cloud project is missing the Connected tables…" | The SQL wasn't run on this project. | Run `Supabase/snapcloud-connected-setup.sql` in the SQL Editor. |
| "Sign-in failed: …" | Snapchat sign-in is unavailable, and anonymous sign-in is disabled or not selected. | Enable Anonymous Sign-Ins in Auth settings, or use Auth Mode 0. |
| "Room not found or expired" | Wrong code, a room older than 24 h, or a room whose players all left. | The host creates a new room. |
| "Room is full" | Every seat is taken, including by a device that crashed less than 2 minutes ago. | Wait 2 minutes (stale seats are freed on join and heartbeat), or host a new room. |
| "Too many attempts…" | More than 20 joins in a minute from one account. | Wait a minute. |
| Stuck in `Waiting` | Another seat is empty or hasn't confirmed. | The status line shows how many players have joined and are ready. Each player taps Ready after placing. |
| Objects jump back when I move them | You don't own them (owner is another seat). | Set owner to Anyone, or move them from the owning player. |
| Remote objects appear mirrored or rotated | `faceToFace` turns player 2's frame by 180° (players 3 and 4 by ±90°). | Turn `faceToFace` off for "same layout in front of everyone". |
| Objects don't follow the placed origin | They aren't children of `origin` and were moved before the session became Active. | Put shared content under `origin`. |
| A `SyncedTransforms` never syncs | It sits under the hidden origin, so it registers only after placement; or its Sync Id or order differs between builds. | Put `SyncedTransforms` outside `origin`, and keep ids and order identical. |
| Two Previews / devices on the same Snapchat account | Works: each Lens session sends its own client id, so each gets its own seat. | — |

Known gaps: live two-device Realtime behaviour isn't covered by automated tests (the SQL contract is). Sync rate is bounded by RPC round trips (default 10 Hz), so this package isn't intended for fast physics. There's no late-join history beyond each player's latest row.

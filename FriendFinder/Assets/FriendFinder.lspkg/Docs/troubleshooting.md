# FriendFinder troubleshooting

[← Agent usage index](../README.md)

## Use when

Diagnose source-specific phone, cloud, UI or native media failures.

| Symptom | Source cause to check | Action |
| --- | --- | --- |
| Startup throws before mode UI | Missing MobileKitModule or required prefab assets | Restore prefab inputs/assets; obtain services after OnAwake |
| Native Mobile Kit registration conflict | Duplicate built-in module/loader | Use the shared MobileKitModule instance |
| Phone session never joins | Companion pairing/session not ready | Check companion session; retries occur every three seconds |
| A red "Credentials needed" panel appears before the guide | `CredentialsWarning`: no SupabaseProject is assigned on `SnapCloudRequirements` (the prefab ships without one) | Window > Supabase > Import Credentials, then assign the SupabaseProject on `SnapCloudRequirements`; the panel then no longer appears. "Continue without credentials" runs the demo with Snap Cloud off |
| Watch Your Back fails with cloud disabled | Device source directly creates RtcMailbox | Assign your own project on SnapCloudRequirements and create the rtc_signals table |
| Call Friend unavailable | Manager needs active SnapCloudModule mailbox | Enable/wire its hierarchy and own project |
| Native failure expected to show JPEG instead | Stale comments describe a fallback absent from current path | Resolve native load/session; synthetic video is editor-only |
| UI marker looks close while label is distant | Marker distance deliberately clamps to 5–30m | Compare geographic label, not visual marker distance |
| Motion persists after lost GPS | Velocity extrapolation caps at 30s then holds projected position | Inspect fix age/estimated status and reset when appropriate |
| Cloud history uses a different session | Logger session independent of RTC call code | Use the appropriate public session identifier for each table |
| send returns true but peer has no SDP/ICE | Return means insertion initiated, not completion | Inspect async insert errors and receiving mailbox/table policies |
| RTC handler replaced | One callback per kind/from map key | Coordinate ownership and unsubscribe on session stop |
| Work resumes after stop | In-flight mailbox completion can reschedule | Verify shutdown/restart races before relying on stop alone |
| Preview picture is a pattern | Synthetic editor source selected once | Validate real video/audio on compatible Specs/phones |
| A mode switch turns on but never off; label stays highlighted | Older ModeMenuUI passed the `Switch.onFinished` argument (the explicit flag) as the state | Fixed in this revision (reads `sw.isOn`); update the package |
| Snap Cloud calls, history or checkpoints do nothing; console prints "[SupabaseRequirements] Supabase project not configured!" | No SupabaseProject is assigned on `SnapCloudRequirements` (the prefab ships without one; older revisions kept it on `Snap Cloud` > SupabaseRequirements, which still works as a fallback when its `snapCloudRequirements` input is empty) | Window > Supabase > Import Credentials, then assign the SupabaseProject asset on SnapCloudRequirements. To show an in-lens warning, wire your own Text to its optional `text` input; disable or delete the old `SnapCloud` object if your instance still has it |
| Find Your Friend shows "Waiting for phone…" in Preview, no arrow | `simulateInPreview` is off on your instance (older prefab revisions stored false) | Enable `simulateInPreview` on FriendFinderManager; it only affects the editor |
| Start menu looks huge or panels overlap in Preview | Preview camera left moved from an earlier session (the menu is world-placed at z −110 at start) | Reset the Preview camera before judging placement |
| The demo's expanded ExampleCarousel covers the start menu's header | Older demo scene: menu centered at eye level with the carousel's bottom edge over its top rows | Fixed 2026-10-02: the prefab sets FriendFinderManager `menuDrop` 8 and carousel `extraPanelDrop` −32; in your own scene, lower the menu with `menuDrop` when you put a panel above it |
| Panels near the top/bottom of view hide the POV panel or arrow | The POV panel (~58 cm tall at 100 cm) and the low tethered arrow fill most of the ±18° vertical FoV | Keep extra panels small or off to the side while a mode runs |

The 2026-10-01 QA pass verified the Preview flows only; no device/native/backend pass is claimed. Avoid treating source comments such as 'no cloud', 'stub' or 'JPEG fallback' as the current executable contract.

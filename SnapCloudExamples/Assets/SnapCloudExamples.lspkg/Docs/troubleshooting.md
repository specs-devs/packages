# SnapCloudExamples troubleshooting

[← Agent usage index](../README.md)

## Use when

Read for wiring failures and source-observed caveats before live QA.

| Symptom | Cause / action |
|---|---|
| Red "Credentials needed" panel shows before the guide | `CredentialsWarning`: no SupabaseProject on `[SnapCloudRequirements]` (the shipped prefab has none). Assign it (Window > Supabase > Import Credentials) and the panel stops appearing; or press "Continue without credentials" to explore offline. The log has one `CredentialsWarning: …` line per missing item. If it never shows although the project is missing, check that `[SnapCloudRequirements]` sits above `CredentialsWarning` in the prefab. |
| Media requirements type mismatch | Fixed: the media scripts now use the root `SnapCloudRequirements`; `Example5-Media/Scripts/SnapCloudRequirements` only re-exports it. Rewire older scene copies to the prefab's `[SnapCloudRequirements]`. |
| isConfigured true but auth/RPC/storage fails | Only presence checked; inspect asset URL/token, dashboard policies and backend deployment. |
| Authentication succeeds but log shows a session/token | TableConnector includes serialized session logs; keep logs disabled/redact credentials before sharing. |
| testConnection modifies data | It deliberately inserts records and invokes other write tests. Use a test backend. |
| Service stays unready after late configuration | Leaderboard init caches initialized on missing config; fresh correctly configured component/session required. |
| Cursor follows no remote motion | Follow only accepts pc_ user IDs, channel has cursor- prefix; counterpart must match. |
| Private bucket downloads fail | StorageLoader uses public URLs and test GET omits auth. |
| Image “cleared” still displays | clearLoadedAssets drops texture bookkeeping but does not remove material texture. |
| Capture camera unavailable | Share CameraService and wait for Start/texture frames; independent requests can conflict. |
| Audio utility stop returns no WAV | It returns boolean; getAndClearAudioBuffer returns raw Float32 bytes, not WAV. |
| Composite stitch durations inconsistent | final_stats uses elapsed time after upload; request also includes recording duration/chunk-derived duration. Backend must handle contract explicitly. |
| Compression/mute/scale input has little effect | Audio adjust-quality and composite mute only log; resolutionScale is metadata in shown frame payload, not guaranteed actual resizing. |
| Toggle looks selected but wrong local section | selectToggle changes enabled sections only; name-based mapping is fragile. |
| Leaderboard columns extend sideways | Row step default is (-4,0,0); configure appropriate row layout and inspect prefab. |
| Highest pinch total ranks last | ascending defaults true; configure descending as intended. |
| Every capture/stream logs `CameraService camera texture not available yet`, then `Camera not ready - cannot start recording` | CameraService never started: its object `[CompositeImage]/VirtRender/Object 0/ImageBackground-CS` was disabled (and moved to layer 1) in an earlier Lens Studio re-save. Fixed: enabled again on layer 2, which only the composite camera renders. Keep the object enabled; check for `[CameraService] Camera initialized` in the log. |
| Realtime cursor never appears | The arrow `CursorObject` ships disabled and its mesh/material ids went stale in an earlier Lens Studio re-import (rendered nothing). Fixed: RealtimeCursor shows it while the example is enabled and hides it when disabled; mesh/material rebound to `Arrow/source/arrow.glb`. |
| `Input targetOutlineMaterial was not provided for the object CursorObject` | Its InteractableOutlineFeedback pointed at a material id that no longer exists. Fixed: SIK `TargetOutlineMaterial`. Re-instantiate older scene copies of the prefab (scene instances keep their own stale ids). |
| Table / Realtime / Storage / Edge Functions buttons do nothing | Only the enabled example under `Get Started` (`Tables`, `Realtime Cursor`, `Storage`, `Edge Functions`) listens to its button; the four are one-at-a-time alternatives (enable one). Without a SupabaseProject they stop at the configuration check silently, because `enableLogging` is off in the prefab and the ReminderHint ships disabled. Assign the project on `[SnapCloudRequirements]` (Window > Supabase > Import Credentials), or turn on `enableLogging` to print the setup steps. |
| Storage/media/realtime calls fail with odd bucket, path or channel names | The prefab ships placeholder strings (e.g. `YOUR BUCKET - TRY "specs-bucket"`, `YOUR PATH - TRY "models/rabbit.glb" ` with a trailing space). Replace every one; see [setup](setup.md#prefab-placeholder-values). |
| Storage example image download returns 404 | The shipped mock assets are `rabbit.glb`, `glasses.jpg` and `chill.mp3`, but the prefab suggests `images/spectacles.jpg` (script default `images/spectacles.jpg`, model default `fox/scene.gltf`). Upload under the paths you set, or change `modelFileName`/`imageFileName`/`audioFileName` to match your uploads. |
| Audio listener page never logs stream start/end | `audio-stream-listener.html` listens for `stream-started`/`stream-ended`; AudioStreamingController sends `audio-stream-started`/`audio-stream-ended`. Only the status log lines are affected; `audio-chunk` matches. |
| Leaderboard panel is empty after a round | PinchGameController ends on the leaderboard with no replay; without a backend no rows load. Reset the Lens to play again. |
| No "set up your Supabase account" note in the scene | The red ReminderHint ships disabled and unwired (`SnapCloudRequirements.text` empty, it is `@allowUndefined`) so no loose text floats in front of the panels; the setup steps live in the demo's carousel info and in [Setup](setup.md). To show it again, enable `ReminderHint` and assign its Text to `SnapCloudRequirements.text` (SnapCloudRequirements toggles the Text, not the object; it sits 40 cm in front of the origin). |

Verified in the Lens Studio Preview without a Snap Cloud project (2026-10-01): clean compile, each of examples 1–4 enabled alone with its button, cursor drag, the five media tabs, media capture reaching the configuration check, leaderboard Start → countdown → end of round. Not verified (needs a backend or a device): auth/RLS/RPC/function flows, uploads, viewer delivery, Spotlight, the HD still capture (device only), device camera/mic permissions, and tap scoring (tool calls stall frames against the 6 s round).

# RemoteAssistance cheat sheet

[← Agent usage index](../README.md)

## Use when

Read first before wiring or extending this revision.

1. Use the prefab and assign `SnapCloudRequirements.supabaseProject` (a red Credentials needed panel shows until you do); presence is only an asset check, not successful authentication. Install every dependency in `package_dependencies.json` (InteractionKit, UIKit, Motion, Icons, SnapDecorators, SupabaseClient, Utilities). → [Components](components.md)
2. The manager creates menu and call panels at runtime; its call-start/end methods are private. Consume the menu event instead of guessing manager APIs. → [Components](components.md)
3. Current media is WebRTC-only: Preview can simulate drawings but cannot execute the device `.so` or fall back to JPEG/WAV media transport. → [API status](api-status.md)
4. Keep a single camera owner. Native capture and JS CameraModule must not compete. → [Native API](native-api.md)
5. Preserve an identity transform for world-position annotation mesh vertices. Do not put the annotation root under a moving/recentering carousel. → [Troubleshooting](troubleshooting.md)
6. Draw updates contain the complete point list in normalized video coordinates (`v` downward); first update freezes pose, aspect, width and color. Reuse of a completed ID is ignored. → [Drawing protocol](drawing-protocol.md)
7. Mailbox success means queued insert, not delivery. It replays prior rows for the session; use distinct session codes and check actual database errors. → [Components](components.md)
8. Repeated call/clear QA matters: the caption status poll is not cancelled and async mailbox/audio completion has no teardown generation guard (demo strokes are cancelled by `clearAll()`). → [Troubleshooting](troubleshooting.md)
9. Layout is fixed in code: the start menu spawns at world (0, 0, −110) under a runtime root, and the call panel (≈29 × 62 cm, 100 cm ahead, 11 cm left) fills almost the whole SPECS 27 view height. Leave room for it; anything you add below or above it overlaps during a call. → [Troubleshooting](troubleshooting.md)

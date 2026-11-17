# RemoteAssistance troubleshooting

[← Agent usage index](../README.md)

## Use when

Diagnose this source revision without treating Preview as hardware proof.

| Symptom | Source cause | Action/check |
|---|---|---|
| Cannot resolve `SupabaseClient.lspkg`, `SnapDecorators.lspkg` or `Utilities.lspkg` | A dependency from `package_dependencies.json` isn't installed in the project | Install the listed packages (InteractionKit, UIKit, Motion, Icons, SnapDecorators, SupabaseClient, Utilities); do not fake declarations. |
| Menu available but call never connects | Prefab cloud asset null; auth/schema/permissions can also fail | Assign SupabaseProject on SnapCloudRequirements; inspect authentication and rtc_signals insert/select errors. Asset presence is not auth success. |
| Connected flag true but no peer sees signal | sendRtcSignal returns before insert resolves; PostgREST errors are asynchronous | Inspect database insert errors and correct sender/session/filter, not boolean alone. |
| Preview loader says fallback but no media | Historical log wording; current CallStreamer has no JPEG transport fallback | Treat device native module as required; validate only local demo in Preview. |
| Old strokes return on next call | Manager reuses session code; mailbox replays historical draw rows | Use distinct sessions for distinct conversations, inspect intended replay, test clear propagation. |
| Clear/quit followed by drawings returning (Preview demo) | Before 2026-10-01, simulateDemo delayed events stayed scheduled after clear/teardown: QUIT CALL 1.5 s into a call left the arrow and dot over the start menu | Fixed: `clearAll()` bumps a demo generation and pending demo callbacks are dropped. Reproduce by quitting within 6 s of START CALL; no `Stroke_*` objects should remain. |
| More caption polling after repeated calls | status delayed events are not cancelled; old closure reads the new streamer/panel | Test repeated start/quit; store/cancel event handles if implementing a lifecycle fix. |
| Callback fires after stop | In-flight mailbox connect/poll and audio load callbacks lack lifecycle guards | Test teardown races; avoid claiming stop is cancellation-safe. |
| Strokes move or double-transform | World coordinates put in mesh under nonidentity/moving parent | Keep annotations world root identity; never attach to moving camera/carousel. |
| Alignment offset | Wrong video aspect/FOV/depth/pose delay; first stroke update freezes these | Send normalized video-frame points/aspect; calibrate FOV/depth/lag on the actual camera. |
| Malformed clear deletes everything | Parser intentionally returns empty object for missing/malformed JSON | Validate producer data; explicit stroke ID for single-stroke clear. |
| Huge/invalid drawing causes artifacts | Optional color/width/aspect not fully finite-validated; no geometry point cap | Bound producer payloads and validate direct applyStroke inputs before use. |
| Webcam texture shown but voice missing | mediaConnected uses OR, not both sessions | Inspect independent povConnected/voiceConnected and audio health/native states. |
| Cross-network call stays waiting | STUN only, TURN_URL empty, no transport fallback | Test intended network topology; do not promise LTE/enterprise traversal. |
| Outbound video has no virtual strokes | Native encoder captures raw camera, not Lens compositor | Helper renders overlay locally; no current native overlay toggle API. |
| Second call/audio stop errors | CallStreamer stop destroys output component; asynchronous WAV load may outlive stop | Fresh streamer per call, as manager does; test pending-load teardown on device. |
| Native mic inactive | One native attempt per POV connection; stall >3 s or start >8 s falls back to JS | Inspect actual native/mic frame counters and JS sent chunks. JS recovery one dead-air restart; repeated capture failure needs device diagnosis. |
| `Input annotations was not provided for the object RemoteAssistanceManager`, Lens never runs | A hand-built scene copy of the manager without `annotations` wired (the old demo scene had this) | Use the prefab (annotations is pre-wired to Annotations3D) or assign the AnnotationRenderer. |
| Your guide panel shows but the start menu is already behind it | The menu is built in the manager's Awake under a new root; hiding the prefab instance after that has no effect on it | Put the guide object above the instance in the hierarchy so it disables the instance before the manager awakes. |
| Red **Credentials needed** panel before the guide | `SnapCloudRequirements.supabaseProject` is empty (the prefab ships without credentials) | Window > Supabase > Import Credentials, then assign the asset on the `SnapCloudRequirements` object. "Continue without credentials" closes the panel; calls then can't signal. This package needs no Remote Service Gateway tokens. |
| Calls never reach the helper | No SupabaseProject on `SnapCloudRequirements` (or, when SnapCloudModule's `snapCloudRequirements` isn't wired, on the deprecated SupabaseRequirements) | The Logger shows `[RtcMailbox] SupabaseProject not configured — RTC signaling disabled.` Assign the asset on `SnapCloudRequirements`. |
| A panel you add covers QUIT CALL / CLEAR DRAWINGS | The call panel is ≈62 cm tall at 100 cm, about the full SPECS 27 vertical FoV | Place extra UI over the top of the video box (no buttons there) or beside it; nothing fits below it. |
| Demo arrow runs off-screen to the left | Demo points are normalized to the camera frame, which is wider than the display FoV; strokes anchor 200 cm ahead | Expected in Preview; the circle and dot land in view. |

`WEBRTC-CALL.md` (at the project root, not shipped inside `RemoteAssistance.lspkg`) contains explicitly historical phone-relay/JPEG sections. Use these package-owned source-derived docs for current behavior. Rows marked Fixed were reproduced and verified in the Preview on 2026-10-01; the others are source findings still unverified on device.

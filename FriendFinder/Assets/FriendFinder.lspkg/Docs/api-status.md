# FriendFinder api-status

[← Agent usage index](../README.md)

## Use when

Check the actual source paths and retained legacy helpers for the installed revision.

| Status | Surface | Actual source behavior |
| --- | --- | --- |
| Current | FriendFinderManager, ModeMenuUI, IncomingCallUI | OnStart service wiring; Find Friend plus one exclusive media mode |
| Current | GeoMath, FriendPositionEstimator, marker/minimap UI | GPS math, last-fix velocity estimate and runtime UI |
| Current | MobileKitModule/MobileKitLink | One native built-in module; BLE session location/control/RTC relay seam |
| Current | SnapCloudRequirements, SnapCloudModule, SupabaseRequirements (bridge), CloudPathLogger/CloudCheckpoints | Consumer-supplied project on SnapCloudRequirements, logging/checkpoint tables |
| Current | RtcMailbox/RtcSignalTransport | PostgREST rtc_signals polling and SDP/ICE/bye callbacks |
| Current | SyntheticPovSource | Editor animated RGBA test pattern |
| Current, device only | WebRtcWatchYourBackSource, CallStreamer, WebRTCSession, native loaders, RtcVoicePlayer | Native video/voice; cloud mailbox signaling |
| Retained legacy | Realtime/PovFrameReceiver | Public JPEG/broadcast modules remain in source; current manager does not instantiate them |
| Deprecated (2026-10-06) | `SupabaseRequirements.supabaseProject` input | Used only when its new `snapCloudRequirements` input is empty; assign the project on `SnapCloudRequirements` instead |
| Experimental / verification gap | Native interop, hardware routing and reconnect cleanup | Public declarations exist; source-only pass does not certify device behavior |
| Removed (2026-10-01) | `Scripts/GuideDismissPanel/GuideDismissPanel.ts`; prefab objects `Guide_ReadMe`, `Dev Tools` / `AiPreviewAgent Handler` | Demo/QA residue; the handler depended on preview tooling packages that consumers don't install. Since 2026-10-05 the guide and carousel ship inside the package again, as demo scaffolding in `Example/` nested in the prefab ([components](components.md#demo-scaffolding-example)) |

Comments describing Watch Your Back as cloud-free, the native path as a stub, or CallStreamer/manager as falling back to JPEG are stale relative to the implementation. Current device Watch Your Back directly constructs RtcMailbox and WebRTCSession; Call Friend obtains a mailbox from the active SnapCloudModule. The audio WAV batch fallback in CallStreamer is an audio output fallback, not JPEG video transport.

Fixed 2026-10-01: ModeMenuUI switch rows read `Switch.isOn` in `onFinished` (UIKit's `onFinished` passes the explicit-interaction flag, not the new state), so modes now turn off as well as on. Preview-verified (2026-10-01): guide → start menu, Find Your Friend with simulation (arrow + debug minimap, EXIT), Watch Your Back synthetic panel (QUIT CALL), Call Friend connecting panel (no native module in Preview). Prefab updates (2026-10-01): `simulateInPreview` is now on in the prefab (editor-only), and the `SnapCloud` credentials warning moved from z −100 (over the start menu) to below it (0, −29, −110), centered, font 26; later the same day the floating `SnapCloud` warning Text was removed from the prefab (SupabaseRequirements.text left unassigned; the warning stays in the console and the demo's carousel info). Added 2026-10-02: FriendFinderManager `menuDrop` input (default 0, unchanged placement) lowers the start menu; the demo sets it to 8 and its ExampleCarousel `extraPanelDrop` to −32 (since 2026-10-05 both live in the prefab), so the expanded carousel sits above the menu instead of covering its FRIEND FINDER header (Preview-verified, minimized and expanded). Native media, Snap Cloud signaling and phone links remain device-only and unverified here.

Added 2026-10-06: the Snap Cloud project now lives on one `SnapCloudRequirements` object in the prefab (the SnapCloudExamples pattern, shipped empty). `SupabaseRequirements` keeps its static `getProject()` for the transports but reads the project through its new `snapCloudRequirements` input; its own `supabaseProject` stays as a deprecated fallback, so existing scenes keep working. A new `CredentialsWarning` object (demo scaffolding) shows a red-framed "Credentials needed" panel before the guide while the project is missing. Preview-verified with no project: warning → "Continue without credentials" → guide → "Ok, I understood" → carousel and start menu, no errors.

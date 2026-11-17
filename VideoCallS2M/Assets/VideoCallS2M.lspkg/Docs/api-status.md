# VideoCallS2M API status

[← Agent usage index](../README.md)

## Use when

Distinguish installed exports, native device behavior, editor simulation and historical call paths.

## Package

The package version is in `package.native`. Dependencies (`package_dependencies.json`): InteractionKit, UIKit, Motion, Icons, SnapDecorators, SupabaseClient and Utilities. The native modules in `Modules/` run only on a SPECS device, not in the Lens Studio Preview. All public signatures are in [components](components.md).

## Current

| Surface | Source behavior |
|---|---|
| VideoCallS2MManager + menu | Builds runtime UI/geo/video groups; resolves required MobileKitModule and optional SnapCloudModule on Start; internal UI owns modes. |
| MobileKitLink | Location/control/phone call events and RtcSignalTransport API. Only one built-in Mobile Kit module is required by its owner. |
| SnapCloudModule / SupabaseRequirements / SnapCloudRequirements | Optional history/checkpoints, mailbox factory; SupabaseRequirements bridges the transports to the one `SnapCloudRequirements` holding the project. |
| Current call signaling | Manager creates RtcMailbox using rtc_signals DB REST polling. Device Watch Your Back creates a mailbox too. |
| Watch Your Back | Own phone's rear video and one-way inbound voice on device; 180x320 animated synthetic texture in editor, chosen once. |
| CallStreamer / WebRTCSession | Native device media, nullable callbacks, optional native audio APIs and JS audio fallback, no call media transport fallback. |
| Friend guidance | GPS/UWB inputs, extrapolated/held positions, marker/minimap UI; simulation depends on editor + simulateInPreview. |
| Native bindings | Modules/libVideoCallS2MWebRTCModule.so and libVideoCallS2MStreamModule.so, decorator/load helpers, optional older-binary methods explicitly typed. |

## Deprecated

No formal deprecated annotations were found. Realtime, PovFrameReceiver, StreamController and native JPEG export types are retained legacy surfaces; their existence does not select them as current call media fallback. CALL_TRANSPORT_* constants also remain exported without a public manager transport-selection input.

## Experimental / unverified

Lens Studio Preview check (2026-10-01): compile clean; start menu, every switch on/off, Call Friend (connecting state only, no native module or Supabase in Preview), Watch Your Back synthetic feed, Find Your Friend simulated GPS with arrow + minimap, QUIT CALL / EXIT back to the menu; no runtime errors. Still unverified: device WebRTC, native audio/camera, paired phone GPS/UWB, cloud authentication/policies, cross-network connectivity and runtime UI remain unverified. The default TURN_URL is empty and STUN is configured; no cross-network guarantee follows. Optional native mic/speaker methods require compatible binary exports.

Added 2026-10-06: the Snap Cloud project now lives on one `SnapCloudRequirements` object in the prefab (the SnapCloudExamples pattern, shipped empty). `SupabaseRequirements` keeps its static `getProject()` for the transports but reads the project through its new `snapCloudRequirements` input; its own `supabaseProject` stays as a deprecated fallback, so existing scenes keep working. A new `CredentialsWarning` object (demo scaffolding) shows a red-framed "Credentials needed" panel before the guide while the project is missing. Preview-verified with no project: warning → "Continue without credentials" → guide → "Ok, I understood" → carousel and start menu, no errors. The configured path (project assigned → no warning) was not Preview-checked: the project has no SupabaseProject asset.

## Removed from current flow / gaps

| Surface | Source limit |
|---|---|
| Realtime JPEG/WAV call fallback | Current CallStreamer does not select it, despite stale controller text. |
| Private mode operations as public API | Manager exports onAwake only; no public applySelection/startCall/hangup method. |
| SDK download link | SpecsNDK 1.1 (1.1.0) is available from https://github.com/specs-devs/ndk. |
| `Scripts/GuideDismissPanel/GuideDismissPanel.ts` | Removed 2026-10-01 (old guide utility). The current guide script ships as demo scaffolding in `Example/GuideDismissPanel/`. |
| Prefab `Guide_Readme`, `Dev Tools/AiPreviewAgent Handler` | Removed from VideoCallS2M__PLACE_IN_SCENE.prefab 2026-10-01 (guide text and preview-tool residue). The prefab now carries the `Guide` panel and `ExampleCarousel` from `Example/` instead. |

The preserved human guide is not a device compatibility certificate. Fixed: ModeMenuUI switches now read `sw.isOn` (they could turn on but never off); the prefab manager ships `simulateInPreview = true` (editor-only effect).

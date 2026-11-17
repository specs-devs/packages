# RemoteAssistance API status

[← Agent usage index](../README.md)

## Use when

Determine what exists in the installed source rather than historical notes.

| Status | Surface | Meaning in this revision |
|---|---|---|
| Current | Manager, runtime ModeMenuUI/PovPanelUI | Specs-initiated browser-helper call; session code created once per manager instance and reused across calls. |
| Current | RtcMailbox | Snap Cloud PostgREST polling every 0.4 s, no Supabase Realtime channel. |
| Current | CallStreamer/WebRTCSession | WebRTC H.264/Opus only; native-first audio with JS audio fallback **inside WebRTC**, not a fallback media transport. |
| Current | AnnotationRenderer | Pose-frozen world mesh; local Preview simulation, clear/stroke protocol. `clearAll()` cancels pending demo strokes (fixed 2026-10-01). |
| Device only | WebRTCController/StreamController | Native `.so` load; Preview does not validate the media path. |
| Optional/version sensitive | Native mic/speaker/stats exports | Check capability methods or optional fields before use; older binaries can omit them. |
| Retained compatibility | StreamNativeModule, StreamController, RtcVoicePlayer; call transport constants | Present in source, not used as a JPEG transport fallback by current CallStreamer. |
| Historical, not current | Mobile Kit phone relay, Watch Your Back, incoming phone call; old Realtime/JPEG fallback instructions | Not the current RemoteAssistance architecture. `WEBRTC-CALL.md` (at the project root, not inside `RemoteAssistance.lspkg`) explicitly labels its old sections historical. Do not implement those claims as current APIs. |
| Not implemented | TURN configuration, native virtual-content overlay toggle | `TURN_URL` is empty; outbound native camera video does not include Lens virtual rendering. No `rtcSetOverlay` export exists. |

`SupabaseRequirements` is marked `@deprecated` (replaced by `SnapCloudRequirements`; still read by RtcMailbox when SnapCloudModule has no `snapCloudRequirements`); other retained compatibility helpers are not invented removal/deprecation guarantees. SupabaseClient (imported by `RtcMailbox.ts`), SnapDecorators and Utilities (imported by `SnapCloudRequirements.ts`) are declared in `package_dependencies.json` next to InteractionKit, UIKit, Motion and Icons. Historical guide claims of successful native operation are not current verification.

## Removed

| Removed | When | Replacement |
|---|---|---|
| `Scripts/GuideDismissPanel/GuideDismissPanel.ts` | 2026-10-01 | Demo copy now ships in `Example/GuideDismissPanel/` (2026-10-05) and is wired to the prefab's `Guide`; see [Components](components.md#demo-scaffolding-example). |
| Prefab child `Guide_ReadMe` (Text + GuideDismissPanel, ~40-line setup text at z −100) | 2026-10-01 | Short onboarding `Guide` panel inside the prefab (2026-10-05); full setup lives in [Guide](guide.md) and the package [README](../README.md). |
| Prefab child `AiPreviewAgent Handler` (AgentInspectScript / AgentInteractScript) | 2026-10-01 | Preview-tool helper saved by mistake; not part of the package. |

## Preview verification (2026-10-01, Lens Studio Preview, SPECS 27 Interactive)

Compile clean; no runtime errors. Start menu, START CALL, demo circle/arrow/dot, VIDEO 1K→2K, CLEAR DRAWINGS, QUIT CALL → menu, second call: pass. Native media, Snap Cloud signaling, helper portal, voice and webcam are device/credential-only and were not verified.

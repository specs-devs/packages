# VideoCallS2S API status

[← Agent usage index](../README.md)

## Use when

Check source contracts and readiness boundaries before relying on a call, preview or native binary.

## Revision

The version is in `package.native`. Declared dependencies (`package_dependencies.json`): InteractionKit, UIKit, Motion, Icons, SnapDecorators, SupabaseClient and Utilities. SupabaseClient is imported by `Scripts/SnapCloud/RtcMailbox`; Utilities and SnapDecorators by the root `SnapCloudRequirements`; InteractionKit and UIKit by the `Example/` scripts and the app UI. [Components](components.md) lists every public module/export (13 TypeScript modules under `Scripts/` plus the root `SnapCloudRequirements.ts`).

## Current

| Surface | Source behavior |
|---|---|
| Manager | Private idle/calling/ringing/in-call flow; public onAwake only; snapCloud input and previewTestPattern=true. |
| Home/Incoming/Call UI | PublicApi call/accept/deny/hangup/quality events and text/texture/status methods. |
| Pairing helpers | Four-digit random code; normalization strips non-digits; call session `s2s-` + callee code. |
| DB mailbox | Async auth/schema gate, ring/accept/decline/busy/bye and SDP/ICE rows; 1.5s idle/0.4s active polling. |
| WebRTCSession / CallStreamer | Role-specific one duplex native connection; native-first audio with optional support and JS audio fallback; generation >=3 required. |
| SyntheticVideoSource | 320x180 animated editor UI feed selected by manager; no real peer/video acquisition. |
| SnapCloudRequirements | Root credentials component holding the SupabaseProject; `isConfigured`, URL/header getters, `revalidate`. |
| Native module | `libVideoCallS2SWebRTCModule.so` runs only on a SPECS device; in the Lens Studio Preview it does not load and only the synthetic editor feed is available. |

## Deprecated

No formal deprecated annotations were found.

## Experimental / unverified

The original human guide states S2S native changes were compiled but not exercised on hardware. The Lens Studio Preview verified only the editor path: home panel with code + Snap Cloud warning, CALL FRIEND → call panel with the synthetic feed, VIDEO quality 1K → 2K → MAX, HANG UP → home, repeat call. Native load, cloud auth/handshake, the incoming-call dialog, media and hardware are unverified. TURN_URL is empty; STUN is configured, so no cross-network guarantee follows. Optional native audio exports vary by binary revision.

## Removed / unavailable assumptions

| Assumption | Actual source limit |
|---|---|
| Manager public call/hangup methods | State methods are private; UI events drive them internally. |
| Device media fallback to synthetic | Synthetic belongs to editor review; generation/load failure on device is unavailable media. |
| S2M/S2S protocol interchange | Signaling signatures/roles differ; S2S needs generation >=3. |
| Authenticated pairing | A four-digit code is an unauthenticated prototype rendezvous, not identity proof. |
| Bundled guide / dev tools | `Guide_Readme`, `Dev Tools/AiPreviewAgent Handler` and `Scripts/GuideDismissPanel/GuideDismissPanel.ts` were removed. The prefab now ships demo scaffolding instead: `Guide` + `ExampleCarousel` (scripts in `Example/`), with Core / WebRTC · NDK / Snap Cloud under `VideoCallS2SDemo`. |

No SDK download URL, deployed backend, tested device matrix or successful TURN configuration is supplied by these docs.

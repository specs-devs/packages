<p align="center">
  <img src="Docs/media/VideoCallS2S.png" width="250px" alt="VideoCallS2S"/>
</p>

# Video Call S2S

VideoCallS2S is a two-wearer Specs calling example: home pairing code, incoming accept/deny dialog, and friend-video/voice panel. Native WebRTC carries both cameras and voices through one duplex session; Snap Cloud DB rows carry handshake and SDP/ICE. No phone companion is needed. Editor synthetic video supports UI review and does not establish native call readiness.

The complete original workflow, architecture, native-build tutorial and limitations remain in [the human guide](Docs/guide.md).

## Quick Start

1. Place `VideoCallS2S__PLACE_IN_SCENE.prefab` in a configured Specs scene.
2. Wire manager.snapCloud to the active SnapCloudModule and assign your SupabaseProject on the prefab's `SnapCloudRequirements` object for real calls (shipped empty; until then a red-framed "Credentials needed" panel appears before the guide).
3. Configure the rtc_signals schema/policies and confirm mailbox authentication/readiness.
4. On two compatible devices, use one wearer's code from the other home screen, then accept the incoming ring. Verify both video and voice directions separately.
5. For editor-only layout with cloud not ready, previewTestPattern=true lets CALL FRIEND open synthetic UI. It is not a native/network fallback on device.

## Usage

This section ships with the package and describes the exact installed revision. Package-specific setup lives here; generic Lens scripting, scene construction and Specs spatial design are out of scope here.

### Package identity

- Descriptor: `VideoCallS2S.lspkg/package.native`.
- Consumer import prefix: `VideoCallS2S.lspkg/Scripts/`; manager path `App/VideoCallS2SManager`, protocol/pairing helpers `App/Types`. The one exception is the credentials component `SnapCloudRequirements`, at the package root (`VideoCallS2S.lspkg/SnapCloudRequirements`).
- Required companion packages (`package_dependencies.json`): `SupabaseClient` (imported by `Scripts/SnapCloud/RtcMailbox`), `Utilities` and `SnapDecorators` (imported by `SnapCloudRequirements`), `InteractionKit` and `UIKit` (imported by the UI and `Example/` scripts), plus `Motion` and `Icons`.
- Native binary: `Modules/libVideoCallS2SWebRTCModule.so`; rebuild archive in `ExtractAtProjectRoot/`. It runs only on a SPECS device; in the Lens Studio Preview it does not load, so no real call, camera or voice is possible there.
- Prefab entry point: `VideoCallS2S__PLACE_IN_SCENE.prefab`. It is the full demo: dropped into an empty Specs scene (Camera, lighting, InteractionKit) it shows a credentials warning while no SupabaseProject is assigned (`CredentialsWarning`), a guide panel (`Guide`), then an example carousel (`ExampleCarousel`, starts minimized) above the call UI. The package objects sit under its `VideoCallS2SDemo` child: `Core`, `WebRTC · NDK`, `Snap Cloud`.
- Snap Cloud credentials: assign your SupabaseProject on the prefab's `SnapCloudRequirements` object (`VideoCallS2S.lspkg/SnapCloudRequirements.ts`, shipped empty). It is the only place the project lives: the `Snap Cloud` object's SupabaseRequirements reads it from there for RtcMailbox. While it is missing, a red-framed "Credentials needed" panel appears before the guide; "Continue without credentials" runs the demo with calling disabled (in the Preview, CALL FRIEND still opens the synthetic test feed). No Remote Service Gateway tokens are needed. See [setup](Docs/setup.md#snap-cloud).
- Demo scaffolding: `VideoCallS2S.lspkg/Example/` ships the credentials warning, guide and carousel scripts (`CredentialsWarning`, `GuideDismissPanel`, `ExampleCarousel`) used by the prefab. They are demo code, not call API. The `SnapCloudRequirements` inputs and methods are in [components](Docs/components.md#snapcloudrequirements-credentials). See [components](Docs/components.md#demo-scaffolding-example).

### Version and API status

Read [API status](Docs/api-status.md) for role-specific signaling, native generation >=3, preview-only synthesis and unsupported assumptions. Pairing-code format and module declarations do not establish authentication or successful calls.

### Applicability

Use S2S for a Specs-to-Specs call. Use the separate S2M package for a phone companion or friend GPS/UWB. Their mailbox signatures and native role protocols differ; do not substitute S2M native binaries/helpers by matching class names.

### Package Docs (ship in Docs/)

- [Cheat sheet](Docs/cheat-sheet.md) — first-read wiring and role rules.
- [API status](Docs/api-status.md) — current source/preview/native boundaries.
- [Components](Docs/components.md) — every public class/input/event/helper/native export, `SnapCloudRequirements`, demo scaffolding and assets.
- [Examples](Docs/examples.md) — pairing helper and capability-check imports.
- [Setup](Docs/setup.md) — own cloud credentials/schema and native build prerequisites.
- [Troubleshooting](Docs/troubleshooting.md) — ring/accept/timeout/media/schema issues.
- [Human guide](Docs/guide.md) — preserved full workflow and build tutorial.

### Verification

- Compile clean; a fresh prefab instance has Guide / ExampleCarousel / VideoCallS2SDemo (Core, WebRTC · NDK, Snap Cloud), with manager.snapCloud wired. "Ok, I understood" closes the guide and shows the carousel and the home panel.
- Preview (no SupabaseProject): home shows a 4-digit code and the Snap Cloud warning; CALL FRIEND opens the synthetic call panel; VIDEO cycles 1K → 2K → MAX; HANG UP returns home.
- With Snap Cloud configured: incoming accept/deny/missed-call, outgoing timeout, busy and hang-up flows (the synthetic feed only proves the panel animates, not a call).
- On two devices, prove ping generation >=3, authentication/schema readiness, one offerer/one answerer, both camera and voice directions, quality cycling and repeat-call teardown.
- Verify requested network environments separately; source has no configured TURN relay or authenticated pairing-code protocol.

## Built with 👽 by the SPECS team

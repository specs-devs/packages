<p align="center">
  <img src="Docs/media/VideoCallS2M.png" width="250px" alt="VideoCallS2M"/>
</p>

# Video Call S2M

VideoCallS2M combines a Specs Lens and iPhone companion for Find Friend, Watch Your Back, and Call Friend. Native WebRTC carries live device media; the current manager uses Snap Cloud DB mailbox signaling for calls. In editor, Watch Your Back displays a synthetic test pattern and optional fake GPS supports layout work. Those simulations do not prove phone or media connectivity.

The complete original modes, architecture diagram, native-build instructions, companion setup, and known limitations remain in [the human guide](Docs/guide.md).

## Quick Start

1. Place `VideoCallS2M__PLACE_IN_SCENE.prefab` in a configured Specs scene.
2. Wire the manager's required MobileKitModule component, optional SnapCloudModule, and optional FriendMarkerUI reference using the prefab as the starting point.
3. Assign your own SupabaseProject asset on the prefab's `SnapCloudRequirements` object when cloud signaling/history are needed (shipped empty; until then a red-framed "Credentials needed" panel appears before the guide).
4. Review simulation/UI in editor separately from native WebRTC, phone GPS/UWB and audio on real devices.
5. Review [setup](Docs/setup.md) before using native binaries or extracting/building the companion source.

## Usage

This section ships with the package and describes the installed package. Package-specific setup belongs here; generic Lens scripting, scene construction and Specs spatial design are out of scope here.

### Package identity

- Descriptor: `VideoCallS2M.lspkg/package.native` (holds the package version).
- Consumer import prefix: `VideoCallS2M.lspkg/Scripts/`; manager is `App/VideoCallS2MManager`, shared types `App/Types`.
- Dependencies (`package_dependencies.json`): InteractionKit, UIKit, Motion, Icons, SnapDecorators, SupabaseClient and Utilities. The scripts import InteractionKit and UIKit (menu, panels, demo scaffolding), SupabaseClient (`SupabaseClient.lspkg/supabase-snapcloud`, cloud scripts), and SnapDecorators and Utilities (`SnapCloudRequirements.ts`).
- Native code: `Modules/libVideoCallS2MWebRTCModule.so` and `Modules/libVideoCallS2MStreamModule.so` run only on a SPECS device. They don't load in the Lens Studio Preview, where Watch Your Back shows a synthetic test pattern and Call Friend stops at its connecting state.
- Prebuilt native binaries are in `Modules/`. Optional rebuild and iOS archives ship in `ExtractAtProjectRoot/`.
- Prefab entry point: `VideoCallS2M__PLACE_IN_SCENE.prefab`. It is self-contained: `SnapCloudRequirements`, a credentials warning (`CredentialsWarning`), a guide panel (`Guide`), an `ExampleCarousel`, and the `Video Call S2M` example group (Core, WebRTC · NDK, Snap Cloud, Navigation, PhoneLink · Mobile Kit). The guide hides the carousel and the example until **Ok, I understood** is pinched.
- Snap Cloud credentials: assign your SupabaseProject on the prefab's `SnapCloudRequirements` object (`VideoCallS2M.lspkg/SnapCloudRequirements.ts`, shipped empty). It is the only place the project lives: `SnapCloudRequirements` > SupabaseRequirements reads it from there for every cloud transport. While it is missing, a red-framed "Credentials needed" panel appears before the guide; "Continue without credentials" runs the demo with Snap Cloud off. No Remote Service Gateway tokens are needed. See [setup](Docs/setup.md).
- Demo scaffolding: `VideoCallS2M.lspkg/Example/` holds the credentials warning, guide and carousel scripts (`Example/CredentialsWarning`, `Example/GuideDismissPanel`, `Example/ExampleCarousel`) used only by the prefab. They are not call API (see [components](Docs/components.md)); delete `CredentialsWarning` / `Guide` / `ExampleCarousel` from your copy of the prefab if you only want the call experience.

### Version and API status

Read [API status](Docs/api-status.md) for device-only exports, simulation boundaries, retained legacy helpers and source/documentation gaps. Native export presence is not binary compatibility or network readiness proof.

### Applicability

Use S2M for Specs-to-phone media plus friend-location guidance. Specs-to-Specs calling belongs to the separate S2S package. The Mobile Kit phone link is required; optional cloud history can be disabled, but current call signaling still needs configured cloud services.

### Package Docs (ship in Docs/)

- [Cheat sheet](Docs/cheat-sheet.md) — required blocks and transport boundaries.
- [API status](Docs/api-status.md) — current versus legacy/unverified surfaces.
- [Components](Docs/components.md) — prefab hierarchy, all public classes, inputs, callbacks, wire/native types and functions, and the assets the scripts load by path.
- [Examples](Docs/examples.md) — real import paths and typed helper/event usage.
- [Setup](Docs/setup.md) — credentials, companion archives and native build ownership.
- [Troubleshooting](Docs/troubleshooting.md) — missing block, waiting call, estimated GPS and stale comments.
- [Human guide](Docs/guide.md) — preserved tutorial and native-build instructions.

### Verification

- Compile resolved package imports and confirm typed required module inputs; the placed prefab has `Guide`, `ExampleCarousel` and `Video Call S2M` (Core, WebRTC · NDK, Snap Cloud, Navigation, PhoneLink · Mobile Kit) and no preview-tool objects.
- In the Preview start menu, turn each switch on and then off again: the label colour and the START summary must follow the knob both ways, and Call Friend / Watch Your Back must switch each other off.
- Verify Find Friend menu, marker/minimap and dropouts with explicit simulated-versus-real GPS labels.
- Verify Watch Your Back animated editor texture at two timestamps, then actual own-phone rear video/audio on device.
- Verify Call Friend native video and two-way voice, accepted/denied/hung-up calls and independent Find Friend state.
- Verify Supabase authentication/schema/signaling and same-session repeat calls; startup and a UDP probe alone are insufficient.

## Built with 👽 by the SPECS team

<p align="center">
  <img src="Docs/media/FriendFinder.png" width="250px" alt="FriendFinder"/>
</p>

# Friend Finder

Find a friend in a crowd, watch your own back, or video-call a friend — a Specs experience with an iPhone companion doing the phone-side work. Real-time media uses peer-to-peer WebRTC; position history, checkpoints and call signaling use Snap Cloud (Supabase).

## Usage

This section ships with the package and describes the exact installed revision. Generic Lens scripting, scene construction and Specs spatial design are out of scope here; this package owns Mobile Kit routing, location estimation, cloud tables, native WebRTC and the companion contract.

### Package identity

- Descriptor: `package.native` (it holds the package version).
- Consumer prefix: `FriendFinder.lspkg/Scripts/`.
- Demo: `FriendFinder.lspkg/FriendFinder__PLACE_IN_SCENE.prefab`. It is self-contained: drop it into a Specs scene (Camera + InteractionKit) and you get the guide, the example carousel and the demo (`FriendFinderDemo` group).
- Snap Cloud credentials: assign your SupabaseProject on the prefab's `SnapCloudRequirements` object (shipped empty; all cloud scripts read it from there). While it is missing, a red-framed "Credentials needed" panel appears before the guide; "Continue without credentials" runs the demo with Snap Cloud off. No Remote Service Gateway tokens are needed. See [Setup](Docs/setup.md).
- Demo scaffolding: `FriendFinder.lspkg/Example/` holds `CredentialsWarning`, `ExampleCarousel` and `GuideDismissPanel`. The prefab uses them to present the demo; the FriendFinder scripts don't depend on them.
- Required companion packages (`package_dependencies.json`): `InteractionKit` and `UIKit` (imported by the `Scripts/App`, `Scripts/Geolocation` and `Scripts/WebRTC` UI scripts and by the `Example/` scripts), `SupabaseClient` (imported by `CloudPathLogger`, `RtcMailbox` and `Realtime`), `SnapDecorators` and `Utilities` (imported by `SnapCloudRequirements`), plus `Solvers`, `Motion` and `Icons` (declared; no package script imports them).
- Native device binaries: `Modules/libFriendFinderWebRTCModule.so` and `Modules/libFriendFinderStreamModule.so`. They run only on a SPECS device, not in the Lens Studio Preview (Preview uses simulated GPS and a synthetic video pattern). Companion/native source ZIPs: `ExtractAtProjectRoot/` (`iOS.zip`, `FriendFinderWebRTCModule.zip`, `FriendFinderStreamModule.zip`).
- Assets: `Meshes/DestinationPointer.glb` (pointer, loaded by FriendFinderManager), `Meshes/MarkerSphere.mesh`, `Meshes/{ArrowHeadMesh,ArrowShaftMesh}.mesh` (unreferenced), `Audio/{ConnectChime,TargetPing}.wav`, `Audio/MicInput.micaudio`, `Audio/RtcVoiceOutput.audioOutput`, `Materials/{ArrowMat,MarkerMat,ImageMaterial}.mat`, `Shaders/{unlit,flat,unlit_arrow}.graphShader`, `Images/{person_pin_circle,Image}.png`, `RawLocationPermission.rawLocationModule`. See [Components](Docs/components.md#shipped-assets).

### Version and API status

Read [API status](Docs/api-status.md) before using legacy broadcast helpers or native exports. The descriptor is not proof of Asset Library release availability. Device media and physical phone links need device verification.

### Applicability

Use this package for the combined friend-finding/iPhone companion experience. Use the pure GeoMath and FriendPositionEstimator modules independently when only location math is needed. Preview uses simulation/synthetic media and cannot validate the native WebRTC libraries.

### Package Docs (ship in Docs/)

- [Cheat sheet](Docs/cheat-sheet.md): read first for source lifecycle and mode rules.
- [Components](Docs/components.md): read for every source input, API, wire type and native declaration.
- [API status](Docs/api-status.md): read for current versus retained legacy paths.
- [Setup](Docs/setup.md): read before wiring phones, cloud tables or native modules.
- [Examples](Docs/examples.md): read for typed geographic and estimator consumers.
- [Troubleshooting](Docs/troubleshooting.md): read for phone, cloud, media and stale-comment mismatches.
- [Guide](Docs/guide.md): read for the retained native build recipes and human tutorial.

### Verification

1. Compile the package and typed imports after assigning required prefab inputs.
2. In Preview, verify each mode switch turns on and off, Find Your Friend shows the arrow + minimap, and Watch Your Back shows the synthetic panel; EXIT / QUIT CALL return to the menu.
3. With your own cloud project, verify auth, locations/checkpoints and fresh rtc_signals handling.
4. On compatible Specs and phones, verify Mobile Kit reconnect, GPS/UWB, incoming-call controls and native media/audio.
5. Verify end-call/quit cleanup, restart and cross-network connectivity separately; Preview media is not a device result.

## Built with 👽 by the SPECS team

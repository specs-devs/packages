<p align="center">
  <img src="Docs/media/RemoteAssistance.png" width="250px" alt="RemoteAssistance"/>
</p>

<h1 align="center">Remote Assistance</h1>

<p align="center">
  Call a helper from your SPECS: they see your POV in a web browser,
  talk you through the task — and <b>draw guidance that lands as 3D lines
  in your world</b>.
</p>

The wearer calls a helper browser through native WebRTC; Snap Cloud carries signaling and drawing rows. The original setup and native build tutorial is preserved in [Guide](Docs/guide.md).

## Usage

This section ships with the package and describes its exact source revision. Generic Lens scripting, scene construction and Specs spatial design are out of scope here; package APIs, configuration and limitations live here.

### Package identity

- [package.native](package.native) holds the package version; existing ReadMe preserved, SetupScript empty and no instantiable root.
- Consumer prefix `RemoteAssistance.lspkg/`; editable folder `Assets/RemoteAssistance.lspkg/`. Example: `RemoteAssistance.lspkg/Scripts/Drawing/AnnotationRenderer`.
- [Dependencies](package_dependencies.json): InteractionKit, UIKit, Motion, Icons, SnapDecorators, SupabaseClient and Utilities. Scripts import InteractionKit and UIKit (runtime menu/call panel, `Example/`), SupabaseClient (`RtcMailbox`), SnapDecorators and Utilities (`SnapCloudRequirements`); Motion and Icons are declared but no script imports them.
- Native modules: `Modules/libRemoteAssistanceWebRTCModule.so` (the call media path) and `Modules/libRemoteAssistanceStreamModule.so` (retained camera-stream module), loaded by `WebRTCController` / `StreamController`. They run only on a SPECS device; in the Lens Studio Preview they don't load ("Native module unavailable") and only the local demo drawing (`simulateInPreview`) runs. Their C++ sources ship as zips in `ExtractAtProjectRoot/`; rebuilding needs SpecsNDK, see [Guide](Docs/guide.md#native-development-specsndk).
- [RemoteAssistance__PLACE_IN_SCENE.prefab](RemoteAssistance__PLACE_IN_SCENE.prefab) wires manager, annotations, cloud requirements and native loaders. The Snap Cloud project lives on its `SnapCloudRequirements` child (every script reads it from there); the input is intentionally empty, so assign your own SupabaseProject asset (Window > Supabase > Import Credentials). Until you do, a red-framed "Credentials needed" panel (`CredentialsWarning`) shows before the guide; "Continue without credentials" closes it. No Remote Service Gateway tokens are needed. See [Setup](Docs/setup.md).
- The prefab includes the demo guide panel and example carousel: dragging it into an empty Specs scene gives the full demo. Their scripts ship in `RemoteAssistance.lspkg/Example/` (`CredentialsWarning`, `ExampleCarousel`, `GuideDismissPanel`, see [Components](Docs/components.md#demo-scaffolding-example)). They only present the demo; the RemoteAssistance scripts don't import them.

### API status

Read [API status](Docs/api-status.md). The current browser/PostgREST path supersedes older phone-relay and JPEG fallback descriptions. Device-only native load failure in Preview does not produce a working media fallback.

### Applicability

Use for remote guidance with a browser helper, Snap Cloud mailbox and compatible Specs hardware. Preview can demonstrate local annotations; it cannot prove native media, authentication, ICE, microphone, speaker or end-to-end alignment.

### Package Docs (ship in Docs/)

- [Setup](Docs/setup.md): Snap Cloud credentials and the Credentials needed panel.
- [Cheat sheet](Docs/cheat-sheet.md): startup and camera ownership rules.
- [API status](Docs/api-status.md): current surface, historical claims and gaps.
- [Components](Docs/components.md): every script, input, callback, method and protocol type, the `Example/` demo scaffolding and the shipped assets.
- [Native API](Docs/native-api.md): exact native exports, loaders and optional features.
- [Examples](Docs/examples.md): typed parser, annotation and menu consumers.
- [Troubleshooting](Docs/troubleshooting.md): signaling, lifecycle, audio and alignment.
- [Guide](Docs/guide.md): original setup/build tutorial preserved.
- [Drawing protocol](Docs/drawing-protocol.md): retained wire-format guide.
- [Helper portal](Docs/helper-portal.md): retained browser setup instructions.

### Verification

Preview checks (verified in the Lens Studio Preview on 2026-10-01, see [API status](Docs/api-status.md)) and device checks still open:

1. Compile clean with the dependencies installed (InteractionKit, UIKit, Motion, Icons, SnapDecorators, SupabaseClient, Utilities); in the Preview the native controllers log "Native module unavailable" (expected, device-only).
2. START CALL → circle, arrow and dot appear ~200 cm ahead; VIDEO cycles 1K/2K/MAX; CLEAR DRAWINGS wipes them; QUIT CALL returns to the menu; quitting within 6 s leaves no strokes behind.
3. Assign your SupabaseProject, apply the shipped schema and verify authenticated mailbox insert/select with a browser using the same session code.
4. On Specs, verify both WebRTC legs, outgoing POV, optional incoming webcam, two-way voice and quality switching; exercise repeated call teardown.
5. Test disconnect/reconnect and the intended networks. STUN without TURN is not a connectivity guarantee; calibrate stroke FOV/depth/lag against the actual camera.

## Built with 👽 by the SPECS team

# VideoCallS2S setup

[← Agent usage index](../README.md)

## Use when

Configure your own cloud signaling and native two-device prerequisites.

## Snap Cloud

Assign a SupabaseProject asset imported via Window > Supabase > Import Credentials on the prefab's `SnapCloudRequirements` object (`VideoCallS2S.lspkg/SnapCloudRequirements.ts`); the prefab ships it empty. It is the only place the project lives: the `Snap Cloud` object's SupabaseRequirements has `snapCloudRequirements` wired to it and hands the project to RtcMailbox. Its `supabaseProject` input is deprecated and only used when `snapCloudRequirements` isn't wired. While no project is assigned, the prefab's `CredentialsWarning` shows a red-framed "Credentials needed" panel before the guide; "Continue without credentials" runs the demo with calling disabled. No Remote Service Gateway tokens are used. SupabaseRequirements' optional Text also warns until configuration is present. SnapCloudModule must be active and configured; createRtcMailbox returns null otherwise. `package_dependencies.json` declares the packages the source imports: SupabaseClient (`SupabaseClient.lspkg/supabase-snapcloud`, used by RtcMailbox), Utilities and SnapDecorators (used by `SnapCloudRequirements`), InteractionKit and UIKit, plus Motion and Icons. See [components](components.md#snapcloudrequirements-credentials) for the `SnapCloudRequirements` inputs and methods.

RtcMailbox first tries Snapchat ID-token auth, then anonymous fallback. Enable/configure anonymous auth for your own editor backend if needed; source declarations do not prove the backend permits it. Apply the project's rtc_signals schema/migrations under your normal backend authorization and confirm policies support handshake and SDP/ICE rows. No backend change was made in this pass.

Mailbox start is fire-and-forget; use onReady/onSchemaMissing, schemaMissing and isConnected. The constructor exposes readonly session/me. Its join cursor starts at the newest existing row, avoiding old call history. Idle inbox polling uses 1.5 seconds and active calls 0.4 seconds.

## Native module

Prebuilt `Modules/libVideoCallS2SWebRTCModule.so` is device-only: it runs on a SPECS device, not in the Lens Studio Preview. Extract source from `ExtractAtProjectRoot/VideoCallS2SWebRTCModule.zip` into the project root containing Assets if rebuilding. The [preserved tutorial](guide.md#native-development-specsndk) retains SpecsNDK 1.1 (1.1.0), toolchain/header checks, CMake/Bash prerequisites, matched Opus/patched libdatachannel bundle and build.sh command.

Loader requires one decorated field, assigns exports and invokes onLoaded bound to the component. Static WebRTCController.native starts null. WebRTCSession.isS2SCapable requires ping >= S2S_MODULE_GENERATION (3); old S2M generation-2 binaries are refused. Optional native mic/speaker APIs require support checks. Keep one camera/mic owner; native-first audio's JS fallback is not a second call transport.

## Network and role boundary

Caller makes the offer, callee answers, with one duplex POV connection for both camera and voice. Both mailbox peers use `s2s-` + the callee's code. These types differ from S2M mailbox signatures.

TURN_URL is empty and public STUN configured. Start validation on the intended same Wi-Fi/hotspot and test each requested environment; no TURN server or cross-network guarantee is supplied. Pairing codes and rtc_signals policies are prototype rendezvous, not authenticated user identity.

## Editor preview boundary

When cloud is not ready, manager permits synthetic call UI only when isEditor() and previewTestPattern=true. Synthetic source is 320x180 RGBA animated gradient/scanline. Its helper does not gate itself; preserve manager's editor-only ownership if consuming it independently. On real devices, native load/compatibility and signaling are still required.

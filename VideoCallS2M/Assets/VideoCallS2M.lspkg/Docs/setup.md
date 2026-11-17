# VideoCallS2M setup

[← Agent usage index](../README.md)

## Use when

Configure phone-link, cloud and native prerequisites for this package.

## Phone link

Wire VideoCallS2MManager.mobileKit to MobileKitModule, not a SceneObject or a second module asset. This block lazily owns the shared MobileKitLink and the only require of LensStudio:SpectaclesMobileKitModule. Manager calls link.start on Start. Without the input, it logs a missing PhoneLink and cannot start.

The iOS companion source ships in ExtractAtProjectRoot/iOS.zip. The full repository has iOS/ and its README; the [human guide](guide.md) retains build prerequisites. This pass does not pair phones, install apps or execute native/mobile builds.

## Snap Cloud

Create/import your own SupabaseProject asset through Window > Supabase > Import Credentials and assign it on the prefab's `SnapCloudRequirements` object (`VideoCallS2M.lspkg/SnapCloudRequirements.ts`, the SnapCloudExamples pattern). It is the only place the project lives: SupabaseRequirements (same object) reads it through its `snapCloudRequirements` input and hands it to Realtime, RtcMailbox and CloudPathLogger. SupabaseRequirements' own `supabaseProject` input is deprecated and only used when `snapCloudRequirements` isn't wired, so older scenes keep working. The prefab ships with the project EMPTY: until you assign it, a red-framed "Credentials needed" panel (`CredentialsWarning`) appears before the guide; "Continue without credentials" closes it and the demo runs with Snap Cloud off. This package uses no Remote Service Gateway tokens. Do not hardcode tokens into scripts/docs. isConfigured checks asset presence only.

Cloud source imports `SupabaseClient.lspkg/supabase-snapcloud`, and `SnapCloudRequirements.ts` imports SnapDecorators and Utilities. All three are declared in `package_dependencies.json` next to InteractionKit, UIKit, Motion and Icons, so they install with the package.

RtcMailbox uses rtc_signals inserts and ~0.4s REST polls, with Snapchat ID-token auth first and anonymous fallback only if that fails. Whether anonymous auth is enabled and RLS/table schema permit these operations is a backend setup question, not confirmed by source. The repository supabase/ folder contains schema/migrations; apply to your own project under your authorization, not a historical project ID.

Disabling/unwiring SnapCloudModule disables history/checkpoints and makes manager Call Friend skip a mailbox. Device Watch Your Back independently creates RtcMailbox and still needs configured requirements; an optional cloud module is not a promise that every native media mode runs offline. Do not confuse DB signaling with live media transport.

## Native modules

Prebuilt binaries live in Modules/libVideoCallS2MWebRTCModule.so and Modules/libVideoCallS2MStreamModule.so. They run only on a SPECS device and cannot execute in the Lens Studio Preview. Native loaders require a decorated field, assign exports and call onLoaded bound to the component, returning null on load failure. The WebRTCController also performs a UDP egress probe; success is not a completed call.

Rebuild archives in ExtractAtProjectRoot/ are VideoCallS2MWebRTCModule.zip and VideoCallS2MStreamModule.zip. Extract into the project root containing Assets. The [preserved guide](guide.md#native-development-specsndk) documents SpecsNDK 1.1 (1.1.0), toolchain/header checks, matching Opus/patched libdatachannel dependencies, and the two build.sh commands. Get SpecsNDK from https://github.com/specs-devs/ndk.

Native stream owns the RGB camera while running. Do not also request it from CameraModule. WebRTC audio methods marked optional depend on binary revision; branch on support instead of assuming an older .so implements them. The current media path stays WebRTC; JS mic/speaker fallback is audio implementation fallback, not cloud video fallback.

## Network expectations

WebRTCSession uses an empty TURN_URL and configured public STUN, with quality presets 1000/2000/3500 kbps. Validate same-network call setup and every requested network environment on device. Cross-network/TURN provisioning is not performed or certified here; do not publish credentials in this package's documentation.

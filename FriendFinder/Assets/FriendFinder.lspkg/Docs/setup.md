# FriendFinder setup

[← Agent usage index](../README.md)

## Use when

Read before configuring the iPhone companion, Snap Cloud or native media.

1. Drop `FriendFinder.lspkg/FriendFinder__PLACE_IN_SCENE.prefab`. Verify the manager's MobileKitModule reference, optional SnapCloudModule, label and native-loader inputs. Preserve the bundled pointer/audio/native assets and one shared Mobile Kit module.
2. Configure your own Snap Cloud project with the Lens Studio Supabase panel and assign its imported SupabaseProject on the prefab's `SnapCloudRequirements` object (`FriendFinder.lspkg/SnapCloudRequirements.ts`). It is the only place the project lives: `Snap Cloud` > SupabaseRequirements reads it from there for every cloud transport (its own `supabaseProject` input is deprecated and only used when `snapCloudRequirements` isn't wired). The prefab ships with it empty, so until you assign it a red-framed "Credentials needed" panel (`CredentialsWarning`) appears before the guide; "Continue without credentials" closes it and the demo runs with Snap Cloud off. This package uses no Remote Service Gateway tokens. Enable anonymous auth if testing cloud flows in Preview. Device token authentication can also fall back to anonymous; confirm your intended auth policy.
3. Apply the repository migrations under `FriendFinder/supabase/migrations/` for locations, checkpoints and rtc_signals, including their expected access policies. These files are repository support files, not a promise that dropping the prefab creates tables.
4. Extract companion/native ZIPs from ExtractAtProjectRoot into the project root. Build/configure the iOS companion with your own cloud configuration; use the supplied prebuilt native device libraries unless modifying C++. See [native build recipes](guide.md#native-development-specsndk).
5. Pair the Specs Mobile Kit phone session, then the two-phone MultipeerConnectivity/NearbyInteraction session for Find Friend. Device Watch Your Back uses your phone plus cloud mailbox signaling; Call Friend uses the friend's phone plus the manager's active cloud module.
6. Test audio permissions, phone camera direction, native library load, end-call/reconnect and network routing on compatible devices. The retained guide's same-network/no-TURN limitation is not a newly measured connectivity result.

The simulated Preview path does not require working native media. Optional cloud services can still contact a configured backend in Preview, so select setup deliberately. No phone, cloud or native connection was opened during the source documentation pass.

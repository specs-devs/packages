# SnapCloudConnected cheat sheet

[← Agent usage index](../README.md)

## Use when

Read this first, before you build or edit a Lens with Snap Cloud Connected.

1. **Run the SQL once per Snap Cloud project.** Without `Supabase/snapcloud-connected-setup.sql`, Host and Join fail with "missing the Connected tables". → [setup](setup.md)
2. **Never put credentials in scripts or in the prefab.** Assign a `SupabaseProject` asset (Window → Supabase → Import Credentials) to `SnapCloudRequirements.supabaseProject`; `SnapCloudConnected` reads it through `snapCloudRequirements`. → [setup](setup.md)
3. **Put shared content under `Origin`, and put `SyncedTransforms` components outside it.** The origin is hidden until it is placed (`hideOriginUntilPlaced`). A component on a disabled object doesn't start, so it registers late. → [components](components.md)
4. **Ids must match on every device.** The wire id is `<syncId>/<index in objects>`. Keep the same Sync Id and the same object order in every build, and give each `SyncedTransforms` a unique Sync Id. → [components](components.md#syncedtransforms)
5. **Owner decides who may move an object.** Players who don't own an object follow it, so their local moves of it are overwritten. Use `Anyone` for objects every player can grab. → [components](components.md#syncedtransforms)
6. **Sync runs only in `Active`.** That means every seat is taken, every player has placed, and every player has confirmed (`confirmReady()`, or `autoReadyAfterPlacement`). → [components](components.md#session-states)
7. **Poses are relative to the placed origin, turned by the seat yaw when `faceToFace` is on** (player 2 by 180°). Turn `faceToFace` off when everyone should see the same layout in front of them. → [troubleshooting](troubleshooting.md)
8. **Default sign-in is Snapchat, then anonymous.** For "Anonymous only", enable Anonymous Sign-Ins in your Snap Cloud Auth settings. → [setup](setup.md)

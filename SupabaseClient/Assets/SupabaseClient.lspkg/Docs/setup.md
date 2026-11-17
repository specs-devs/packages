# SupabaseClient setup

[← Agent usage index](../README.md)

## Use when

Read before running the demo prefab `SupabaseClient__PLACE_IN_SCENE.prefab` against a Snap Cloud project.

## Snap Cloud project

Create/import your own SupabaseProject asset through Window > Supabase > Import Credentials and assign it on the prefab's `SnapCloudRequirements` object (`SupabaseClient.lspkg/SnapCloudRequirements.ts`, the SnapCloudExamples pattern). It is the only place the project lives: both examples (`Client Tests`, `Realtime Test`) read it through their `snapCloudRequirements` input. Their own `supabaseProject` input is deprecated and only used when `snapCloudRequirements` isn't wired, so older scenes keep working.

The prefab ships with the project EMPTY. Until you assign it, a red-framed "Credentials needed" panel (`CredentialsWarning`) appears before the "Ok, I understood" guide and lists what's missing. "Continue without credentials" closes it; the examples then print their guard message and stop. With a project assigned the panel doesn't appear and the guide shows directly. `isConfigured()` checks that the asset is assigned, not that the backend answers.

This package uses no Remote Service Gateway tokens, so `CredentialsWarning` checks only the Snap Cloud project. Never commit a SupabaseProject or tokens into the prefab, scripts or docs.

`SnapCloudRequirements.ts` imports `Utilities.lspkg` (Logger) and `SnapDecorators.lspkg` (decorators). Both are declared in `package_dependencies.json`, next to InteractionKit, UIKit, Motion and Icons. Make sure they resolve when you use the prefab in another project.

## Backend

The tests expect what `Example/DatabaseTypes.ts` and [Examples](examples.md) describe (a `test_table`, a Storage bucket, edge functions, Snapchat sign-in). Set these up in your own project under your own authorization.

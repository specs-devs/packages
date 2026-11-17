<p align="center">
  <img src="Docs/media/SupabaseClient.png" width="250px" alt="SupabaseClient"/>
</p>

# SupabaseClient

A bundled Supabase JavaScript SDK with Lens Studio transport/polyfills and a
Snapchat sign-in convenience method. It supplies a client library, the
`SnapCloudRequirements` credentials component and a demo test prefab, not UI,
database deployment or a backend project.

## Usage

This section ships with the package and describes the exact installed revision.
Generic Lens scripting, scene construction and SPECS spatial design live in
CLAD skills; client factory behavior, declarations and Lens transport limits live here.

### Package identity

- Descriptor `SupabaseClient.lspkg/package.native` (holds the package version).
  Existing ReadMe UUID retained; empty setup script and no Instantiable assignment.
- Consumer module: `SupabaseClient.lspkg/supabase-snapcloud` (JS + matching `.d.ts`).
  `version.json` records upstream commit `5a6c9c2`; this is not the package version.
- Declared companions (`package_dependencies.json`): SpectaclesInteractionKit, SpectaclesUIKit,
  Motion, Icons, Utilities and SnapDecorators. The client bundle imports none of them;
  `SnapCloudRequirements.ts` imports Utilities and SnapDecorators, and the `Example/` scripts
  import SpectaclesUIKit and SpectaclesInteractionKit.
- The client bundle has no @component/@input scripts; `SnapCloudRequirements` is the one
  reusable component (see [Components](Docs/components.md#snapcloudrequirements)). Polyfills are bundled into the
  main JS; their separate `.d.ts` files do not have corresponding loose JS modules.
- Demo prefab: `SupabaseClient.lspkg/SupabaseClient__PLACE_IN_SCENE.prefab`. It is self-contained:
  it includes the guide (dismissed with "Ok, I understood"), the example carousel
  (Previous / Next / minimize) and the two examples (`Client Tests`, `Realtime Test`), so dropping it
  into a Specs scene with Camera, lighting and SIK gives the full demo. The demo scripts ship in
  `SupabaseClient.lspkg/Example/` (`ExampleCarousel`, `GuideDismissPanel`, `ts__test`,
  `ts_test_realtime`, `DatabaseTypes`, plus the `Text Texture` used by the Storage upload test);
  see [Components](Docs/components.md).
- Credentials: assign your Snap Cloud SupabaseProject on the prefab's `SnapCloudRequirements` object
  (`SupabaseClient.lspkg/SnapCloudRequirements.ts`); both examples read it from there (their own
  `supabaseProject` input is a deprecated fallback). The prefab ships without one, so a red-framed
  "Credentials needed" panel (`CredentialsWarning`) shows before the guide until it is set. No Remote
  Service Gateway tokens are used. See [Setup](Docs/setup.md).

### Version and API status

Read [API status](Docs/api-status.md). Use the installed declarations as the
mechanical type contract. A declared upstream browser method is not proof that
Lens transport/runtime or your Snap Cloud deployment supports that flow.

### Applicability

Use this reusable library for Snap Cloud auth, table/RPC queries, storage,
functions and realtime. Use SnapCloudExamples for scene wiring/demo controllers;
SyncKit supplies shared object state/ownership rather than this backend SDK.

### Package Docs (ship in Docs/)

- [Setup](Docs/setup.md): read first for the Snap Cloud project on SnapCloudRequirements and the credentials warning.
- [Cheat sheet](Docs/cheat-sheet.md): read first for factory, result handling and transport limits.
- [API status](Docs/api-status.md): read for Lens adaptation vs upstream declarations.
- [Client/auth/query API](Docs/api.md): read for factory, options and complete public callable signatures.
- [Storage/functions API](Docs/storage-functions.md): read for bucket/file operations and invocation.
- [Realtime API](Docs/realtime.md): read for channel events, presence, send and cleanup.
- [Polyfills](Docs/polyfills.md): read for exact Lens transport behavior and unsupported browser assumptions.
- [Components](Docs/components.md): read for the demo prefab's scripts in `Example/` and their inputs.
- [Examples](Docs/examples.md): read for compile-checked guarded functions (network only on invocation).
- [Troubleshooting](Docs/troubleshooting.md): read for source limits and pending validation.
- [Original tutorial](Docs/tutorial.md): preserved older examples and claims; illustrative fragments.

### Related CLAD skills

Use [Snap Cloud](https://github.com/lens-studio-devs/ls-extensions/tree/main/plugins/ls-clad/skills/specs-snap-cloud)
and [Internet](https://github.com/lens-studio-devs/ls-extensions/tree/main/plugins/ls-clad/skills/specs-internet)
for platform routing. CLAD setup: https://developers.specs.com/docs/clad/setup/setup-ai/.
Use the installed SupabaseProject/SupabaseModule declarations for engine assets.

### Verification

1. Compile clean against `SupabaseClient.lspkg/supabase-snapcloud` without `as any`; keep the `SupabaseProject` input `@allowUndefined` and guard it before `createClient`.
2. Preview with no project assigned: no `TypeError … 'url' of undefined`; your guard message prints instead.
3. With a test Snap Cloud project: `signInWithSnapchat()` returns a user, then one table query and one Storage upload/download return `error === null`.
4. Realtime: `channel(...).subscribe()` reaches `SUBSCRIBED`, a `send` broadcast is received, and `removeAllChannels()` runs in `onDestroy`.
5. Repeat on a paired SPECS device (auth, connection loss, cleanup). The package's demo prefab (`Client Tests` / `Realtime Test` carousel steps) runs exactly these checks and prints PASS / FAIL in the Logger.

## Built with 👽 by the SPECS team








<p align="center">
  <img src="Docs/media/SnapCloudExamples.png" width="250px" alt="SnapCloudExamples"/>
</p>

# Snap Cloud Examples

Examples for Snapchat authentication, tables, realtime cursor broadcasts,
public storage downloads, image-processing functions, media capture/streaming,
and a global leaderboard. These are backend demonstrations with Inspector wiring.

## Usage

This section ships with the package and describes the exact installed revision.
Generic Lens scripting, scene construction and SPECS spatial design live in
CLAD skills; this package documents its own component wiring and backend contracts.

### Package identity

- Descriptor: `SnapCloudExamples.lspkg/package.native` (it carries the package and Lens Studio versions).
  Existing ReadMe UUID retained; empty setup script and no Instantiable assignment.
- Consumer imports begin `SnapCloudExamples.lspkg/`; the main prefab is
  `SnapCloudExamples.lspkg/SnapCloudExamples__PLACE_IN_SCENE.prefab`. The prefab is self-contained:
  it includes the guide (dismissed with "Ok, I understood"), the example carousel
  (Previous / Next / minimize) and every example, so dropping it into a Specs scene with
  Camera, lighting and SIK gives the full demo. The demo scaffolding scripts ship in
  `SnapCloudExamples.lspkg/Example/` (`ExampleCarousel`, `GuideDismissPanel`, `CredentialsWarning`).
- Credentials: every example reads the Supabase project from the prefab's one
  `[SnapCloudRequirements]` object, shipped empty. Assign your SupabaseProject there
  (Window > Supabase > Import Credentials). Until then a red-framed "Credentials needed"
  panel appears before the guide; "Continue without credentials" closes it. No example uses
  Remote Service Gateway tokens. See [Setup](Docs/setup.md).
- Declared dependencies (see `package_dependencies.json`): SpectaclesInteractionKit, SpectaclesUIKit,
  SupabaseClient, Utilities, SnapDecorators, Motion and Icons.
- Backend and browser counterparts ship in `SnapCloudExamples.lspkg/ExternalServicesExamples/`:
  the leaderboard SQL, two Edge Function sources, mock table/storage data, three web viewers for the
  media broadcasts, a web cursor controller for Realtime Cursor, a Node composite-stitcher service and
  four guides. They are not Lens assets; you deploy or open them yourself. See
  [Setup](Docs/setup.md#shipped-backend-and-viewer-samples-externalservicesexamples).
- `CompositeCameraWork/` is the shared camera rig (CameraService + composite render targets) used by
  the media examples. It carries its own `README.md` and is part of this package,
  not a separate install.

### Version and API status

Read [API status](Docs/api-status.md). The current surface is 25 TS files (three of them demo scaffolding in `Example/`),
four prefabs and their Inspector references. Authentication is the Lens-specific
SupabaseClient adapter flow; this is not ordinary browser Supabase configuration.

### Applicability

Use these wired examples to learn particular cloud operations. For a reusable
client use SupabaseClient; for multiplayer ownership/state use SyncKit. This
package supplies no backend deployment automation or general SDK wrapper.

### Package Docs (ship in Docs/)

- [Cheat sheet](Docs/cheat-sheet.md): read first for wiring and actions with backend effects.
- [API status](Docs/api-status.md): read for current vs historical APIs and verification limits.
- [Core components](Docs/components.md): read for requirements, authentication, tables, cursor and downloads.
- [Media components](Docs/media.md): read for all capture/streaming inputs and shared utilities.
- [Leaderboard](Docs/leaderboard.md): read for RPCs, rows, score ordering and game controller.
- [Setup](Docs/setup.md): read for project, schema, storage/function and viewer contracts, and the shipped `ExternalServicesExamples/` files.
- [Examples](Docs/examples.md): read for small offline compile-checked integrations.
- [Troubleshooting](Docs/troubleshooting.md): read for source-observed limitations and pending QA.
- [Tutorial](Docs/tutorial.md): end-to-end walkthrough, example by example, with the backend pieces each one needs.

### Related CLAD skills

Use [Snap Cloud](https://github.com/lens-studio-devs/ls-extensions/tree/main/plugins/ls-clad/skills/specs-snap-cloud),
[camera](https://github.com/lens-studio-devs/ls-extensions/tree/main/plugins/ls-clad/skills/specs-camera),
[audio](https://github.com/lens-studio-devs/ls-extensions/tree/main/plugins/ls-clad/skills/specs-audio)
and [scene construction](https://github.com/lens-studio-devs/ls-extensions/tree/main/plugins/ls-clad/skills/scene-construction)
for platform workflows. CLAD setup: https://developers.specs.com/docs/clad/setup/setup-ai/.

### Verification

1. Compile with exact installed dependencies and the single root `SnapCloudRequirements`.
2. With no project assigned: the red Credentials needed panel shows before the guide, the log has `[CameraService] Camera initialized`,
   the media tabs switch, and enabling Example2 shows the draggable arrow cursor.
3. With a test backend configured, verify auth/errors, table read/write, public downloads and function response.
4. Test capture start/stop/repeat, upload errors and every broadcast against its matching external viewer.
5. Check leaderboard ordering/row pooling and on-device camera/microphone behavior. Step 2 passed in the
   Lens Studio Preview (2026-10-01; credentials panel 2026-10-06); steps 3–5 need a backend or a device and are not verified.

## Built with 👽 by the SPECS team

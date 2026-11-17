# Snap Cloud Social Media

Record through Specs, edit a caption, turn destinations on, choose a format and submit one share
job to Snapchat, X, YouTube, LinkedIn, Instagram, Threads and TikTok. The package includes a
drag-and-drop prefab with a UIKit panel, a Lens Studio setup panel, a public JSON
configuration and a self-hosted publishing proxy that uses each platform's official API. It's
extracted from `SnapCloudExamples/Example5-Media`, with no Ayrshare dependency.

The prefab starts in **demo mode**. Camera recording is real, but sharing is simulated and
labelled, and no credentials are needed. Turn demo mode off once your proxy, Snap Cloud project
and social accounts are connected ([setup](Docs/setup.md)).

**Status: prototype.** The demo panel was checked in the Lens Studio Preview: layout, destination switches and share count. Proxy tests cover the API
contracts, authorization, encryption, deduplication and real FFmpeg encoding, with provider HTTP
mocked. Still unverified: on-device capture, native package export, OAuth with registered apps,
and live posting.

## Usage

This section ships with the package and describes the exact installed revision. Read it, then
follow the links into `Docs/` for the topic you need. It is written for both people and coding
agents. Generic Lens scripting, scene construction, Snap Cloud basics and Specs spatial design
are out of scope here.

### Package identity

- Package descriptor: `SnapCloudSocialMedia.lspkg/package.native`
- Consumer import prefix: `SnapCloudSocialMedia.lspkg/Scripts/`, for example
  `import {parseConfig, PROVIDERS} from "SnapCloudSocialMedia.lspkg/Scripts/SocialConfig"`.
  Every module is directly under `Scripts/`. See [components](Docs/components.md).
- Drop-in prefab: `SnapCloudSocialMedia.lspkg/SnapCloudSocialMedia__PLACE_IN_SCENE.prefab`. It
  holds the whole demo: the guide (`Guide`, closed with "Ok, I understood"), the
  `ExampleCarousel` with the example's instructions, and the `Snap Cloud Social Media` panel.
  Dropping it into a Specs scene with a Camera and InteractionKit gives the full demo.
- Demo scaffolding: `Example/` holds the guide and carousel scripts the prefab uses
  (`Example/GuideDismissPanel/GuideDismissPanel.ts`, `Example/ExampleCarousel/ExampleCarousel.ts`).
  See [components](Docs/components.md#demo-scaffolding-example).
- Bundled assets: `social.config.json` (public configuration the prefab reads),
  `Microphone Audio.micaudio`, `Icons/` (seven provider icons)
- Required companion packages (`package_dependencies.json`): `SupabaseClient`,
  `InteractionKit`, `UIKit`, `Motion`, `Icons`. `Scripts/` imports
  `SupabaseClient` and `UIKit`; the `Example/` scaffolding imports
  `InteractionKit` and `UIKit`.
- Outside the `.lspkg`, in the source project: the editor panel (`Plugins/SnapCloudSocialMedia/`),
  the publishing proxy (`Proxy/`) and the Snap Cloud migration (`supabase/migrations/`).
  [Setup](Docs/setup.md) covers all three.

### Version and API status

Read [API status](Docs/api-status.md) before reusing older code. It lists the Current, Internal,
Experimental and Removed surfaces of this revision, including the InteractionKit / UIKit migration changes.

### Applicability

Use this package when a Lens should **publish a recording or photo to people's own social
accounts** through official APIs, with the server holding tokens and encoding the MP4. Use
SnapCloudExamples (Example5-Media) to learn plain capture-and-upload to Snap Cloud Storage. Use
SupabaseClient directly for other cloud data. Don't use it to post from a shared account on
behalf of every Lens user: connections belong to one Snap Cloud user.

### Package Docs (ship in `Docs/`)

- [cheat sheet](Docs/cheat-sheet.md): load-bearing rules. Read first.
- [setup](Docs/setup.md): editor panel, `social.config.json`, the publishing proxy, Snap Cloud
  migration, credentials (placeholders only), platform behavior, test and export
- [components](Docs/components.md): `SnapCloudSocialMedia` inputs and behavior, config schema,
  internal helpers
- [API status](Docs/api-status.md): Current / Internal / Experimental / Removed for this revision
- [examples](Docs/examples.md): prefab path, config snippets, compile-correct TypeScript
- [troubleshooting](Docs/troubleshooting.md): status messages and symptoms → cause → fix,
  including the InteractionKit / UIKit migration findings

### Verification

1. Compile with no TypeScript errors and no `as any`. Import only from
   `SnapCloudSocialMedia.lspkg/Scripts/`.
2. Check that the prefab instance has `configAsset` (and `microphone` if
   `capture.includeAudio` is on) assigned. Then reset the Preview: the panel shows the title,
   seven destination rows and the status `Demo ready · record a clip, select destinations,
   simulate share`.
3. Flip a destination switch on, then off. The share button reads `Simulate share to N` and
   goes N → N+1 → N.
4. Record (at least two frames), then press **Simulate share**. The status reads
   `DEMO · Simulated <provider>/<format>, … · No posts sent`.
5. With demo mode off: run `cd Proxy && npm test` (provider HTTP is mocked; no real posts).
   Then sign in from the editor panel, connect one approved app, and smoke-test one share.

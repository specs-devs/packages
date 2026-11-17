# Snap Cloud Social Media

## What it is
A prototype package for publishing a recording or photo captured on Specs to people's own social accounts:
Snapchat, X, YouTube, LinkedIn, Instagram, Threads and TikTok. The Lens records and uploads through Snap Cloud;
a self-hosted publishing proxy, shipped in the source project, holds the tokens, encodes the MP4 and posts
through each platform's official API. It is for developers building capture-and-share Lenses.

## What it does
1. Drop `SnapCloudSocialMedia__PLACE_IN_SCENE` into the scene. The `SnapCloudSocialMedia` component reads
   `social.config.json` once in `onAwake` and builds a UI Kit panel with seven destination rows.
2. **Record** captures JPEG frames from the camera (or `compositeTexture` to include AR content), with optional
   microphone audio; **Photo** captures a single frame.
3. Select a provider to edit its caption, cycle its format and delivery option (YouTube privacy, TikTok privacy
   level), and flip its switch to include it.
4. **Share** builds one target per enabled, connected destination. Out of demo mode it uploads the media to the
   `social-media` bucket, posts a job to the proxy and polls it until `complete`, `partial`, `failed` or
   `unknown`.
5. The prefab starts in **demo mode**: recording is real, sharing is simulated and labelled
   (`DEMO · Simulated … · No posts sent`), and no credentials are needed.

## Highlights
- One share job to several platforms, with per-destination caption, format and delivery settings.
- No secrets in the Lens: `parseConfig` rejects secret-like keys in the public config; client secrets and the
  encryption key live only in the proxy configuration.
- Enforced capture limits: `capture.fps` 1–12, `capture.maxSeconds` 1–15, 32 MB of frames, at least 2 frames.
- Snap Cloud sign-in with Snapchat; proxy calls carry the session token.
- Lens Studio editor panel (in the source project) to sign in, connect accounts and save presets.

## Core scripts
| Script | What it does |
|---|---|
| `Scripts/SnapCloudSocialMedia.ts` | The component: reads the config, builds the panel and runs record / share. |
| `Scripts/SocialConfig.ts` | Config schema, `PROVIDERS` and `parseConfig` validation. |
| `Scripts/SocialPanel.ts` | Builds the UI Kit panel: rows, switches, caption, format and status. |
| `Scripts/SocialClient.ts` | Snap Cloud client: sign-in, media upload and authorized proxy requests. |
| `Scripts/CameraRecorder.ts` | Captures camera or composite frames as JPEGs at the configured fps. |
| `Scripts/AudioRecorder.ts` | Records 16 kHz microphone audio as a mono WAV. |

## Extra info
- **Requires:** InteractionKit, UIKit, Motion, Icons, SupabaseClient. Live sharing needs your own Snap Cloud
  project with the migration applied, the publishing proxy running, and approved developer apps per platform
  (see [setup.md](setup.md)). Recording uses the camera and the `InternetModule`; on Specs that combination goes
  through Transparent Permission. On-device capture, OAuth with registered apps and live posting are not yet
  verified.
- **Get started:** `SnapCloudSocialMedia__PLACE_IN_SCENE.prefab`; keep `configAsset` (`social.config.json`) and
  `microphone` assigned. Restart the Preview after editing the config.
- **More docs:**
  - [cheat-sheet.md](cheat-sheet.md) — load-bearing rules; read first
  - [setup.md](setup.md) — editor panel, `social.config.json`, proxy, Snap Cloud migration, test and export
  - [components.md](components.md) — component inputs and behaviour, config schema, internal helpers
  - [api-status.md](api-status.md) — Current / Internal / Experimental / Removed surfaces
  - [examples.md](examples.md) — prefab path, config snippets, TypeScript
  - [troubleshooting.md](troubleshooting.md) — status messages and symptoms to fixes

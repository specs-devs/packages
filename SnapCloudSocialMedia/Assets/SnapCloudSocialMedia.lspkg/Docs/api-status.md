# SnapCloudSocialMedia API status

[← Agent usage index](../README.md)

## Use when

Check this before writing code against the package or reusing older capture/share code. It covers
this installed revision, verified against the TypeScript sources in `Scripts/`.

## Status meanings

- **Current**: supported public surface for new work.
- **Internal**: exported for the package's own use. It may change without notice; don't build on it.
- **Experimental**: present and tested locally but not verified live.
- **Removed**: not available in this revision.

## Current API

| Surface | Module (`SnapCloudSocialMedia.lspkg/Scripts/…`) |
|---|---|
| `SnapCloudSocialMedia` component: inputs `configAsset`, `compositeTexture`, `microphone`, `panelWidth`, `fontScale` (no public methods) | `SnapCloudSocialMedia` |
| Prefab `SnapCloudSocialMedia__PLACE_IN_SCENE` | package root |
| Config types `SocialConfig` (`schemaVersion: 1`), `Destination`, `ProviderId` | `SocialConfig` |
| `parseConfig(text): SocialConfig` (validation + secret rejection), `PROVIDERS` (id, name, formats) | `SocialConfig` |
| Public config asset `social.config.json` | package root |
| Proxy HTTP API `/health`, `/v1/providers`, `/v1/connections…`, `/v1/media/finalize`, `/v1/jobs…`, `/oauth/<provider>/callback` | `Proxy/src/server.mjs` (source project, not in the `.lspkg`) |

Details: [components](components.md), [setup](setup.md).

## Internal

| Surface | Module |
|---|---|
| `SocialPanel`: `select()`, `deliveryLabel()`, `setConnection()`, `setStatus()`, `setRecording()` | `SocialPanel` |
| `SocialClient`: `initialize()`, `request()`, `connections()`, `upload()`, `share()`, `job()`, `destroy()`; `uuid()`; types `Connection`, `CapturedFrame`, `ShareResult` | `SocialClient` |
| `CameraRecorder`: `start()`, `stop()`, `photo()`, `destroy()` | `CameraRecorder` |
| `AudioRecorder`: `start()`, `stop()` (16 kHz mono PCM WAV), `destroy()` | `AudioRecorder` |

## Experimental

| Surface | State |
|---|---|
| Live publishing to all seven providers | Proxy tests mock provider HTTP. No real account was connected and no post was sent. |
| TikTok Direct Post (`publishMode: "direct"`) | Needs an approved `video.publish` app; privacy level chosen in the Lens; consent on Share |
| Snapchat Public Profile API | Needs a Business Manager app allowlisted by Snap |
| On-device capture, native package export/reimport | Not verified yet |

## Changed in this revision

| Change | Detail |
|---|---|
| Dependencies | Moved to the InteractionKit and UIKit releases declared in `package_dependencies.json`, plus `Motion` and `Icons` |
| Button content alignment | UIKit `ElementContent.textAlignment = TextAlignment.Left/Center` (the older `contentAlignment` string is gone) |
| Destination switches | `Switch.onFinished` passes the *explicit* flag, not the state; the panel reads `toggle.isOn` |
| Panel rows | Registered with `FlexLayout.addItems` directly inside the parent's `onInitialized`. See [troubleshooting](troubleshooting.md) |

## Removed

| Surface | Replacement |
|---|---|
| Ayrshare publishing | Self-hosted proxy with official provider APIs |
| Older UIKit `ElementContent.contentAlignment` (as used by the panel) | `textAlignment` |

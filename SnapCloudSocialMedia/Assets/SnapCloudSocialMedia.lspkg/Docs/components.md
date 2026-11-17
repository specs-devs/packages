# SnapCloudSocialMedia components

[← Agent usage index](../README.md)

## Use when

Read this when you place, configure or script against the package: the component's inputs,
what it builds, its states and status messages, and the config schema. All facts come from
`Scripts/*.ts` in this installed revision.

## `SnapCloudSocialMedia` (component)

`import {SnapCloudSocialMedia} from "SnapCloudSocialMedia.lspkg/Scripts/SnapCloudSocialMedia"`

On the `Snap Cloud Social Media` child of the prefab root `SnapCloudSocialMedia__PLACE_IN_SCENE`.
The root sits at the origin; the panel is authored at local position (0, 6, −160).

| Input | Type | Default | Meaning |
|---|---|---|---|
| `configAsset` | `JsonAsset` | `requireAsset('../social.config.json')` | Public configuration (schema below). Required. Never add provider secrets. |
| `compositeTexture` | `Texture` (`@allowUndefined`) | none | Rendered camera texture to record AR content as well. Empty: the physical camera. |
| `microphone` | `AudioTrackAsset` (`@allowUndefined`) | `requireAsset('../Microphone Audio.micaudio')` | Used when `capture.includeAudio` is true. Missing + includeAudio: `Assign a microphone audio track or disable Include microphone`. |
| `panelWidth` | `number`, slider 38–48 | 44 | Panel width in cm. |
| `fontScale` | `number`, slider 0.8–1.4 | 1 | Multiplies every text size of the panel. |

There are no public methods or events. The component is a self-contained experience.

### What it builds (on its own SceneObject)

- In `onAwake`: it parses the config, creates `SocialClient`, then builds `SocialPanel`: a
  `Component.Canvas`, a UIKit `BackPlate` and a `Social Content` child with a column
  `FlexLayout` (padding 1.6, row gap 0.3).
- Panel rows, top to bottom: the title; a demo or ready caption; seven provider rows (a
  `RectangleButton` with the provider icon and status, plus a UIKit `Switch`); the `<Provider>
  caption` label; a `TextInputField` with the caption; `Format: <format>`; the delivery button;
  `Record` | `Photo`; `Simulate share to N` / `Share to N`; `Refresh connections`; the status
  line. The BackPlate is resized to the layout result. At width 44 the panel is about 75 cm tall.
- In `OnStartEvent`, `initialize()` signs in to Snap Cloud (skipped in demo mode). It then
  creates `CameraRecorder`, plus `AudioRecorder` if `includeAudio`, refreshes connections, and
  sets the status.

### Interaction and states

States: `initializing` → `ready` ⇄ `recording` / `busy`.

| Control | Effect |
|---|---|
| Provider button | Selects it: caption label, caption text, format and delivery label follow. For TikTok Direct Post (not demo) it loads creator settings from `/v1/connections/tiktok/creator`. |
| Switch | `destinations[id].enabled = toggle.isOn` (session only) and updates the share count. Only connected, enabled destinations are counted. |
| Caption field | Writes `destinations[selected].caption` (session only). |
| `Format:` | Cycles through `PROVIDERS[selected].formats`. |
| Delivery button | YouTube: cycles `private` → `unlisted` → `public`. TikTok Direct: cycles the creator's `privacy_level_options` (`SELF_ONLY` in demo). Other providers: an info status. |
| `Record` | Starts recording (`Stop recording` while on). It stops at `maxSeconds` or 32 MB, then uploads. |
| `Photo` | Captures one JPEG. Only providers set to the `photo` format accept it. |
| Share | Builds one target per enabled destination. An empty caption falls back to `composer.caption`, an empty title to `composer.title`. In demo mode it only reports. Otherwise it posts `/v1/jobs` and polls every 2 s until `complete`, `partial`, `failed` or `unknown`. |
| `Refresh connections` | Demo: marks every provider connected. Otherwise reads `/v1/connections`. |

Status messages are listed with their causes in [troubleshooting](troubleshooting.md).

## Demo scaffolding (`Example/`)

The prefab also carries the demo's guide and carousel. They are demo scaffolding, not package
API: keep them, adapt them or delete them from your instance.

Prefab children, in order: `Guide`, `ExampleCarousel`, `Snap Cloud Social Media`.

### `GuideDismissPanel` (`Example/GuideDismissPanel/GuideDismissPanel.ts`)

On `Guide`, next to a UIKit `Frame`, with a child `GuideText` (Text) and `OkButton` (UIKit
Button). It places the guide 110 cm in front of the user and hides the listed objects until the
button is pressed.

| Input | Type | Prefab value | Meaning |
|---|---|---|---|
| `buttonLabel` | `string` | `Ok, I understood` | Button label (only used when the panel is built at runtime) |
| `hideUntilDismissed` | `SceneObject[]` | `Snap Cloud Social Media`, `ExampleCarousel` | Disabled in `onAwake`, enabled again when the guide is closed |

### `ExampleCarousel` (`Example/ExampleCarousel/ExampleCarousel.ts`)

On `ExampleCarousel`. It builds a UIKit Frame with the example's title and instructions. With
one example (as here) it only carries the guidance; with several, Previous / Next step through
them. "-" / "+" collapses and expands the panel.

| Input | Type | Prefab value | Meaning |
|---|---|---|---|
| `examples` | `SceneObject[]` | `Snap Cloud Social Media` | Examples to step through; one is enabled at a time |
| `exampleInfo` | `string[]` | the recording/sharing instructions | Text per example; empty falls back to the example's own guide text |
| `steps` | `SceneObject[]` | empty | Optional sub-examples to step through instead of `examples` |
| `stepInfo` | `string[]` | empty | Text per entry of `steps`; empty entries fall back to the example's info |
| `startIndex` | `number` | 0 | Example shown first |
| `previousLabel` / `nextLabel` | `string` | `Previous` / `Next` | Button labels |
| `examplesPushBack` | `number` | 20 | Extra cm the examples are pushed behind the carousel |
| `anchorExamples` | `boolean` | `false` | Re-anchor the examples to the head pose |
| `startMinimized` | `boolean` | `true` | Start collapsed to the title bar |
| `extraPanelDrop` | `number` | 20 | Extra cm the carousel sits below its usual spot, under the tall panel |

## Config schema (`SocialConfig`, `schemaVersion: 1`)

`import {SocialConfig, Destination, ProviderId, PROVIDERS, parseConfig} from "SnapCloudSocialMedia.lspkg/Scripts/SocialConfig"`

| Field | Type | Bundled value | Rule (enforced by `parseConfig`) |
|---|---|---|---|
| `schemaVersion` | `1` | 1 | Must be 1 |
| `demoMode` | boolean | `true` | Required boolean |
| `proxyUrl` | string | `https://your-social-proxy.example.com` | `https://` when `demoMode` is false |
| `cloud.url` | string | `https://YOUR_PROJECT.snapcloud.dev` | `https://` when `demoMode` is false |
| `cloud.publishableKey` | string | `""` | Non-empty when `demoMode` is false; **publishable** key only |
| `capture.aspect` | `portrait` \| `landscape` \| `square` | `portrait` | One of the three |
| `capture.fps` | number | 8 | 1–12 |
| `capture.maxSeconds` | number | 12 | 1–15 |
| `capture.includeAudio` | boolean (optional) | `true` | Boolean if present |
| `composer.caption` / `composer.title` | string | `Made with Specs ✨ #Specs` / `A moment through my Specs` | Strings |
| `destinations.<id>` | `Destination` | see below | All seven ids present; `enabled` boolean; `format` in the provider's formats; `caption` string |

Any key, at any depth, matching `/secret|access.?token|refresh.?token|service.?role|password|api.?key/i`
throws `Keep private credentials in proxy.config.json on the server`.

`Destination`: `enabled`, `format`, `caption`, plus optional `title`, `privacy` (YouTube),
`publishMode` (`inbox` | `direct`, TikTok), `privacyLevel`, `disableComment`, `disableDuet` and
`disableStitch` (TikTok). `privacyLevel` is cleared at every Lens start, because a Direct Post
privacy choice must be made in the current session.

`PROVIDERS` (id → formats): `snapchat` story/spotlight · `x` video/photo · `youtube`
video/short · `linkedin` video/photo · `instagram` reel/story/photo · `threads` video/photo ·
`tiktok` video.

Bundled destinations: X `video`, YouTube `short` (`private`) and Instagram `reel` are enabled.
Snapchat `spotlight`, LinkedIn `video`, Threads `video` and TikTok `video` (`inbox`) are
disabled.

## Internal helpers

Exported for the package's own use ([API status](api-status.md)). Listed here so you can read
the code, not to build on.

| Class | Behavior |
|---|---|
| `SocialPanel` | Builds the UIKit panel described above. `setStatus(text)`, `setRecording(on)`, `setConnection(id, connected)`, `select(id)`, `deliveryLabel()`. |
| `SocialClient` | Snap Cloud client from `SupabaseClient.lspkg/supabase-snapcloud`. `initialize()` calls `auth.signInWithIdToken({provider: 'snapchat', token: ''})`. `request(path, method, body)` adds `Authorization: Bearer <session token>` to proxy calls. `upload()` stores frames as `<userId>/<session>/frame-NNNN.jpg` (plus `audio.wav`) in bucket `social-media`, calls `/v1/media/finalize`, then deletes the raw frames. Demo mode returns a local `demo-recording`. |
| `CameraRecorder` | `CameraModule` request (`Right_Color` on device, `Default_Color` in the editor) or `compositeTexture`. Encodes one JPEG at a time (`IntermediateQuality`) at `fps`. Stops at `maxSeconds` or 32 MB. `stop()` throws `Record a longer clip` below 2 frames. |
| `AudioRecorder` | `MicrophoneAudioProvider` at 16 kHz, capped at 16 s, written as 16-bit mono PCM WAV. |

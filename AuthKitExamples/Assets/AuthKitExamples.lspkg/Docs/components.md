# AuthKitExamples components

[← Agent usage index](../README.md)

## Use when

Read this when you wire one of the controllers to your own UI, change its configuration, or need
to know exactly which inputs are required. Every entry is taken from the package source.

All three are `@component` classes extending `BaseScriptComponent`. Each creates one AuthKit
`OAuth2` in `onAwake` from its inputs (see the AuthKit README for that API) and binds its buttons'
`onTriggerUp` on start: `UIController` and `SpotifyUIController` through `createEvent("OnStartEvent")`,
`SpotifyMusicController` through the SnapDecorators `@bindStartEvent` decorator.

## SpotifyMusicController

`import { SpotifyMusicController } from "AuthKitExamples.lspkg/SpotifyExample/SpotifymusicController"`

Signs in to Spotify, loads the user's liked songs and plays them: on a Spotify Connect device
first, else as a 30-second preview through the AudioComponent. Every UI input is `@allowUndefined`.

| Input | Type | Default | Meaning |
|---|---|---|---|
| `signInButton` / `signOutButton` | `RectangleButton` | — | Start `authorize(scope)` / `signOut()` and clear the song list |
| `playButton` / `pauseButton` / `stopButton` | `RectangleButton` | — | Play or resume / pause (also pauses on Spotify) / stop (also pauses on Spotify) |
| `nextButton` / `previousButton` | `RectangleButton` | — | Step through the liked songs (wraps around) |
| `statusText` | `Text` | — | Connection and playback status (required by Pause and Stop) |
| `trackInfoText` | `Text` | — | Track name, artists, album (`Not connected` when signed out) |
| `audioDebugText` | `Text` | — | Step-by-step playback / preview messages |
| `albumArtworkImage` | `Image` | — | Gets the artwork texture on `mainPass.baseTex` |
| `audioComponent` | `AudioComponent` | — | Plays previews; its finish callback plays the next song |
| `title` | `string` | `"Spotify Music Controller"` | Not displayed by this controller |
| `clientId` | `string` | `"your-spotify-client-id"` | Spotify app Client ID (prefab: `YOUR-CLIENT-ID`) |
| `authorizationUri` | `string` | `https://accounts.spotify.com/authorize` | |
| `tokenUri` | `string` | `https://accounts.spotify.com/api/token` | |
| `authenticationType` | `string` | `"code"` | AuthKit flow (`code` = PKCE) |
| `maxLikedSongs` | `number` | `50` | `limit` of `GET /v1/me/tracks` (Spotify allows 1–50) |
| `enableLogging` / `enableLoggingLifecycle` | `boolean` | `false` | Turn the `Logger` on (see [troubleshooting](troubleshooting.md)) |

`scope` is a plain field (not an input): `user-read-private user-library-read user-read-playback-state user-modify-playback-state user-read-currently-playing`.

`SpotifyTrack` is a module-private interface (not exported), so you cannot import it; type the
result structurally or declare your own copy. Its fields: `id`, `name`, `artists: { name }[]`, `uri`,
`preview_url?`, `duration_ms`, `external_urls?: { spotify }`, `album: { name, images: { url, height, width }[] }`.

Public methods: `getCurrentTrack(): SpotifyTrack | undefined`, `getLikedSongs(): SpotifyTrack[]`,
`getPlaybackState(): { isPlaying, currentIndex, totalTracks }`. On start, if a stored token exists
(`isAuthorized`), it loads the liked songs without a new sign-in.

Spotify endpoints: `GET /v1/me/tracks`, `GET /v1/tracks/{id}?market=US`, `GET /v1/search`,
`GET /v1/me/player/devices`, `PUT /v1/me/player/play`, `PUT /v1/me/player/pause`; preview fallback
`https://api.deezer.com/search`, `https://itunes.apple.com/search` (no auth).

## SpotifyUIController (SpotifyControllerMinimum.ts)

`import { SpotifyUIController } from "AuthKitExamples.lspkg/SpotifyExample/SpotifyControllerMinimum"`

Sign in, sign out and one authenticated call (`GET apiUri`, shows `Hello, <apiResponseKey>! 🎵`).
Every button and Text input is **required**.

| Input | Type | Default | Meaning |
|---|---|---|---|
| `signInButton` / `signOutButton` / `apiButton` | `RectangleButton` | — | Sign in / sign out / call the API |
| `statusText` | `Text` | — | Status and API result |
| `titleText` | `Text` | — | Shows `title` (prefab: the TrackInfo text) |
| `title` | `string` | `"Spotify Music Lens"` | |
| `clientId` | `string` | `"your-spotify-client-id"` | Spotify app Client ID |
| `authorizationUri` / `tokenUri` | `string` | Spotify endpoints | |
| `authenticationType` | `string` | `"code"` | |
| `scope` | `string` | `user-read-private user-read-currently-playing user-read-playback-state` | |
| `apiUri` | `string` | `https://api.spotify.com/v1/me` | |
| `apiResponseKey` | `string` | `"display_name"` | Top-level key shown after a successful call (`Spotify User` if missing) |
| `enableLogging` / `enableLoggingLifecycle` | `boolean` | `false` | |

## UIController

`import { UIController } from "AuthKitExamples.lspkg/UIController"`

The same three-button flow for any provider. No defaults: fill every input. Every button and Text
input is **required**. It has no logging inputs and does not use `Logger`: a successful API call
prints the raw response body with `print("response data: " + data)` before reading `apiResponseKey`.

| Input | Type | Meaning |
|---|---|---|
| `signInButton` / `signOutButton` / `apiButton` | `RectangleButton` | Sign in / sign out / call `apiUri` |
| `statusText` / `titleText` | `Text` | `Signed In` / `Signed Out` / errors; the `title` |
| `title` | `string` | Panel title |
| `clientId`, `clientSecret`, `authorizationUri`, `tokenUri`, `refreshUri`, `authenticationType` | `string` | Passed to `new OAuth2({...})` unchanged (`clientSecret` and `refreshUri` may stay empty) |
| `scope` | `string` | Space-separated scopes for `authorize(scope)` |
| `apiUri`, `apiResponseKey` | `string` | Test call and the top-level JSON key shown on success |

## AuthKitExamples__PLACE_IN_SCENE.prefab

Root (0, 0, 0) → `Guide` (z −100), `ExampleCarousel`, then the two example groups, both at
(0, −7, −60): `SpotifyLoginExample` and `SpotifyMinimumExample`. Each group holds
`SpotifyControllerMinimum`, `SpotifyMusicController` and a UIKit `Frame` at z −80 holding: `Status`
(y 19.6), `Image` (artwork, y 6.6), `TrackInfo` (y 0), three button rows — `GridLayout` y −7
(SignIn x −4, SignOut x +4), y −12 (Play −8, Pause 0, Stop +8), y −17 (Previous −4, Next +4) — the
`API` button (y −12, used by the minimal controller), `AudioDebug` (y −22.4) and `Audio Output`
(AudioComponent). Buttons are 6 × 3 cm.

- `SpotifyLoginExample`: `SpotifyMusicController` enabled, `SpotifyControllerMinimum` and `API` disabled.
- `SpotifyMinimumExample`: `SpotifyControllerMinimum` enabled; `SpotifyMusicController`, the
  Play/Pause/Stop and Previous/Next rows (they share y −12 with `API`), `AudioDebug`, `Image` and
  `Audio Output` disabled; `API` enabled.

To use only one of them in your Lens, keep that group and delete the other (with the Guide and
ExampleCarousel if you don't want the demo scaffolding).

## Demo scaffolding (`Example/`)

These scripts ship in `AuthKitExamples.lspkg/Example/` and are wired inside
`AuthKitExamples__PLACE_IN_SCENE.prefab` (order: Guide, ExampleCarousel, then the
`SpotifyLoginExample` and `SpotifyMinimumExample` groups). They only present the examples; they are
not part of the AuthKitExamples API, and you don't need them in your own Lens.

| Object / script | Class | Key inputs |
|---|---|---|
| `Guide` — `Example/GuideDismissPanel/GuideDismissPanel.ts` | `GuideDismissPanel` | `hideUntilDismissed: SceneObject[]` — hidden until "Ok, I understood" is pressed (here: ExampleCarousel, SpotifyLoginExample and SpotifyMinimumExample); `buttonLabel: string = "Ok, I understood"` (only used when the panel is built at runtime) |
| `ExampleCarousel` — `Example/ExampleCarousel/ExampleCarousel.ts` | `ExampleCarousel` | `examples: SceneObject[]` (here `SpotifyLoginExample`, `SpotifyMinimumExample`), `exampleInfo: string[]` (one line per example), `steps: SceneObject[]`, `stepInfo: string[] = []` (one line per step, same order as `steps`; empty entries fall back to the example info), `startIndex: number = 0`, `previousLabel: string = "Previous"` / `nextLabel: string = "Next"`, `examplesPushBack: number = 20`, `anchorExamples: boolean = true`, `startMinimized: boolean = false`, `extraPanelDrop: number = 0` (8 here) |

Keep the Guide above the examples in the hierarchy: it hides its targets in `onAwake`.

# AuthKitExamples API status

[← Agent usage index](../README.md)

## Use when

Check this file before choosing a controller or copying an older AuthKitExamples snippet. It is
the compatibility index for the package revision that contains it (the version is in
`package.native`; companions AuthKit, SpectaclesInteractionKit and SpectaclesUIKit are listed in
`package_dependencies.json`).

## Status meanings

- **Current** — recommended public surface for new work.
- **Experimental** — public, but with caveats listed here and in troubleshooting.
- **Removed** — no longer in this revision; don't copy it from older examples.

## Current API

| Capability | Current surface | Import path |
|---|---|---|
| Full Spotify player (sign in, liked songs, playback, artwork) | `SpotifyMusicController` component; public `getCurrentTrack()`, `getLikedSongs()`, `getPlaybackState()` | `AuthKitExamples.lspkg/SpotifyExample/SpotifymusicController` |
| Minimal Spotify sign-in + profile call | `SpotifyUIController` component (file `SpotifyControllerMinimum.ts`) | `AuthKitExamples.lspkg/SpotifyExample/SpotifyControllerMinimum` |
| Provider-agnostic sign-in template | `UIController` component | `AuthKitExamples.lspkg/UIController` |
| Drop-in UI | `AuthKitExamples__PLACE_IN_SCENE.prefab` (UIKit `Frame` + `RectangleButton`s, music controller enabled) | — |
| Buttons | `RectangleButton` from SpectaclesUIKit, bound through `onTriggerUp.add(...)` | `SpectaclesUIKit.lspkg/Scripts/Components/Button/RectangleButton` |
| HTTP | `InternetModule.fetch(new Request(url, init))` | `require("LensStudio:InternetModule")` |
| Remote artwork / preview audio | `InternetModule.makeResourceFromUrl(url)` + `RemoteMediaModule.loadResourceAsImageTexture` / `loadResourceAsAudioTrackAsset` | `require("LensStudio:RemoteMediaModule")` |

Inputs, defaults and behaviour of each component are in [components.md](components.md).

## Experimental

| Surface | Why |
|---|---|
| `SpotifyMusicController` preview fallback | Uses Spotify `preview_url`, then the public Deezer and iTunes search APIs; previews are often missing and third-party search can return a different recording. |
| `SpotifyMusicController` remote playback | `PUT /v1/me/player/play` needs Spotify Premium and an active Spotify Connect device; the response is only checked for `ok`. |
| `UIController.apiResponseKey` | Reads one top-level key of the JSON response; nested values are not supported. |

## Removed in this revision

| Old surface | Replacement |
|---|---|
| SpectaclesUIKit 1.x `GridLayout` component on the prefab's button rows (`rows`, `columns`, `cellSize`, `cellPadding`, `layoutBy`) | Removed from the current SpectaclesUIKit; the rows are now plain objects with each button at a fixed local x (±4 cm for two buttons, −8 / 0 / +8 cm for three). The current UIKit grid lives in `Scripts/Components/Layout2D/Grid/GridLayout` and uses CSS-style tracks. |
| `RemoteServiceModule.makeResourceFromUrl` | Deprecated in Lens Studio; the examples call `InternetModule.makeResourceFromUrl`. |
| `new (Request as any)(...)` casts | `new Request(url, init)` type-checks directly. |
| SIK `Interactable` + `onInteractorTriggerStart` on the buttons | SpectaclesUIKit `RectangleButton.onTriggerUp`. |

# AuthKitExamples cheat sheet (load-bearing rules)

[← Agent usage index](../README.md)

## Use when

Read this **first**, before copying one of the controllers or dropping the prefab into a Lens.
It is the short list of rules that most often break a Lens built from these examples, each with
a pointer to the detail. Everything here is derived from the package source.

## The rules

1. **Sign-in only runs on a device.** Every controller calls AuthKit's `OAuth2.authorize()`, which
   rejects in the editor; the Spotify controllers then show `⚠️ Test on Glasses device`. Test the
   Preview path signed out. → [troubleshooting](troubleshooting.md)
2. **Set your own `clientId`.** The prefab ships `YOUR-CLIENT-ID`, the script defaults are
   `your-spotify-client-id`. The Spotify app must list the redirect URI
   `https://www.spectacles.com/deeplink/specslink/oauth2redirect/unsecure`. → [setup](setup.md)
3. **One controller per set of buttons.** `SpotifyMusicController` and `SpotifyControllerMinimum`
   both bind the prefab's SignIn / SignOut buttons in their `OnStartEvent`; enabling both makes one
   press run both handlers. Keep exactly one enabled (the prefab enables the music controller). → [components](components.md)
4. **Buttons are wired by `@input`, bound in `OnStartEvent`.** Inputs are `RectangleButton`
   (SpectaclesUIKit); the controllers subscribe to `onTriggerUp`. Don't call the private
   `onSignIn()` etc. from outside — there is no public action API. → [components](components.md)
5. **Required inputs differ per controller.** `SpotifyMusicController` marks every UI input
   `@allowUndefined` (missing ones are skipped, except `statusText` in Pause/Stop); `SpotifyUIController`
   and `UIController` need every button and Text set or `onAwake` throws. → [troubleshooting](troubleshooting.md)
6. **The prefab's rows are positioned, not laid out.** The three `GridLayout` objects are plain
   containers since the current UIKit removed the old grid component; move buttons by their local x. → [troubleshooting](troubleshooting.md)
7. **Logging is all-or-nothing.** With `enableLogging` and `enableLoggingLifecycle` off, the
   `Logger` also drops warnings and errors (e.g. `Authentication failed: …`); turn `enableLogging`
   on while debugging. → [examples](examples.md#logging)
8. **Playback needs a Spotify device or a preview URL.** Play first asks Spotify to play on an
   active Spotify Connect device; without one it falls back to a 30-second preview (Spotify,
   then Deezer, then iTunes search), which can also be missing. → [troubleshooting](troubleshooting.md)
9. **The panel is tall (≈44 cm).** Placed in front of the user, keep it about 1.5 m away or lower it,
   or the status line and artwork fall outside the Specs field of view. → [troubleshooting](troubleshooting.md)

## Verify

Compile clean, then in the Preview: Sign In → `⚠️ Test on Glasses device`, Play → `❌ Please sign in first`.
On device: `✅ Connected to Spotify!`, then `✅ Loaded N liked songs`.

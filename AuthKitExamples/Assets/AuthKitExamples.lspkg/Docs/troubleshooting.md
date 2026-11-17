# AuthKitExamples troubleshooting

[← Agent usage index](../README.md)

## Use when

Read this when a Lens built from these examples doesn't behave as expected. Each entry is
symptom → cause → fix; the ones marked *QA* were found while preparing the package demo
(in the Lens Studio Preview, with the InteractionKit and UIKit companions of that release). Problems inside AuthKit itself (tokens, refresh,
deep links) are covered in AuthKit's own troubleshooting.

## Sign-in

| Symptom | Cause | Fix |
|---|---|---|
| Status shows `⚠️ Test on Glasses device` / `OAuth2 doesn't work in Lens Studio` | AuthKit's `authorize()` rejects with `Authorization not supported in editor mode` in the editor | Expected in the Preview. Sign in on a SPECS device. |
| `UIController` shows `Authorization error:` + the same message | Same, without the friendly mapping | Expected in the Preview. |
| Spotify page opens but the Lens never says Connected | Redirect URI not registered on the Spotify app, or the account isn't allowed while the app is in development mode | Register `https://lenses.specs.com/deeplink/specslink/oauth2redirect/unsecure` and add the account → [setup](setup.md) |
| Spotify page shows `INVALID_CLIENT` | `clientId` still `YOUR-CLIENT-ID` / `your-spotify-client-id` | Paste your app's Client ID → [setup](setup.md) |
| `API error: … Not authorized. Call authorize() first.` | API pressed before signing in | Sign in first; expected in the Preview. |
| Signed in on one launch, signed out on the next after an hour | Spotify tokens expire; AuthKit refreshes with the stored refresh token on the next `getAccessToken()` | Nothing to do for the code flow; a failing refresh shows as `Failed to load songs: …` → sign in again. |

## Playback (SpotifyMusicController)

| Symptom | Cause | Fix |
|---|---|---|
| `❌ Please sign in first` on Play / Pause / Stop | Not authorized | Expected when signed out. |
| `❌ No Spotify devices found. Open Spotify on your phone!` then a preview | No active Spotify Connect device | Open Spotify on a phone or computer and play anything once; remote playback also needs Premium. |
| `❌ No preview URL available` / `🎵 No preview: <track>` | Spotify returned no `preview_url` and neither Deezer nor iTunes search found one | Pick another song; the fallback is best effort. |
| Album artwork stays the placeholder | `albumArtworkImage` not set, or the image request failed (`Failed to load album artwork texture` — only logged with `enableLogging`) | Wire the Image; check the network. |
| Nothing in the Logger, even on failure | `Logger` drops warnings and errors too when `enableLogging` and `enableLoggingLifecycle` are off | Turn `enableLogging` on → [examples](examples.md#logging) |
| *QA* — every frame printed `Update event triggered` with `enableLogging` on | An `UpdateEvent` logged each frame | Removed in this revision. |

## Prefab and UI

| Symptom | Cause | Fix |
|---|---|---|
| *QA* — all buttons of a row drawn on top of each other (`Sign In`/`Sign Out` overprinted) | The rows used the UIKit 1.x `GridLayout` component, which the current UIKit removed; the ScriptComponents pointed at a missing script and nothing laid the buttons out | Fixed in this revision: the dangling components are gone and buttons sit at fixed x (±4 / −8, 0, +8 cm). Copies made from an older prefab need the same fix. |
| *QA* — `Stop` and `Next` labels sat higher than the others | Their Text was `"Stop\n"` / `"Next\n"` (a trailing newline) | Fixed in this revision (labels trimmed). |
| *QA* — status line and artwork cut off at the top of the view | The Frame is ≈44 cm tall; lifted to eye level at ~1 m its top leaves the Specs vertical field of view (±18°) | Keep the panel ~1.5 m away or lower it (the demo project uses root (0, −7, −60) under its carousel). |
| One press runs two handlers (e.g. Sign In and API both answer) | Both controllers enabled on the same Frame — they bind the same SignIn / SignOut buttons | Keep one controller enabled → [components](components.md#authkitexamples__place_in_sceneprefab) |
| `Input signInButton was not provided` (or another input) | `SpotifyUIController` and `UIController` don't mark their inputs `@allowUndefined` | Wire every button and Text input. |
| *QA* — in the Lens Studio Preview, a simulated pinch on a lower-row button also triggered the button above it | The Preview agent's virtual hand travels to the button and its fingertip pokes neighbouring buttons on the way (SIK `PhysicalInteractionProvider` poke); not a Lens bug | When testing with the Preview agent, read the status after each press; on device the ray targets one button. |

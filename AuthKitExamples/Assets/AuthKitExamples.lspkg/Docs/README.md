# Auth Kit Examples

## What it is
A package of working examples that show how to add OAuth2 sign-in for a third-party service to a Specs Lens with
Auth Kit. It ships two Spotify controllers and a generic controller you can point at any OAuth2 provider. It is
for developers who need a sign-in panel and authenticated web API calls; the OAuth2 logic itself lives in Auth Kit,
and this package adds the UI wiring and the Spotify Web API calls.

## What it does
- `AuthKitExamples__PLACE_IN_SCENE.prefab` shows a guide panel ("Ok, I understood") and an example carousel with
  two UI Kit `Frame` panels: `SpotifyLoginExample` and `SpotifyMinimumExample`.
- Each controller creates one Auth Kit `OAuth2` in `onAwake` from its inputs and binds its UI Kit
  `RectangleButton`s on start.
- Spotify Music Controller: Sign In / Sign Out, then loads the user's liked songs and plays them, on a Spotify
  Connect device if one is active, otherwise as a 30-second preview through the `AudioComponent`. It shows track
  info and album artwork, and Next / Previous step through the list. With a stored token it loads the songs on
  start without a new sign-in.
- Spotify Controller Minimum: Sign In, Sign Out and one authenticated call (`GET apiUri`), which shows
  `Hello, <name>!`.
- `UIController` (not in the prefab) runs the same three-button flow for any provider from its inputs.

## Highlights
- Authorization Code flow with PKCE (`authenticationType = "code"`), so the Spotify examples need no client secret.
- Preview fallback for songs without remote playback, using public preview search endpoints (no auth).
- A generic `UIController` template with every provider value (`clientId`, `authorizationUri`, `tokenUri`,
  `scope`, `apiUri`, `apiResponseKey`) as an input.
- Clear status messages: in the Lens Studio Preview, Sign In tells you to test on device and playback buttons ask
  you to sign in first.
- Optional debug logging through `enableLogging` / `enableLoggingLifecycle` on the Spotify controllers.

## Core scripts
| Script | What it does |
|---|---|
| `SpotifyExample/SpotifymusicController.ts` | `SpotifyMusicController`: sign-in, liked songs, playback and preview fallback. |
| `SpotifyExample/SpotifyControllerMinimum.ts` | `SpotifyUIController`: minimal sign-in, sign-out and one API call. |
| `UIController.ts` | Generic OAuth2 sign-in panel for any provider. |
| `Example/ExampleCarousel/ExampleCarousel.ts` | Demo carousel that steps between the two Spotify examples. |
| `Example/GuideDismissPanel/GuideDismissPanel.ts` | Demo guide panel that hides the examples until dismissed. |

## Extra info
- **Requires:** AuthKit, InteractionKit, UIKit, SnapDecorators, Utilities, Motion, Icons. OAuth2 sign-in only
  works on Specs, not in the Lens Studio Preview. You need your own Spotify app (or other provider app) and its
  Client ID with the redirect URI `https://lenses.specs.com/deeplink/specslink/oauth2redirect/unsecure`.
  Remote playback also needs Spotify Premium and an active Spotify Connect device.
- **Get started:** drag `AuthKitExamples__PLACE_IN_SCENE.prefab` into a scene with the Interaction Kit (SIK)
  prefab, paste your Client ID into the `clientId` input of the enabled controller and build to Specs.
- **More docs:**
  - [cheat-sheet.md](cheat-sheet.md): load-bearing rules; read first.
  - [components.md](components.md): every controller, its inputs and the prefab layout.
  - [setup.md](setup.md): Spotify app registration, redirect URI, Client ID and other providers.
  - [examples.md](examples.md): your own provider controller, API calls and logging.
  - [troubleshooting.md](troubleshooting.md): symptoms, causes and fixes.
  - [api-status.md](api-status.md): the current public surface.

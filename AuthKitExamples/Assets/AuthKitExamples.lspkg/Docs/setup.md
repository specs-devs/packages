# AuthKitExamples setup

[← Agent usage index](../README.md)

## Use when

Read this when you configure the Spotify examples with a real account, or point `UIController`
at another OAuth2 provider. No credentials ship with the package: every value below is a
placeholder you replace with your own.

## Spotify

1. Create an app in the [Spotify Developer Dashboard](https://developer.spotify.com/dashboard).
2. Add the redirect URI exactly: `https://lenses.specs.com/deeplink/specslink/oauth2redirect/unsecure`
   (AuthKit's default `redirectUri`).
3. Set **Package ID** in Lens Studio (**Project Settings → Platform Settings → SPECS →
   SPK Configuration**), e.g. `com.specs.example.authkit` — this is the lensId used by OAuth
   deep links.

   <img src="../README-ref/LS-PackageID.png" alt="Package ID in Project Settings" width="700" />
4. Copy the app's **Client ID** into the `clientId` input of the controller you enabled
   (`SpotifyMusicController` or `SpotifyControllerMinimum`). No client secret is needed: the
   examples use the Authorization Code flow with PKCE (`authenticationType = "code"`).
5. While the Spotify app is in development mode, add each Spotify account that will sign in
   under the app's user management in the dashboard.
6. Build to a SPECS device and press Sign In. The Spotify page opens; after you accept, the Lens
   receives the callback and the status changes to `✅ Connected to Spotify!`.

Scopes requested — music controller: `user-read-private user-library-read user-read-playback-state
user-modify-playback-state user-read-currently-playing`; minimal controller (`scope` input):
`user-read-private user-read-currently-playing user-read-playback-state`.

Remote playback (`PUT /v1/me/player/play`) also needs Spotify Premium and a phone or computer with
Spotify open (an active Spotify Connect device); otherwise the controller plays previews.

## Other providers (UIController)

Add a `UIController` to an object, wire three `RectangleButton`s and two `Text`s, and fill the
provider inputs. Example values for GitHub (placeholders):

| Input | Value |
|---|---|
| `clientId` | `<your-github-oauth-app-client-id>` |
| `authorizationUri` | `https://github.com/login/oauth/authorize` |
| `tokenUri` | `https://github.com/login/oauth/access_token` |
| `authenticationType` | `code` |
| `scope` | `read:user user:email` |
| `apiUri` / `apiResponseKey` | `https://api.github.com/user` / `login` |

Other common endpoints: Google `https://accounts.google.com/o/oauth2/v2/auth` /
`https://oauth2.googleapis.com/token` (scopes `openid email profile`); Discord
`https://discord.com/api/oauth2/authorize` / `https://discord.com/api/oauth2/token`
(`identify email`). Register the same Specs redirect URI with each provider.

`clientSecret` is sent from inside the Lens as HTTP Basic auth, so it is not secret: prefer a public
client with PKCE and leave `clientSecret` empty whenever the provider allows it.

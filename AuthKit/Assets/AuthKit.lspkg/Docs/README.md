# Auth Kit

## What it is
Auth Kit is a package of plain TypeScript classes that sign the wearer in to a third-party OAuth2 / OIDC provider
(Google, Spotify, GitHub, your own server …) and hand you a bearer token for that provider's API. It implements the
Authorization Code flow with PKCE and the Implicit flow, plus token storage and refresh. It is for Lens developers
whose Specs Lens must call an external service on behalf of the user.

## What it does
1. In your own `@component` you create one `OAuth2` per client ID with `clientId`, `authorizationUri`, `tokenUri`
   and `authenticationType` (`"code"` or `"implicit"`). The constructor restores a stored, unexpired token.
2. `authorize(scope)` builds the authorization URI (new `state`; the code flow adds a PKCE S256 challenge), opens it
   through the deep link module and waits for the provider to call back on the redirect URI.
3. On the callback the code flow exchanges the code at `tokenUri`; the token is saved in
   `persistentStorageSystem.store`, keyed by the client ID, so it survives a Lens restart.
4. `getAccessToken()` returns the access token, refreshing it first when it has expired (tokens count as expired
   60 seconds early). `signOut()` clears the stored token.
5. The demo prefab adds a session panel with Sign in / Get token / Test token / Sign out buttons.

## Highlights
- Authorization Code flow with PKCE (no client secret needed for public clients) and Implicit flow.
- Persistent sessions: `TokenManager` saves, restores and clears tokens per client ID.
- Automatic refresh with a `refresh_token` request to `refreshUri` (defaults to `tokenUri`).
- Optional `clientSecret` for confidential clients, sent as an HTTP Basic header.
- `getIdToken()` returns the OIDC `id_token` when the provider issues one.
- `Token.toString()` masks token values, so tokens are safe to print.

## Core scripts
| Script | What it does |
|---|---|
| `Core/OAuth2.ts` | The authenticator: builds the authorization URI, handles the deep-link callback, exchanges and refreshes tokens. |
| `Core/TokenManager.ts` | Saves, restores and clears tokens in persistent storage and performs the refresh request. |
| `Core/Token.ts` | The token record (access, refresh and id token, `expires_in`) with an early expiration timestamp. |
| `Example/AuthKitDemo/AuthKitDemo.ts` | Demo session panel built at runtime with UI Kit (Sign in / Get token / Test token / Sign out). |

## Extra info
- **Requires:** InteractionKit and UIKit, used only by the `Example/` scripts; `Core/` imports no package and uses
  `InternetModule`, `DeepLinkModule` and `persistentStorageSystem`. Register
  `https://www.spectacles.com/deeplink/specslink/oauth2redirect/unsecure` (the default `redirectUri`) with your
  provider. `authorize()` works only on Specs: in the Lens Studio Preview it rejects with
  `Authorization not supported in editor mode`. `authorize()` has no timeout, and the demo's endpoints are
  placeholders you must replace with your provider's values.
- **Get started:** import `OAuth2` from `AuthKit.lspkg/Core/OAuth2` and construct it once in your component, or drop
  `AuthKit__PLACE_IN_SCENE.prefab` into a scene with a Camera and Interaction Kit (SIK) for the demo panel.
- **More docs:**
  - [cheat-sheet.md](cheat-sheet.md) - load-bearing rules, read first
  - [components.md](components.md) - every class, option, method and property, with import paths
  - [setup.md](setup.md) - provider registration, redirect URI, client ID and secret
  - [examples.md](examples.md) - sign-in UI, authenticated API client, session checks
  - [api-status.md](api-status.md) - current, experimental and internal surfaces
  - [troubleshooting.md](troubleshooting.md) - symptoms, causes and fixes

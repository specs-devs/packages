# AuthKit API status

[← Agent usage index](../README.md)

## Use when

Check this file before choosing a class or copying an older AuthKit example. It is the
compatibility index for the package that contains it. `Core/` imports no other package;
the `Example/` demo scripts use UIKit and InteractionKit (both listed in
`package_dependencies.json`).

## Status meanings

- **Current** — recommended public surface for new work.
- **Experimental** — public, but with caveats listed here and in troubleshooting.
- **Internal** — exported, but meant to be used through `OAuth2`.
- **Removed** — unavailable in this revision.

## Current API

| Capability | Current surface | Import path |
|---|---|---|
| Sign in, token access, sign out | `OAuth2` class: `new OAuth2(options)`, `authorize(scope?)`, `getAccessToken()`, `getIdToken()`, `refreshToken()`, `signOut()`, `isAuthorized` getter | `AuthKit.lspkg/Core/OAuth2` |
| Configuration | `AuthenticatorOptions` interface (`clientId`, `authorizationUri`, `tokenUri`, `refreshUri?`, `clientSecret?`, `authenticationType`, `redirectUri?`) | `AuthKit.lspkg/Core/OAuth2` |
| Token record | `Token` class, `IToken` interface | `AuthKit.lspkg/Core/Token` |
| Flows | `authenticationType: "code"` (Authorization Code + PKCE S256, recommended) | — |
| OIDC id token | `getIdToken()` returns the `id_token` of the last authorization / refresh, or `null` | `AuthKit.lspkg/Core/OAuth2` |

Exact options, members and messages are listed in [components.md](components.md).

## Experimental

| Surface | Why |
|---|---|
| `authenticationType: "implicit"` | Supported (adds `prompt=consent`, reads `access_token`, `expires_in`, `id_token` from the callback) but issues no refresh token; OAuth 2.1 deprecates the implicit grant. Use the code flow when the provider allows it. |
| `clientSecret` (confidential client) | Sent as HTTP Basic auth on token and refresh requests; the secret is shipped inside the Lens. Only for providers that require it. |
| `redirectUri` override | Any URI must still reach the Lens through `DeepLinkModule.onUriReceived`; only the default Specs deep link is documented. |

## Internal

| Surface | Notes |
|---|---|
| `TokenManager` (`AuthKit.lspkg/Core/TokenManager`) | Used by `OAuth2` for persistence and refresh. Usable directly (e.g. `new TokenManager().save(clientId, token)` for tests) but `OAuth2` only reads storage in its constructor. |
| `AuthKit__PLACE_IN_SCENE.prefab` and `Example/` | Demo scaffolding (guide, example carousel, `AuthKitDemo`). Not needed in a Lens; see [components](components.md#demo-scaffolding-example). |

## Removed

Nothing is removed in this revision. There is no `@component` and no Inspector-driven setup
in AuthKit; examples that show `@input auth: OAuth2` were never valid.

## Changed in this revision (QA pass 2026-09-30)

- The callback log line prints only parameter names (`Received OAuth response with: code, state`),
  no longer the code / token values.
- Implicit flow uses the callback's `expires_in` (was always 3600 s).
- Refresh requests URL-encode `refresh_token` and `client_id`, and accept responses without
  `expires_in` (defaults to 3600 s).

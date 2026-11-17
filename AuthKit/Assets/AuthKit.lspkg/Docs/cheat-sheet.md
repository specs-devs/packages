# AuthKit cheat sheet (load-bearing rules)

[← Agent usage index](../README.md)

## Use when

Read this **first**, and re-read it before adding sign-in to a Lens. It is the short list
of rules that most often break a generated AuthKit Lens, each with a pointer to the detail.
Everything here is derived from the installed package source.

## The rules

1. **AuthKit is classes, not components.** Import `OAuth2` from `AuthKit.lspkg/Core/OAuth2`
   and construct it in your own `@component` (e.g. in `onAwake`). Never declare
   `@input auth: OAuth2` — a plain class can't be an Inspector input. → [components](components.md#oauth2)
2. **One `OAuth2` per client ID, created once.** The constructor restores the stored token
   for `clientId` and adds a `DeepLinkModule.onUriReceived` listener that is never removed;
   re-creating instances piles up listeners. → [components](components.md#oauth2)
3. **`authorize()` only works on a device.** In the Lens Studio editor it rejects with
   `Authorization not supported in editor mode` before opening anything. Design the Preview
   path around `isAuthorized === false` or a test token. → [troubleshooting](troubleshooting.md)
4. **Register the redirect URI.** The default is
   `https://lenses.specs.com/deeplink/specslink/oauth2redirect/unsecure`; it must be an
   allowed redirect URI of your provider's client, or the provider never calls back. → [setup](setup.md)
5. **`authorize()` has no timeout.** It resolves only when a matching deep-link callback
   arrives (code, token or `error`). If the user closes the provider page, the promise stays
   pending; keep your own UI state and let the user retry. → [troubleshooting](troubleshooting.md)
6. **Always get the token through `getAccessToken()`.** It refreshes an expired token first
   (tokens count as expired 60 s early). Implicit-flow tokens have no refresh token, so after
   expiry `getAccessToken()` throws `No refresh token available` → call `authorize()` again. → [components](components.md#oauth2)
7. **Wrap every call in `try/catch`.** `authorize`, `getAccessToken` and `refreshToken` reject
   with plain `Error`s (messages listed in [troubleshooting](troubleshooting.md)); an
   unhandled rejection only shows up in the Logger.
8. **Don't ship a client secret you need to keep secret.** `clientSecret` becomes an HTTP
   Basic header inside the Lens. Prefer a public client with the PKCE code flow (no secret). → [setup](setup.md)
9. **Token storage is keyed by the raw `clientId`.** Don't use the client ID as a key for
   your own `persistentStorageSystem.store` data; `signOut()` removes that key. → [components](components.md#tokenmanager)

## Verify

A compile-clean Lens can still never sign in: on device, check the Logger for
`Opening authorization URL`, then `Received OAuth response with: …` and
`Successfully obtained access token`. Missing the second line = redirect URI or deep link
problem. → [troubleshooting](troubleshooting.md)

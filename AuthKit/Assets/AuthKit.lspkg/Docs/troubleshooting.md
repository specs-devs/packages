# AuthKit troubleshooting

[← Agent usage index](../README.md)

## Use when

Use this table for package-specific failures. Generic Lens scripting, networking and
TypeScript issues are outside this package's scope. The rows marked **QA** were found while
making the package's demo project QA-ready (2026-09-30).

## Error messages

| Message | Thrown by | Meaning / fix |
|---|---|---|
| `Authorization not supported in editor mode` | `authorize()` | Expected in Lens Studio. Test sign-in on a device; use a test token in the Preview ([examples](examples.md#test-token-in-the-preview)). |
| `Not authorized. Call authorize() first.` | `getAccessToken()` | No token in memory (never signed in, or `signOut()`). |
| `No refresh token available` | `refreshToken()`, `getAccessToken()` on an expired token | Implicit-flow token, or the provider issued no refresh token (some need an `offline_access` scope or `access_type=offline`). Call `authorize()` again. |
| `Failed to refresh token` | `refreshToken()` | Refresh endpoint answered non-2xx (revoked / expired refresh token, wrong `refreshUri`, missing secret). The old token stays in memory and storage; sign the user in again. |
| `Token refresh response missing access_token` | `refreshToken()` | The refresh response isn't a standard OAuth2 token JSON. |
| `Token exchange failed: <status> <body>` | `authorize()` (code flow) | Code exchange rejected: check `tokenUri`, the registered redirect URI, client type (public vs secret) and that the provider supports PKCE. |
| `OAuth error: <error>` | `authorize()` | The provider redirected with `error=` (e.g. `access_denied`, `invalid_scope`). |
| `Authorization cancelled` | `authorize()` | A matching callback arrived with neither `code`, `access_token` nor `error`. |

## Known limitations and fixes

| Symptom | Package cause | Fix |
|---|---|---|
| `authorize()` never resolves | It waits for a deep-link callback with the same `state`; there is no timeout and no cancel. Closing the provider page, a wrong redirect URI, or a callback for another `OAuth2` leaves it pending. | Show your own "waiting" state with a retry; register the exact redirect URI ([setup](setup.md)). |
| A second `authorize()` call wins, the first never settles | Each call replaces the stored resolvers and `state`. | Disable the sign-in button while a sign-in is running. |
| Sign-in callbacks handled twice / by the wrong instance | Every `OAuth2` adds a permanent `onUriReceived` listener; mismatching `state` is ignored silently. | Create one `OAuth2` per client ID and reuse it. |
| Logger is flooded with `OAuth2: isAuthorized called, …` | The getter prints on every call (values masked). | Read `isAuthorized` on state changes, not every frame. |
| Earlier builds printed the authorization code / tokens in the Logger (**QA**, fixed) | The callback log printed `JSON.stringify(params)`. | Now prints only the parameter names: `Received OAuth response with: code, state`. |
| Implicit token expired after 1 h regardless of the provider (**QA**, fixed) | `expires_in` from the callback was ignored. | The callback's `expires_in` is used (3600 s if missing). |
| Refresh failed for refresh tokens containing `+`, `/` or `=` (**QA**, fixed) | The refresh body wasn't URL-encoded. | `refresh_token` and `client_id` are now encoded. |
| Refresh rejected with `Failed to parse refresh access token` although an access token came back (**QA**, fixed) | `expires_in` was required (it is optional in RFC 6749). | Accepted without `expires_in` (3600 s default). |
| Your own stored value disappears after sign-out | Tokens are stored under the raw `clientId` key of `persistentStorageSystem.store`. | Don't reuse the client ID as a storage key. |
| `isAuthorized` is `false` right after saving a token with `TokenManager` | `OAuth2` reads storage only in its constructor. | Create a new `OAuth2` for that client ID after saving. |
| Basic auth header wrong for a non-ASCII client secret | `computeBasicAuth` encodes each UTF-16 char code as one byte. | Use ASCII client IDs / secrets (the norm for OAuth2 consoles). Not changed in this revision. |
| `+` in a callback value isn't decoded to a space | Callback parameters use `decodeURIComponent` only. | Affects only values with spaces (e.g. `error_description`); codes and tokens are unaffected. |
| Copying an older README example fails to compile: `@input auth: OAuth2` | `OAuth2` is a plain class, not a component or asset. | Create it in code and pass it to helpers ([examples](examples.md)). |

## Not verified in this QA pass

- A real device sign-in against a live provider (the demo project ships placeholder
  endpoints; the editor path, test-token persistence, `getAccessToken()` and `signOut()` were
  verified in the Preview).
- Which Specs permission / publishing settings `DeepLinkModule` needs for the callback.

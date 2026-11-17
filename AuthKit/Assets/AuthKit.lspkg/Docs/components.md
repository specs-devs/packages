# AuthKit components

[← Agent usage index](../README.md)

## Use when

Look up an exact class, option, method, property or error message before writing code
against AuthKit. Everything below is read from `Core/*.ts` in this package. AuthKit
has no `@component` scripts: you create the classes from your own component.

## OAuth2

`import { OAuth2, AuthenticatorOptions } from "AuthKit.lspkg/Core/OAuth2"`

### Constructor

`new OAuth2(options: AuthenticatorOptions)`

1. Creates a `TokenManager` and restores the token stored for `options.clientId` (if any).
2. If `clientSecret` is set, computes the HTTP Basic value `base64(clientId:clientSecret)`.
3. Sets the redirect URI to `options.redirectUri` or the default
   `https://www.spectacles.com/deeplink/specslink/oauth2redirect/unsecure`.
4. Adds a listener to `DeepLinkModule.onUriReceived` (never removed).

### AuthenticatorOptions

| Option | Type | Required | Meaning |
|---|---|---|---|
| `clientId` | `string` | yes | OAuth2 client ID. Also the persistent-storage key for the token. |
| `authorizationUri` | `string` | yes | Provider authorization endpoint. |
| `tokenUri` | `string` | yes | Token endpoint for the code exchange (not used by the implicit flow). |
| `refreshUri` | `string` | no | Refresh endpoint; defaults to `tokenUri`. |
| `clientSecret` | `string` | no | Confidential clients only; sent as `Authorization: Basic …`. |
| `authenticationType` | `string` | yes | `"code"` (Authorization Code + PKCE) or `"implicit"`. Any other value behaves like `"code"`. |
| `redirectUri` | `string` | no | Redirect URI sent to the provider; defaults to the Specs deep link above. |

### Members

| Member | Signature | Behavior |
|---|---|---|
| `isAuthorized` | `get isAuthorized(): boolean` | `true` when a token with an `access_token` exists and is not expired. Prints one `OAuth2: isAuthorized called, …` line per call (token values masked). |
| `authorize` | `authorize(scope = ""): Promise<Token \| undefined>` | Editor: rejects `Authorization not supported in editor mode`. Device: builds the authorization URI (new `state` UUID; code flow adds a 64-char PKCE verifier and S256 challenge), opens it with `DeepLinkModule.openUri`, waits for the callback, then (code flow) exchanges the code at `tokenUri`. Saves and returns the token. |
| `getAccessToken` | `getAccessToken(): Promise<string>` | Rejects `Not authorized. Call authorize() first.` without a token; calls `refreshToken()` first when expired; returns `access_token`. |
| `getIdToken` | `getIdToken(): string \| null` | The OIDC `id_token` of the last authorization / refresh, or `null`. Does not refresh. |
| `refreshToken` | `refreshToken(): Promise<void>` | Rejects `No refresh token available` without a `refresh_token`; otherwise POSTs `grant_type=refresh_token` to `refreshUri \|\| tokenUri`, saves the new token (keeps the old refresh / id token when the response omits them). |
| `signOut` | `signOut(): void` | Removes the stored token for `clientId` and clears the in-memory token. |

### Callback handling

- Callbacks are ignored unless this instance is waiting in `authorize()`, and ignored silently
  when `state` doesn't match (another instance's callback).
- Parameters are read from the URI fragment (`#…`) if present, else from the query (`?…`).
- Implicit flow + `access_token` → token with `expires_in` from the callback (default 3600),
  no refresh token, resolves. `code` → resolves with the code. `error` → rejects
  `OAuth error: <error>`. Anything else → rejects `Authorization cancelled`.
- Code exchange: `POST tokenUri` (`application/x-www-form-urlencoded`: `grant_type`, `code`,
  `redirect_uri`, `code_verifier`, `client_id`); a non-2xx response rejects
  `Token exchange failed: <status> <body>`.

## Token

`import { Token, IToken } from "AuthKit.lspkg/Core/Token"`

`new Token(access_token, refresh_token?, expires_in?, expiration_timestamp?, id_token?)`

| Field | Type | Default |
|---|---|---|
| `access_token` | `string` | — |
| `refresh_token` | `string \| null` | `null` |
| `expires_in` | `number` (s) | `3600` |
| `expiration_timestamp` | `number` (ms, `Date.now()` clock) | `Date.now() + expires_in * 1000 - 60000` (60 s early) |
| `id_token` | `string \| null` | `null` |

`toString()` masks the tokens (`abcd...wxyz`, `<redacted>` for ≤ 8 chars) — safe to print.

## TokenManager

`import { TokenManager } from "AuthKit.lspkg/Core/TokenManager"`

| Member | Behavior |
|---|---|
| `constructor(storage?: GeneralDataStore)` | Defaults to `global.persistentStorageSystem.store`. |
| `storage: GeneralDataStore` | Public field holding the store passed to (or defaulted by) the constructor. |
| `save(clientId, token)` | `storage.putString(clientId, JSON.stringify(token))`. |
| `restoreToken(clientId)` | Parses the stored JSON into a `Token` (keeps its `expiration_timestamp`), or `undefined`. |
| `clearToken(clientId)` | `storage.remove(clientId)`. |
| `refreshToken({clientId, refresh_token, tokenUri, basicAuth?, id_token?})` | POSTs the refresh grant; rejects `Failed to refresh token` (non-2xx) or `Token refresh response missing access_token`; returns a new `Token`. |

`OAuth2` reads storage only in its constructor: after saving a token yourself, create a new
`OAuth2` for that client ID to pick it up.

## Prefab

`AuthKit__PLACE_IN_SCENE.prefab` — the self-contained demo: Guide, ExampleCarousel and
AuthKitDemo under one root. Not needed to use AuthKit in your own Lens.

## Demo scaffolding (`Example/`)

These scripts ship in `AuthKit.lspkg/Example/` and are wired inside `AuthKit__PLACE_IN_SCENE.prefab` (order: Guide, ExampleCarousel, then AuthKitDemo). They only present the example; they are not part of the AuthKit API. ExampleCarousel and GuideDismissPanel import SpectaclesUIKit and SpectaclesInteractionKit, and AuthKitDemo imports SpectaclesUIKit.

| Object / script | Class | Key inputs |
|---|---|---|
| `Guide` — `Example/GuideDismissPanel/GuideDismissPanel.ts` | `GuideDismissPanel` | `hideUntilDismissed: SceneObject[]` — hidden until "Ok, I understood" is pressed (here: AuthKitDemo and ExampleCarousel); `buttonLabel: string = "Ok, I understood"` (only used when the panel is built at runtime) |
| `ExampleCarousel` — `Example/ExampleCarousel/ExampleCarousel.ts` | `ExampleCarousel` | `examples: SceneObject[]` (here the single `AuthKitDemo` object), `exampleInfo: string[]` (one line per example), `steps: SceneObject[]`, `stepInfo: string[] = []` (one line per step, same order as `steps`; empty entries fall back to the step's example info; unused here), `startIndex: number = 0`, `previousLabel` / `nextLabel`, `examplesPushBack: number = 20`, `anchorExamples: boolean = true`, `startMinimized: boolean = false`, `extraPanelDrop: number = 0` |
| `AuthKitDemo` — `Example/AuthKitDemo/AuthKitDemo.ts` | `AuthKitDemo` | `clientId: string = "authkit-demo-client"`, `authorizationUri: string = "https://provider.example/oauth/authorize"`, `tokenUri: string = "https://provider.example/oauth/token"`, `scope: string = "openid profile"`, `authenticationType: string = "code"` (`"code"` or `"implicit"`). The prefab keeps these placeholder values. It builds its UIKit panel at runtime. |

The demo's endpoints are placeholders, not a real OAuth2 server. On device, Sign in refuses to
open while `authorizationUri` contains `provider.example` and shows "Set clientId,
authorizationUri and tokenUri on AuthKitDemo to your provider's values first." Set the three
inputs to your provider's values (see [setup](setup.md)). In the Preview, `authorize()` rejects
with its own editor-mode error before this check matters.

Keep the Guide above the examples in the hierarchy: it hides its targets in `onAwake`.

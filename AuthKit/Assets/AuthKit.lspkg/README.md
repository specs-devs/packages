<p align="center">
  <img src="../AssetImage/AuthKit.png" width="250px" alt="AuthKit"/>
</p>

# AuthKit 

AuthKit is a comprehensive OAuth2 authentication framework designed for SPECS applications that need to integrate with external services requiring user authorization. It provides a complete implementation of OAuth2 flows including Authorization Code Flow with PKCE (Proof Key for Code Exchange) and Implicit Flow, along with automatic token management, refresh capabilities, and persistent session storage.

## Features

- **OAuth2 Authorization Code Flow with PKCE**: Secure authorization flow with cryptographic code challenge
- **OAuth2 Implicit Flow**: Simplified flow for client-side applications
- **Automatic Token Refresh**: Seamlessly refreshes expired access tokens using refresh tokens
- **Persistent Token Storage**: Saves tokens across sessions using persistent storage
- **Deep Link Integration**: Handles OAuth callbacks via SPECS deep link system
- **Token Expiration Management**: Automatically checks and handles token expiration
- **Secure Client Authentication**: Supports both public and confidential OAuth2 clients
- **Type-Safe API**: Fully typed TypeScript interfaces for reliable development

## Quick Start

```typescript
import { OAuth2 } from "AuthKit.lspkg/Core/OAuth2";

const internetModule = require("LensStudio:InternetModule") as InternetModule;

// One OAuth2 instance per client ID (Authorization Code Flow with PKCE)
const auth = new OAuth2({
  clientId: "<your-client-id>",
  authorizationUri: "https://provider.com/oauth/authorize",
  tokenUri: "https://provider.com/oauth/token",
  authenticationType: "code",
});

// A stored, unexpired token is restored by the constructor
if (!auth.isAuthorized) {
  await auth.authorize("read write profile"); // device only, opens the provider's page
}

// Current access token, refreshed first if it has expired
const accessToken = await auth.getAccessToken();
const response = await internetModule.fetch("https://api.provider.com/user", {
  headers: { Authorization: `Bearer ${accessToken}` },
});
```

Register `https://www.spectacles.com/deeplink/specslink/oauth2redirect/unsecure` (the default
`redirectUri`) as an allowed redirect URI with your provider. Provider setup, the full UI flow,
an authenticated API client and error handling are in [Docs/](Docs/examples.md).

## Script Highlights

- **OAuth2.ts**: Core OAuth2 authenticator implementing both Authorization Code Flow with PKCE and Implicit Flow. Generates the authorization URI (PKCE challenge + state), opens it through the deep link module, handles the callback, exchanges the code for tokens and refreshes expired tokens.
- **TokenManager.ts**: Saves, restores and clears tokens in `persistentStorageSystem.store` (one entry per client ID) and refreshes them with a `refresh_token` request to the token endpoint.
- **Token.ts**: The token record (access, refresh and id token, `expires_in`) with an expiration timestamp 60 seconds before the real expiry, so tokens are refreshed early.

## Usage

This section ships with the package and describes the installed package
(the version lives in `package.native`). Read it, then follow the links into `Docs/` for the topic you
need. It is written for both people and coding agents; generic Lens scripting, scene
construction and Specs spatial design live in the CLAD skills, not here.

### Package identity

- Package descriptor: `AuthKit.lspkg/package.native` (ReadMe = this file).
- Consumer import prefix: `AuthKit.lspkg/Core/<Module>` — `AuthKit.lspkg/Core/OAuth2`,
  `AuthKit.lspkg/Core/Token`, `AuthKit.lspkg/Core/TokenManager`. There is no `Scripts/` folder
  and no `@component`: AuthKit is plain TypeScript classes you create from your own script.
- Companion packages (`package_dependencies.json`): SpectaclesInteractionKit and
  SpectaclesUIKit. `Core/` itself imports no package: it only uses
  `require("LensStudio:InternetModule")`, `require("LensStudio:DeepLinkModule")` and
  `global.persistentStorageSystem`. The two frameworks are needed by the `Example/` scripts:
  `AuthKitDemo`, `ExampleCarousel` and `GuideDismissPanel` import `SpectaclesUIKit.lspkg/...`,
  and `ExampleCarousel` / `GuideDismissPanel` also import `SpectaclesInteractionKit.lspkg/...`.
- Prefab entry point: `AuthKit__PLACE_IN_SCENE.prefab`. The prefab is self-contained:
  it carries the guide panel ("Ok, I understood"), the example carousel and the `AuthKitDemo`
  session panel (Sign in / Get token / Test token / Sign out), so dropping it into a Specs scene
  with a Camera and SIK gives the full demo. You don't need it to use AuthKit in your own Lens.
- Demo scaffolding: `AuthKit.lspkg/Example/` holds the scripts the prefab uses
  (`ExampleCarousel/`, `GuideDismissPanel/`, `AuthKitDemo/`). They are not part of the AuthKit
  API; see [components](Docs/components.md#demo-scaffolding-example).

### Version and API status

This README and `Docs/` ship in the package archive and describe that exact installed
revision. Read [API status](Docs/api-status.md) before reusing an older example; it lists
the Current, Experimental and Internal surfaces of this revision.

### Applicability

Use AuthKit when a Lens must sign the wearer in to a third-party OAuth2 / OIDC provider
(Google, Spotify, GitHub, your own server …) and call that provider's API with a bearer
token. Use Snap Cloud (Supabase) auth for Lens backends hosted on Snap Cloud, and
`InternetModule` alone for public endpoints that need no user authorization.

### Related CLAD skills

[specs-snap-cloud](https://github.com/lens-studio-devs/ls-extensions/blob/main/plugins/ls-clad/skills/specs-snap-cloud/SKILL.md). These skills cover the surrounding Lens workflow.

[Install CLAD](https://developers.specs.com/docs/clad/setup/setup-ai/) or browse its [source](https://github.com/lens-studio-devs/ls-extensions). Read the installed package docs for this revision’s APIs.

### Package Docs (ship in `Docs/`)

Lens Studio installs packages packed but auto-extracts their files into the project's Cache
on import, so an agent can read these `Docs/` there (or from the package source). Treat only
documented public members as supported API: never guess an import path or reach into a
private field.

- [cheat sheet](Docs/cheat-sheet.md) - load-bearing rules; read first
- [components](Docs/components.md) - every public class, option, method and property, with import paths
- [API status](Docs/api-status.md) - Current / Experimental / Internal surfaces of this revision
- [setup](Docs/setup.md) - provider registration, redirect URI, client ID / secret placeholders
- [examples](Docs/examples.md) - minimal compile-correct TypeScript: sign-in UI, API client, session checks
- [troubleshooting](Docs/troubleshooting.md) - package-specific symptoms, causes and fixes (incl. QA findings)

### Verification

1. Compile the Lens with no TypeScript errors and no `as any` on AuthKit types.
2. In the Preview, `authorize()` must reject with `Authorization not supported in editor mode`
   and `getAccessToken()` with `Not authorized. Call authorize() first.` — both are expected.
3. Save a test token with `new TokenManager().save(clientId, new Token("test-…", null, 3600))`,
   create a new `OAuth2` for the same client ID: `isAuthorized` must be `true` (also after a
   Preview reset), and `signOut()` must make it `false` again.
4. On device, sign in once and confirm the Logger shows `Received OAuth response with: code, state`
   followed by `Successfully obtained access token` (code flow). For the implicit flow the Logger
   shows `Received OAuth response with: access_token, …` and nothing after it: `authorize()`
   returns the token without printing the success line.
5. Restart the Lens on device: `isAuthorized` must be `true` without a new sign-in until the
   token expires; after expiry `getAccessToken()` must refresh (code flow) or throw
   `No refresh token available` (implicit flow).

---

## Built with 👽 by the SPECS team <!-- --> <!-- --> <!-- --> <!-- -->

## Package artwork

`Assets/AssetImage/AuthKit.png` is the preview; the native package icon is kept in sync with `AuthKit.svg`.

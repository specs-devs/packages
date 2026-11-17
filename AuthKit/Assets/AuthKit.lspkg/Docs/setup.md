# AuthKit setup

[← Agent usage index](../README.md)

## Use when

Read this before the first sign-in: registering the Lens with an OAuth2 provider, choosing
the flow, and filling in `AuthenticatorOptions`. AuthKit ships no credentials; every value
below is a placeholder you get from your provider's developer console.

## 1. Register a client with the provider

In the provider's developer console (Google Cloud, Spotify, GitHub, your own server, …):

1. Create an OAuth2 / OIDC client. Prefer a **public** client type (mobile / installed app /
   "no client secret") so the Lens can use the code flow with PKCE and no secret.
2. Add the redirect URI exactly:
   `https://lenses.specs.com/deeplink/specslink/oauth2redirect/unsecure`
   (the `redirectUri` default). A different value must still come back to the Lens through
   the deep link module.
3. Enable the scopes you will request (space-separated in `authorize(scope)`); add `openid`
   if you need `getIdToken()`.
4. Note the authorization endpoint, token endpoint and client ID.

## Package ID

On SPECS, your Lens is identified by the **Package ID** you define in Lens Studio (this is
the lensId used by deep links). Set it before deploying:

**Project Settings → Platform Settings → SPECS → SPK Configuration → Package ID**

<img src="../README-ref/LS-PackageID.png" alt="Package ID in Project Settings" width="700" />

Choose a stable Package ID before shipping; changing it later breaks deep link routing.

## 2. Fill in the options

```typescript
const auth = new OAuth2({
  clientId: "<client-id-from-console>",
  authorizationUri: "<provider authorization endpoint>",
  tokenUri: "<provider token endpoint>",
  refreshUri: "<optional, defaults to tokenUri>",
  authenticationType: "code", // or "implicit"
  // clientSecret: "<only if the provider requires a confidential client>",
});
```

| Choice | Use |
|---|---|
| `"code"` (default choice) | Authorization Code + PKCE S256. Returns refresh tokens when the provider issues them. |
| `"implicit"` | Only when the provider offers no code flow for this client type. No refresh token: users sign in again after expiry. |
| `clientSecret` | Only when the provider rejects PKCE-only public clients. The secret is shipped inside the Lens and is not confidential. |

Don't commit real client secrets to source control; keep them out of shared sample projects.

## 3. Capabilities the Lens needs

- Internet access (`InternetModule`) for the code exchange, refresh and API calls.
- Deep links (`DeepLinkModule.openUri` / `onUriReceived`) for the provider page and its
  callback.
- Persistent storage (`global.persistentStorageSystem.store`) for the token.

The package only `require`s these modules; it does not change project settings. Which
publishing / permission settings these modules need on Specs is not described by the package
source — check the Specs publishing docs for your Lens Studio version.

## 4. Test

1. Preview: confirm the signed-out UI, and the signed-in UI with a test token
   ([examples](examples.md#test-token-in-the-preview)).
2. Device: sign in, restart the Lens, confirm `isAuthorized` stays `true`; sign out.

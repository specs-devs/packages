# AuthKit examples

[← Agent usage index](../README.md)

## Use when

Copy a minimal, compile-correct starting point for sign-in, authenticated API calls or
session checks. All snippets use this package's import paths (`AuthKit.lspkg/Core/…`) and were
compiled against this package with UIKit for the buttons. Replace the
`<…>` placeholders with your provider's values ([setup](setup.md)).

## Setup in a scene

AuthKit has nothing to drag into the scene: add the package, then create `OAuth2` from your
own component. `AuthKit__PLACE_IN_SCENE.prefab` is the packaged demo: a guide, an
example carousel and `AuthKitDemo` (`Example/AuthKitDemo/AuthKitDemo.ts`), which shows one
session with Sign in / Get token / Test token / Sign out buttons.

## Sign-in panel with UIKit buttons

```typescript
import { OAuth2 } from "AuthKit.lspkg/Core/OAuth2";
import { RectangleButton } from "UIKit.lspkg/Scripts/Components/Button/RectangleButton";

@component
export class AuthenticationManager extends BaseScriptComponent {
  @input loginButton: RectangleButton;
  @input logoutButton: RectangleButton;
  @input statusText: Text;
  @input contentContainer: SceneObject;

  private auth: OAuth2;

  onAwake() {
    // Create once; the constructor restores a stored token for this client ID.
    this.auth = new OAuth2({
      clientId: "<your-client-id>",
      authorizationUri: "https://provider.com/oauth/authorize",
      tokenUri: "https://provider.com/oauth/token",
      authenticationType: "code",
    });
    // UIKit buttons: subscribe in OnStart, after they initialized.
    this.createEvent("OnStartEvent").bind(() => {
      this.loginButton.onTriggerUp.add(() => this.handleLogin());
      this.logoutButton.onTriggerUp.add(() => this.handleLogout());
      this.updateUI();
    });
  }

  private async handleLogin() {
    try {
      this.statusText.text = "Opening sign-in...";
      await this.auth.authorize("read profile");
      this.statusText.text = "Signed in";
    } catch (error) {
      // In the editor: "Authorization not supported in editor mode"
      this.statusText.text = `Sign-in failed: ${error}`;
    }
    this.updateUI();
  }

  private handleLogout() {
    this.auth.signOut();
    this.updateUI();
  }

  private updateUI() {
    const signedIn = this.auth.isAuthorized;
    this.loginButton.sceneObject.enabled = !signedIn;
    this.logoutButton.sceneObject.enabled = signedIn;
    this.contentContainer.enabled = signedIn;
    if (signedIn) {
      this.statusText.text = "Signed in";
    }
  }
}
```

## Authenticated API client

`fetch` comes from `InternetModule`; `getAccessToken()` refreshes an expired token first.

```typescript
import { OAuth2 } from "AuthKit.lspkg/Core/OAuth2";

const internetModule = require("LensStudio:InternetModule") as InternetModule;

export class AuthenticatedApiClient {
  constructor(private auth: OAuth2, private baseUrl: string) {}

  async get(endpoint: string): Promise<any> {
    const accessToken = await this.auth.getAccessToken();
    const response = await internetModule.fetch(`${this.baseUrl}${endpoint}`, {
      method: "GET",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!response.ok) {
      throw new Error(`API request failed: ${response.status}`);
    }
    return await response.json();
  }

  async post(endpoint: string, data: object): Promise<any> {
    const accessToken = await this.auth.getAccessToken();
    const response = await internetModule.fetch(`${this.baseUrl}${endpoint}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      throw new Error(`API request failed: ${response.status}`);
    }
    return await response.json();
  }
}

// const api = new AuthenticatedApiClient(auth, "https://api.provider.com");
// const profile = await api.get("/user/profile");
```

## Periodic session check

Pass the `OAuth2` instance in code (it can't be an `@input`).

```typescript
import { OAuth2 } from "AuthKit.lspkg/Core/OAuth2";

const CHECK_INTERVAL_S = 300;

export class SessionWatcher {
  constructor(private auth: OAuth2, private owner: BaseScriptComponent, private onExpired: () => void) {
    const delayed = owner.createEvent("DelayedCallbackEvent");
    delayed.bind(() => {
      this.check();
      delayed.reset(CHECK_INTERVAL_S);
    });
    delayed.reset(CHECK_INTERVAL_S);
  }

  private async check() {
    try {
      await this.auth.getAccessToken(); // refreshes when expired
    } catch (error) {
      // "Not authorized…", "No refresh token available", "Failed to refresh token"
      this.onExpired();
    }
  }
}
```

## Test token in the Preview

`authorize()` can't run in the editor. To exercise the signed-in path there, store a fake
token and create a new `OAuth2`, which restores it:

```typescript
import { OAuth2 } from "AuthKit.lspkg/Core/OAuth2";
import { Token } from "AuthKit.lspkg/Core/Token";
import { TokenManager } from "AuthKit.lspkg/Core/TokenManager";

function signInWithTestToken(clientId: string): OAuth2 {
  new TokenManager().save(clientId, new Token("test-access-token", null, 3600));
  return new OAuth2({
    clientId,
    authorizationUri: "https://provider.com/oauth/authorize",
    tokenUri: "https://provider.com/oauth/token",
    authenticationType: "code",
  });
}
```

Call `signOut()` afterwards so the fake token doesn't stay in persistent storage.

## OIDC id token

Request the `openid` scope; after `authorize()` (or a refresh) read `auth.getIdToken()`.
Call `await auth.getAccessToken()` first when the id token must match a refreshed session.

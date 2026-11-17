# AuthKitExamples examples

[← Agent usage index](../README.md)

## Use when

Read this when you build your own sign-in panel from these examples. The snippets are
compile-checked against this revision and its companions AuthKit, UIKit and Utilities.

## Drop-in prefab

1. Make sure the scene has the Interaction Kit prefab (UIKit buttons need it).
2. Drag `AuthKitExamples.lspkg/AuthKitExamples__PLACE_IN_SCENE.prefab` into the scene.
3. Set `clientId` on `SpotifyLoginExample/SpotifyMusicController` and
   `SpotifyMinimumExample/SpotifyControllerMinimum` (see [setup](setup.md)).
4. The guide shows first; "Ok, I understood" reveals the example carousel, which steps between the
   two examples and places the shown one in front of the user (`anchorExamples`).

## Your own provider controller

A minimal sign-in + API panel for any OAuth2 provider, the pattern `UIController` uses:

```typescript
import { OAuth2 } from "AuthKit.lspkg/Core/OAuth2";
import { RectangleButton } from "UIKit.lspkg/Scripts/Components/Button/RectangleButton";

@component
export class MyProviderController extends BaseScriptComponent {
  @input signInButton: RectangleButton;
  @input apiButton: RectangleButton;
  @input statusText: Text;

  @input clientId: string = "<your-client-id>";
  @input authorizationUri: string = "https://your-provider.example/oauth/authorize";
  @input tokenUri: string = "https://your-provider.example/oauth/token";
  @input scope: string = "profile";
  @input apiUri: string = "https://your-provider.example/api/me";

  private internetModule: InternetModule = require("LensStudio:InternetModule");
  private auth: OAuth2;

  onAwake() {
    this.auth = new OAuth2({
      clientId: this.clientId,
      authorizationUri: this.authorizationUri,
      tokenUri: this.tokenUri,
      authenticationType: "code",
    });
    this.statusText.text = this.auth.isAuthorized ? "Signed in" : "Signed out";
    // UIKit buttons are ready in OnStartEvent.
    this.createEvent("OnStartEvent").bind(() => {
      this.signInButton.onTriggerUp.add(() => this.onSignIn());
      this.apiButton.onTriggerUp.add(() => this.onApi());
    });
  }

  private async onSignIn() {
    this.statusText.text = "Connecting...";
    try {
      await this.auth.authorize(this.scope);
      this.statusText.text = "Signed in";
    } catch (error) {
      // In the Lens Studio editor this is "Authorization not supported in editor mode".
      this.statusText.text = "Sign-in failed:\n" + error;
    }
  }

  private async onApi() {
    try {
      const token = await this.auth.getAccessToken();
      const request = new Request(this.apiUri, {
        headers: { Authorization: "Bearer " + token },
      });
      const response = await this.internetModule.fetch(request);
      if (!response.ok) {
        throw new Error("HTTP " + response.status);
      }
      const data = JSON.parse(await response.text());
      this.statusText.text = "Hello, " + (data.name || "user");
    } catch (error) {
      this.statusText.text = "API error:\n" + error;
    }
  }
}
```

## Reading the music controller's state

`SpotifyMusicController` exposes read-only getters; drive playback through its buttons.

```typescript
import { SpotifyMusicController } from "AuthKitExamples.lspkg/SpotifyExample/SpotifymusicController";

@component
export class NowPlayingLabel extends BaseScriptComponent {
  @input music: SpotifyMusicController;
  @input label: Text;

  onAwake() {
    this.createEvent("UpdateEvent").bind(() => {
      const state = this.music.getPlaybackState();
      const track = this.music.getCurrentTrack();
      this.label.text = track
        ? `${track.name} (${state.currentIndex + 1}/${state.totalTracks})`
        : `${state.totalTracks} songs`;
    });
  }
}
```

## Logging

The two Spotify controllers log through `Logger` from `Utilities.lspkg/Scripts/Utils/Logger`
(`UIController` has no logging inputs; it only `print`s the raw API response). The Logger is
created as `new Logger(tag, enableLogging || enableLoggingLifecycle, true)`, and when disabled it
drops **every** level, warnings and errors included. Turn `enableLogging` on in the Inspector while
debugging; output looks like:

```
01:13:42 | SpotifyMusicController | INFO | Starting Spotify authentication
01:13:42 | SpotifyMusicController | ERROR | Authentication failed: Error: Authorization not supported in editor mode
```

`enableLoggingLifecycle` adds the `LIFECYCLE: onAwake()` line.

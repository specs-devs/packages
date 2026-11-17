# AuthKitExamples 

Complete working examples demonstrating OAuth2 authentication integration with real-world services using AuthKit. These examples show how to build production-ready authentication flows with UI components, API integration, and proper error handling for SPECS applications.

## Features

- **Spotify Music Controller**: Full-featured music player with OAuth2 authentication, liked songs playback, and audio preview support
- **Spotify Controller Minimum**: Minimal OAuth2 integration example showing basic authentication flow and API calls
- **UI Controller**: Generic OAuth2 UI controller template that works with any OAuth2 provider
- **RectangleButton Integration**: UI Kit button components for clean, interactive authentication interfaces
- **Logging Configuration**: Built-in debug logging controls for development and troubleshooting

## Quick Start

1. Drag `AuthKitExamples__PLACE_IN_SCENE.prefab` into a scene that already has the
   Interaction Kit prefab.
2. Register an app in the [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
   with the redirect URI `https://lenses.specs.com/deeplink/specslink/oauth2redirect/unsecure`,
   set a **Package ID** under **Project Settings → Platform Settings → SPECS → SPK Configuration**,
   and paste the Client ID into the `clientId` input of the controller you use.
3. Sign in on a SPECS device — OAuth2 sign-in does not run in the Lens Studio editor.

```typescript
// Use the generic UI Controller as a template
import { UIController } from "AuthKitExamples.lspkg/UIController";

// Or explore the Spotify examples for real-world integration
import { SpotifyMusicController } from "AuthKitExamples.lspkg/SpotifyExample/SpotifymusicController";
import { SpotifyUIController } from "AuthKitExamples.lspkg/SpotifyExample/SpotifyControllerMinimum";
```

Step-by-step setup is in [Docs/setup.md](Docs/setup.md); a template for your own provider is in
[Docs/examples.md](Docs/examples.md).

## Usage

This section ships with the package and describes the exact installed revision. Read it, then follow the links into `Docs/` for the topic you
need. It is written for both people and coding agents; generic Lens scripting, scene
construction and Specs spatial design are out of scope here.

### Package identity

- Package descriptor: `AuthKitExamples.lspkg/package.native` (ReadMe = this file).
- Consumer import prefix: `AuthKitExamples.lspkg/<File>` — `AuthKitExamples.lspkg/UIController`,
  `AuthKitExamples.lspkg/SpotifyExample/SpotifymusicController` (class `SpotifyMusicController`),
  `AuthKitExamples.lspkg/SpotifyExample/SpotifyControllerMinimum` (class `SpotifyUIController`).
- Required companion packages (package_dependencies.json): AuthKit (the OAuth2 engine),
  InteractionKit, UIKit (`RectangleButton`), SnapDecorators
  (`@bindStartEvent`), Utilities (`Logger`), Motion and Icons (UIKit dependencies).
- `AuthKitExamples__PLACE_IN_SCENE.prefab`: self-contained demo. It carries the guide panel
  ("Ok, I understood"), the example carousel (Previous / Next / minimize) and two example groups,
  each a UIKit `Frame` with the buttons, texts, album artwork Image and AudioComponent:
  `SpotifyLoginExample` (driven by `SpotifyMusicController`) and `SpotifyMinimumExample` (the same
  Frame driven by `SpotifyControllerMinimum`). Dropping it into a Specs scene with a Camera and SIK
  gives the full demo. `UIController` is not in the prefab.
- Assets: `Materials/Image.mat` (the album-artwork material used by the prefab, built on
  `Shaders/flat.graphShader` with the grey placeholder texture `Images/Image.png`) and
  `Audio/Audio Output.audioOutput` (audio output referenced by the prefab).
- Demo scaffolding: `AuthKitExamples.lspkg/Example/` holds the scripts the prefab uses for the guide
  and carousel (`ExampleCarousel/`, `GuideDismissPanel/`). They are not part of the AuthKitExamples
  API; see [components](Docs/components.md#demo-scaffolding-example).

### Version and API status

This README and `Docs/` ship in the package archive and describe that exact installed
revision. Read [API status](Docs/api-status.md) before reusing an older example; it lists
the Current, Experimental and Removed surfaces of this revision.

### Applicability

Use AuthKitExamples as a starting point when a Lens needs a sign-in panel for a third-party
OAuth2 service — Spotify as shipped, or any provider through `UIController`. The OAuth2 logic
itself lives in AuthKit (read its README for the `OAuth2` API); this package only adds UI wiring
and Spotify Web API calls. For Lens backends on Snap Cloud use Snap Cloud (Supabase) auth instead.

### Package Docs (ship in `Docs/`)

Lens Studio installs packages packed but auto-extracts their files into the project's Cache
on import, so an agent can read these `Docs/` there (or from the package source). Treat only
documented public members as supported API: never guess an import path or reach into a
private field.

- [cheat sheet](Docs/cheat-sheet.md) - load-bearing rules; read first
- [components](Docs/components.md) - every component, its @inputs (with defaults) and public methods
- [API status](Docs/api-status.md) - Current / Experimental / Removed surfaces of this revision
- [setup](Docs/setup.md) - Spotify app registration, redirect URI, client ID, other providers
- [examples](Docs/examples.md) - compile-correct TypeScript: your own provider controller, API calls, logging
- [troubleshooting](Docs/troubleshooting.md) - package-specific symptoms, causes and fixes (incl. QA findings)

### Verification

1. Compile the Lens with no TypeScript errors and no `as any` (the examples build `new Request(url, init)` directly).
2. In the Preview, Sign In must show `⚠️ Test on Glasses device` / `OAuth2 doesn't work in Lens Studio`,
   and Play / Pause / Stop must answer `❌ Please sign in first`.
3. With `SpotifyControllerMinimum`, API (signed out) must show `API error: … Not authorized. Call authorize() first.`
4. The prefab's buttons must sit in three rows (Sign In · Sign Out / Play · Pause · Stop / Previous · Next),
   not stacked on top of each other.
5. On device, with a real Client ID: Sign In opens Spotify's page, the status becomes
   `✅ Connected to Spotify!` and then `✅ Loaded N liked songs`.

---

## Built with 👽 by the SPECS team

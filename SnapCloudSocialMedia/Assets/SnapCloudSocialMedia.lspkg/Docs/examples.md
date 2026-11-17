# SnapCloudSocialMedia examples

[← Agent usage index](../README.md)

## Use when

Read this when you add the package to a Lens or write code next to it. The snippets use this
package's import paths and were compile-checked against this installed revision.

## Drop in the prefab

1. Drag `SnapCloudSocialMedia.lspkg/SnapCloudSocialMedia__PLACE_IN_SCENE.prefab` into the scene,
   or press **Add prefab to scene** in the editor panel ([setup](setup.md)).
   The prefab brings the guide and the example carousel along with the panel.
2. On its `Snap Cloud Social Media` child, check that **Config Asset** is `social.config` and
   **Microphone** is `Microphone Audio`. Optionally set **Composite Texture** to record rendered
   AR content.
3. Keep the whole panel (about 44 × 75 cm) in view. The prefab root sits at the origin and the
   `Snap Cloud Social Media` child at (0, 6, −160); move that child to place the panel.
4. Reset the Preview. Demo mode needs no credentials.

The scene needs a Camera with DeviceTracking and the InteractionKit rig, so the panel
can be pinched.

## Configs

Demo (bundled default; nothing is posted):

```json
{"schemaVersion": 1, "demoMode": true, "proxyUrl": "https://your-social-proxy.example.com",
 "cloud": {"url": "https://YOUR_PROJECT.snapcloud.dev", "publishableKey": ""}, "...": "..."}
```

Live (placeholders; publishable key only):

```json
{
  "schemaVersion": 1,
  "demoMode": false,
  "proxyUrl": "https://YOUR_PROXY",
  "cloud": {"url": "https://YOUR_PROJECT.snapcloud.dev", "publishableKey": "<publishable key>"},
  "capture": {"aspect": "portrait", "fps": 8, "maxSeconds": 12, "includeAudio": true},
  "composer": {"caption": "Made with Specs ✨ #Specs", "title": "A moment through my Specs"},
  "destinations": {
    "snapchat": {"enabled": false, "format": "spotlight", "caption": ""},
    "x": {"enabled": true, "format": "video", "caption": ""},
    "youtube": {"enabled": true, "format": "short", "caption": "", "privacy": "private"},
    "linkedin": {"enabled": false, "format": "video", "caption": ""},
    "instagram": {"enabled": true, "format": "reel", "caption": ""},
    "threads": {"enabled": false, "format": "video", "caption": ""},
    "tiktok": {"enabled": false, "format": "video", "caption": "", "publishMode": "inbox", "privacyLevel": ""}
  }
}
```

All seven destinations must be present, even disabled ones.

## Validate a config from your own script

`parseConfig` is the same validation the prefab and the editor panel use. Use it to check a
config before you ship.

```ts
import {parseConfig, PROVIDERS} from "SnapCloudSocialMedia.lspkg/Scripts/SocialConfig"

@component
export class SocialConfigCheck extends BaseScriptComponent {
  @input
  @hint("The public social.config JSON asset")
  configAsset: JsonAsset

  onAwake(): void {
    try {
      const config = parseConfig(this.configAsset.getString())
      const enabled = PROVIDERS.filter((p) => config.destinations[p.id].enabled)
        .map((p) => p.name + "/" + config.destinations[p.id].format)
      print("Social config OK · demo " + config.demoMode + " · " + enabled.join(", "))
    } catch (error) {
      print("Social config invalid: " + error)
    }
  }
}
```

## Show which formats a provider supports

```ts
import {PROVIDERS, ProviderId} from "SnapCloudSocialMedia.lspkg/Scripts/SocialConfig"

export function formatsFor(id: ProviderId): string[] {
  const provider = PROVIDERS.find((p) => p.id === id)
  return provider ? provider.formats : []
}
```

## Hide the panel until your own intro is dismissed

The component builds its panel in `onAwake`. Keep the instance disabled until you need it; its
`onAwake` then runs when you enable it. The example project does this through its guide's
`hideUntilDismissed` list.

```ts
@component
export class ShowSocialPanel extends BaseScriptComponent {
  @input
  @hint("The Snap Cloud Social Media prefab instance (disabled in the scene)")
  socialPanel: SceneObject

  show(): void {
    this.socialPanel.enabled = true
  }
}
```

Don't add `SnapCloudSocialMedia` with `createComponent`. Its `configAsset` input isn't
optional, so a runtime-created component throws `Input configAsset was not provided`.

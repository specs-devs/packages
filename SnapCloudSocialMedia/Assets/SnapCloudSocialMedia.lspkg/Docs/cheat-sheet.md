# SnapCloudSocialMedia cheat sheet (load-bearing rules)

[← Agent usage index](../README.md)

## Use when

Read this **first**, and again before wiring the package into a Lens. These are the rules that
most often break a social-sharing Lens. Each links to the detail.

## The rules

1. **Use the prefab, not `createComponent`.** Drag
   `SnapCloudSocialMedia__PLACE_IN_SCENE.prefab` into the scene. `configAsset` isn't
   `@allowUndefined`, so a component created at runtime throws `Input configAsset was not
   provided`. The component builds its whole UI (Canvas, BackPlate, FlexLayout panel) on its own
   SceneObject in `onAwake`. Don't author children under it. → [components](components.md)
2. **Keep `configAsset` assigned on the instance.** It points at the package's
   `social.config.json`, and `microphone` at `Microphone Audio.micaudio`. If a scene re-save
   clears them (the inspector shows them empty), the Lens throws at awake and no panel appears.
   → [troubleshooting](troubleshooting.md)
3. **No secrets in the Lens.** `social.config.json` is public and ships in the Lens.
   `parseConfig` rejects any key matching `secret`, `access token`, `refresh token`,
   `service role`, `password` or `api key`. Client secrets, the service-role key and the
   encryption key belong only in the proxy's `proxy.config.json` / `.env`. → [setup](setup.md)
4. **Demo mode is the default.** With `demoMode: false`, `parseConfig` requires an `https://`
   `proxyUrl`, an `https://` `cloud.url` and a non-empty `cloud.publishableKey`. Destinations
   must also be connected for the signed-in Snap Cloud user, or Share fails with `Connect
   <Provider> in the editor plugin`. → [setup](setup.md)
5. **Capture limits are enforced.** `capture.fps` must be 1–12 and `capture.maxSeconds` 1–15.
   Recording also stops at 32 MB of JPEG frames, and a clip needs at least 2 frames. Video
   formats need a video and the `photo` format needs a photo; mixing them fails. Reels, Stories,
   Shorts and Spotlight need portrait. → [components](components.md)
6. **Restart the Preview after editing the config.** The prefab reads the JSON once in
   `onAwake`. Panel changes in the Lens (switches, caption, format) are session-only. Save
   presets through the editor panel. → [setup](setup.md)
7. **Use the InteractionKit and UIKit declared in `package_dependencies.json`
   (+ Motion, Icons).** The panel code uses current UIKit APIs
   (`ElementContent.textAlignment`, `Switch.isOn` in `onFinished`). On older SIK / UIKit releases
   it doesn't compile. → [API status](api-status.md), [troubleshooting](troubleshooting.md)
8. **The panel is big: about 44 × 75 cm.** At 110 cm it fills the whole vertical field of view,
   so anything placed in front overlaps it. The prefab places the `Snap Cloud Social Media`
   child at (0, 6, −160); keep it that far, or narrow it with `panelWidth`. → [troubleshooting](troubleshooting.md)
9. **Camera + internet.** Recording requests the camera (`Right_Color` on device,
   `Default_Color` in the editor) and posts over `InternetModule`. On device that combination
   goes through Transparent Permission. Set `compositeTexture` to record AR content as well.
   → [components](components.md)

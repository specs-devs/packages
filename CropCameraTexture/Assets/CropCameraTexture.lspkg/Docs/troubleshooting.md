# CropCameraTexture troubleshooting

[← Agent usage index](../README.md)

## Use when

Diagnose setup, crop, placement and texture readiness issues.

| Symptom | Cause to check | Fix |
| --- | --- | --- |
| Setup failed log | Missing camModule/screenTexture or native camera failure | Keep the prefab bindings; read the logged stack |
| Camera feed exists but the crop panel stays blank or invisible | Older revisions assigned the feed only when the crop texture already had an input | Fixed in this revision. If you still see it, check that screenTexture is a Screen Crop Texture (its control must expose `inputTexture`) |
| getCameraTexture returns the original | Missing provider or an exception | Check the control type and wiring; don't assume any Texture is a crop provider |
| Getter returns undefined | Called before setup, after a setup failure, or while the object is disabled (initialize runs on the first Start after it's enabled) | Guard getOriginalCameraTexture; there's no public ready event |
| Crop inverted or empty | Boundaries out of order or out of range | Validate left/right/bottom/top in consumer code |
| Editing the Screen Crop Texture asset's crop has no effect | CameraTexture overwrites cropRect from cropLeft/Right/Bottom/Top on every frame | Change the CameraTexture inputs instead |
| Panel not visible or cut off | The prefab root is at local z −50. Parenting it under a raised or recentered root (e.g. a guidance panel's head-anchored group) can push it out of the ±18° vertical field of view | Place the instance about 100–120 cm in front of the user, near eye level; compensate in the scene instance's transform, not the prefab |
| Old scenes still show a blue "Modify the offset…" note | Stale prefab instance from a revision that shipped the instruction Text | Replace the instance with a fresh one from the prefab |
| Preview shows a grey room/grid instead of a camera picture | Interactive Preview feeds the simulated scene as Default_Color | Expected; check real camera output on Specs |
| Runtime crop changes not visible | No camera frame update, or the wrong Image/material | Check native frame availability and the authored Image output |
| Image looks stretched | Display rectangle/aspect doesn't match the crop | Adjust the consumer display layout; there's no automatic aspect lock |
| Resolution never adapts | The source picks a fixed value per platform | Implement a separate, measured performance policy if needed |
| Multiple callbacks | initialize called repeatedly | Let SnapDecorators bind initialization once |

The provider is reached through `any` casts; callers shouldn't copy those casts to bypass wiring errors. Native texture references are live, so keeping repeated references doesn't capture separate frames.

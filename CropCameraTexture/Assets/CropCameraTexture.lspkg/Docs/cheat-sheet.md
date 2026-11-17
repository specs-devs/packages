# CropCameraTexture cheat-sheet

[← Agent usage index](../README.md)

## Use when

Read first before wiring the crop output.

1. Wire camModule, screenTexture and uiImage; use the prefab's `Render/Screen Crop Texture` asset (a Screen Crop Texture, whose control is a RectCropTextureProvider). → [Components](components.md)
2. Initialization runs on Start via SnapDecorators, and only once the CameraTexture object is enabled. Getters return undefined before setup succeeds, even though they're typed as Texture. → [API status](api-status.md)
3. Keep left < right and bottom < top, within -1..1; nothing clamps or reorders the values. → [Examples](examples.md)
4. Full frame is -1,1,-1,1. Script defaults are ±0.2 (center region); the prefab instance overrides them to ±0.8. The asset's own serialized crop (±0.5) is overwritten on every frame. → [Components](components.md)
5. Both Preview and device request Default_Color. Resolution is picked once (352 in Preview, 756 on device) and never adapts. → [API status](api-status.md)
6. The camera feed is assigned to the crop texture even when its input is empty. A texture with no `inputTexture` field (not a crop texture) is skipped and the getter returns it unchanged. → [Troubleshooting](troubleshooting.md)
7. The prefab root sits at local z −50 and the Image at scale 17. Place the instance in front of the user, not at the origin, and keep it inside the field of view. → [Troubleshooting](troubleshooting.md)

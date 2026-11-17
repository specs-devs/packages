# CompositeCameraTexture examples

[← Agent usage index](../README.md)

## Use when

Use the ready prefab or reference the package component from your own script.

Drag `CompositeCameraTexture.lspkg/CompositeCameraTexture__PLACE_IN_SCENE.prefab` into the scene. Inspect the CameraService bindings and keep its render-texture assets. Check that `editorCamera` is the Camera that renders your Lens: CameraService assigns its render target to `Materials/ImageVC.mat` at start, so your Lens content reaches the composite. The CompositeImage panel appears 100 cm in front of the origin; disable or remove it if you only need `Render/CompositeImage.renderTarget`. The component initializes itself on Start; do not call start again from a consumer.

```typescript
import {CameraService} from "CompositeCameraTexture.lspkg/Scripts/CameraService"

@component
export class InspectCompositeCamera extends BaseScriptComponent {
  @input service: CameraService

  onAwake(): void {
    this.createEvent("OnStartEvent").bind(() => {
      print("Crop output texture: " + this.service.screenCropTexture)
    })
  }
}
```

The component exposes the crop Texture, not the requested camera feed. For per-frame processing, adapt CameraService's empty callback or create your own native camera request using the [guide](guide.md).

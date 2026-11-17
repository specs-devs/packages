# CropCameraTexture examples

[← Agent usage index](../README.md)

## Use when

Adapt crop bounds from a consumer while keeping package initialization intact.

Drag `CropCameraTexture.lspkg/CropCameraTexture__PLACE_IN_SCENE.prefab` into your scene. Wire a consumer to its CameraTexture component.

```typescript
import {CameraTexture} from "CropCameraTexture.lspkg/Scripts/CameraTexture"

@component
export class CentralCameraCrop extends BaseScriptComponent {
  @input cameraTexture: CameraTexture

  onAwake(): void {
    this.cameraTexture.cropLeft = -0.5
    this.cameraTexture.cropRight = 0.5
    this.cameraTexture.cropBottom = -0.5
    this.cameraTexture.cropTop = 0.5
    this.createEvent("UpdateEvent").bind(() => {
      if (!this.cameraTexture.getOriginalCameraTexture()) return
      const cropped = this.cameraTexture.getCameraTexture()
      // Consume this live texture after camera setup succeeds.
    })
  }
}
```

Bounds can change at runtime; the package's onNewFrame handler refreshes its Image using the latest values. This snippet avoids assuming same-frame Start ordering or exposing a nonexistent readiness event.

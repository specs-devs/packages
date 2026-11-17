# NDK Capture — examples

Prefab: `NDKCapture.lspkg/NDKCapture__PLACE_IN_SCENE.prefab`.

## Change a layer from your own script

```typescript
import {NDKCapture} from "NDKCapture.lspkg/Scripts/NDKCapture"

@component
export class FadeArOnTap extends BaseScriptComponent {
  @input capture: NDKCapture

  onAwake(): void {
    this.createEvent("TapEvent").bind(() => {
      const ar = this.capture.getLayer("ar")
      this.capture.setLayer("ar", {opacity: ar.opacity > 0.5 ? 0.3 : 1})
    })
  }
}
```

## Record a take with markers

```typescript
import {NDKCapture} from "NDKCapture.lspkg/Scripts/NDKCapture"

@component
export class TenSecondTake extends BaseScriptComponent {
  @input capture: NDKCapture

  onAwake(): void {
    this.createEvent("OnStartEvent").bind(() => {
      this.capture.startRecording("Take 1")
      const mark = this.createEvent("DelayedCallbackEvent")
      mark.bind(() => this.capture.addMarker("Halfway"))
      mark.reset(5)
      const stop = this.createEvent("DelayedCallbackEvent")
      stop.bind(() => this.capture.stopRecording())
      stop.reset(10)
    })
  }
}
```

## Higher-quality camera layer on Specs

```typescript
// A bitrate selects CBR (with 0 the SDK default, constant QP, ignores bitrate).
this.capture.setLayer("camera", {bitrate: 8000000, keyFrameInterval: 60})
```

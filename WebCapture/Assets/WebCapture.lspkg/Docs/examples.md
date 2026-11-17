# WebCapture examples

[← Agent usage index](../README.md)

## Use when

Read when you need working code: the prefab path and minimal, compile-correct snippets.

## Prefab

Drag `WebCapture.lspkg/WebCapture__PLACE_IN_SCENE.prefab` into the scene. It records the three demo
shapes for 10 s after the guide is dismissed. For your own Lens, delete `Guide`, `ExampleCarousel`
and `WebCaptureDemo` and point **Capture Origin** at your content's root.

## Record a moment from code

```typescript
import {WebCapture} from "WebCapture.lspkg/Scripts/WebCapture"

@component
export class CaptureTheThrow extends BaseScriptComponent {
  @input capture: WebCapture

  // Call when the interesting part starts (set Record On Start off on WebCapture).
  begin(): void {
    this.capture.startRecording("Throw " + new Date().toISOString())
  }

  // Call when it ends: saves to the plugin and/or Snap Cloud.
  async end(): Promise<void> {
    this.capture.mark("landed")
    const recording = await this.capture.stopRecording()
    if (recording) print("Saved " + recording.meta.duration.toFixed(1) + " s, " + recording.objects.length + " objects")
  }
}
```

## Capture objects created at runtime

```typescript
import {WebCaptureTarget} from "WebCapture.lspkg/Scripts/WebCaptureTarget"

@component
export class SpawnCaptured extends BaseScriptComponent {
  @input prefab: ObjectPrefab

  spawn(index: number): SceneObject {
    const obj = this.prefab.instantiate(this.getSceneObject())
    const target = obj.createComponent(WebCaptureTarget.getTypeName()) as WebCaptureTarget
    target.targetId = "ball-" + index // stable, unique id
    target.primitive = "sphere"
    return obj
  }
}
```

`WebCapture` refreshes its object list every second, so new targets join the live view and the
running recording within a second.

## React to saves

```typescript
import {WebCapture} from "WebCapture.lspkg/Scripts/WebCapture"

@component
export class SaveNotice extends BaseScriptComponent {
  @input capture: WebCapture
  @input label: Text

  onAwake(): void {
    this.capture.onRecordingSaved((recording, saved) => {
      this.label.text = "Saved to " + saved.map((s) => s.transport).join(" + ")
    })
  }
}
```

## Read a recording outside the portal

Recordings are plain JSON (see [protocol](protocol.md)). Sampling an object at time `t`:

```javascript
import { normalizeRecording, frameAt } from "./WebCapturePortal/src/model.js"
const rec = normalizeRecording(JSON.parse(fs.readFileSync("WebCaptureRecordings/demo.webcapture.json", "utf8")))
const frame = frameAt(rec, 2.5) // {objects: [{id, pose, visible, color, …}], camera}
```

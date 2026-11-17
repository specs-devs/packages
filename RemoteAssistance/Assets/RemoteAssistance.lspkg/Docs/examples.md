# RemoteAssistance examples

[← Agent usage index](../README.md)

## Use when

Use minimal typed consumers instead of private manager methods.

## Prefab setup

Import companions and place [RemoteAssistance__PLACE_IN_SCENE.prefab](../RemoteAssistance__PLACE_IN_SCENE.prefab), then assign SupabaseProject (Window > Supabase > Import Credentials, then the SupabaseProject input on the `SnapCloudRequirements` object). Until it is assigned, SnapCloud features are off and a red "Credentials needed" panel shows before the guide. The demo flow runs through the runtime START CALL button; manager call methods are private. `simulateInPreview=true` produces local strokes after call start even without a working native device module. This is local drawing simulation, not a browser call.

## Parse a helper stroke without a network

```typescript
import {parseStrokePayload, parseClearPayload} from "RemoteAssistance.lspkg/Scripts/Drawing/AnnotationTypes"
const stroke = parseStrokePayload(JSON.stringify({id: "local-1", ar: 4 / 3, done: true, pts: [0.4, 0.5, 0.6, 0.5]}))
if (stroke !== null) print("parsed " + stroke.id + " with " + stroke.pts.length / 2 + " points")
const clear = parseClearPayload('{"id":"local-1"}')
print("clear " + (clear.id || "all"))
```

## Consume a configured renderer

Attach this consumer and assign the prefab renderer. OnStart ensures its Awake pose sampler already exists; first-frame pose fallback remains valid.

```typescript
import {AnnotationRenderer} from "RemoteAssistance.lspkg/Scripts/Drawing/AnnotationRenderer"
@component
export class LocalAnnotation extends BaseScriptComponent {
  @input renderer!: AnnotationRenderer
  onAwake(): void {
    this.createEvent("OnStartEvent").bind(() => {
      this.renderer.applyStroke({id: "local-example", ar: 4 / 3, pts: [0.4, 0.5, 0.6, 0.5], done: true})
      print(this.renderer.statusLine())
    })
  }
}
```

This emits world-space mesh vertices; preserve identity parent transform. Call `clearStroke("local-example")` or `clearAll()` to remove it.

## Observe an existing menu component

Use this only with a ModeMenuUI handle you own. The manager creates its menu internally; it exposes no Inspector handle to that runtime component.

```typescript
import {ModeMenuUI} from "RemoteAssistance.lspkg/Scripts/App/ModeMenuUI"
@component
export class MenuObserver extends BaseScriptComponent {
  @input menu!: ModeMenuUI
  onAwake(): void {
    this.createEvent("OnStartEvent").bind(() => {
      this.menu.onStartCall.add(() => print("helper-call menu triggered"))
    })
  }
}
```

Listener observes the event and does not initiate networking by itself. No `as any`, private-method access, placeholder credentials or native mock declarations are used.

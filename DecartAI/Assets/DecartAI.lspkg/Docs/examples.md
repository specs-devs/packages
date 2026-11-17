# DecartAI examples

[← Agent usage index](../README.md)

## Use when

Read for small source-aligned integrations that do not start a network session automatically.

## Prefab entry point

Instantiate `DecartAI.lspkg/DecartAI__PLACE_IN_SCENE.prefab`, then audit the rig's external camera input. See [setup](setup.md#prefab-wiring). The prefab carries its own head-locked display, guide and carousel, but not a camera. Native standalone smoke test should live in a separate scene from the main engine.

## Bind and update the existing engine

This component expects an existing, correctly wired engine ScriptComponent. It changes a prompt and display only; it deliberately does not call startLoop.

```typescript
import {DecartRealtimeRestyle} from "DecartAI.lspkg/Scripts/DecartRealtimeRestyle";

@component
export class DecartDisplayPreset extends BaseScriptComponent {
  @input engine: DecartRealtimeRestyle;

  onAwake(): void {
    this.createEvent("OnStartEvent").bind(() => {
      this.engine.setPrompt("Restyle as watercolor while preserving subjects and motion.");
      this.engine.setDisplayZoom(1.6);
      this.engine.setDisplayOffsetX(0);
      this.engine.setDisplayOffsetY(0);
      print("Loop requested: " + this.engine.isRunning());
    });
  }
}
```

Starting transport requires configured environment/credentials and explicit application intent. Stop through the runtime controls before editing/resetting an active HTTP loop; `isRunning()` is not proof of a connection.

## Check placeholder configuration locally

This performs no auth/backend request. A true result only means the string passes the package's local predicate.

```typescript
import {DecartRequirements, DECART_API_KEY_PLACEHOLDER} from "DecartAI.lspkg/Scripts/DecartRequirements";

export function hasConfiguredDecartKey(value: string | undefined): boolean {
  return value !== DECART_API_KEY_PLACEHOLDER && DecartRequirements.isRealKey(value);
}
```

## Interpret native frame metadata without loading native code

```typescript
import {DecartWebRTCState, type DecartWebRTCFrameRGBA} from "DecartAI.lspkg/Scripts/DecartWebRTCNativeModule";

export function isUsableDecartFrame(frame: DecartWebRTCFrameRGBA): boolean {
  return frame.width > 0 && frame.height > 0 &&
    frame.buffer.byteLength >= frame.width * frame.height * 4;
}

export function isConnectedState(state: number): boolean {
  return state === DecartWebRTCState.Connected || state === DecartWebRTCState.Streaming;
}
```

Even connected state or a usable gradient does not prove transformed remote frames. Check native media and live Decart independently when authorized.

## Verification status

These snippets are static type-check targets against the installed Lens Studio ambient declarations and the package source. They are not runtime/transport/device tests. No credentials, backend startup or billing session is included.

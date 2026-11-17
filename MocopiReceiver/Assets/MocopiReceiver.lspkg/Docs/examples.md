# MocopiReceiver examples

[← Agent usage index](../README.md)

## Use when

Place the wired demo or add typed observation without replacing its runtime routing. Snippets require package/dependency declarations; static compilation does not prove a relay connection.

## Prefab setup

Add SurfacePlacement and SIK setup required by your installed companion packages, then drag `MocopiReceiver.lspkg/MocopiReceiver__PLACE_IN_SCENE.prefab` into the scene. It wires PrefabPlacement (Horizontal mode=1), objectVisuals, avatar prefab and a CapsuleButton reset callback. It also contains the onboarding guide and the `ExampleCarousel` panel (scripts in `Example/`), so the demo runs as soon as the prefab is in the scene.

The basic avatar prefab contains Main, WebSocket and Avatar components. Main references the two others. Configure the WebSocket serverUrl before use: its serialized instructional text is not valid. Placement instantiates under objectVisuals at local origin/identity rotation/unit scale and then assigns prefabPlacement to the avatar helper. Avatar Awake therefore logs `Initialized, waiting for PrefabPlacement to assign itself`, which is expected; successful skeleton initialization must still be verified after placement.

## Connection status observer

```typescript
import {MocopiMainController} from "MocopiReceiver.lspkg/Scripts/MocopiMainController";

@component
export class MocopiStatus extends BaseScriptComponent {
  @input main: MocopiMainController;
  @input status: Text;

  onAwake(): void {
    this.createEvent("UpdateEvent").bind(() => {
      const stats = this.main.getConnectionStats();
      this.status.text = stats
        ? `${stats.connected ? "Connected" : "Disconnected"} · ${stats.framesReceived} frames`
        : "Assign WebSocket client";
    });
  }
}
```

## Observe frame receipt

```typescript
import {MocopiWebSocketClient} from "MocopiReceiver.lspkg/Scripts/MocopiWebSocketClient";
import {FrameData} from "MocopiReceiver.lspkg/Scripts/MocopiDataTypes";

@component
export class ObserveMocopiFrames extends BaseScriptComponent {
  @input client: MocopiWebSocketClient;

  onAwake(): void {
    this.createEvent("OnStartEvent").bind(() => {
      const previous = this.client.onFrameReceived;
      this.client.onFrameReceived = (frame: FrameData) => {
        if (previous) previous(frame);
        if (frame.frame_id % 50 === 0) print(`Observed frame ${frame.frame_id}`);
      };
    });
  }
}
```

Main's Awake installs callbacks; this Start wrapper preserves its route. There is one callback slot, not `.add()`/`.remove()` subscription API. Arrange teardown/ownership in your consumer and avoid replacing the slot again later.

## Relay protocol

On WebSocket open the client sends JSON `{type:"request_skeleton"}`. Relay replies with SkeletonDefinition; subsequent FrameData drives the avatar. `sendPing()` sends `{type:"ping"}` and `pong` is logged without public callback. Text and UTF-8 JSON Blob are accepted; other data types are ignored. Protocol shapes are listed in [Components](components.md#mocopidatatypes). See original [network guide](guide.md#network-setup) and bundled Python relay folders; no relay availability or deployment is assumed.

# ARKitSpectator examples

[← Agent usage index](../README.md)

## Use when

Read when wiring the package from script. These are minimal, package-only snippets; scene
structure and UI belong to the calling workflow.

## No-code path

1. Drag `ARKitSpectator.lspkg/ARKitSpectator__PLACE_IN_SCENE.prefab` into the scene and assign
   **Supabase Project** on its `SnapCloudRequirements` child.
2. Parent the objects to stream under `SpectatorDemo` (the stage origin; delete the three demo
   objects, the `Guide` and the `ExampleCarousel` for your own Lens), and add a
   `SpectatorEntity` to each one. Set **Entity Id**, and optionally **Asset Url** / **Primitive** /
   **Color** / **Loop Clip**.

## React to the room code

```typescript
import {ARKitSpectator} from "ARKitSpectator.lspkg/Scripts/ARKitSpectator"

@component
export class ShowSpectatorCode extends BaseScriptComponent {
  @input spectator: ARKitSpectator
  @input label: Text

  onAwake(): void {
    this.createEvent("OnStartEvent").bind(() => {
      this.spectator.onRoomReady((code) => (this.label.text = "Watch on iPhone: " + code))
      this.spectator.onRoomClosed(() => (this.label.text = "Spectating off"))
    })
  }
}
```

## Manual room control and room data

```typescript
import {ARKitSpectator} from "ARKitSpectator.lspkg/Scripts/ARKitSpectator"

@component
export class SpectatorRound extends BaseScriptComponent {
  @input spectator: ARKitSpectator // set Auto Create Room = false on it

  async startRound(round: number): Promise<void> {
    this.spectator.setRoomData({round})
    const code = await this.spectator.createRoom()
    if (!code) print("Spectator room failed: " + this.spectator.status)
  }

  async endRound(): Promise<void> {
    await this.spectator.closeRoom()
  }
}
```

## Clips and per-object data

```typescript
import {SpectatorEntity} from "ARKitSpectator.lspkg/Scripts/SpectatorEntity"

@component
export class RobotSpectatorState extends BaseScriptComponent {
  @input entity: SpectatorEntity // on the robot; Asset Url = models/robot.glb

  onHit(health: number): void {
    this.entity.setData({hp: health})
    this.entity.playClip("Hit")          // one-shot; calling again replays it
    if (health <= 0) this.entity.playClip("Defeat", true) // loop from now on
  }
}
```

## Inspect what would be sent

```typescript
import {validateState} from "ARKitSpectator.lspkg/Scripts/SpectatorProtocol"

const state = spectator.buildState()
print(state.entities.length + " entities, problem: " + (validateState(state) ?? "none"))
```

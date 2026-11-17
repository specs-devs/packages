# SnapCloudConnected examples

[← Agent usage index](../README.md)

## Use when

You need a working starting point: the prefab, your own lobby UI, or objects registered from code.

## Prefab (no code)

1. Drag `SnapCloudConnected.lspkg/SnapCloudConnected__PLACE_IN_SCENE.prefab` into the scene, next to the SIK prefab.
2. Assign your `SupabaseProject` on the `SnapCloudRequirements` child of the prefab. Until you do, a red "Credentials needed" panel shows before the guide.
3. Add your content under `Origin`, then add those objects to a `SyncedTransforms` component on `SnapCloudConnectedDemo` (or add more `SyncedTransforms` components with their own Sync Id and owner). The demo ships three: the host, guest and shared cubes.
4. Give grabbable objects SIK `Interactable` and `InteractableManipulation` components, plus a collider.

## Your own lobby UI

```typescript
import {ConnectedState, SnapCloudConnected} from "SnapCloudConnected.lspkg/Scripts/SnapCloudConnected"

@component
export class MyLobby extends BaseScriptComponent {
  @input connected: SnapCloudConnected
  @input label: Text

  onAwake(): void {
    this.connected.onStatusChanged.add((status) => (this.label.text = status))
    this.connected.onStateChanged.add((state) => {
      if (state === ConnectedState.Confirm) this.connected.confirmReady()
    })
  }

  hostGame(): void {
    this.connected.host()
  }

  joinGame(code: string): void {
    this.connected.join(code) // "0427": exactly 4 digits
  }
}
```

## Registering objects from code

```typescript
import {OWNER_ANYONE, SnapCloudConnected} from "SnapCloudConnected.lspkg/Scripts/SnapCloudConnected"

// The id must be identical on every device.
const session = SnapCloudConnected.getInstance()
session.registerObject("ball", ballObject, OWNER_ANYONE) // 0 = host only, 1 = player 2 only, ...
```

## Per-player objects

Use one `SyncedTransforms` per owner, for example `HostCube` (owner Player 1) and `GuestCube` (owner Player 2). Each player moves its own cube and sees the other player's cube follow.

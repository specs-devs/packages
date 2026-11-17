# VideoCallS2M examples

[← Agent usage index](../README.md)

## Use when

Place the package entry prefab or consume its actual helper/event APIs from project-owned code.

## Entry prefab

Use `VideoCallS2M.lspkg/VideoCallS2M__PLACE_IN_SCENE.prefab`. It brings its own guide and example carousel (scripts in `Example/`); the `Video Call S2M` group contains Core/manager, PhoneLink · Mobile Kit, optional Snap Cloud, WebRTC/Stream controller and FriendMarkerUI objects. Manager resolves typed module inputs on Start and builds runtime mode UI; it has no public mode-start/hangup API. Review retained guide/tool nodes before shipping your experience.

## Geolocation formatting without a phone session

This pure helper uses exact public import paths and accepts coordinates supplied by your application. It does not establish camera/device location or friend connectivity.

```typescript
import {haversineMeters, formatFeetMiles} from "VideoCallS2M.lspkg/Scripts/Geolocation/GeoMath"

export function formatFriendDistance(
  selfLat: number, selfLon: number, friendLat: number, friendLon: number
): string {
  return formatFeetMiles(haversineMeters(selfLat, selfLon, friendLat, friendLon))
}
```

## Observe the required phone link

Wire module to the MobileKitModule component from the prefab. Subscribe on Start, when typed module methods are available. The manager already starts the shared link; do not construct a second Mobile Kit module or independently start competing sessions.

```typescript
import {MobileKitModule} from "VideoCallS2M.lspkg/Scripts/MobileKit/MobileKitModule"

@component
export class ObserveFriendFix extends BaseScriptComponent {
  @input module: MobileKitModule

  onAwake(): void {
    this.createEvent("OnStartEvent").bind(() => {
      this.module.getLink().onFriendFix.add((fix) => {
        print("Friend latitude: " + fix.lat)
      })
    })
  }
}
```

PublicApi callbacks use add; low-level helper callbacks such as onFriendVideoTexture/onTexture are nullable function properties assigned before start. Their texture-ready callback is not evidence of a network connection unless real decoded device frames and corresponding status are observed. Stop resources you own; do not stop the manager-owned shared link from an observer.

## Editor versus device recipe

Editor: with simulateInPreview true, select Find Friend and review explicitly fake GPS; select Watch Your Back and verify the animated test pattern at two timestamps. Call Friend media cannot run without native modules.

Device: configure phone/credentials/signaling, then verify real own-phone rear-camera Watch Your Back and friend-camera/two-way-voice Call Friend. [Setup](setup.md) separates native loading, signaling readiness and media readiness.

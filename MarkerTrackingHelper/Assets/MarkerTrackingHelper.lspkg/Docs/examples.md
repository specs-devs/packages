# MarkerTrackingHelper minimal examples

[← Agent usage index](../README.md)

## Use when

You need the smallest working setup. Choosing between the prefabs, and
multi-marker setups, are in [guide](guide.md).

## Prefab (no code)

1. Make sure the scene has a root Camera. For the Extended prefab, add
   `Device Tracking` on it set to **World**. (Specs projects normally already
   have this.)
2. Drag one of the three marker prefabs
   (`MarkerTrackingHelper_Simple__PLACE_IN_SCENE.prefab`,
   `MarkerTrackingHelper_ResizableWithCallbacks__PLACE_IN_SCENE.prefab`,
   `MarkerTrackingHelper_Extended__PLACE_IN_SCENE.prefab`) into the scene **root**.
   You don't need to parent it under the camera; it does that itself at awake.
   For the full demo with guide and carousel, drag
   `MarkerTrackingHelper__PLACE_IN_SCENE.prefab` instead.
3. Preview: set the input media to Lens Studio's built-in **Image Marker** image
   or video, and point the view at it.

## Use your own marker

1. Select `MarkerTrackingHelper.lspkg/Image Marker [EDIT_ME].imgmarker` (or
   create a new Image Marker asset). Set its texture to your image and its
   height to the printed height in cm.
2. If you created a new asset, assign it to the prefab instance's
   `MarkerTrackingComponent` → `Marker`.
3. Replace the content under the `MarkerTrackingComponent` object with yours.
   For the Resizable prefab, author objects at unit size and list them in
   `resizeObjectArray`.

## Found / lost callback script

```typescript
import {MarkerCallbacks} from "MarkerTrackingHelper.lspkg/Scripts/MarkerCallback";

@component
export class MarkerReactions extends BaseScriptComponent {
  @input info: Text;
  @input @allowUndefined thankYou: MarkerCallbacks; // optional: keep the prefab's animation

  // Called by ImageTrackingController with `true` on found (`false` on lost)
  public showInfo(_found: boolean) {
    this.info.text = "Marker found";
    if (this.thankYou) this.thankYou.onMarkerFound();
  }

  public hideInfo(_lost: boolean) {
    this.info.text = "";
  }
}
```

On the Resizable prefab's `ImageTrackingController`, keep `Edit Event Callbacks`
on. Then set `Custom Function Script` = the `MarkerReactions` component,
`On Marker Found Function Names` = `["showInfo"]` and
`On Marker Lost Function Names` = `["hideInfo"]`. The controller calls one
script, so forward to `MarkerCallbacks` (as above) to keep the animation.

## React once the Extended prefab has anchored

```typescript
@component
export class AnchoredWatcher extends BaseScriptComponent {
  @input tracker: MarkerTrackingComponent; // the Extended prefab's tracker

  private done = false;

  onAwake() {
    this.createEvent("UpdateEvent").bind(() => {
      // ExtendMarkerTrackingController disables the tracker 0.5 s after the first detection.
      if (!this.done && !this.tracker.enabled) {
        this.done = true;
        print("content anchored in the world");
      }
    });
  }
}
```

`MarkerTrackingComponent` members (`enabled`, `isTracking()`, `marker`) come
from the Lens Studio API (`StudioLib.d.ts`), not from this package.

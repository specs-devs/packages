# MarkerTrackingHelper guide and recipes

[← Agent usage index](../README.md)

## Use when

You need to choose between the three prefabs, understand how each one behaves,
or set up several markers. This guide replaces the older README's "Script
Highlights" and "Advanced Usage". Those sections described APIs (multi-marker
state tracking, `validateWorldTracking`, scripted `createComponent` setup) that
this revision doesn't have.

## Choosing a prefab

| You want | Prefab | Script |
|---|---|---|
| Content that rides on the marker while it is visible | Simple | `SimpleImageTracking` |
| Content sized to the marker, with found/lost reactions | Resizable … with Callbacks | `ImageTrackingController` (+ `MarkerCallbacks`) |
| Content that is placed by the marker and then stays in the world | Extended | `ExtendMarkerTrackingController` |

## How each one behaves

- **Simple**: the rig object moves under the camera at awake. The Lens Studio
  `MarkerTrackingComponent` then drives its children onto the marker. Content
  sizes are your own (the demo cube is 10 cm).
- **Resizable with callbacks**: at start, every object in `resizeObjectArray`
  is scaled to the marker's real size: height = marker height, width = height ×
  the marker image's aspect ratio. Author them as unit squares. On found/lost,
  the controller calls the listed function names on one script. The demo calls
  `MarkerCallbacks.onMarkerFound()`, which plays the "thank you" animated
  texture once.
- **Extended**: requires World device tracking. On the first detection it
  waits 0.5 s so the pose can settle. Then it moves `parentObject` (the prefab
  root) to a new scene-root object, keeping its world pose, and disables the
  tracker. From then on, the content is world-anchored where the marker was.

## Recipe: several markers

Use **one prefab instance per marker**. Give each instance's
`MarkerTrackingComponent` its own Image Marker asset (texture + height) and its
own content. Two controllers on one `MarkerTrackingComponent` both fire (they
chain their handlers), but each detaches or resizes the same content, so keep
one controller per tracker. From your own scripts, subscribe with
`Utils.addMarkerFoundHandler` / `addMarkerLostHandler`; a plain
`onMarkerFound = …` assignment replaces every earlier handler.

```
Scene root
├── Camera (DeviceTracking: World)
├── Poster_A  ← Resizable prefab, Marker = PosterA.imgmarker, callbacks → PosterAReactions
└── Poster_B  ← Resizable prefab, Marker = PosterB.imgmarker, callbacks → PosterBReactions
```

## Recipe: place once, then let the user re-scan

Start from the Extended prefab. To allow a new placement, re-parent the
content back under the tracker and re-enable it:

```typescript
@component
export class Rescan extends BaseScriptComponent {
  @input rig: SceneObject;                 // the Extended prefab root (its parentObject)
  @input tracker: MarkerTrackingComponent; // its MarkerTrackingComponent
  @input camera: SceneObject;              // the root camera

  private pos: vec3;
  private rot: quat;
  private scale: vec3;

  onAwake() {
    // The controller has already parented the rig under the camera in its onAwake;
    // remember that local pose so a re-scan restores the original rig layout.
    this.createEvent("OnStartEvent").bind(() => {
      const t = this.rig.getTransform();
      this.pos = t.getLocalPosition();
      this.rot = t.getLocalRotation();
      this.scale = t.getLocalScale();
    });
  }

  rescan() {
    this.rig.setParent(this.camera);
    const t = this.rig.getTransform();
    t.setLocalPosition(this.pos);
    t.setLocalRotation(this.rot);
    t.setLocalScale(this.scale);
    this.tracker.enabled = true; // the controller's onMarkerFound handler is still assigned
  }
}
```

Every detection reuses the same scene-root `NewParent` object, so re-scanning
doesn't pile up objects.

## Tips

- Print the marker at the height set in the asset. A wrong height makes the
  content and the Resizable scaling wrong by the same factor.
- High-contrast, detailed images track best. The default marker is the same
  image as Lens Studio's built-in "Image Marker" Preview media, which makes
  testing in Preview easy.

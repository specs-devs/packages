# FaceMesh cheat-sheet

[← Agent usage index](../README.md)

## Use when

Read first before adapting the native face prefab or a transform follower.

1. Keep exactly one main camera, and it needs a DeviceTracking component (World): the prefab's `Camera` child is that camera. If your scene already has a camera, unpack the prefab, move DeviceTracking, AmbientLight and Effects onto yours and delete the prefab's `Camera`. InteractionKit throws "Your main camera is currently missing a 'Device Tracking Component'" otherwise. → [Troubleshooting](troubleshooting.md)
2. The face shader is lit PBR: keep the `AmbientLight` (or another light on the mesh's layer). Unlit, the mesh renders black, and black is invisible on Specs. → [Components](components.md)
3. Never disable the prefab root or its `Camera` to hide the effect: that turns the camera off. Toggle `Effects` (or `Head Binding`) instead. → [Troubleshooting](troubleshooting.md)
4. Import MatchTransformTS from `FaceMesh.lspkg/Scripts/MatchTransform`, not a class-named file; create it with `createComponent(MatchTransformTS.getTypeName())`. → [Components](components.md)
5. Assign `target` explicitly; the mainCamera Inspector hint does not implement a fallback. → [Troubleshooting](troubleshooting.md)
6. positionOffset is added in world axes, not rotated with the target. → [Components](components.md)
7. Setting a constrain flag true preserves that current axis; it does not zero it. → [Examples](examples.md)
8. Position/rotation use world transforms, but scale reads target world scale and writes follower local scale. Avoid nonidentity parent scale until tested. → [API status](api-status.md)
9. usePositionLerp=false makes position immediate; rotation/scale still lerp. → [Guide](guide.md)

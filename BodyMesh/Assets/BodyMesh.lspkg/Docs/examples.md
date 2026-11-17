# BodyMesh examples

[← Agent usage index](../README.md)

## Use when

Place the full setup or inspect the configured native tracker from a project script.

## Prefab recipe

Drag `BodyMesh.lspkg/BodyMesh__PLACE_IN_SCENE.prefab` into the scene. Its included Camera already has World DeviceTracking and the `Effects` → `3D Body Tracking` → `Body Mesh` hierarchy described in [components](components.md#native-setup).

If your project already has the rendering camera you need, unpack the instance, move the `Effects` hierarchy beneath that compatible camera, and remove the unused included Camera. The native ObjectTracking3D does not have a package-defined “assign camera” input: preserving the intended hierarchy and camera configuration is the setup operation.

Keep the supplied tracker index and body mesh index at 0 for the provided single-body setup. Point camera input at a person whose head, hands, and feet are visible. For editor checks, choose a full-body recorded source; an interactive room without a camera-observed person cannot establish body tracking.

## Read native tracking state

Create this project-owned component outside `BodyMesh.lspkg`, then wire `tracking` to the native ObjectTracking3D on `3D Body Tracking`. This uses built-in Lens runtime types and adds no BodyMesh import. It logs the initial state; it does not create tracking or certify acquisition later in the session.

```typescript
@component
export class BodyMeshState extends BaseScriptComponent {
  @input tracking: ObjectTracking3D

  onAwake(): void {
    this.createEvent("OnStartEvent").bind(() => {
      print("Body index: " + this.tracking.objectIndex)
      print("Tracking now: " + this.tracking.isTracking())
    })
  }
}
```

To monitor acquisition/loss, poll the same native `isTracking()` state at appropriate times in your project logic. The package does not ship a tracking callback manager.

## Attach an accessory to a configured label

Wire `tracking` to the same native component and `accessory` to your own SceneObject. `Head` is an exact configured label from this package's tracking asset. This snippet uses the native attachment API; it does not add an accessory asset to the package.

```typescript
@component
export class BodyMeshHeadAccessory extends BaseScriptComponent {
  @input tracking: ObjectTracking3D
  @input accessory: SceneObject

  onAwake(): void {
    this.createEvent("OnStartEvent").bind(() => {
      this.tracking.addAttachmentPoint("Head", this.accessory)
    })
  }
}
```

Check alignment and visibility while the person moves and while tracking is lost. The provided prefab has no accessories already attached.

## Historical requirements note

The previous README listed a minimum Lens Studio version and a Specs device or simulator with body tracking support. Those historical requirements were prose, not a compatibility guarantee encoded by the current descriptor. Keep a camera in the scene and validate on the intended hardware; this documentation does not establish a tested minimum editor or device matrix.

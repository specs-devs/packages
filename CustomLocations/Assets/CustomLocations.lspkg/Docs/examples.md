# CustomLocations examples

[← Agent usage index](../README.md)

## Use when

Implement a listener or inspect the provided scene. These snippets use current package import paths and no `as any`; they passed static TypeScript compilation against the Lens Studio declarations. Runtime localization is still device-dependent.

## Custom listener

```typescript
import {LocatedObject} from "CustomLocations.lspkg/Scripts/LocatedObject";

@component
export class SpawnOnArrival extends BaseScriptComponent implements LocatedObject {
  @input prefab: ObjectPrefab;
  private instance: SceneObject | null = null;

  activate(): void {
    this.instance ??= this.prefab.instantiate(this.getSceneObject());
    this.instance.enabled = true;
  }

  deactivate(): void {
    if (this.instance) this.instance.enabled = false;
  }

  localize(): void {
    print("Scan found for the first time");
  }
}
```

Add the ScriptComponent to the activator's `listenerObjects`. Initialization belongs in the component's lifecycle, not exclusively in `localize()`, because Editor simulation and force activation can call `activate()` without calling `localize()` first.

## Observe activation state

```typescript
import {ActivateWhenInCameraView} from "CustomLocations.lspkg/Scripts/ActivateWhenInCameraView";

@component
export class ObserveLocationState extends BaseScriptComponent {
  @input activator: ActivateWhenInCameraView;

  onAwake(): void {
    this.createEvent("OnStartEvent").bind(() => {
      print(`Localized: ${this.activator.isLocalized}`);
      print(`Active: ${this.activator.isActivated}`);
    });
  }
}
```

The package exposes getters, not public state-change events. Subscribe to the native Located At events when actual tracking transitions matter; read the package active getter to inspect content activation separately.

## Toggle collected scan visuals

```typescript
import {DeactivateLocationMeshOnDevice} from "CustomLocations.lspkg/Scripts/DeactivateLocationMeshOnDevice";

@component
export class ShowScansForDebug extends BaseScriptComponent {
  @input visibility: DeactivateLocationMeshOnDevice;

  onAwake(): void {
    this.createEvent("UpdateEvent").bind(() => {
      if (this.visibility.locationMeshVisuals.length > 0) {
        this.visibility.setMeshesVisible(true);
        this.enabled = false;
      }
    });
  }
}
```

This waits until the helper has collected meshes on Start. Showing these visuals does not change native localization. Avoid permanently exposing scan meshes in the final device experience without a deliberate debug control.

## Own location setup

1. Create/publish your scans and group using the Custom Locations tooling described in the original [Guide](guide.md).
2. Add native `CustomLocationGroupComponent` on a root, configure GroupId and load its scans through Lens Studio. Keep scan children and their transforms aligned with that group.
3. Add `DeactivateLocationMeshOnDevice` on that root; it discovers one RenderMeshVisual on each immediate child with a Located At component.
4. On each Located At child add `ActivateWhenInCameraView`, wire camera and optional center, add scale/audio/custom listener components, and assign those components in `listenerObjects`.
5. For ScaleIn, assign content whose initial local scale is positive and uniform. For Audio, assign an AudioComponent or place the listener on the same object as one.
6. If using the example panel, add `CustomLocationsExamplesPanel` on a separate SceneObject and set `locationGroup` to the group root. Assign camera explicitly to avoid arbitrary first-camera fallback.

## Sample scene and prefabs

The project's `Assets/Scene.scene` has `Custom Locations` (the group SceneObject) with GroupId `JEHNXBBZ6JA9` and three immediate scan children. Each has native Located At, scan RenderMeshVisual, activation, scale and audio helpers. The whole demo (group, status panel, guide and carousel) ships as `CustomLocations__PLACE_IN_SCENE.prefab` at the package root; the demo scene holds one instance of it next to the Camera, lighting and SIK.

| Scan ID | Sample child/content |
|---|---|
| `CH7JMKLVUSXV` | `Child CH7JMKLVUSXV` with Kitty |
| `H3X56VS2BCQ3` | `Child H3X56VS2BCQ3` with RedPanda |
| `W79DULBVS9HS` | `Child W79DULBVS9HS` with Fox |

Individual reusable assets are `Examples/Models/Kitty/Kitty__ADD_TO_SCENE.prefab`, `Examples/Models/Red Panda/RedPanda__ADD_TO_SCENE.prefab`, `Examples/Models/DreamyFox/Dreamy Fox__ADD_TO_SCENE.prefab` and `Examples/Audio/GlitterSFX__PLACE_IN_OBJECTS_PANEL.prefab`. Model prefabs include autoplay looping IDLE animation; their optional action/sleep/fly clips start disabled. They do not contain activation listeners themselves; scene wiring provides those.

Inside the prefab, `Guide` and `ExampleCarousel` (scripts in `Example/`) wrap the whole `Custom Locations` group as one step with `anchorExamples = false`, so the scans keep their alignment. The prefab also has a `CustomLocations Status Panel` (this component, `locationGroup` = the group object) for Preview testing. See [components](components.md#demo-scaffolding-example).

## Preview versus device

Editor simulation can exercise distance/frustum activation and listener animation, but cannot prove the three scans track. The sample centers/content are meters apart in scan-local coordinates; camera movement or deliberate debug actions are needed. Real tracking, first localize callback, loss/reacquisition, spatial placement and device scan-mesh hiding require Specs at the actual site or your own published location group.

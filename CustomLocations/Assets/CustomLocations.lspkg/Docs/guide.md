# CustomLocations guide

[← Agent usage index](../README.md)

## Use when

Read the original scanning/setup tutorial and example workflow. Use [Components](components.md) and [API status](api-status.md) for current names, dependencies and exact behavior.

## Features

- **Proximity + camera-view activation**: `ActivateWhenInCameraView` waits for the location to be found, then calls `activate()` / `deactivate()` on its listeners based on 2D distance and whether the location sphere is in the camera frustum
- **LocatedObject listeners**: `ScaleInLocatedObject` (scale in / out animation) and `AudioLocatedObject` (play / stop a sound); implement the `LocatedObject` interface for your own behaviours
- **Scan meshes on device**: `DeactivateLocationMeshOnDevice` keeps the scan meshes visible in Lens Studio and hides them on SPECS (with a switch to show them again)
- **Status panel**: `CustomLocationsExamplesPanel` (UIKit, built in code) lists the group SceneObject name and each Located At object with its tracking state and 3D distance, toggles the scan meshes and forces activation so the flow can be tested in Preview
- **Editor friendly**: locations count as localized in Lens Studio Preview so the activation flow can be tested by moving the Preview camera
- **Dependency free location helpers**: activation, scale, audio, mesh visibility and logging modules import no companion packages. The example status panel imports UIKit

## Package Contents

| Path | Purpose |
|---|---|
| `Scripts/LocatedObject.ts` | Interface implemented by anything that reacts to a location: `activate`, `deactivate`, `localize` |
| `Scripts/ActivateWhenInCameraView.ts` | Attach next to a Located At component; drives the listeners from distance and camera visibility |
| `Scripts/ScaleInLocatedObject.ts` | Listener: enables and scales content in on activate, out on deactivate |
| `Scripts/AudioLocatedObject.ts` | Listener: plays an AudioComponent while the wearer is at the location |
| `Scripts/DeactivateLocationMeshOnDevice.ts` | Attach to the Custom Location Group; hides child scan meshes on device |
| `Scripts/Logger.ts` | Small tagged logger used by the package |
| `Examples/CustomLocationsExamplesPanel.ts` | UIKit panel: group and per-scan status, scan mesh switch, activate / deactivate buttons |
| `Examples/Locations/` | The three scans of the example group `JEHNXBBZ6JA9` (`CH7JMKLVUSXV`, `H3X56VS2BCQ3`, `W79DULBVS9HS`), each with `<ID>.location`, `Mesh <ID>.location_mesh` and `Material <ID>.mat` |
| `Examples/Materials/location_material.graphShader` | Shader used by the three scan materials |
| `Examples/Models/`, `Examples/Audio/` | Animated characters and the sound that appear on approach |

> **NOTE:** Custom Locations only track on SPECS. In Lens Studio Preview the scans render as meshes and the activation flow is simulated.

## Design Guidelines

Designing Lenses for SPECS offers all-new possibilities for immersive AR experiences. View Design Guidelines

## Original environment notes

The following device/app minima were listed in the original tutorial and were not revalidated. The Lens Studio version the package was saved with is in `package.native`; companion packages are listed in `package_dependencies.json`.


- **SPECS OS Version**: v7.0+
- **SPECS App iOS**: v1.7+
- **SPECS App Android**: v1.7+
- **Examples only**: InteractionKit and UIKit

## Getting Started

### Option A: use the example scene

Open the project and look at `Custom Locations` in the Scene Hierarchy: it holds the **Custom Location Group** component (Group ID `JEHNXBBZ6JA9`) and three **Located At** children, one per scan. Each child has `ActivateWhenInCameraView` with a `ScaleInLocatedObject` and an `AudioLocatedObject` as listeners. Move the Preview camera towards the statue and the cat scales in with a sound.

### Option B: set up your own location

1. Scan your place with the Custom Locations Lens, publish the scans, create a group and publish it.
2. Add a **Custom Location Group** component to an empty SceneObject, paste the Group ID and click **Reload Group**. Lens Studio creates one **Located At** child per scan, with its scan mesh.
3. Add `DeactivateLocationMeshOnDevice` to the group object so the scan meshes only show in Lens Studio.
4. On a Located At child:
   1. Parent your content and position it against the scan mesh.
   2. Add `ActivateWhenInCameraView`, assign the **Camera** and optionally a **Center Reference** object.
   3. Add `ScaleInLocatedObject` (assign the content) and, on an object with an AudioComponent, `AudioLocatedObject`.
   4. Add both listener components to **Listener Objects** on `ActivateWhenInCameraView`.
5. Repeat for every scan, send the Lens to SPECS and walk to the place.

### Option C: react from code

```typescript
import {LocatedObject} from "CustomLocations.lspkg/Scripts/LocatedObject"

@component
export class SpawnOnArrival extends BaseScriptComponent implements LocatedObject {
  @input prefab: ObjectPrefab
  private instance: SceneObject | null = null

  activate(): void {
    this.instance ??= this.prefab.instantiate(this.getSceneObject())
    this.instance.enabled = true
  }

  deactivate(): void {
    if (this.instance) this.instance.enabled = false
  }

  localize(): void {}
}
```

Add the component to the **Listener Objects** of an `ActivateWhenInCameraView` and it is driven like the built-in listeners.

## Examples

Drop a SceneObject with `CustomLocationsExamplesPanel` in front of the camera, wire **Location Group** to `Custom Locations` and run the Lens:

- **Status lines** show the group (waiting / found) and, per scan, the tracking state (`Ready`, `Can track`, `Found`, `Lost`, ...) and the distance to the camera.
- **Scan meshes** switch shows or hides the scan meshes (on device they start hidden).
- **Activate all / Deactivate all** force the listeners of every scan so the content flow can be checked without being at the location. Activate all keeps content on until Deactivate all, which returns to the automatic distance / camera-view check.

## Inputs

### ActivateWhenInCameraView

| Input | Type | Default | Description |
|---|---|---|---|
| Camera | `Camera` | | Camera used for visibility and distance checks |
| Center Reference | `SceneObject` | this object | Point treated as the location center |
| Listener Objects | `ScriptComponent[]` | | Components implementing `LocatedObject` |
| Sphere In View For Activation Radius | `float` | `600` | Radius (cm) of the sphere tested against the camera frustum |
| Distance For Activation | `float` | `1000` | 2D distance (cm) below which the location activates |
| De Activate Distance Multiplier | `float` | `1.5` | Deactivation distance = activation distance × multiplier |
| Simulate Localized In Editor | `bool` | `true` | Treat the location as found in Lens Studio Preview |

### ScaleInLocatedObject / AudioLocatedObject / DeactivateLocationMeshOnDevice

| Component | Input | Default | Description |
|---|---|---|---|
| ScaleInLocatedObject | Content Scene Object | this object | Content that is enabled and scaled in |
| ScaleInLocatedObject | Animation Step | `0.05` | Fraction of the target scale applied per frame |
| AudioLocatedObject | Audio | on this object | AudioComponent to play |
| AudioLocatedObject | Loops | `1` | Loop count passed to `play` (`-1` = forever) |
| DeactivateLocationMeshOnDevice | Hide In Editor | `false` | Also hide the scan meshes in Preview |

## API

Signatures below are reference text, not a standalone executable snippet.

```text
// ActivateWhenInCameraView
get isLocalized(): boolean      // onFound received (or simulated in the editor)
get isActivated(): boolean
activateListeners(): void        // force activate (debug / panel)
deactivateListeners(): void

// DeactivateLocationMeshOnDevice
get locationMeshVisuals(): RenderMeshVisual[]
setMeshesVisible(visible: boolean): void
```

Native members used by this source or preserved from its tutorial include: `LocatedAtComponent.onFound / onLost / onReady / onCanTrack / onCannotTrack / onError`, `LocatedAtComponent.location`, and `CustomLocationGroupComponent.onFound(locationId)` / `hintUserPosition(groupLocalPosition)`.

## How It Works

- The Custom Location Group tracks its scans; whichever scan is recognised first moves the whole group so the other scans line up.
- `ActivateWhenInCameraView` subscribes to the Located At `onFound` event, then on every frame measures the 2D distance between the camera and the center reference and, inside the activation distance, checks `camera.isSphereVisible()`. Deactivation uses a larger distance so content does not flicker at the boundary.
- The activator guards repeated `activate` / `deactivate` calls with its active flag. Editor simulation makes `isLocalized` true without invoking `localize()`. The actual `onFound` event invokes `localize()` once; `onLost` only logs and never clears that state. Once active, looking away alone does not deactivate: only exceeding the cached outer distance does.

## Tips

- Keep the content center reference at the middle of the scan and tune **Distance For Activation** to the size of the place (10 m default).
- Put the group object high in the Scene Hierarchy so its scripts run before the content that depends on them.
- Group IDs are tied to the real place; replace `JEHNXBBZ6JA9` with your own group to test on device.

## Support

If you have any questions or need assistance, please don't hesitate to reach out to the [SPECS Developer Community](https://developers.specs.com).

## Contributing

This package is maintained by the SPECS team. For feature requests or bug reports, visit https://developers.specs.com.

## Built with 👽 by the SPECS team <!-- -->

---

[See more packages](https://github.com/specs-devs/packages)

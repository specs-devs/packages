# Custom Locations

## What it is
A package of helpers for Lenses built on Custom Locations: content anchored to a scanned and published real-world
location through the native `CustomLocationGroupComponent` and `LocatedAtComponent`. It adds proximity
activation, scale-in and audio responses, scan-mesh visibility and a status panel on top of the native tracking.
It is for developers placing content at a scanned site; it does not scan or publish locations and does not provide
GPS navigation.

## What it does
- `ActivateWhenInCameraView` sits next to a `LocatedAtComponent`. Once the location is found (or simulated in the
  editor), it activates its listeners when the camera is within `distanceForActivation` (horizontal distance) and
  the location sphere is in view, and deactivates them beyond `deActivateDistanceMultiplier` times that distance.
- Listeners implement the `LocatedObject` interface (`activate`, `deactivate`, `localize`):
  `ScaleInLocatedObject` enables content and scales it in or out, and `AudioLocatedObject` plays or stops a sound.
- `DeactivateLocationMeshOnDevice` on the group keeps the scan meshes visible in Lens Studio and hides them on Specs.
- `CustomLocations__PLACE_IN_SCENE.prefab` shows a guide, an example carousel, a status panel and an example group
  with three scans, each with an animated character (fox, red panda, kitty) that appears on approach.
- The status panel lists each scan's tracking state and distance, toggles the scan meshes, and has
  **Activate all** / **Deactivate all** buttons to force the content on for testing.

## Highlights
- Distance plus camera-frustum activation, with an outer threshold so content does not flicker at the edge.
- A small listener interface (`LocatedObject`) for your own location-driven behaviours.
- Editor friendly: `simulateLocalizedInEditor` counts locations as localized in the Preview, so you can test the
  flow by moving the Preview camera.
- The location helpers import no companion packages; only the example status panel uses UI Kit.
- Each listener callback is guarded, so one failing listener does not stop the others.

## Core scripts
| Script | What it does |
|---|---|
| `Scripts/ActivateWhenInCameraView.ts` | Drives listeners from localization, distance and camera visibility. |
| `Scripts/LocatedObject.ts` | Interface for anything that reacts to a location. |
| `Scripts/ScaleInLocatedObject.ts` | Listener that enables and scales content in on activate, out on deactivate. |
| `Scripts/AudioLocatedObject.ts` | Listener that plays an `AudioComponent` while you are at the location. |
| `Scripts/DeactivateLocationMeshOnDevice.ts` | Hides the group's scan meshes on Specs. |
| `Scripts/Logger.ts` | Small tagged logger used by the package. |
| `Examples/CustomLocationsExamplesPanel.ts` | UI Kit status panel: per-scan state, scan mesh switch, activate / deactivate. |

## Extra info
- **Requires:** InteractionKit, UIKit, Motion, Icons. Custom Locations only track on Specs at the scanned site; in
  the Lens Studio Preview the scans render as meshes and activation is simulated. The example scans only align at
  their real location, so use your own published scans for your Lens.
- **Get started:** drag `CustomLocations__PLACE_IN_SCENE.prefab` into a Specs scene with a Camera and the
  Interaction Kit (SIK) prefab. To build your own group, use the model and audio prefabs in `Examples/` and follow
  the own-location setup in [examples.md](examples.md).
- **More docs:**
  - [cheat-sheet.md](cheat-sheet.md): hierarchy and activation rules; read first.
  - [components.md](components.md): inputs, methods, getters and the listener contract.
  - [examples.md](examples.md): listener snippet, sample wiring and own-location setup.
  - [guide.md](guide.md): the full scanning and setup tutorial.
  - [troubleshooting.md](troubleshooting.md): localization, activation, scale, audio and mesh issues.
  - [api-status.md](api-status.md): current public surface and known behaviour gaps.

# NavigationKit troubleshooting

[← Agent usage index](../README.md)

## Use when

Use this table for package-specific failures. Generic Lens scripting, scene placement,
rendering and TypeScript issues belong to the relevant CLAD skill. The rows marked **QA**
were found while making the package's demo project QA-ready (2026-09-30, Lens Studio Preview).

## Known limitations and fixes

| Symptom | Package cause | Package fix |
|---|---|---|
| Lens fatals at awake: cannot read `getTransform` of null in `NavigationDataComponent` | `userCamera` is unassigned. The prefab references the Spectacles template camera id `…0065-…0065`, which does not exist in projects with a different Camera. | Assign the scene Camera to `NavigationDataComponent.userCamera`. |
| Pinching a menu entry does nothing; Logger shows `ExampleMenu: could not subscribe to button A/B/C` (**QA**, fixed in this revision) | The menu subscribed to a non-existent `onButtonPinched`, then looked for an `Interactable` that UIKit creates later. | `ExampleMenu` now subscribes to `RectangleButton.onTriggerUp`. For your own UI do the same: `button.onTriggerUp.add(() => nav.navigateToPlace(place))`. |
| Arrow never shows; Logger shows `ARNavigation: arrowRenderMeshVisual.mainMaterial is missing` / `checkSignMeshVisual.mainMaterial is missing` (**QA**, fixed) | A RenderMeshVisual without material or mesh. In older builds the AR prefabs referenced assets that no longer exist. | All three prefabs now reference `compass_arrow_material.mat`, `Compass_arrow.mesh` and the `check_mark.obj` mesh. If you see the warning on your own visuals, assign the material in the Inspector. |
| World arrow stays at the scene origin instead of following the head (**QA**, fixed) | `NavigationKit__PLACE_IN_SCENE.prefab` was malformed at its last line, so Lens Studio dropped the SIK `Headlock` component from `AR Navigation/HeadLockPivot` on import. | Fixed in the prefab file. If an existing scene instance still lacks it, re-instantiate the prefab. |
| Arrival shows nothing: the arrow just disappears (**QA**, fixed) | `ARNavigation.onDestinationReached` only reset the visuals and never enabled the switch animation. | `onDestinationReached` now shows arrow + check sign and enables the 2 s switch; `reset()` hides everything 3 s later. |
| The demo's Big Ben place is about 17 km east of the real Big Ben | The prefab's `ManualPlaceList` entry authors Big Ben's longitude as `"0.1245 "` (east of Greenwich). Big Ben is at about 51.5007, **−0.1246**. The Eiffel Tower entry is authored `2.2845` (actual about 2.2945). | Set the entries' `longitude` on your instance (e.g. `-0.1246` for Big Ben). Western longitudes are negative. |
| A geo place never becomes `visited` | `GeoLocationPlace.checkVisited` compares the great-circle distance (m) with `distanceToActivate` (default 10 m); user position must have a fix (`UserPositionStatus.GeoLocalizationAvailable`). `updateThreshold = 0` disables GPS entirely. | Keep `updateThreshold > 0`; on device, wait for a fix; in the editor call `(nav.getUserPosition() as EditableUserPosition).setOverridePosition(geo)` with a position near the place. |
| A Scene Object place is visited immediately, or never | `SceneObjectPlace.checkVisited` compares the world distance in **cm** with `distanceToActivate` (hint says meters). | Author `distanceToActivate` in cm for Scene Object places (e.g. 100 for 1 m). Placing the object at the scene origin makes it visited at start (used by the example's "Start Position" to demo the arrival animation). |
| `ExampleMenu` throws `The example scene has been modified, please remove this menu.` | The demo menu requires at least 3 registered places. | Keep 3 entries in `ManualPlaceList` or remove `ExampleMenu` and drive `navigateToPlace` from your own UI. |
| `Invalid number format` thrown at start | `GeoPlaceInput.latitude/longitude` are strings parsed with `convertToNumber` (comma accepted, anything else NaN). | Use plain decimal strings such as `51.5007`. |
| Custom Location place never tracks or arrives in the Preview | By design: `CustomLocationPlace` ignores `onFound` and returns `visited = false` while `deviceInfoSystem.isEditor()`. | Test Custom Locations on device. |
| `Center points and located ats must be in the same order.` / `… must be the same length.` | `PlacesFromLocationGroup` requires each `center` SceneObject to be a direct child of its `locatedAt`'s SceneObject, listed in the same order. | Parent each center under its LocatedAt object and keep the arrays aligned. |
| Distance text shows `… up)` for places below the user | Fixed in this revision: the vertical offset text used the absolute value for the up/down choice. | — |
| Prompt images for Custom Location **group** members are registered only when `promptImage` is empty | `ManualPlaceList` registers group bindings with `isNull(binding.input.promptImage)` (inverted relative to the single Custom Location path). Not changed in this revision. | Register images yourself through `IPlaceImageRegister`, or set the image on single `CustomLocationPlaceInput` entries. |
| HUD compass (`ARNavigation_Camera`) shows the "here" spin for every nearby place | Its `hereRadius` is authored as 300 (m), the world prefab uses 3. | Lower `hereRadius` on the camera compass if you want a direction instead of the spin within 300 m. |
| Two `ARNavigation` instances react to the same selection | Both subscribe to the same `NavigationDataComponent` events (intended: world arrow + HUD compass). | Set `blockActivation = true` on the one you want to silence, or remove it. |
| Arrow visible but the Preview camera cannot move toward places | The Preview has no live GPS; geo places keep their projected direction from the simulated position. | Verify direction logic on device; use a Scene Object place to test arrival in the Preview. Not verified in this QA pass: whether the Preview's simulated location reaches `GeoLocalizationAvailable`. |

## Verification

After applying a fix, reproduce it in the Preview (pinch a place, check the Logger) and on
device for GPS / Custom Location behavior. If behavior differs from this installed guide,
record the package version and update the package docs with the API change.

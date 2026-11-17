# NavigationKit cheat sheet (load-bearing rules)

[← Agent usage index](../README.md)

## Use when

Read this **first**, and re-read it before wiring navigation into a Lens. It is the short
list of rules that most often break a generated navigation Lens, each with a pointer to the
detail. Everything here is derived from the installed package source.

## The rules

1. **One `NavigationDataComponent` per Lens, with `userCamera` assigned.** Its `onAwake`
   builds the user position from `userCamera.getTransform()`; a missing camera throws before
   anything else runs. The shipped prefab points at the Spectacles template camera id, so in a
   project with a different Camera re-assign the input. → [components](components.md#navigationdatacomponent)
2. **Places are registered in `OnStart`, in list order.** `ManualPlaceList` adds geo places,
   then Custom Location places, then Scene Object places, then group places. Anything that
   reads `places` in its own `onAwake` sees an empty list; subscribe to `onPlacesUpdated` or
   read in `OnStartEvent`. `ExampleMenu` throws when fewer than 3 places exist. → [components](components.md#manualplacelist)
3. **Distances are meters; `distanceToActivate` for Scene Object places is NOT.**
   `UserPosition.getDistanceTo`, `ARNavigation.hereRadius` and geo `distanceToActivate` are
   meters, but `SceneObjectPlace` compares the raw world distance (cm) with its
   `distanceToActivate`. A Scene Object place with the default 10 counts as visited within
   10 cm. → [troubleshooting](troubleshooting.md)
4. **`visited` is sticky.** `Place` sets `visited = true` the first frame its check passes and
   never clears it. Selecting an already-visited place (e.g. a Scene Object place at the start
   position) fires `onArrivedAtPlace` on the next update. Use that to test the arrival
   animation in the Preview. → [components](components.md#place-hierarchy)
5. **GPS needs `updateThreshold > 0` and the Location permission.** `updateThreshold = 0`
   never starts `initializeGeoLocationUpdates`, so geo places have no position and the arrow
   returns early. The package `require`s `LensStudio:RawLocationModule`. → [components](components.md#navigationdatacomponent)
6. **`ARNavigation` is driven only by events.** It subscribes to `onNavigationStarted` and
   `onArrivedAtPlace` in `OnStart`; `navigateToPlace(place)` shows it, `stopNavigation()`
   (= `navigateToPlace(null)`) hides it. Set `showByDefault` only when a place is selected
   elsewhere. Both AR prefabs ship with a `navigationDataComponent` reference from the
   example scene — re-assign it in your scene. → [components](components.md#arnavigation)
7. **Arrow and check sign need a material.** `ARNavigation.onAwake` clones
   `mainMaterial` of both visuals and logs `mainMaterial is missing` when a RenderMeshVisual
   has none; the result is an invisible arrow, not an error. All three prefabs reference
   `compass_arrow_material`, `Compass_arrow` and the `check_mark.obj` mesh in this revision. → [troubleshooting](troubleshooting.md)
8. **Custom Location places never arrive in the editor.** `CustomLocationPlace.checkVisited`
   returns `false` and ignores `onFound` while `deviceInfoSystem.isEditor()`; test tracking
   on device. `PlacesFromLocationGroup` requires each `center` to be a direct child of its
   `locatedAt` object, in the same order, or it throws. → [components](components.md#custom-location-places)
9. **Keep the UI theme to SIK/UIKit defaults.** The example menu uses UIKit `RectangleButton`
   + `Frame` and subscribes with `button.onTriggerUp` (an Element event that exists before the
   button initializes); there is no `onButtonPinched` in UIKit. → [examples](examples.md)

## Verify

A compile-clean Lens can still show nothing: pinch a place and look for the arrow and the
distance text; select a place you stand at and look for the 2 s arrow→check-mark switch;
read the Logger for `mainMaterial is missing`, `could not subscribe to button`, and
`[Navigation Component]` lines. → [troubleshooting](troubleshooting.md)

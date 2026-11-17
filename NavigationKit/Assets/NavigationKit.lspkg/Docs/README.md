# Navigation Kit

## What it is
A framework package you add to a Specs project to build navigation experiences. It stores a set of places the
wearer can be guided to (GPS coordinates, Custom Location scans, Custom Location groups or plain scene objects) and
ships the visuals that point the way: a direction arrow with a distance readout and an arrival animation. It is for
developers building wayfinding, tours or "go here next" Lenses.

## What it does
1. A `NavigationDataComponent` owns the place list, the selected place and the user's position (from the assigned
   `userCamera` and, when `updateThreshold > 0`, GPS through the raw location module).
2. A `ManualPlaceList` registers places authored in the Inspector at start: geo places, Custom Location places,
   Scene Object places, then Custom Location groups.
3. Calling `navigateToPlace(place)` (for example from a UI Kit button) fires `onNavigationStarted`; `ARNavigation`
   shows the arrow, rotates it toward the place every frame and writes the distance (metric or US units, with
   "up"/"down" when the place is well above or below).
4. When the selected place becomes visited, `onArrivedAtPlace` fires: the arrow spins out and a check mark scales in
   over 2 s, then everything hides 3 s later.
5. The demo prefab adds a three-button "Select Location" menu (Big Ben, Eiffel Tower, Start Position), an onboarding
   `Guide` and an `ExampleCarousel`.

## Highlights
- One registry for four place types behind a common `Place` model with sticky `visited` state.
- Event-driven API: `onNavigationStarted`, `onArrivedAtPlace`, `onPlacesUpdated` and, in `tourMode`,
  `onAllPlacesVisited`.
- Two arrow presentations: a head-locked world arrow and a HUD compass prefab you parent under the Camera; several
  `ARNavigation` instances can react to the same selection.
- Within `hereRadius` the arrow points down and spins instead of giving a direction.
- Geo helpers (`getPhysicalDistanceBetweenLocations`, `calculateBearing`) are exported from `NavigationUtils`.

## Core scripts
| Script | What it does |
|---|---|
| `NavigationDataComponent/NavigationDataComponent.ts` | Place registry, selection, navigation status and arrival events. |
| `NavigationDataComponent/ManualPlaceList.ts` | Creates and registers places from Inspector lists at start. |
| `ARNavigationComponent/Scripts/ARNavigation.ts` | Direction arrow, distance and name text, and the arrival animation. |
| `NavigationDataComponent/Place.ts` | Abstract place model (`visited`, `ready`, position and orientation). |
| `NavigationDataComponent/GeoLocationPlace.ts` | GPS place; visited within `distanceToActivate` meters. |
| `NavigationDataComponent/SceneObjectPlace.ts` | Place anchored to a scene object. |
| `NavigationDataComponent/CustomLocationPlace.ts` | Place tracked through a `LocatedAtComponent` Custom Location. |
| `NavigationDataComponent/UserPosition.ts` | Read-only user pose and geo position with `UserPositionStatus`. |
| `NavigationDataComponent/ExampleMenu.ts` | Demo menu wiring three UI Kit buttons to the first three places. |

## Extra info
- **Requires:** InteractionKit, UIKit, Motion and Icons. GPS places need the Location permission and a fix on Specs
  (`UserPositionStatus.GeoLocalizationAvailable`); the Lens Studio Preview has no live GPS. Custom Location places
  never track or arrive in the editor; test them on device. Scene Object places compare `distanceToActivate` in
  world units (cm).
- **Get started:** `NavigationKit__PLACE_IN_SCENE.prefab` in a scene with the Interaction Kit (SIK) prefab; assign
  `userCamera` on `Navigation Kit Menu` if your Camera differs. For the arrow alone use
  `ARNavigationComponent/ARNavigationPrefab [PUT_IN_SCENE].prefab` or
  `ARNavigationComponent/ARNavigation_Camera [PUT_UNDER_CAMERA].prefab`. Pinch "Start Position" in Preview to see
  the arrival animation. Delete `Guide` and `ExampleCarousel` for your own Lens.
- **More docs:**
  - [cheat-sheet.md](cheat-sheet.md): load-bearing rules; read first.
  - [api-status.md](api-status.md): current, experimental, internal and removed surfaces.
  - [components.md](components.md): every script, input, method, event and prefab.
  - [examples.md](examples.md): prefab setup and minimal TypeScript recipes.
  - [troubleshooting.md](troubleshooting.md): symptoms, causes and fixes.

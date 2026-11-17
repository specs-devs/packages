# NavigationKit components

[← Agent usage index](../README.md)

## Use when

Look up the exact import path, `@input`s, public members and events of a package script
before writing code against it. Everything below is read from the installed source
Import prefix: `NavigationKit.lspkg/`.

## NavigationDataComponent

`import {NavigationDataComponent, NavigationStatus} from "NavigationKit.lspkg/NavigationDataComponent/NavigationDataComponent"`

`@component`. Owns the place list, the selected place and the user position. Requires the
Location permission (`require("LensStudio:RawLocationModule")`).

| Input | Type | Default | Meaning |
|---|---|---|---|
| `userCamera` | `Camera` | — (required) | Transform used as the user's position and heading. |
| `updateThreshold` | `number` | `1` | Seconds between GPS requests; `0` never starts GPS updates. |
| `tourMode` | `boolean` | `false` | Track every place's visited state and fire `onAllPlacesVisited`. |

| Member | Signature | Notes |
|---|---|---|
| `places` | `get places(): Place[]` | Registration order. |
| `status` | `get status(): NavigationStatus` | `LocationNotSelected`, `Initializing`, `InProgress`, `Succeeded`. |
| `getUserPosition()` | `(): UserPosition` | Read-only view of the `EditableUserPosition`. |
| `navigateToPlace(place)` | `(place: Place): void` | Adds unknown places, sets status `InProgress`, fires `onNavigationStarted(place)`. No-op when `place` is already selected. |
| `stopNavigation()` | `(): void` | `navigateToPlace(null)`: status `LocationNotSelected`, fires `onNavigationStarted(null)`. |
| `addPlace(place)` / `removePlace(place)` | `(place: Place): void` | Fire `onPlacesUpdated`; `addPlace(null)` throws. |
| `onNavigationStarted` | `PublicApi<Place>` | Selection changed (place or `null`). |
| `onArrivedAtPlace` | `PublicApi<Place>` | Selected place became `visited`; the selection is then cleared and status is `Succeeded`. In tour mode fires once per place. |
| `onPlacesUpdated` | `PublicApi<void>` | List changed. |
| `onAllPlacesVisited` | `PublicApi<void>` | Tour mode only, once. |

Lifecycle: `onAwake` creates the user position and binds an `UpdateEvent` through SIK's
`LensConfig.getInstance().updateDispatcher`; arrival is detected in that update.

## ManualPlaceList

`import {ManualPlaceList, GeoPlaceInput, SceneObjectPlaceInput, CustomLocationPlaceInput, CustomLocationGroupPlaceInput} from "NavigationKit.lspkg/NavigationDataComponent/ManualPlaceList"`

`@component`. Creates and registers `Place`s from Inspector lists in `OnStartEvent`, in this
order: geo places, Custom Location places, Scene Object places, Custom Location groups.

| Input | Type | Meaning |
|---|---|---|
| `navigationDataComponent` | `NavigationDataComponent` | Target registry (required). |
| `placeInputs` ("Manual Geo Places") | `GeoPlaceInput[]` | `active=true`, `latitude: string`, `longitude: string` (parsed with `convertToNumber`, comma allowed), `label`, `icon: Texture`, `description`, `distanceToActivate=10` (meters). |
| `sceneObjects` ("Scene Object Places") | `SceneObjectPlaceInput[]` | `active`, `sceneObject`, `label`, `icon`, `description`, `distanceToActivate=10` (**compared in world units, cm**). |
| `customLocationComponents` ("Custom Location Places") | `CustomLocationPlaceInput[]` | `active`, `locatedAt: LocatedAtComponent`, `center: SceneObject`, `label`, `icon`, `description`, `promptImage: Texture`, `distanceToActivate=10`. `changeLocatedAtEnabled` is set `true` on the created place. |
| `locationGroupComponents` ("Custom Location Group Places") | `CustomLocationGroupPlaceInput[]` | `active`, `customLocations: CustomLocationPlaceInput[]` → one `PlacesFromLocationGroup`. |
| `imageDisplay` | `IPlaceImageRegister` (optional, `@allowUndefined`) | Receives `register(place, promptImage)` for Custom Location places. |

Also subscribes to `onNavigationStarted` and enables the selected Custom Location place's
`LocatedAtComponent` (`setLocatedAtEnabled(true)`).

## ARNavigation

`import {ARNavigation} from "NavigationKit.lspkg/ARNavigationComponent/Scripts/ARNavigation"`

`@component`. Rotates `targetPivot` toward the selected place every frame and writes the
distance; on arrival plays the arrow→check-mark switch.

| Input | Type | Default | Meaning |
|---|---|---|---|
| `navigationDataComponent` | `NavigationDataComponent` | — (required) | Source of selection/arrival events. |
| `targetPivot` | `SceneObject` | — (required) | Object whose world rotation is slerped toward the place (`quat.angleAxis(-bearing, up)`), factor `deltaTime * 10`. |
| `arrowRenderMeshVisual` | `RenderMeshVisual` | — (required) | Arrow; its `mainMaterial` is cloned at awake. |
| `checkSignMeshVisual` | `RenderMeshVisual` | — (required) | Check sign; material cloned at awake, alpha animated. |
| `distanceTexts` | `Text[]` | — (required) | All receive the formatted distance. |
| `placeNameText` | `Text` | optional (`@allowUndefined`) | Receives `place.name`. |
| `measurementSystem` | `int` combo | `0` Metric | `0` Metric (`m`, `km` from 1000 m), `1` US (`ft`, `mi` from 1609.34 ft). |
| `showByDefault` | `boolean` | `false` | Call `setVisible(true)` at start. |
| `hereRadius` | `number` | `3` | Meters; within it the arrow points down and spins and the texts hide. |

| Member | Notes |
|---|---|
| `setVisible(visible: boolean)` | Shows/hides arrow + texts and starts/stops the per-frame update; ignored while `blockActivation`. |
| `blockActivation: boolean` | Public flag to silence this instance. |
| `hereRadius: number` | Public. |

Behavior: distance text appends `\n(<d> up)` / `(<d> down)` when the place is more than
180 cm above/below the user. On `onArrivedAtPlace` the arrow fades and spins out while the
check sign scales in over 2 s, then everything hides 3 s later. `onNavigationStarted(null)`
hides it. Warns `mainMaterial is missing` when a visual has no material.

## Place hierarchy

`import {Place} from "NavigationKit.lspkg/NavigationDataComponent/Place"`

| Member | Notes |
|---|---|
| `name`, `icon: Texture`, `description` | Constructor data. |
| `visited: boolean` | Set once by the per-frame `checkVisited()` and never cleared. |
| `ready: boolean` | `true` except `CustomLocationPlace` (after `onReady`). |
| `getRelativePosition(): vec3 \| null` | Abstract. World position relative to the session origin. |
| `getGeoPosition(): GeoPosition \| null`, `getOrientation(): quat`, `requestNewGeoPosition(geo): boolean` | Abstract. |
| `onStatusUpdated: PublicApi<void>` | Tracking status changes (Custom Location). |

- `GeoLocationPlace(geoPosition, distanceToVisit, name, icon, description, userPosition)` —
  `NavigationDataComponent/GeoLocationPlace`. Projects the place from great-circle distance and
  bearing at the user's eye height; `visited` when physical distance < `distanceToVisit` (m);
  `requestNewGeoPosition` accepted; `getBearing(userPosition)` returns `null` (and logs) until
  `UserPositionStatus.GeoLocalizationAvailable`.
- `SceneObjectPlace(sceneObject, visitDistance, name, icon, description, userPosition)` —
  `NavigationDataComponent/SceneObjectPlace`. Position = the object's world position; `visited`
  when `worldPosition.distance(user) < visitDistance` (cm). `getGeoPosition()` derives a geo
  position from the user's fix and heading (approximation valid for a few km).

### Custom Location places

- `CustomLocationPlace(locatedAt, center: Transform, name, icon, description, distanceToActivate, userPosition)` —
  `NavigationDataComponent/CustomLocationPlace`. Downloads the geo position of
  `locatedAt.location`; tracks `onFound/onLost/onCanTrack/onCannotTrack/onError/onReady`
  (`onFound` ignored in the editor). Members: `locatedAt`, `isNearby`, `isTracking`, `ready`,
  `onNearby: PublicApi<boolean>` (user within `userAccuracy + placeAccuracy + distanceToActivate`),
  `changeLocatedAtEnabled` (default `false`), `setLocatedAtEnabled(enabled)` (enables the
  LocatedAt scene object 5 s after becoming nearby when allowed). `visited` = tracking (never in editor).
- `OverridableCustomLocationPlace` — `NavigationDataComponent/OverridableCustomLocationPlace`.
  Adds `setOverride(position: vec3 | null)`; the override wins until the place tracks.
- `PlacesFromLocationGroup(locatedAtInput: CustomLocationPlaceInput[], navigationComponent)` —
  `NavigationDataComponent/PlacesFromLocationGroup`. Creates one `OverridableCustomLocationPlace`
  per active entry, registers them, and when any member's `LocatedAtComponent` is found moves
  the others by the authored relative transforms. Validates that each `center` is a direct
  child of its `locatedAt.sceneObject` (same order) and throws otherwise. `inputPlaceBinding`
  exposes `{place, input}` pairs, typed by the exported
  `PlaceInputBinding = {place: OverridableCustomLocationPlace; input: CustomLocationPlaceInput}`.

## UserPosition

`import {UserPosition, UserPositionStatus} from "NavigationKit.lspkg/NavigationDataComponent/UserPosition"`

| Member | Notes |
|---|---|
| `initializeGeoLocationUpdates(accuracy, updateFrequency)` | Called by `NavigationDataComponent` with `GeoLocationAccuracy.Navigation`. |
| `getGeoPosition(): GeoPosition \| null` | `null` until the first fix. |
| `getRelativeTransform(): Transform` | The `userCamera` transform. |
| `getBearing(): number` | Radians from true north (from `onNorthAlignedOrientationUpdate`); negated in the editor. |
| `getNorthAlignedOrientation(): quat` | |
| `getDistanceTo(place): number \| null` | Meters (world displacement / 100). |
| `getBearingTo(place, world: boolean): number \| null` | Radians; `world=true` ignores the user heading. |
| `status: UserPositionStatus` | `Unknown`, `UnknownErrorNetworkMissing`, `UnknownPoorGPSReception`, `GeoLocalizationAvailable`, `GlobalLocalizationPoorGPSReception`, `ErrorTrackingAssetFailedToDownload`. |
| `onUserPositionUpdated: PublicApi<void>` | New geo fix (or override). |
| `gpsActive: boolean` | `updateFrequency > 0`. |

`EditableUserPosition` (`NavigationDataComponent/EditableUserPosition`) implements it and adds
`setOverridePosition(position: GeoPosition)`, which fixes the geo position and stops live updates
(editor testing).

## IPlaceImageRegister

`import {IPlaceImageRegister} from "NavigationKit.lspkg/NavigationDataComponent/IPlaceImageRegister"`

`interface IPlaceImageRegister extends BaseScriptComponent { register(customLocationPlace: CustomLocationPlace, image: Texture): void }`
— implement it on a script and assign it to `ManualPlaceList.imageDisplay`.

## ExampleMenu (demo)

`import {ExampleMenu} from "NavigationKit.lspkg/NavigationDataComponent/ExampleMenu"`

`@component`. Inputs: `navigationComponent: NavigationDataComponent`, `buttonA/B/C: RectangleButton`
(UIKit), `buttonAText/BText/CText: Text`. In `OnStart` it labels the buttons with the first
three places and subscribes `button.onTriggerUp` → `navigateToPlace`. Throws when fewer than
3 places are registered.

## Demo scaffolding (`Example/`)

Shipped with the package so the `__PLACE_IN_SCENE` prefab works on its own. Not part of the
NavigationKit API; reuse or delete them freely.

- `Example/GuideDismissPanel/GuideDismissPanel.ts` — on the prefab's `Guide` object (UIKit
  `Frame` + `OkButton`). Inputs: `buttonLabel` (default "Ok, I understood"),
  `hideUntilDismissed: SceneObject[]` (disabled while the guide shows, enabled on dismiss; in the
  prefab: `ExampleCarousel` and `NavigationKitDemo`). Never list the prefab root there — it
  contains the guide.
- `Example/ExampleCarousel/ExampleCarousel.ts` — on the prefab's `ExampleCarousel` object: a
  Previous / Next panel with a minimize button that shows one example at a time. Inputs:
  `examples: SceneObject[]` (in the prefab: `NavigationKitDemo`), `exampleInfo: string[]`,
  `steps: SceneObject[]`, `stepInfo: string[]` (one line per step, same order as `steps`; an
  empty entry falls back to the step's example info), `startIndex`, `previousLabel` / `nextLabel`, `examplesPushBack`
  (cm), `anchorExamples`, `startMinimized`, `extraPanelDrop` (cm).

## NavigationUtils

`import {calculateBearing, getPhysicalDistanceBetweenLocations, normalizeAngle, convertToNumber, customGetEuler, makeTween, lerp, mod} from "NavigationKit.lspkg/NavigationDataComponent/NavigationUtils"`

Geo math (`getPhysicalDistanceBetweenLocations` → meters, `calculateBearing` → radians) and
small helpers. Both geo functions take the exported type
`GeoCoordinate = {longitude: number; latitude: number; altitude: number}` (a `GeoPosition`
satisfies it). The map/ScreenTransform helpers in the same file are internal leftovers (see
[API status](api-status.md)).

## Prefabs

| Prefab | Contents | Must assign |
|---|---|---|
| `NavigationKit__PLACE_IN_SCENE.prefab` | `Guide` (GuideDismissPanel, at (0, 0, −100)) and `ExampleCarousel` (see [Demo scaffolding](#demo-scaffolding-example)), then `NavigationKitDemo` → `Navigation Kit Menu` (NavigationDataComponent + ManualPlaceList: Big Ben, Eiffel Tower, Start Position = the menu object itself; the two geo entries' longitudes are authored with errors, see [troubleshooting](troubleshooting.md)) → `SelectionMenu` (ExampleMenu, UIKit Frame, 3 RectangleButtons, title "Select Location") at (0, 0, −100); `AR Navigation` (ARNavigation) → `HeadLockPivot` (SIK Headlock, distance 100, yaw locked) → `CheckSignPivot` (SIK Billboard, check mesh scale 0.2, DistanceText, NameText) and `ArrowPivot` (Compass_arrow, scale 0.5), both at y −35. | `userCamera` if your Camera is not the template camera. |
| `ARNavigationComponent/ARNavigationPrefab [PUT_IN_SCENE].prefab` | The `AR Navigation` subtree above, standalone. | `navigationDataComponent` (ships with a reference from the example scene). |
| `ARNavigationComponent/ARNavigation_Camera [PUT_UNDER_CAMERA].prefab` | HUD compass: root at (−5, 2.25, −15.5) with pivot scale 0.2, Headlock disabled, two distance texts, `hereRadius` 300. Parent it under the Camera. | `navigationDataComponent`. |

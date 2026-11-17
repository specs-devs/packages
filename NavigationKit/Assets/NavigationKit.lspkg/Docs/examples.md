# NavigationKit examples

[← Agent usage index](../README.md)

## Use when

You need the drag-and-drop setup or a minimal, compile-correct TypeScript snippet against
this package revision. Import paths match the installed layout (no `Scripts/` root
for the data modules).

## Prefab setup (no code)

1. Install `SpectaclesInteractionKit`, `SpectaclesUIKit`, `Motion` and `Icons` (the package's
   declared dependencies) and add the SIK prefab to the scene.
2. Drag `NavigationKit.lspkg/NavigationKit__PLACE_IN_SCENE.prefab` into the scene. It brings
   the place registry (`Navigation Kit Menu`), the demo menu and the head-locked arrow, plus a
   guide panel ("Ok, I understood" reveals the demo) and the example carousel panel.
   Check `Navigation Kit Menu › NavigationDataComponent › User Camera` points at your Camera.
3. Optional HUD compass: drag `ARNavigationComponent/ARNavigation_Camera [PUT_UNDER_CAMERA].prefab`
   under the Camera object and assign its `ARNavigation › Navigation Data Component` to the
   `Navigation Kit Menu` component.
4. Preview: pinch a menu entry; the arrow and distance appear. Pinch **Start Position** (a
   Scene Object place at the menu's own position) to see the arrival animation.
5. Edit the places in `Navigation Kit Menu › ManualPlaceList` (geo coordinates as decimal
   strings, Scene Object places, Custom Location places).

## Select a place from your own UIKit button

```ts
import {RectangleButton} from "SpectaclesUIKit.lspkg/Scripts/Components/Button/RectangleButton"
import {NavigationDataComponent} from "NavigationKit.lspkg/NavigationDataComponent/NavigationDataComponent"

@component
export class GoToFirstPlace extends BaseScriptComponent {
  @input navigation: NavigationDataComponent
  @input button: RectangleButton

  onAwake(): void {
    this.createEvent("OnStartEvent").bind(() => {
      // Places are registered in OnStart, so read them here, not in onAwake.
      const place = this.navigation.places[0]
      if (place === undefined) {
        print("GoToFirstPlace: no places registered")
        return
      }
      // onTriggerUp is a UIKit Element event; it exists before the button initializes.
      this.button.onTriggerUp.add(() => this.navigation.navigateToPlace(place))
    })
  }
}
```

## Add a place at runtime and react to arrival

```ts
import {NavigationDataComponent} from "NavigationKit.lspkg/NavigationDataComponent/NavigationDataComponent"
import {SceneObjectPlace} from "NavigationKit.lspkg/NavigationDataComponent/SceneObjectPlace"

@component
export class WaypointRunner extends BaseScriptComponent {
  @input navigation: NavigationDataComponent
  @input waypoint: SceneObject

  onAwake(): void {
    this.createEvent("OnStartEvent").bind(() => {
      // Scene Object places compare distanceToActivate in world units (cm): 100 = 1 m.
      const place = new SceneObjectPlace(this.waypoint, 100, "Waypoint", null, "", this.navigation.getUserPosition())
      this.navigation.addPlace(place)
      this.navigation.onArrivedAtPlace.add((arrived) => {
        if (arrived === place) {
          print("Reached " + arrived.name)
        }
      })
      this.navigation.navigateToPlace(place)
    })
  }
}
```

## Geo place from code

```ts
import {GeoLocationPlace} from "NavigationKit.lspkg/NavigationDataComponent/GeoLocationPlace"
import {NavigationDataComponent} from "NavigationKit.lspkg/NavigationDataComponent/NavigationDataComponent"

export function addGeoPlace(navigation: NavigationDataComponent, latitude: number, longitude: number, label: string): GeoLocationPlace {
  const geo = GeoPosition.create()
  geo.latitude = latitude
  geo.longitude = longitude
  // distanceToVisit is meters for geo places.
  const place = new GeoLocationPlace(geo, 10, label, null, "", navigation.getUserPosition())
  navigation.addPlace(place)
  return place
}
```

## Read distance and status

```ts
const user = navigation.getUserPosition()
const meters = user.getDistanceTo(place)          // number | null (null before the first GPS fix for geo places)
const bearing = user.getBearingTo(place, false)   // radians relative to the user's heading
const ready = user.status === UserPositionStatus.GeoLocalizationAvailable
```

`UserPositionStatus` comes from `NavigationKit.lspkg/NavigationDataComponent/UserPosition`.

## Test arrival in the editor

Select a place whose `checkVisited` can pass without GPS: a `SceneObjectPlace` at the user's
start position (the example's "Start Position"), or override the user's geo position:

```ts
import {EditableUserPosition} from "NavigationKit.lspkg/NavigationDataComponent/EditableUserPosition"

const editable = navigation.getUserPosition() as EditableUserPosition
const geo = GeoPosition.create()
geo.latitude = 51.5007
geo.longitude = -0.1246 // west of Greenwich: negative
editable.setOverridePosition(geo) // stops live GPS updates for this session
```

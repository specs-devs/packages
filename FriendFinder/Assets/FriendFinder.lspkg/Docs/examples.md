# FriendFinder examples

[← Agent usage index](../README.md)

## Use when

Use typed geographic/estimator consumers without triggering native or cloud services.

## Geographic distance and label

```typescript
import {haversineMeters, initialBearing, formatFeetMiles} from "FriendFinder.lspkg/Scripts/Geolocation/GeoMath"
const meters = haversineMeters(37.77, -122.42, 37.771, -122.42)
const bearingDegrees = initialBearing(37.77, -122.42, 37.771, -122.42)
print(`${formatFeetMiles(meters)} bearing=${bearingDegrees}`)
```

## Estimate only after a fix

```typescript
import {FriendPositionEstimator} from "FriendFinder.lspkg/Scripts/Geolocation/FriendPositionEstimator"
@component
export class FriendEstimateConsumer extends BaseScriptComponent {
  private estimator = new FriendPositionEstimator()
  onAwake(): void {
    this.createEvent("OnStartEvent").bind(() => this.estimator.addFix(37.771, -122.42, 8))
    this.createEvent("UpdateEvent").bind(() => {
      const estimate = this.estimator.estimate()
      if (estimate) print(JSON.stringify(estimate))
    })
  }
}
```

## Bearing relative to user heading

```typescript
import {directionFromHeading, shortestAngleDeg} from "FriendFinder.lspkg/Scripts/Geolocation/GeoMath"
const targetBearingDegrees = 90
const userHeadingDegrees = 0
const direction: vec3 = directionFromHeading(targetBearingDegrees, userHeadingDegrees)
const turnDegrees = shortestAngleDeg(userHeadingDegrees, targetBearingDegrees)
print(`${direction.toString()} turn=${turnDegrees}`)
```

The native example remains the bundled prefab plus configured companion. These snippets import pure geographic modules and do not exercise Mobile Kit, cloud auth or WebRTC.

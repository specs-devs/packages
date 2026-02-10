/**
 * Specs Inc. 2026
 * Place wrapper for SceneObject-based navigation targets in world space. Uses Transform for position
 * and orientation without GPS coordinates, dynamically generates GeoPosition on request by converting
 * world position relative to UserPosition, detects arrival within configurable visit radius, and enables
 * navigation to pre-placed scene objects for AR experiences and indoor scenarios.
 */
import {customGetEuler, normalizeAngle} from "./NavigationUtils"
import {Place} from "./Place"
import {UserPosition} from "./UserPosition"

/**
 * Wraps a {@link SceneObject} as a {@link Place} for navigation.
 *
 * @version 1.0.0
 */
export class SceneObjectPlace extends Place {
  private readonly sceneObject: SceneObject
  private readonly userPosition: UserPosition
  private readonly visitDistance: number
  private geoPosition: GeoPosition | null

  constructor(
    sceneObject: SceneObject,
    visitDistance: number,
    name: string,
    icon: Texture,
    description: string,
    userPosition: UserPosition,
  ) {
    super(name, icon, description)
    this.sceneObject = sceneObject
    this.userPosition = userPosition
    this.visitDistance = visitDistance
  }

  public getRelativePosition(): vec3 | null {
    return this.sceneObject.getTransform().getWorldPosition()
  }

  public getGeoPosition(): GeoPosition | null {
    if (isNull(this.geoPosition)) {
      return this.createGeoPosition()
    }
    return this.geoPosition
  }

  public requestNewGeoPosition(geoPosition: GeoPosition): boolean {
    // Geo position is calculated on request from scene position.
    return false
  }

  public getOrientation(): quat {
    return this.sceneObject.getTransform().getWorldRotation()
  }

  private createGeoPosition(): GeoPosition {
    const userGeoPosition = this.userPosition.getGeoPosition()

    const userLatitude = userGeoPosition.latitude

    const userTransform = this.userPosition.getRelativeTransform()
    const objectPosition = this.sceneObject.getTransform().getWorldPosition()
    const userPosition = userTransform.getWorldPosition()
    const userGeoOrientation = this.userPosition.getNorthAlignedOrientation()
    const objectDisplacement = objectPosition.sub(userPosition)
    const bearing = normalizeAngle(customGetEuler(userGeoOrientation).y) * MathUtils.DegToRad
    const cosBearing = Math.cos(bearing)
    const sinBearing = Math.sin(bearing)

    let northEastDisplacement = new vec3(
      objectDisplacement.x * cosBearing - objectDisplacement.z * sinBearing,
      0,
      objectDisplacement.x * sinBearing + objectDisplacement.z * cosBearing,
    )

    northEastDisplacement = northEastDisplacement.div(new vec3(100, 100, 100))
    const northDisplacement = -northEastDisplacement.z
    const eastDisplacement = northEastDisplacement.x

    // Note: This is an approximation which holds for distances under a few Km.
    const latitudeDisplacement = northDisplacement / 111111
    const longitudeDisplacement = eastDisplacement / (111111 * Math.cos(userLatitude * MathUtils.DegToRad))

    const position = GeoPosition.create()
    position.longitude = userGeoPosition.longitude + longitudeDisplacement
    position.latitude = userLatitude + latitudeDisplacement
    return position
  }

  protected checkVisited(): boolean {
    const worldPosition = this.sceneObject.getTransform().getWorldPosition()
    const userPosition = this.userPosition.getRelativeTransform().getWorldPosition()
    return worldPosition.distance(userPosition) < this.visitDistance
  }
}

/**
 * Specs Inc. 2026
 * Place implementation based on LocatedAtComponent for Custom Location scans. Dynamically updates
 * world space position as LocatedAtComponent localizes for improved accuracy, manages nearby
 * detection with configurable activation distance, auto-enables component on approach with buffer
 * timing, and tracks tracking state for indoor-outdoor transition handling.
 */
import Event from "SpectaclesInteractionKit.lspkg/Utils/Event"
import {CancelToken, setTimeout} from "SpectaclesInteractionKit.lspkg/Utils/FunctionTimingUtils"
import {GeoLocationPlace} from "./GeoLocationPlace"
import {normalizeAngle} from "./NavigationUtils"
import {UserPosition} from "./UserPosition"

/**
 * Represents a {@link Place} based off a {@link LocatedAtComponent}.
 * The position in world space is subject to change when the {@link LocatedAtComponent} localizes against a position and
 * is able to give a more accurate position.
 *
 * @remarks - A {@link LocatedAtComponent} can contain different sorts of locations, this component is design to only
 * work with Custom Location scans made on Spectacles.
 *
 * @version 1.0.0
 */
export class CustomLocationPlace extends GeoLocationPlace {
  public readonly locatedAt: LocatedAtComponent
  private readonly center: Transform
  private readonly distanceToActivate: number
  private readonly enableBufferTime = 5000
  private _isNearby: boolean = false
  private _ready: boolean = false
  protected _isTracking = false
  private enableTimeout: CancelToken

  private status: string | null = null

  private nearbyEvent = new Event<boolean>()
  public onNearby = this.nearbyEvent.publicApi()

  public get isNearby(): boolean {
    return this._isNearby
  }

  public get isTracking(): boolean {
    return this._isTracking
  }

  public override get ready(): boolean {
    return this._ready
  }

  /**
   * If true, this script will enable the {@link LocatedAtComponent} on approach.
   */
  public changeLocatedAtEnabled = false

  constructor(
    locatedAt: LocatedAtComponent,
    center: Transform,
    name: string,
    icon: Texture,
    description: string,
    distanceToActivate: number,
    userPosition: UserPosition,
  ) {
    super(null, distanceToActivate, name, icon, description, userPosition)

    if (isNull(locatedAt)) {
      throw new Error("CustomLocationPlace passed null LocatedAt " + name)
    }
    if (isNull(locatedAt.location)) {
      throw new Error("CustomLocationPlace passed LocatedAt with null location " + name)
    }

    this.locatedAt = locatedAt
    this.center = center
    this.distanceToActivate = distanceToActivate

    this.locatedAt.onFound.add(() => {
      if (global.deviceInfoSystem.isEditor()) {
        // editor will find places immediately, disabled to allow testing in editor
        return
      }
      this.status = "found"
      this._isTracking = true
      this.statusUpdateEvent.invoke()
    })
    this.locatedAt.onLost.add(() => {
      this._isTracking = false
      this.status = "lost"
      this.statusUpdateEvent.invoke()
    })
    this.locatedAt.onCanTrack.add(() => {
      this.status = "can track"
      this.statusUpdateEvent.invoke()
    })
    this.locatedAt.onCannotTrack.add(() => {
      this.status = "cannot track"
      this.statusUpdateEvent.invoke()
    })
    this.locatedAt.onError.add(() => {
      this.status = "error"
      this.statusUpdateEvent.invoke()
    })
    this.locatedAt.onReady.add(() => {
      this._ready = true
      this.status = "ready"
      this.statusUpdateEvent.invoke()
    })

    this.status = "not downloaded"
    this.userPosition.onUserPositionUpdated.add(() => {
      this.checkDistance()
    })

    this.downloadGeoLocation(locatedAt.location)
  }

  public override requestNewGeoPosition(geoPosition: GeoPosition): boolean {
    // geo position is not overridable.
    return false
  }

  public getRelativePosition(): vec3 | null {
    if (!this._isTracking && isNull(this.geoPosition)) {
      return null
    } else if (this.calculateInWorldSpace(this.userPosition)) {
      return this.center.getWorldPosition()
    } else {
      const yDisplacement = this.getDisplacementWorldSpace().y
      return super.calculateRelativePosition(yDisplacement)
    }
  }

  public getGeoPosition(): GeoPosition | null {
    return this.geoPosition
  }

  public getOrientation(): quat {
    return quat.quatIdentity()
  }

  protected calculateInWorldSpace(userPosition: UserPosition): boolean {
    return (
      (this._isTracking || isNull(this.geoPosition) || isNull(userPosition.getGeoPosition())) &&
      !global.deviceInfoSystem.isEditor()
    )
  }

  public override getBearing(userPosition: UserPosition): number | null {
    if (this.calculateInWorldSpace(this.userPosition)) {
      let displacement = this.getDisplacementWorldSpace()
      displacement = displacement.normalize()
      const degreeDisplacement = Math.atan2(displacement.z, displacement.x) + Math.PI / 2

      const userForward = userPosition.getRelativeTransform().forward
      const userWorldSpaceBearing = Math.atan2(userForward.z, userForward.x) - Math.PI / 2

      return normalizeAngle(degreeDisplacement - userWorldSpaceBearing)
    } else {
      return super.getBearing(userPosition)
    }
  }

  public setLocatedAtEnabled(enabled: boolean): void {
    if (this.changeLocatedAtEnabled) {
      this.locatedAt.sceneObject.enabled = enabled
    }
  }

  private checkDistance(): void {
    if (isNull(this.geoPosition)) {
      return
    }

    const displacement = this.userPosition.getDistanceTo(this)
    const userAccuracy = this.userPosition.getGeoPosition().horizontalAccuracy
    const placeAccuracy = this.geoPosition.horizontalAccuracy
    const totalAccuracy = userAccuracy + placeAccuracy + this.distanceToActivate
    const nearby = displacement < totalAccuracy

    if (this._isNearby === nearby) {
      return
    }
    this._isNearby = nearby

    if (!isNull(this.enableTimeout)) {
      this.enableTimeout.cancelled = true
    }
    this.enableTimeout = setTimeout(() => {
      this.setLocatedAtEnabled(nearby)
    }, this.enableBufferTime)
    this.nearbyEvent.invoke(nearby)
  }

  private getDisplacementWorldSpace(): vec3 {
    const endWorldPosition = this.center.getWorldPosition()
    const userWorldPosition = this.userPosition.getRelativeTransform().getWorldPosition()
    return endWorldPosition.sub(userWorldPosition)
  }

  protected checkVisited(): boolean {
    if (global.deviceInfoSystem.isEditor()) {
      return false
    }
    return this._isTracking
  }

  private async downloadGeoLocation(location: LocationAsset): Promise<void> {
    this.geoPosition = await GeoLocation.getGeoPositionForLocation(location)
  }
}

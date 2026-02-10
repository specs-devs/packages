/**
 * Specs Inc. 2026
 * Mutable UserPosition implementation with configurable GPS updates and orientation tracking. Integrates
 * LocationService for real-time geo position and north-aligned orientation, manages update frequency
 * and accuracy settings, calculates bearing and distance to places, publishes position update events,
 * and maintains internal state for NavigationComponent while exposing read-only UserPosition interface.
 */
import Event, {callback, PublicApi} from "SpectaclesInteractionKit.lspkg/Utils/Event"
import {customGetEuler, normalizeAngle} from "./NavigationUtils"
import {Place} from "./Place"
import {log, UserPosition, UserPositionStatus} from "./UserPosition"

/**
 * An implementation of {@link UserPosition} that allows it's internals to be updated and changed.
 * To be references inside {@link NavigationComponent}, but to be passed as a read-only {@link UserPosition} outside.
 *
 * @version 1.0.0
 */
export class EditableUserPosition implements UserPosition {
  private readonly _transform: Transform
  private readonly locationService: LocationService
  private updateFrequency: number = 1
  private updatesInitialized: boolean = false
  private _geoPosition: GeoPosition | null
  private _status = UserPositionStatus.Unknown
  private lastUpdate = 0
  private orientation = quat.quatIdentity()

  get status(): UserPositionStatus {
    return this._status
  }

  get gpsActive(): boolean {
    return this.updateFrequency > 0
  }

  private userPositionUpdatedEvent = new Event<void>()
  public onUserPositionUpdated: PublicApi<void> = this.userPositionUpdatedEvent.publicApi()

  constructor(attachScript: ScriptComponent, transform: Transform) {
    this._transform = transform
    this.locationService = GeoLocation.createLocationService()

    attachScript.createEvent("UpdateEvent").bind(() => {
      this.update()
    })
  }

  public initializeGeoLocationUpdates(accuracy: GeoLocationAccuracy, updateFrequency: number): void {
    this.updateFrequency = updateFrequency
    this.locationService.onNorthAlignedOrientationUpdate.add(this.handleNorthAlignedOrientationUpdate.bind(this))
    this.locationService.accuracy = accuracy

    this.updatesInitialized = true
  }

  /**
   * The position of the user in Geo Space.
   *  @remarks - May be null if location services are not working.
   */
  public getGeoPosition(): GeoPosition | null {
    return this._geoPosition
  }
  public getRelativeTransform(): Transform {
    return this._transform
  }
  public getBearing(): number {
    // GeoLocation.getNorthAlignedHeading() currently returns a offsetted heading when the user tilts their head in multiple axis.
    // (e.g. tilting upward in x-axis and then to the left along the z-axis. The heading calculated from GeoLocation.getNorthAlignedHeading() will then start shifting to the left)
    // This is a temporary fix to minimize the shifting. This will be replaced by GeoLocation.getNorthAlignedHeading when the issue is fixed.
    const bearing = normalizeAngle(customGetEuler(this.orientation).y)

    // TODO: Remove the negative sign when the heading is fixed in the Lens Studio
    if (global.deviceInfoSystem.isEditor()) {
      return -bearing
    }
    return bearing
  }

  public getDistanceTo(location: Place): number | null {
    const displacement = this.getDisplacement(location)
    if (isNull(displacement)) {
      return null
    }
    return displacement.length / 100
  }

  public getBearingTo(location: Place, world: boolean = false): number | null {
    let displacement = this.getDisplacement(location)
    if (isNull(displacement)) {
      return null
    }
    displacement = displacement.normalize()
    const angleDisplacement = Math.atan2(displacement.z, displacement.x) + Math.PI / 2

    if (world) {
      return normalizeAngle(angleDisplacement)
    }

    const userForward = this.getRelativeTransform().forward
    const userWorldSpaceBearing = Math.atan2(userForward.z, userForward.x) - Math.PI / 2

    return normalizeAngle(angleDisplacement - userWorldSpaceBearing)
  }

  public getNorthAlignedOrientation(): quat {
    return this.orientation
  }

  private update(): void {
    //User / Map location update
    if (this.updatesInitialized && getTime() - this.lastUpdate > this.updateFrequency) {
      this.fetchLocation((location: GeoPosition) => {
        this.updateGeoPosition(location)
        this._status = UserPositionStatus.GeoLocalizationAvailable
      })

      this.lastUpdate = getTime()
    }
  }

  private updateGeoPosition(geoPosition: GeoPosition): void {
    this._geoPosition = geoPosition
    this.userPositionUpdatedEvent.invoke()
  }

  private fetchLocation(callback: callback<GeoPosition>) {
    this.locationService.getCurrentPosition(
      (geoPosition) => {
        callback(geoPosition)
      },
      (error) => {
        log.e(`Error fetching location: ${error} \n ${Error().stack}`)
      },
    )
  }

  private handleNorthAlignedOrientationUpdate(orientation: quat) {
    this.orientation = orientation
  }

  private getDisplacement(location: Place): vec3 | null {
    const endWorldPosition = location.getRelativePosition()
    if (isNull(endWorldPosition)) {
      return null
    }
    const userWorldPosition = this.getRelativeTransform().getWorldPosition()
    return endWorldPosition.sub(userWorldPosition)
  }
}

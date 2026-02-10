/**
 * Specs Inc. 2026
 * User position interface for navigation tracking in world and geo space. Defines methods for GPS
 * initialization with accuracy and update frequency, provides geo position and relative transform
 * access, calculates bearing (north-aligned orientation) and distance to places, publishes position
 * update events, and reports location service status for debugging navigation issues.
 */
import {PublicApi} from "SpectaclesInteractionKit.lspkg/Utils/Event"
import NativeLogger from "SpectaclesInteractionKit.lspkg/Utils/NativeLogger"
import {Place} from "./Place"

const TAG = "[User Position]"
export const log = new NativeLogger(TAG)

/**
 * Represents the position of the user in both world and geo space.
 * Updates when new data is received.
 *
 * @version 1.0.0
 */
export interface UserPosition {
  /**
   * Initializes the user position for use.
   *
   * @param accuracy - The accuracy of geo location to be used. Expected to be {@link GeoLocationAccuracy.Navigation}.
   * @param updateFrequency - The time, in seconds, in which a new position should be requested.
   */
  initializeGeoLocationUpdates(accuracy: GeoLocationAccuracy, updateFrequency: number): void

  /**
   * The position of the user in Geo Space.
   *  @remarks - May be null if location services are not working.
   */
  getGeoPosition(): GeoPosition | null

  /**
   * Returns the relative position and orientation of the user with respect to the initial position of the user when the
   * session started.
   */
  getRelativeTransform(): Transform

  /**
   * Returns the users north aligned orientation in radians. Indicates how far off from heading north the device is.
   * Zero represents true north, and the direction is determined clockwise
   */
  getBearing(): number

  /**
   * Returns a quaternion representing the north aligned orientation of the user.
   */
  getNorthAlignedOrientation(): quat

  /**
   * Returns the distance, in meters, from the user to the provided navigation location.
   */
  getDistanceTo(location: Place): number | null

  /**
   * Returns the bearing, in radians, from the current user position to the navigation target location.
   * @param location - The place to be directed to.
   * @param world - If true, the users bearing will not be taken into account.
   */
  getBearingTo(location: Place, world: boolean): number | null

  /**
   * Returns the status of the internal location, for use with debugging potentially hidden code.
   */
  get status(): UserPositionStatus

  /**
   * Called when the position has been updated.
   */
  onUserPositionUpdated: PublicApi<void>

  /**
   * Returns true if GPS is active.
   */
  get gpsActive(): boolean
}

export enum UserPositionStatus {
  /**
   * User position can not be determined.
   */
  Unknown,
  /**
   * Position unknown as could not connect to any network.
   */
  UnknownErrorNetworkMissing,
  /**
   * Position unknown due to poor GPS.
   */
  UnknownPoorGPSReception,
  /**
   * Working and available.
   */
  GeoLocalizationAvailable,
  /**
   * Location found, but inaccurate.
   */
  GlobalLocalizationPoorGPSReception,
  /**
   * Could not download the necessary assets.
   */
  ErrorTrackingAssetFailedToDownload,
}

/**
 * Specs Inc. 2026
 * Abstract base class for navigation destinations in world or geo space. Defines common interface for
 * place name, icon, description, and visit status, provides methods for relative position, orientation,
 * and geo coordinates, manages distance and bearing calculations to place, and emits status update
 * events for UI synchronization across navigation system.
 */
import Event from "SpectaclesInteractionKit.lspkg/Utils/Event"
import {LensConfig} from "SpectaclesInteractionKit.lspkg/Utils/LensConfig"

/**
 * Represents a place in either the simulation space or in geo space with {@link GeoPosition}.
 *
 * @version 1.0.0
 */
export abstract class Place {
  private _name: string
  private _icon: Texture
  private _description: string
  private _visited: boolean = false
  protected statusUpdateEvent = new Event<void>()

  /**
   * The name of the place.
   */
  public get name(): string {
    return this._name
  }

  /**
   * An icon associated with the place.
   * For use in menus.
   */
  public get icon(): Texture {
    return this._icon
  }
  /**
   * A short text description of the place.
   */
  public get description(): string {
    return this._description
  }

  /**
   * Returns true if this place has been visited.
   */
  public get visited(): boolean {
    return this._visited
  }

  /**
   * Returns true if the place is ready to be navigated to.
   */
  public get ready(): boolean {
    return true
  }

  /**
   * Returns the relative position of this location with respect to the initial position of the user when the session
   * started.
   */
  public abstract getRelativePosition(): vec3 | null

  /**
   * Returns the geo-referenced position of this location in the world, represented using the GeoPosition data structure.
   * Contains latitude, longitude and altitude among other data.
   */
  public abstract getGeoPosition(): GeoPosition | null

  /**
   * Returns the orientation of the location represented as a quaternion.
   */
  public abstract getOrientation(): quat

  /**
   * Request a new geo position for the place.
   * Returns true if accepted, false if rejected.
   *
   * @param geoPosition - The new geo position.
   */
  public abstract requestNewGeoPosition(geoPosition: GeoPosition): boolean

  /**
   * Triggered whenever there is an update to the tracking or status
   */
  public onStatusUpdated = this.statusUpdateEvent.publicApi()

  constructor(name: string, icon: Texture, description: string) {
    this._name = name
    this._icon = icon
    this._description = description

    const updateDispatcher = LensConfig.getInstance().updateDispatcher
    updateDispatcher.createUpdateEvent("UpdateEvent").bind(() => {
      if (this.checkVisited()) {
        this._visited = true
      }
    })
  }

  /**
   * Override and implement a check to see if the place has been visited.
   */
  protected abstract checkVisited(): boolean
}

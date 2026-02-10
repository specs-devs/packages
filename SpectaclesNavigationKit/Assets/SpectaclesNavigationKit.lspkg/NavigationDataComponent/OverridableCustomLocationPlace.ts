/**
 * Specs Inc. 2026
 * Extended CustomLocationPlace with manual position override capability for location groups. Allows
 * approximate positioning before LocatedAtComponent localization by accepting override coordinates,
 * automatically switches to precise tracking position once localization completes, and enables indoor
 * navigation by calculating relative positions within CustomLocationGroupComponent members.
 */
import {CustomLocationPlace} from "./CustomLocationPlace"
import {UserPosition} from "./UserPosition"

/**
 * Extends {@link PlaceLocatedAt} to allow for an override of world space to be provided.
 *
 * @version 1.0.0
 */
export class OverridableCustomLocationPlace extends CustomLocationPlace {
  private overridePosition: vec3 | null

  public override getRelativePosition(): vec3 {
    if (this._isTracking || isNull(this.overridePosition)) {
      return super.getRelativePosition()
    } else {
      return this.overridePosition
    }
  }

  public setOverride(overridePosition: vec3 | null): void {
    this.overridePosition = overridePosition
  }

  protected override calculateInWorldSpace(userPosition: UserPosition): boolean {
    return super.calculateInWorldSpace(userPosition) || !isNull(this.overridePosition)
  }
}

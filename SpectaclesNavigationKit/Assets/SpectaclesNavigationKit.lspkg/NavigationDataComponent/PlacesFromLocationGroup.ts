/**
 * Specs Inc. 2026
 * Location group manager for indoor navigation with relative position calculation. Creates Places
 * for CustomLocationGroupComponent members with known spatial relationships, initially tracks via
 * GeoPosition until first member localizes, then calculates approximate positions for all members
 * using inverse transform matrices, and progressively refines to precise localized positions for
 * seamless outdoor-to-indoor navigation transitions.
 */
import {CustomLocationPlaceInput} from "./ManualPlaceList"
import {NavigationDataComponent} from "./NavigationDataComponent"
import {OverridableCustomLocationPlace} from "./OverridableCustomLocationPlace"

/**
 * Maps {@link Place}s to members of a {@link CustomLocationGroupComponent}.
 * Custom Location Groups have the added advantage that their relative position
 * to each other is known. As soon as a single member of the group has been
 * localized, an approximate position of each other member can be made.
 *
 * This script creates {@link Place}s for each component, that will track
 * from the {@link GeoPosition}, until one of the members has been localized. At
 * that point, the markers will be updated with a more accurate approximation of
 * their position allowing indoor navigation.
 * Once the {@link LocatedAtComponent} have been localized it produces a final
 * and the most accurate position for them, which will be the position of the
 * marker from then on.
 *
 * @version 1.0.0
 */
export class PlacesFromLocationGroup {
  private readonly navigationComponent: NavigationDataComponent
  private readonly locatedAts: LocatedAtComponent[]
  private readonly centerPoints: SceneObject[]
  private readonly _inputPlaceBinding: PlaceInputBinding[] = []

  private relativeInverseLocalTransforms: mat4[] = []
  private places: OverridableCustomLocationPlace[] = []

  public get inputPlaceBinding() {
    return this._inputPlaceBinding
  }

  public constructor(locatedAtInput: CustomLocationPlaceInput[], navigationComponent: NavigationDataComponent) {
    this.locatedAts = locatedAtInput.map((m) => m.locatedAt)
    this.centerPoints = locatedAtInput.map((m) => m.center)
    this.navigationComponent = navigationComponent

    this.validate()

    for (let i = 0; i < locatedAtInput.length; i++) {
      if (!locatedAtInput[i].active) {
        continue
      }
      const locatedAt = locatedAtInput[i].locatedAt
      const centerTransform = this.centerPoints[i].getTransform()
      const inputParams = locatedAtInput[i]
      this.relativeInverseLocalTransforms[i] = centerTransform.getInvertedWorldTransform()

      const place = new OverridableCustomLocationPlace(
        locatedAt,
        this.centerPoints[i].getTransform(),
        inputParams.label,
        inputParams.icon,
        inputParams.description,
        inputParams.distanceToActivate,
        this.navigationComponent.getUserPosition(),
      )
      this.navigationComponent.addPlace(place)
      this.places[i] = place

      locatedAt.onFound.add(() => {
        this.updateRelativeLocations(this.relativeInverseLocalTransforms[i], centerTransform)
      })

      this._inputPlaceBinding.push({place: place, input: locatedAtInput[i]})
    }
  }

  private updateRelativeLocations(inverse: mat4, newPosition: Transform): void {
    const newMatrix = newPosition.getInvertedWorldTransform().inverse()
    const newMap = newMatrix.mult(inverse)

    for (let i = 0; i < this.relativeInverseLocalTransforms.length; i++) {
      const m = this.relativeInverseLocalTransforms[i]
      const newPos = newMap.mult(m.inverse())

      this.places[i].setOverride(this.getPosition(newPos))
    }
  }

  private validate(): void {
    if (this.locatedAts.length !== this.centerPoints.length) {
      throw new Error("Center points and located at lists must be the same length.")
    }
    for (let i = 0; i < this.locatedAts.length; i++) {
      const centerParent = this.centerPoints[i].getParent()
      const locatedSceneObject = this.locatedAts[i].sceneObject
      if (centerParent !== locatedSceneObject) {
        throw new Error("Center points and located ats must be in the same order.")
      }
    }
  }

  private getPosition(matrix: mat4): vec3 {
    return new vec3(matrix.column3.x, matrix.column3.y, matrix.column3.z)
  }
}

export type PlaceInputBinding = {place: OverridableCustomLocationPlace; input: CustomLocationPlaceInput}

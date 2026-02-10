/**
 * Specs Inc. 2026
 * Manual place list definitions with input typedefs for geo locations, custom locations, and scene objects.
 * Provides GeoPlaceInput for lat/long coordinates, CustomLocationPlaceInput for LocatedAtComponent-based
 * places, and SceneObjectPlaceInput for world-space navigation, each with configurable icons, descriptions,
 * and visit/activation distance thresholds for flexible navigation setup.
 */
import {GeoLocationPlace} from "./GeoLocationPlace"
import {IPlaceImageRegister} from "./IPlaceImageRegister"
import {CustomLocationPlace} from "./CustomLocationPlace"
import {NavigationDataComponent} from "./NavigationDataComponent"
import {convertToNumber} from "./NavigationUtils"
import {Place} from "./Place"
import {PlacesFromLocationGroup} from "./PlacesFromLocationGroup"
import {SceneObjectPlace} from "./SceneObjectPlace"

/**
 * Defines a simple longitude, latitude coordinate and registers a {@link Place} from that.
 */
@typedef
export class GeoPlaceInput {
  @input active: boolean = true
  @input latitude: string
  @input longitude: string
  @input label: string
  @input
  @hint("Texture that will be located on the default 3D pin and in the compass carousel.")
  icon: Texture
  @input description: string
  @input
  @hint("The distance, in meters, calculated from geo positions, that the user must be to visit the place.")
  distanceToActivate: number = 10
}

/**
 * Defines a place from a {@link LocatedAtComponent}.
 */
@typedef
export class CustomLocationPlaceInput {
  @input active: boolean = true
  @input locatedAt: LocatedAtComponent
  @input center: SceneObject
  @input label: string
  @input
  @hint("Texture that will be located on the default 3D pin and in the compass carousel.")
  icon: Texture
  @input description: string

  @input
  @hint("A prompt image to help the user arrive at the location.")
  promptImage: Texture
  @input
  @hint("The distance, in meters, calculated from geo positions, that the user must be to visit the place.")
  distanceToActivate: number = 10
}

/**
 * Defines a place from a {@link SceneObject}.
 */
@typedef
export class SceneObjectPlaceInput {
  @input active: boolean = true
  @input sceneObject: SceneObject
  @input label: string
  @input
  @hint("Texture that will be located on the default 3D pin and in the compass carousel.")
  icon: Texture
  @input description: string
  @input
  @hint("The distance, in meters, calculated from geo positions, that the user must be to visit the place.")
  distanceToActivate: number = 10
}

/**
 * Defines a group of places as a group.
 * Intended to be used in conjunction with {@link CustomLocationGroupComponent}.
 */
@typedef
export class CustomLocationGroupPlaceInput {
  @input active: boolean = true
  @input customLocations: CustomLocationPlaceInput[]
}

/**
 * Allows users to collect together a set of place definitions.
 * This class then creates and registers all of these places with the {@link NavigationDataComponent}.
 *
 * @version 1.0.0
 */
@component
export class ManualPlaceList extends BaseScriptComponent {
  private groupManagers: PlacesFromLocationGroup[] = []
  private customLocationPlaces: CustomLocationPlace[] = []

  @input private navigationDataComponent: NavigationDataComponent

  @ui.separator
  @input
  @label("Manual Geo Places")
  private readonly placeInputs: GeoPlaceInput[]
  @input
  @label("Scene Object Places")
  private readonly sceneObjects: SceneObjectPlaceInput[]
  @input
  @label("Custom Location Places")
  private readonly customLocationComponents: CustomLocationPlaceInput[]
  @input
  @label("Custom Location Group Places")
  private readonly locationGroupComponents: CustomLocationGroupPlaceInput[]

  @ui.separator
  @allowUndefined
  @input
  @hint("(Optional) Image display for Custom Location Places.")
  private imageDisplay: IPlaceImageRegister

  private onAwake(): void {
    this.createEvent("OnStartEvent").bind(() => {
      this.start()
    })
  }

  private start(): void {
    const userPosition = this.navigationDataComponent.getUserPosition()

    this.placeInputs.forEach((m) => {
      if (m.active) {
        const geoPosition = GeoPosition.create()
        geoPosition.longitude = convertToNumber(m.longitude)
        geoPosition.latitude = convertToNumber(m.latitude)

        const place = new GeoLocationPlace(
          geoPosition,
          m.distanceToActivate,
          m.label,
          m.icon,
          m.description,
          userPosition,
        )
        this.navigationDataComponent.addPlace(place)
      }
    })

    this.customLocationComponents.forEach((m) => {
      if (m.active) {
        const place = new CustomLocationPlace(
          m.locatedAt,
          m.center.getTransform(),
          m.label,
          m.icon,
          m.description,
          m.distanceToActivate,
          this.navigationDataComponent.getUserPosition(),
        )
        this.navigationDataComponent.addPlace(place)
        place.changeLocatedAtEnabled = true

        if (!isNull(this.imageDisplay) && !isNull(m.promptImage)) {
          this.imageDisplay.register(place, m.promptImage)
        }

        this.customLocationPlaces.push(place)
      }
    })

    this.sceneObjects.forEach((m) => {
      if (m.active) {
        const place = new SceneObjectPlace(
          m.sceneObject,
          m.distanceToActivate,
          m.label,
          m.icon,
          m.description,
          userPosition,
        )
        this.navigationDataComponent.addPlace(place)
      }
    })

    this.locationGroupComponents.forEach((m) => {
      if (m.active) {
        const groupManager = new PlacesFromLocationGroup(m.customLocations, this.navigationDataComponent)
        this.groupManagers.push(groupManager)
        if (!isNull(this.imageDisplay)) {
          groupManager.inputPlaceBinding.forEach((binding) => {
            if (isNull(binding.input.promptImage)) {
              this.imageDisplay.register(binding.place, binding.input.promptImage)
            }
          })
        }
      }
    })

    this.navigationDataComponent.onNavigationStarted.add((p) => this.enableCustomLocationPlacesOnSelection(p))
  }

  private enableCustomLocationPlacesOnSelection(place: Place): void {
    this.customLocationPlaces.find((e) => e === place)?.setLocatedAtEnabled(true)
  }
}

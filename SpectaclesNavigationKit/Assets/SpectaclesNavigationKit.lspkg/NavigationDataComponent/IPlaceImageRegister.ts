/**
 * Specs Inc. 2026
 * Interface for registering place-to-texture bindings in navigation system. Enables dependency injection
 * during Place creation for associating CustomLocationPlace instances with preview images, allowing
 * external systems to track and manage visual assets for location markers and UI displays.
 */
import {CustomLocationPlace} from "./CustomLocationPlace"

/**
 * Some classes my wish to create a binding between {@link Place}s and {@link Texture}s.
 * By implementing this interface they can be injected into the {@link Place} creation process and have this link
 * registered.
 *
 * @version 1.0.0
 */
export interface IPlaceImageRegister extends BaseScriptComponent {
  /**
   * Registers a binding between a place and an image.
   *
   * @param customLocationPlace - The place.
   * @param image - The image.
   */
  register(customLocationPlace: CustomLocationPlace, image: Texture): void
}

/**
 * Specs Inc. 2026
 * Screen transform utilities for UI dimension calculations, position conversions, and click detection.
 * Provides helper functions for working with ScreenTransform components in Lens Studio.
 */

/**
 * Utility class for screen transform operations
 */
export class ScreenTransformUtils {
  /**
   * Get screen transform positions as array
   * Useful for checking if screen transform bounds changed
   * @param screenTransform - ScreenTransform component
   * @returns Array of positions [topLeft, bottomRight]
   */
  static getScreenTransformPositionsAsArray(screenTransform: ScreenTransform): vec3[] {
    return [
      screenTransform.localPointToWorldPoint(vec2.zero()),
      screenTransform.localPointToWorldPoint(vec2.one())
    ];
  }

  /**
   * Check if screen transform was clicked at screen point
   * Checks if transform is enabled in hierarchy and contains the point
   * @param screenTransform - ScreenTransform component
   * @param screenPoint - Screen point to test
   * @returns True if clicked, false otherwise
   */
  static wasClicked(screenTransform: ScreenTransform, screenPoint: vec2): boolean {
    return screenTransform.getSceneObject().isEnabledInHierarchy &&
           screenTransform.containsScreenPoint(screenPoint);
  }

  /**
   * Get world width of screen transform
   * @param screenTransform - ScreenTransform component
   * @returns World width in units
   */
  static getScreenTransformWorldWidth(screenTransform: ScreenTransform): number {
    return screenTransform
      .localPointToWorldPoint(new vec2(-1, -1))
      .distance(screenTransform.localPointToWorldPoint(new vec2(1, -1)));
  }

  /**
   * Get world height of screen transform
   * @param screenTransform - ScreenTransform component
   * @returns World height in units
   */
  static getScreenTransformWorldHeight(screenTransform: ScreenTransform): number {
    return screenTransform
      .localPointToWorldPoint(new vec2(-1, 1))
      .distance(screenTransform.localPointToWorldPoint(new vec2(-1, -1)));
  }

  /**
   * Convert world width to parent-relative width (0-1)
   * @param parentScreenTransform - Parent ScreenTransform
   * @param worldWidth - World width to convert
   * @returns Relative width (0-1)
   */
  static getWorldWidthToRelativeToParentWidth(
    parentScreenTransform: ScreenTransform,
    worldWidth: number
  ): number {
    return worldWidth / ScreenTransformUtils.getScreenTransformWorldWidth(parentScreenTransform);
  }

  /**
   * Convert world height to parent-relative height (0-1)
   * @param parentScreenTransform - Parent ScreenTransform
   * @param worldHeight - World height to convert
   * @returns Relative height (0-1)
   */
  static getWorldHeightToRelativeToParentHeight(
    parentScreenTransform: ScreenTransform,
    worldHeight: number
  ): number {
    return worldHeight / ScreenTransformUtils.getScreenTransformWorldHeight(parentScreenTransform);
  }

  /**
   * Set screen transform rectangle using normalized coordinates (0-1)
   * @param screenTransform - ScreenTransform component
   * @param x - X position (0-1)
   * @param y - Y position (0-1)
   * @param width - Width (0-1)
   * @param height - Height (0-1)
   */
  static setScreenTransformRect01(
    screenTransform: ScreenTransform,
    x: number,
    y: number,
    width: number,
    height: number
  ): void {
    const lerp = (start: number, end: number, scalar: number): number => {
      return start + (end - start) * scalar;
    };

    screenTransform.anchors.left = lerp(-1, 1, x);
    screenTransform.anchors.right = screenTransform.anchors.left + width * 2;
    screenTransform.anchors.top = lerp(1, -1, y);
    screenTransform.anchors.bottom = screenTransform.anchors.top - height * 2;
  }

  /**
   * Compare screen transform position arrays
   * Useful for checking if screen transform bounds changed
   * @param a - First position array
   * @param b - Second position array
   * @returns True if equal, false otherwise
   */
  static compareScreenTransformsPositionsArray(a: vec3[], b: vec3[]): boolean {
    return a.toString() === b.toString();
  }
}

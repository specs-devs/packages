/**
 * Specs Inc. 2026
 * Component search and initialization utilities for finding components in parent hierarchies,
 * safely initializing components, and locating root scene objects with specific components.
 */

/**
 * Utility class for component operations
 */
export class ComponentUtils {
  /**
   * Find component in parent hierarchy (search upwards)
   * @param sceneObject - Starting scene object
   * @param componentTypeName - Component type to find
   * @returns Found component or null
   */
  static findInParents<T extends Component>(
    sceneObject: SceneObject,
    componentTypeName: string
  ): T | null {
    let current: SceneObject | null = sceneObject;

    while (current !== null) {
      const component = current.getComponent(componentTypeName as any);
      if (component) {
        return component as T;
      }
      current = current.getParent();
    }

    return null;
  }

  /**
   * Safely initialize a component (handles already initialized)
   * Attempts to call initialize() method if it exists
   * @param component - Component to initialize
   * @returns True if initialized successfully, false if already initialized or failed
   */
  static safeInitialize(component: any): boolean {
    if (typeof component.initialize === "function") {
      try {
        component.initialize();
        return true;
      } catch (e) {
        // Already initialized or initialization failed
        return false;
      }
    }
    return false;
  }

  /**
   * Find root scene object with specific component
   * Searches through all root objects in the scene
   * @param componentTypeName - Component type to find
   * @returns Scene object with component or null
   */
  static findRootWithComponent(componentTypeName: string): SceneObject | null {
    const objectCount = global.scene.getRootObjectsCount();

    for (let i = 0; i < objectCount; i++) {
      const rootObject = global.scene.getRootObject(i);
      const component = rootObject.getComponent(componentTypeName as any);

      if (component) {
        return rootObject;
      }
    }

    return null;
  }

  /**
   * Find camera in scene root objects
   * Convenience method for locating the main camera
   * @returns Camera scene object or throws error if not found
   */
  static getRootCamera(): SceneObject {
    const cameraObject = ComponentUtils.findRootWithComponent("Component.Camera");

    if (!cameraObject) {
      throw new Error("Camera not found in scene. Please add a camera to your scene.");
    }

    return cameraObject;
  }

  /**
   * Get all components of a specific type from a scene object
   * @param sceneObject - Scene object to search
   * @param componentTypeName - Component type name
   * @returns Array of found components
   */
  static getAllComponents<T extends Component>(
    sceneObject: SceneObject,
    componentTypeName: string
  ): T[] {
    const components: T[] = [];
    const allComponents = sceneObject.getComponents(componentTypeName as any);

    for (let i = 0; i < allComponents.length; i++) {
      components.push(allComponents[i] as T);
    }

    return components;
  }
}

/**
 * Specs Inc. 2026
 * Scene object and component utilities for hierarchy traversal, component finding,
 * and scene graph operations. Provides convenient methods for working with scene objects
 * and their components across the hierarchy.
 */

/**
 * Utility class for scene object operations and component management
 */
export class SceneObjectUtils {
  /**
   * Traverse scene object hierarchy and execute callback on each
   * @param sceneObject - Root scene object to start traversal
   * @param fn - Callback function to execute on each scene object
   * @param includeSelf - Whether to include root in traversal (default: true)
   */
  static forEachSceneObjectInSubHierarchy(
    sceneObject: SceneObject,
    fn: (so: SceneObject) => void,
    includeSelf: boolean = true
  ): void {
    if (includeSelf === undefined || includeSelf) {
      fn(sceneObject);
    }
    for (let i = 0; i < sceneObject.getChildrenCount(); i++) {
      const childSceneObject = sceneObject.getChild(i);
      fn(childSceneObject);
      SceneObjectUtils.forEachSceneObjectInSubHierarchy(childSceneObject, fn, false);
    }
  }

  /**
   * Find script component by property name
   * @param sceneObject - Scene object to search
   * @param propertyName - Property name to look for
   * @returns Found script component or null
   */
  static findScriptComponent(
    sceneObject: SceneObject,
    propertyName: string
  ): ScriptComponent | null {
    const components = sceneObject.getComponents("ScriptComponent");
    for (let idx = 0; idx < components.length; idx++) {
      if ((components[idx] as any)[propertyName]) {
        return components[idx];
      }
    }
    return null;
  }

  /**
   * Get the root scene object from any object in hierarchy
   * @param sceneObject - Any scene object in the hierarchy
   * @returns Root scene object
   */
  static getSceneRoot(sceneObject: SceneObject): SceneObject {
    let parent = sceneObject.getParent();
    let currentSceneObject = sceneObject;

    while (parent !== null) {
      currentSceneObject = parent;
      parent = parent.getParent();
    }

    return currentSceneObject;
  }

  /**
   * Recursively find a component in scene object hierarchy
   * @param root - Root scene object to start search
   * @param typeName - Component type name to find
   * @returns Found component or null
   */
  static findComponentInHierarchy<T extends Component>(
    root: SceneObject,
    typeName: string
  ): T | null {
    // Search all components on root
    const components = root.getComponents("Component.ScriptComponent");
    for (let i = 0; i < components.length; i++) {
      const comp = components[i] as any;
      if (comp.getTypeName && comp.getTypeName() === typeName) {
        return comp as T;
      }
    }

    // Recursively search children
    const childCount = root.getChildrenCount();
    for (let i = 0; i < childCount; i++) {
      const child = root.getChild(i);
      const foundComponent = SceneObjectUtils.findComponentInHierarchy<T>(child, typeName);
      if (foundComponent) {
        return foundComponent;
      }
    }

    return null;
  }

  /**
   * Get component or create if it doesn't exist
   * @param sceneObject - Scene object to get/create component on
   * @param componentTypeName - Component type name
   * @returns Component instance
   */
  static getOrCreateComponent<T extends Component>(
    sceneObject: SceneObject,
    componentTypeName: string
  ): T {
    let component = sceneObject.getComponent(componentTypeName as any);
    if (!component || component === null || component === undefined) {
      component = sceneObject.createComponent(componentTypeName as any);
    }
    return component as T;
  }

  /**
   * Find scene object by name with common naming variations
   * Handles various naming conventions like underscores, colons, prefixes, etc.
   * @param root - Root scene object to search from
   * @param targetName - Base name to search for
   * @param customVariations - Optional custom name variations to check
   * @returns Found scene object or null
   */
  static findSceneObjectByNameVariations(
    root: SceneObject,
    targetName: string,
    customVariations?: string[]
  ): SceneObject | null {
    const objNameLower = root.name.toLowerCase();
    const nameLower = targetName.toLowerCase();

    // Direct match
    if (objNameLower === nameLower) {
      return root;
    }

    // Generate common variations
    const variations = [
      targetName,
      targetName.replace(/_/g, ""),
      targetName.replace(/_/g, " "),
      `mixamorig:${targetName}`,
      `${targetName}_jnt`,
      `${targetName}_bone`,
      `human_low:_${targetName}`,
      `human_high:_${targetName}`,
      `human:_${targetName}`,
      `_${targetName}`,
      `:_${targetName}`,
      `:${targetName}`,
    ];

    // Add custom variations if provided
    if (customVariations) {
      variations.push(...customVariations);
    }

    // Check all variations
    for (const variant of variations) {
      const variantLower = variant.toLowerCase();
      if (objNameLower === variantLower) {
        return root;
      }
      if (objNameLower.endsWith(variantLower)) {
        return root;
      }
    }

    // Search children recursively
    const childCount = root.getChildrenCount();
    for (let i = 0; i < childCount; i++) {
      const child = root.getChild(i);
      const result = SceneObjectUtils.findSceneObjectByNameVariations(
        child,
        targetName,
        customVariations
      );
      if (result) {
        return result;
      }
    }

    return null;
  }
}

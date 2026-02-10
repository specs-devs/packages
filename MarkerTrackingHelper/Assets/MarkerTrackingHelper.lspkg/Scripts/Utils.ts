/**
 * Specs Inc. 2026
 * Utility functions for marker tracking. Provides helper methods for finding cameras and
 * creating marker tracking callbacks with dynamic function invocation.
 */
@component
export class Utils extends BaseScriptComponent {
  onAwake() {}

  static getRootCamera(): SceneObject | null {
    // Get root objects from the scene
    const objectCount = global.scene.getRootObjectsCount();
    for (let i = 0; i < objectCount; i++) {
      const rootObject = global.scene.getRootObject(i);
      const cameraObject = rootObject.getComponent("Component.Camera");
      if (cameraObject) {
        return cameraObject.getSceneObject(); // Return the first root object with a Camera component
      }
    }
    throw new Error(
      "You are missing a camera. Please add a Camera in a Scene."
    );
  }

  static createMarkerCallback<T>(
    scriptComponent: ScriptComponent,
    functionNames: string[]
  ): (args: T) => void {
    if (scriptComponent === undefined) {
      return () => {};
    }
    return (args) => {
      functionNames.forEach((name) => {
        if ((scriptComponent as any)[name]) {
          (scriptComponent as any)[name](args);
        }
      });
    };
  }
}

/**
 * Specs Inc. 2026
 * Utility functions for marker tracking. Provides helper methods for finding cameras and
 * creating marker tracking callbacks with dynamic function invocation.
 */
import { ComponentUtils } from "Utilities.lspkg/Scripts/Utils/ComponentUtils";
import { Logger } from "Utilities.lspkg/Scripts/Utils/Logger";

@component
export class Utils extends BaseScriptComponent {
  onAwake() {}

  // Re-export getRootCamera from Utilities for backward compatibility
  static getRootCamera(): SceneObject | null {
    return ComponentUtils.getRootCamera();
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

/**
 * SPECS Inc. 2027
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

  /* onMarkerFound / onMarkerLost are single assignable properties. Chain the new
   * handler after whatever is already assigned instead of overwriting it. */
  static addMarkerFoundHandler(
    markerTrackingComponent: MarkerTrackingComponent,
    handler: () => void
  ): void {
    const previous = markerTrackingComponent.onMarkerFound;
    markerTrackingComponent.onMarkerFound = () => {
      if (typeof previous === "function") {
        previous();
      }
      handler();
    };
  }

  static addMarkerLostHandler(
    markerTrackingComponent: MarkerTrackingComponent,
    handler: () => void
  ): void {
    const previous = markerTrackingComponent.onMarkerLost;
    markerTrackingComponent.onMarkerLost = () => {
      if (typeof previous === "function") {
        previous();
      }
      handler();
    };
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

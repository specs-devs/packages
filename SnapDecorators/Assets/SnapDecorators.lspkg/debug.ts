/**
 * Specs Inc. 2026
 * Debug utilities for error reporting and scene hierarchy path generation. Provides reportError()
 * for pretty-printed error logging with source maps and spath() for generating unique identifiers
 * based on SceneObject hierarchy position.
 */
import { isComponent } from "./guards";

/** Print details of an error that was caught. */
export function reportError(reason: unknown): void {
  if (reason instanceof Error) {
    reason.stack = SourceMaps.applyToStackTrace(`${reason.stack}`);
    print(`${reason.name}: ${reason.message}\n${reason.stack}`);
  } else if (typeof reason !== "string") {
    print(`${typeof reason}: ${reason}`);
  } else {
    print(`${reason}`);
  }
}

/** Generate a unique identifier based for a node based on its location in the scene hierarchy. */
export function spath(node: SceneObject | Component): string {
  if (isComponent(node)) {
    return `${spath(node.sceneObject)}:${node.getTypeName()}`;
  }
  // node is SceneObject
  if (node.hasParent()) {
    return `${spath(node.getParent())}/${node.name}`;
  }
  return `/${node.name}`;
}

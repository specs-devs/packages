/**
 * Specs Inc. 2026
 * Type guard utilities for runtime type checking of Lens Studio objects. Provides isScriptObject()
 * for validating ScriptObject types and isComponent() for Component type validation with TypeScript
 * type narrowing support.
 */

export function isScriptObject(obj: unknown): obj is ScriptObject {
  if (!obj || typeof obj !== "object") return false;
  const isOfType = (obj as ScriptObject)["isOfType"];
  if (typeof isOfType !== "function") return false;
  const result = isOfType.call(obj, "ScriptObject");
  if (typeof result !== "boolean") return false;
  return result;
}

export function isComponent(obj: unknown): obj is Component {
  return isScriptObject(obj) && obj.isOfType("Component");
}

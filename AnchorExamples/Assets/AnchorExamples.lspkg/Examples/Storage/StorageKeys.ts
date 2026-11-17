/**
 * Glasses Inc. 2026
 * Centralized storage key constants and helpers for persistent storage.
 */

/**
 * Root prefix for all AnchorExamples keys. Bumped for the native AnchorModule port so records written
 * by the previous Spatial Anchors framework (different anchor id format) are never read back.
 */
export const STORAGE_PREFIX: string = "ANCHOR_EXAMPLES_V1"

/** Sub-key for the area name-to-id mapping. */
export const AREAS_KEY: string = "AREAS_KEY"

/** Sub-key for widget transform matrices. */
export const TRANSFORM_KEY: string = "TRANSFORM_KEY"

/** Sub-key for widget type identifiers. */
export const TYPE_KEY: string = "TYPE_KEY"

/** Sub-key for widget serialized content strings. */
export const CONTENT_KEY: string = "CONTENT_KEY"

/** Sub-key for the saved anchor pose (widgetParent world transform, editor / fallback only). */
export const ANCHOR_POSE_KEY: string = "ANCHOR_POSE_KEY"

/** Sub-key for the saved `Anchor.id` of an area (restored with `AnchorSession.resolveAnchor`). */
export const ANCHOR_ID_KEY: string = "ANCHOR_ID_KEY"

/**
 * Returns the storage key prefix scoped to a specific area.
 * @param areaName - The human-readable area/space name.
 */
export function areaKey(areaName: string): string {
  return `${STORAGE_PREFIX}_${areaName}`
}

/**
 * Returns the fully-qualified storage key for data within an area.
 * @param areaName - The area name.
 * @param subKey - One of TRANSFORM_KEY, TYPE_KEY, CONTENT_KEY, ANCHOR_POSE_KEY or ANCHOR_ID_KEY.
 */
export function widgetKey(areaName: string, subKey: string): string {
  return `${STORAGE_PREFIX}_${areaName}_${subKey}`
}

/** Returns the storage key for the global areas map. */
export function areasMapKey(): string {
  return `${STORAGE_PREFIX}_${AREAS_KEY}`
}

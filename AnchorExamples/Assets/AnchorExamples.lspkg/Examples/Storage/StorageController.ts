/**
 * Glasses Inc. 2026
 * Singleton controller for all persistent storage operations.
 * Manages area CRUD, the saved anchor id per area, and widget data serialization via
 * global.persistentStorageSystem.
 */
import {Logger} from "../../Scripts/Logger"
import {WidgetData} from "../App/AppState"
import {
  areasMapKey,
  widgetKey,
  TRANSFORM_KEY,
  TYPE_KEY,
  CONTENT_KEY,
  ANCHOR_POSE_KEY,
  ANCHOR_ID_KEY,
} from "./StorageKeys"

/**
 * Maps area display names to their internal anchor area IDs.
 */
interface AreaNameToAreaId {
  [name: string]: string
}

export class StorageController {
  private static instance: StorageController

  private logger: Logger
  private persistentStorage = global.persistentStorageSystem.store

  private constructor() {
    this.logger = new Logger("StorageController", true)
  }

  static getInstance(): StorageController {
    if (StorageController.instance) {
      return StorageController.instance
    }
    StorageController.instance = new StorageController()
    return StorageController.instance
  }

  // -------------------------------------------------------
  // Areas
  // -------------------------------------------------------

  /** Returns the full area-name → area-id map from persistent storage. */
  getAreas(): Record<string, string> {
    try {
      const json = this.persistentStorage.getString(areasMapKey())
      if (!json || json === "") {
        return {}
      }
      return JSON.parse(json) as AreaNameToAreaId
    } catch (e) {
      this.logger.error(`Error loading areas: ${e}`)
      return {}
    }
  }

  /** Persists a new or updated area entry. */
  saveArea(name: string, id: string): void {
    try {
      const areas = this.getAreas()
      areas[name] = id
      this.persistentStorage.putString(areasMapKey(), JSON.stringify(areas))
      this.logger.info(`Saved area "${name}" with id ${id}`)
    } catch (e) {
      this.logger.error(`Error saving area: ${e}`)
    }
  }

  /** Removes an area, its anchor id and its widget data. */
  deleteArea(name: string): void {
    try {
      this.clearWidgets(name)
      this.clearAnchorId(name)

      const areas = this.getAreas()
      delete areas[name]
      this.persistentStorage.putString(areasMapKey(), JSON.stringify(areas))
      this.logger.info(`Deleted area "${name}"`)
    } catch (e) {
      this.logger.error(`Error deleting area: ${e}`)
    }
  }

  /** Removes all areas, anchor ids and widget data. */
  clearAllAreas(): void {
    try {
      const areas = this.getAreas()
      for (const name of Object.keys(areas)) {
        this.clearWidgets(name)
        this.clearAnchorId(name)
      }
      this.persistentStorage.putString(areasMapKey(), JSON.stringify({}))
      this.logger.info("Cleared all areas")
    } catch (e) {
      this.logger.error(`Error clearing all areas: ${e}`)
    }
  }

  /** Returns the number of currently saved areas. */
  getAreaCount(): number {
    return Object.keys(this.getAreas()).length
  }

  // -------------------------------------------------------
  // Anchor id (native AnchorModule: Anchor.id → AnchorSession.resolveAnchor)
  // -------------------------------------------------------

  /** Stores the `Anchor.id` of the area anchor so it can be resolved on the next visit. */
  saveAnchorId(areaName: string, anchorId: string): void {
    try {
      this.persistentStorage.putString(widgetKey(areaName, ANCHOR_ID_KEY), anchorId)
      this.logger.info(`Saved anchor id for "${areaName}": ${anchorId}`)
    } catch (e) {
      this.logger.error(`Error saving anchor id: ${e}`)
    }
  }

  /** Returns the saved `Anchor.id` for an area, or null when none was saved. */
  loadAnchorId(areaName: string): string | null {
    try {
      const id = this.persistentStorage.getString(widgetKey(areaName, ANCHOR_ID_KEY))
      return id && id !== "" ? id : null
    } catch (e) {
      this.logger.error(`Error loading anchor id: ${e}`)
      return null
    }
  }

  clearAnchorId(areaName: string): void {
    try {
      this.persistentStorage.remove(widgetKey(areaName, ANCHOR_ID_KEY))
    } catch (e) {
      this.logger.error(`Error clearing anchor id: ${e}`)
    }
  }

  // -------------------------------------------------------
  // Widgets
  // -------------------------------------------------------

  /**
   * Saves an array of widget data for a given area.
   * Each widget's transform is encoded as a mat3 (col0=position, col1=rotation euler, col2=scale).
   * Type and content are stored as parallel arrays.
   */
  saveWidgets(areaName: string, widgets: WidgetData[]): void {
    try {
      const transforms: mat3[] = []
      const types: string[] = []
      const contents: string[] = []

      for (const w of widgets) {
        const m = new mat3()
        m.column0 = w.position
        m.column1 = w.rotation
        m.column2 = w.scale
        transforms.push(m)
        types.push(w.type)
        contents.push(w.content)
      }

      this.persistentStorage.putMat3Array(widgetKey(areaName, TRANSFORM_KEY), transforms)
      this.persistentStorage.putStringArray(widgetKey(areaName, TYPE_KEY), types)
      this.persistentStorage.putStringArray(widgetKey(areaName, CONTENT_KEY), contents)

      this.logger.info(`Saved ${widgets.length} widgets for area "${areaName}"`)
    } catch (e) {
      this.logger.error(`Error saving widgets: ${e}`)
    }
  }

  /**
   * Loads widget data for a given area. Returns an empty array if no data found.
   */
  loadWidgets(areaName: string): WidgetData[] {
    try {
      const transforms = this.persistentStorage.getMat3Array(widgetKey(areaName, TRANSFORM_KEY))
      const types = this.persistentStorage.getStringArray(widgetKey(areaName, TYPE_KEY))
      const contents = this.persistentStorage.getStringArray(widgetKey(areaName, CONTENT_KEY))

      if (!transforms || transforms.length === 0) {
        return []
      }

      const widgets: WidgetData[] = []
      for (let i = 0; i < transforms.length; i++) {
        widgets.push({
          position: transforms[i].column0,
          rotation: transforms[i].column1,
          scale: transforms[i].column2,
          type: types[i] ?? "note",
          content: contents[i] ?? "",
        })
      }

      this.logger.info(`Loaded ${widgets.length} widgets for area "${areaName}"`)
      return widgets
    } catch (e) {
      this.logger.error(`Error loading widgets: ${e}`)
      return []
    }
  }

  /** Removes all widget data for the specified area. */
  clearWidgets(areaName: string): void {
    try {
      this.persistentStorage.remove(widgetKey(areaName, TRANSFORM_KEY))
      this.persistentStorage.remove(widgetKey(areaName, TYPE_KEY))
      this.persistentStorage.remove(widgetKey(areaName, CONTENT_KEY))
      this.persistentStorage.remove(widgetKey(areaName, ANCHOR_POSE_KEY))
      this.logger.info(`Cleared widgets for area "${areaName}"`)
    } catch (e) {
      this.logger.error(`Error clearing widgets: ${e}`)
    }
  }

  // -------------------------------------------------------
  // Anchor pose (editor fallback: no anchor service in Lens Studio Preview)
  // -------------------------------------------------------

  /**
   * Saves the widgetParent world pose for an area. Used in Lens Studio Preview, where there is no
   * anchor service, so re-entering an area puts the widgets back where they were.
   */
  saveAnchorPose(areaName: string, position: vec3, rotation: quat): void {
    try {
      const data = JSON.stringify({
        px: position.x, py: position.y, pz: position.z,
        rx: rotation.x, ry: rotation.y, rz: rotation.z, rw: rotation.w,
      })
      this.persistentStorage.putString(widgetKey(areaName, ANCHOR_POSE_KEY), data)
      this.logger.info(`Saved anchor pose for "${areaName}"`)
    } catch (e) {
      this.logger.error(`Error saving anchor pose: ${e}`)
    }
  }

  /**
   * Loads the saved widgetParent pose for an area. Returns null if none was saved.
   */
  loadAnchorPose(areaName: string): {position: vec3, rotation: quat} | null {
    try {
      const data = this.persistentStorage.getString(widgetKey(areaName, ANCHOR_POSE_KEY))
      if (!data || data === "") return null
      const obj = JSON.parse(data)
      return {
        position: new vec3(obj.px, obj.py, obj.pz),
        rotation: new quat(obj.rw, obj.rx, obj.ry, obj.rz),
      }
    } catch (e) {
      this.logger.error(`Error loading anchor pose: ${e}`)
      return null
    }
  }
}

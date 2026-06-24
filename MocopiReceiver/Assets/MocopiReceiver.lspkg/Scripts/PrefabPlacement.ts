/**
 * Specs Inc. 2026
 * Prefab placement controller for Mocopi avatar instantiation with surface placement integration.
 * Automatically detects and connects Mocopi controller from instantiated prefabs.
 */
import { PlacementMode, PlacementSettings } from "SurfacePlacement.lspkg/Scripts/PlacementSettings";

import { SurfacePlacementController } from "SurfacePlacement.lspkg/Scripts/SurfacePlacementController";
import { MocopiMainController } from "./MocopiMainController";
import { SceneObjectUtils } from "Utilities.lspkg/Scripts/Utils/SceneObjectUtils";
import { bindStartEvent } from "SnapDecorators.lspkg/decorators";
import { Logger } from "Utilities.lspkg/Scripts/Utils/Logger";

@component
export class PrefabPlacement extends BaseScriptComponent {
  @input
  @allowUndefined
  objectVisuals: SceneObject;

  @input
  @hint("Prefab to instantiate as child of objectVisuals")
  @allowUndefined
  prefabToPlace: ObjectPrefab;

  // Auto-detected from instantiated prefab
  private mocopiMainController: MocopiMainController = null;

  @input("int")
  @widget(
    new ComboBoxWidget([
      new ComboBoxItem("Near Surface", 0),
      new ComboBoxItem("Horizontal", 1),
      new ComboBoxItem("Vertical", 2),
    ])
  )
  placementSettingMode: number = 0;

  @input
  autoStart: boolean = true;

  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Logging Configuration</span>')
  @ui.label('<span style="color: #94A3B8; font-size: 11px;">Control logging output for this script instance</span>')

  @input
  @hint("Enable general logging (operations, events, etc.)")
  enableLogging: boolean = false;

  @input
  @hint("Enable lifecycle logging (onAwake, onStart, onUpdate, onDestroy, etc.)")
  enableLoggingLifecycle: boolean = false;

  private logger: Logger;

  private transform: Transform = null;
  private instantiatedPrefab: SceneObject = null;

  private surfacePlacement: SurfacePlacementController =
    SurfacePlacementController.getInstance();

  /**
   * Called when component wakes up - initialize logger
   */
  onAwake() {
    const shouldLog = this.enableLogging || this.enableLoggingLifecycle;
    this.logger = new Logger("PrefabPlacement", shouldLog, true);

    if (this.enableLoggingLifecycle) {
      this.logger.header("PrefabPlacement Initialization");
      this.logger.debug("LIFECYCLE: onAwake() - Component waking up");
    }

    this.transform = this.getSceneObject().getTransform();
  }

  /**
   * Called on the first frame when the scene starts
   * Automatically bound to OnStartEvent via SnapDecorators
   */
  @bindStartEvent
  private onStart() {
    if (this.enableLoggingLifecycle) {
      this.logger.debug("LIFECYCLE: onStart() - Scene started");
    }

    this.objectVisuals.enabled = false;

    if (this.autoStart) {
      this.startPlacement();
    }
  }

  startPlacement() {
    // Clean up previous prefab instance before starting new placement
    if (this.instantiatedPrefab) {
      if (this.enableLogging) {
        this.logger.info("Destroying previous prefab instance");
      } else {
        print("[PrefabPlacement] Destroying previous prefab instance");
      }
      this.instantiatedPrefab.destroy();
      this.instantiatedPrefab = null;

      // Reset mocopi avatar controller if present
      if (this.mocopiMainController) {
        if (this.enableLogging) {
          this.logger.info("Resetting mocopi avatar controller");
        } else {
          print("[PrefabPlacement] Resetting mocopi avatar controller");
        }
        this.mocopiMainController.resetAvatarController();
      }
    }

    this.objectVisuals.enabled = false;

    let placementSettings: PlacementSettings;
    switch (this.placementSettingMode) {
      case 0: // Near Surface
        placementSettings = new PlacementSettings(
          PlacementMode.NEAR_SURFACE,
          true, // use surface adjustment widget
          new vec3(10, 10, 0), // offset in cm of widget from surface center
          this.onSliderUpdated.bind(this) // callback from widget height changes
        );
        break;
      case 1: // Horizontal
        placementSettings = new PlacementSettings(PlacementMode.HORIZONTAL);
        break;
      case 2: // Vertical
        placementSettings = new PlacementSettings(PlacementMode.VERTICAL);
        break;
      default:
        placementSettings = new PlacementSettings(PlacementMode.NEAR_SURFACE);
    }

    this.surfacePlacement.startSurfacePlacement(
      placementSettings,
      (pos, rot) => {
        this.onSurfaceDetected(pos, rot);
      }
    );
  }

  resetPlacement() {
    if (this.enableLogging) {
      this.logger.info("Reset placement called");
    } else {
      print("[PrefabPlacement] Reset placement called");
    }

    if (!this.surfacePlacement) {
      if (this.enableLogging) {
        this.logger.error("Surface placement controller not available");
      } else {
        print("[PrefabPlacement] ERROR: Surface placement controller not available");
      }
      return;
    }

    this.surfacePlacement.stopSurfacePlacement();
    this.startPlacement(); // startPlacement() will handle cleanup
  }

  onDestroy() {
    // Clean up when component is destroyed
    if (this.instantiatedPrefab) {
      this.instantiatedPrefab.destroy();
      this.instantiatedPrefab = null;
    }
  }

  private onSliderUpdated(pos: vec3) {
    this.transform.setWorldPosition(pos);
  }

  private onSurfaceDetected(pos: vec3, rot: quat) {
    this.objectVisuals.enabled = true;
    this.transform.setWorldPosition(pos);
    this.transform.setWorldRotation(rot);

    // Instantiate prefab as child of objectVisuals at local position 0,0,0
    if (this.prefabToPlace && !this.instantiatedPrefab) {
      this.instantiatedPrefab = this.prefabToPlace.instantiate(this.objectVisuals);

      if (this.instantiatedPrefab) {
        const prefabTransform = this.instantiatedPrefab.getTransform();
        prefabTransform.setLocalPosition(new vec3(0, 0, 0));
        prefabTransform.setLocalRotation(quat.quatIdentity());
        prefabTransform.setLocalScale(new vec3(1, 1, 1));

        if (this.enableLogging) {
          this.logger.info("Prefab instantiated at local (0,0,0) under objectVisuals");
        } else {
          print("[PrefabPlacement] Prefab instantiated at local (0,0,0) under objectVisuals");
        }

        // Auto-detect and setup MocopiMainController from instantiated prefab
        if (!this.mocopiMainController) {
          this.mocopiMainController = SceneObjectUtils.findComponentInHierarchy<MocopiMainController>(
            this.instantiatedPrefab,
            "MocopiMainController"
          );
          if (this.mocopiMainController) {
            if (this.enableLogging) {
              this.logger.info("Auto-detected MocopiMainController from prefab");
            } else {
              print("[PrefabPlacement] Auto-detected MocopiMainController from prefab");
            }
          }
        }

        // Auto-assign PrefabPlacement to MocopiAvatarController in the prefab
        const avatarController = SceneObjectUtils.findComponentInHierarchy<BaseScriptComponent>(
          this.instantiatedPrefab,
          "MocopiAvatarController"
        );
        if (avatarController) {
          (avatarController as any).prefabPlacement = this;
          if (this.enableLogging) {
            this.logger.info("Auto-assigned PrefabPlacement to MocopiAvatarController");
          } else {
            print("[PrefabPlacement] Auto-assigned PrefabPlacement to MocopiAvatarController");
          }
        }
      }
    }
  }
}

import { PlacementMode, PlacementSettings } from "SurfacePlacement.lspkg/Scripts/PlacementSettings";

import { SurfacePlacementController } from "SurfacePlacement.lspkg/Scripts/SurfacePlacementController";
import { MocopiMainController } from "./MocopiMainController";

@component
export class PrefabPlacement extends BaseScriptComponent {
  @input
  @allowUndefined
  objectVisuals: SceneObject;

  @input
  @hint("Prefab to instantiate as child of objectVisuals")
  @allowUndefined
  prefabToPlace: ObjectPrefab;

  @input
  @hint("Optional: MocopiMainController to reset on placement restart")
  @allowUndefined
  mocopiMainController: MocopiMainController;

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

  private transform: Transform = null;
  private instantiatedPrefab: SceneObject = null;

  private surfacePlacement: SurfacePlacementController =
    SurfacePlacementController.getInstance();

  onAwake() {
    this.transform = this.getSceneObject().getTransform();
    this.createEvent("OnStartEvent").bind(this.onStart.bind(this));
  }

  private onStart() {
    this.objectVisuals.enabled = false;

    if (this.autoStart) {
      this.startPlacement();
    }
  }

  startPlacement() {
    // Clean up previous prefab instance before starting new placement
    if (this.instantiatedPrefab) {
      print("[PrefabPlacement] Destroying previous prefab instance");
      this.instantiatedPrefab.destroy();
      this.instantiatedPrefab = null;

      // Reset mocopi avatar controller if present
      if (this.mocopiMainController) {
        print("[PrefabPlacement] Resetting mocopi avatar controller");
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
    print("[PrefabPlacement] Reset placement called");

    if (!this.surfacePlacement) {
      print("[PrefabPlacement] ERROR: Surface placement controller not available");
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

        print("[PrefabPlacement] Prefab instantiated at local (0,0,0) under objectVisuals");
      }
    }
  }

  // Fix facing direction by rotating only the root bone, not the whole prefab
  // This keeps the bone coordinate system correct while flipping the visual orientation
  private fixAvatarRootBoneRotation(prefab: SceneObject) {
    // Create 180° rotation around Y axis
    const rotation180Y = quat.angleAxis(Math.PI, vec3.up());

    // Look for Reference -> root hierarchy
    const childCount = prefab.getChildrenCount();
    for (let i = 0; i < childCount; i++) {
      const child = prefab.getChild(i);

      // Check if this is a Reference or similar container
      if (child.name.toLowerCase().includes("reference")) {
        // Find the root bone inside Reference
        const refChildCount = child.getChildrenCount();
        for (let j = 0; j < refChildCount; j++) {
          const refChild = child.getChild(j);
          if (refChild.name.toLowerCase() === "root") {
            // Apply 180° rotation to root bone only
            const rootTransform = refChild.getTransform();
            const currentRotation = rootTransform.getLocalRotation();
            const newRotation = rotation180Y.multiply(currentRotation);
            rootTransform.setLocalRotation(newRotation);
            print(`[PrefabPlacement] Applied 180° Y rotation to root bone: ${refChild.name}`);
            return;
          }
        }
        break;
      }
    }

    print("[PrefabPlacement] Warning: Could not find root bone to rotate");
  }
}

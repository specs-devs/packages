import { PlacementMode, PlacementSettings } from "./Scripts/PlacementSettings";

import { SurfacePlacementController } from "./Scripts/SurfacePlacementController";

@component
export class Example extends BaseScriptComponent {
  @input
  @allowUndefined
  objectVisuals: SceneObject;

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
    this.surfacePlacement.stopSurfacePlacement();
    this.startPlacement();
  }

  private onSliderUpdated(pos: vec3) {
    this.transform.setWorldPosition(pos);
  }

  private onSurfaceDetected(pos: vec3, rot: quat) {
    this.objectVisuals.enabled = true;
    this.transform.setWorldPosition(pos);
    this.transform.setWorldRotation(rot);
  }
}

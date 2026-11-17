/**
 * SPECS Inc. 2027
 * Surface placement example demonstrating three placement modes: Near Surface (tabletop with height
 * adjustment widget), Horizontal (ground plane detection), and Vertical (wall detection). Integrates
 * SurfacePlacementController singleton for AR object positioning, provides slider callback for height
 * adjustment, auto-start option for immediate placement, and reset functionality for re-calibration.
 */
import { PlacementInteraction, PlacementMode, PlacementSettings } from "./Scripts/PlacementSettings";

import { SurfacePlacementController } from "./Scripts/SurfacePlacementController";
import { Logger } from "Utilities.lspkg/Scripts/Utils/Logger";
import { bindStartEvent, bindUpdateEvent, bindLateUpdateEvent, bindDestroyEvent } from "SnapDecorators.lspkg/decorators";

@component
export class Example extends BaseScriptComponent {
  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Placement Configuration</span>')
  @ui.label('<span style="color: #94A3B8; font-size: 11px;">Object and placement mode selection</span>')

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
  placementSettingMode: number = 1;

  @input("int")
  @widget(new ComboBoxWidget([
    new ComboBoxItem("Head Pose (hold still)", 0),
    new ComboBoxItem("Pinch or Tap", 1),
  ]))
  @hint("Confirmation for Horizontal and Vertical. Near Surface uses palms.")
  placementInteraction: number = PlacementInteraction.HEAD_POSE;

  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Behavior Settings</span>')
  @ui.label('<span style="color: #94A3B8; font-size: 11px;">Auto-start and initialization options</span>')

  @input
  autoStart: boolean = true;

  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Logging Configuration</span>')
  @ui.label('<span style="color: #94A3B8; font-size: 11px;">Control logging output for this script instance</span>')

  @input
  @hint("Enable general logging (animation cycles, events, etc.)")
  enableLogging: boolean = false;

  @input
  @hint("Enable lifecycle logging (onAwake, onStart, onUpdate, onDestroy, etc.)")
  enableLoggingLifecycle: boolean = false;

  // Logger instance
  private logger: Logger;  private transform: Transform = null;
  private started = false;

  private surfacePlacement: SurfacePlacementController =
    SurfacePlacementController.getInstance();  /**
   * Called when component is initialized
   */
  onAwake(): void {
    // Initialize logger
    this.logger = new Logger("Example", this.enableLogging || this.enableLoggingLifecycle, true);

    if (this.enableLoggingLifecycle) {
      this.logger.debug("LIFECYCLE: onAwake() - Component initializing");
    }


    this.transform = this.getSceneObject().getTransform();
    this.createEvent("OnStartEvent").bind(this.onStart.bind(this));
    // The placement UI lives under the controller singleton, outside this object, so stop it when
    // the example is disabled and pick it up again when it comes back.
    this.createEvent("OnDisableEvent").bind(() => this.surfacePlacement.stopSurfacePlacement());
    this.createEvent("OnEnableEvent").bind(() => {
      // The first enable is handled by onStart.
      if (this.started && this.autoStart) {
        this.startPlacement();
      }
    });
  }

  private onStart() {
    this.started = true;
    this.setVisualsEnabled(false);

    if (this.autoStart) {
      this.startPlacement();
    }
  }

  startPlacement() {
    this.setVisualsEnabled(false);

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
        placementSettings = new PlacementSettings(PlacementMode.HORIZONTAL, true, undefined, null, this.placementInteraction);
        break;
      case 2: // Vertical
        placementSettings = new PlacementSettings(PlacementMode.VERTICAL, true, undefined, null, this.placementInteraction);
        break;
      default:
        placementSettings = new PlacementSettings();
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

  private setVisualsEnabled(enabled: boolean) {
    if (this.objectVisuals) {
      this.objectVisuals.enabled = enabled;
    }
  }

  private onSurfaceDetected(pos: vec3, rot: quat) {
    this.setVisualsEnabled(true);
    this.transform.setWorldPosition(pos);
    this.transform.setWorldRotation(rot);
  }
}

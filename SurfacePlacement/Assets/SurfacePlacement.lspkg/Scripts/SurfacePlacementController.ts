/**
 * SPECS Inc. 2027
 * Central singleton controller for surface placement workflows across all modes. Manages placement mode
 * prefab instantiation (Horizontal, Vertical, TableTop), coordinates HandHintsController for onboarding,
 * provides startSurfacePlacement() and stopSurfacePlacement() public API, handles detector lifecycle with
 * automatic cleanup, plays calibration audio feedback, and ensures only one active placement session at a time.
 */
import { PlacementMode, PlacementSettings } from "./PlacementSettings";

import { HandHintsController } from "./HandHintsController";
import { Singleton } from "../Decorators/Singleton";
import { SurfaceDetector } from "./SurfaceDetector";
import { TableTop } from "./TableTop";

const CALIBRATE_AUDIOTRACK: AudioTrackAsset = requireAsset(
  "../Sounds/CalibrateSnap.mp3"
) as AudioTrackAsset;

const HANDHINTS_PREFAB: ObjectPrefab = requireAsset(
  "../Prefabs/HandHints.prefab"
) as ObjectPrefab;

const PLACEMENT_MODE_PREFABS: ObjectPrefab[] = [
  requireAsset("../Prefabs/HorizontalPlacement.prefab") as ObjectPrefab,
  requireAsset("../Prefabs/VerticalPlacement.prefab") as ObjectPrefab,
  requireAsset("../Prefabs/TableTopPlacement.prefab") as ObjectPrefab,
];

@Singleton
export class SurfacePlacementController {
  public static getInstance: () => SurfacePlacementController;

  private handHintsController: HandHintsController = null;
  private currDetector: SurfaceDetector = null;
  private onCancelled: (() => void) | null = null;

  private sceneObject: SceneObject = null;

  public constructor() {
    this.sceneObject = global.scene.createSceneObject(
      "SurfacePlacementController"
    );

    this.init();
  }

  private init() {
    const audioComponent = this.sceneObject.createComponent("AudioComponent");
    audioComponent.audioTrack = CALIBRATE_AUDIOTRACK;

    const handHintsObj = HANDHINTS_PREFAB.instantiate(this.sceneObject);
    this.handHintsController = handHintsObj.getComponent(
      HandHintsController.getTypeName()
    );
    this.handHintsController.disableHint();
  }

  /**
   * Starts placement. `callback` fires once with the placed world pose. The optional
   * `onCancelled` fires instead when the session is stopped (or replaced by a new
   * start) before it completed, so callers waiting on a result never hang.
   */
  startSurfacePlacement(
    settings: PlacementSettings,
    callback: (pos: vec3, rot: quat) => void,
    onCancelled: (() => void) | null = null
  ) {
    if (this.currDetector != null) {
      //in case mode is changed remove current detector
      this.stopSurfacePlacement();
    }
    //create new one and init
    const detectorObj = PLACEMENT_MODE_PREFABS[
      settings.placementMode
    ].instantiate(this.sceneObject);
    this.currDetector = detectorObj
      .getComponents("ScriptComponent")
      .find((s) => s instanceof SurfaceDetector) as SurfaceDetector;

    if (settings.placementMode == PlacementMode.NEAR_SURFACE) {
      const tableTop = detectorObj.getComponent(TableTop.getTypeName());
      tableTop.setOptions(settings);
    }

    this.currDetector.configure(settings);
    this.currDetector.init(this.handHintsController);
    //start surface placement on desired mode
    this.onCancelled = onCancelled;
    this.currDetector.startSurfaceCalibration((pos, rot) => {
      //completed, so a later stop is not a cancel
      this.onCancelled = null;
      callback(pos, rot);
    });
  }

  stopSurfacePlacement() {
    if (this.currDetector) {
      this.handHintsController.disableHint();
      // Defer destruction so SIK's cursor never references a destroyed
      // interactable mid-update (see SurfaceDetector.destroySafely).
      this.currDetector.destroySafely();
      this.currDetector = null;
    }
    //cleared first, so the handler may start a new placement
    const onCancelled = this.onCancelled;
    this.onCancelled = null;
    if (onCancelled) onCancelled();
  }
}

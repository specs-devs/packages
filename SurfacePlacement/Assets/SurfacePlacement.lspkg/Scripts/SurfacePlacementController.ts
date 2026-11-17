/**
 * SPECS Inc. 2027
 * Entry point for surface placement: starts a mode by instantiating its prefab, plays the
 * calibration chime, and hands back the position and rotation placed on.
 */
import { PlacementSettings } from "./PlacementSettings";

import { LensConfig } from "InteractionKit.lspkg/Utils/LensConfig";
import { Singleton } from "../Decorators/Singleton";
import { SurfaceDetector } from "./SurfaceDetector";

const CALIBRATE_AUDIOTRACK: AudioTrackAsset = requireAsset(
  "../Sounds/CalibrateSnap.mp3"
) as AudioTrackAsset;

const PLACEMENT_MODE_PREFABS: ObjectPrefab[] = [
  requireAsset("../Prefabs/HorizontalPlacement.prefab") as ObjectPrefab,
  requireAsset("../Prefabs/VerticalPlacement.prefab") as ObjectPrefab,
  requireAsset("../Prefabs/TableTopPlacement.prefab") as ObjectPrefab,
];

@Singleton
export class SurfacePlacementController {
  public static getInstance: () => SurfacePlacementController;

  private currDetector: SurfaceDetector = null;

  private sceneObject: SceneObject = null;

  public constructor() {
    this.sceneObject = global.scene.createSceneObject(
      "SurfacePlacementController"
    );

    this.init();
  }

  private init() {
    let audioComponent = this.sceneObject.createComponent("AudioComponent");
    audioComponent.audioTrack = CALIBRATE_AUDIOTRACK;
    this.warmUpChime(audioComponent);
  }

  // The lens's first sound starts its audio output, and on device that call can
  // stall a frame for a long time; the chime is that first sound, so it would land
  // the stall on the first placement. Playing it once, muted, at startup moves
  // the stall into lens launch. Deferred a frame: audio may not be ready while the
  // scene is still waking up.
  private warmUpChime(chime: AudioComponent) {
    LensConfig.getInstance().updateDispatcher.nextFrame("ChimeWarmup", () => {
      const volume = chime.volume;
      chime.volume = 0;
      chime.setOnFinish(() => {
        chime.volume = volume;
      });
      chime.play(1);
    });
  }

  startSurfacePlacement(
    settings: PlacementSettings,
    callback: (pos: vec3, rot: quat) => void
  ) {
    if (this.currDetector != null) {
      //in case mode is changed remove current detector
      this.stopSurfacePlacement();
    }
    //create new one and init
    var detectorObj = PLACEMENT_MODE_PREFABS[
      settings.placementMode
    ].instantiate(this.sceneObject);
    this.currDetector = detectorObj
      .getComponents("ScriptComponent")
      .find((s) => s instanceof SurfaceDetector) as SurfaceDetector;
    this.currDetector.showDebug = settings.showDebug;

    this.currDetector.init();
    //start surface placement on desired mode
    this.currDetector.startSurfaceCalibration(callback);
  }

  stopSurfacePlacement() {
    if (this.currDetector) {
      this.currDetector.onDestroy();
      this.currDetector.getSceneObject().destroy();
      this.currDetector = null;
    }
  }
}

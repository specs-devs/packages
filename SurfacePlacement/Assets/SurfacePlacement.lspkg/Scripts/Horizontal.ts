/**
 * SPECS Inc. 2027
 * Ground placement: hit-tests along the gaze for a floor or table, keeps the indicator on the
 * surface found, and places once the view has held steady.
 */
import {
  HORIZONTAL_RAY_DOWN_TILT,
  SingleSurface,
} from "../Scripts/SingleSurface";

import { RefinePose, SurfaceDetector } from "../Scripts/SurfaceDetector";

// Set min and max hit distance to surfaces
// One far limit for everything: hits are not accepted past it, and it is also
// where the indicator rides when the gaze leaves the floor (looking up must not
// push the UI away from the wearer).
const MAX_HIT_DISTANCE = 350; //max is 1000
const MIN_HIT_DISTANCE = 20;
const DEFAULT_GROUND_DISTANCE = 100; // Assumed floor drop below the camera until a real floor is seen
const DEFAULT_SCREEN_DISTANCE = 250; // Distance in cm from camera to visual for the pose before calibration starts
const MIN_GAZE_DESCENT = 0.05; // gaze must point at least this far down to meet the floor plane

@component
export class Horizontal extends SurfaceDetector {
  @input
  screenTextObj: SceneObject;

  private singleSurface: SingleSurface;
  private screenTextTrans = null;

  onAwake() {
    super.onAwake();
    //the floor reticle reads too small right at the wearer's feet
    this.reticleCloseBoost = 1.1;
    //once the ring is filling, tolerate half again as much wobble before cancelling
    this.dwellFillingBuffer = 1.5;
    this.singleSurface = this.getSceneObject().getComponent(
      SingleSurface.getTypeName(),
    );
    this.screenTextTrans = this.screenTextObj.getTransform();
  }

  init() {
    super.init();
    this.singleSurface.init(
      this.cameraTransform,
      this.trans,
      DEFAULT_SCREEN_DISTANCE,
    );
  }

  startSurfaceCalibration(callback: (pos: vec3, rot: quat) => void): void {
    super.startSurfaceCalibration(callback);
    this.startHitTestSession();
    this.singleSurface.startCalibration();
  }

  private startCalibrationComplete() {
    this.isCalibrationRunning = false;
    //pop the circle full before delivering, same as the near-surface flow
    this.circleAnim.animateCircleOut(() => {
      super.onCalibrationComplete(() => this.invokeCalibrationComplete());
    });
  }

  private invokeCalibrationComplete() {
    this.onCompleteCallback(
      this.singleSurface.desiredPosition,
      this.singleSurface.desiredRotation,
    );
  }

  //the high-accuracy hit owns the position once it lands; rotation keeps following
  //the gravity-aligned face-camera convention, so only the position comes from it
  protected getRefineTarget(): vec3 {
    return this.singleSurface.desiredPosition;
  }

  protected applyRefinedPose(pose: RefinePose) {
    this.singleSurface.desiredPosition = new vec3(pose.x, pose.y, pose.z);
    this.singleSurface.lastGroundHeight = pose.y;
  }

  protected update() {
    super.update();
    if (!this.isCalibrationRunning) {
      return;
    }
    if (!this.isRefining()) {
      //coarse results would fight the accurate pose, so pause them for the dwell
      this.singleSurface.runHitTest(
        this.hitTestSession,
        MIN_HIT_DISTANCE,
        MAX_HIT_DISTANCE,
        true,
        this.onHitTestResult.bind(this),
      );
    }
    this.faceCamera();
    this.singleSurface.interpolatePositionVisuals();
    //after the lerp, so the scale matches where the reticle actually is
    this.updateReticleScale();

    //keep screen text at same height as camera
    var worldTextPos = this.screenTextObj
      .getParent()
      .getTransform()
      .getWorldTransform()
      .multiplyPoint(new vec3(0, 8, 0));
    worldTextPos.y = this.cameraTransform.getWorldPosition().y;
    //make sure text stays above ground visual
    worldTextPos.y = Math.max(
      worldTextPos.y,
      this.singleSurface.lastGroundHeight + 50,
    );
    this.screenTextTrans.setWorldPosition(worldTextPos);

    //only dwell against a real floor, never the no-plane fallback pose. While the
    //high-accuracy test is out, the paused coarse hits would go stale, so it stands in
    if (
      this.hitTestSession != null &&
      (this.isRefining() || this.hasFreshSurfaceHit())
    ) {
      if (this.updateDwellPlacement()) {
        this.startCalibrationComplete();
      }
    } else {
      this.resetDwellPlacement();
    }
  }

  private onHitTestResult(hitTestResult) {
    if (!this.isCalibrationRunning) {
      //late async result must not move the surface after the dwell completed
      return;
    }
    let foundPosition = vec3.zero();
    let foundNormal = vec3.zero();
    if (hitTestResult != null) {
      foundPosition = hitTestResult.position;
      foundNormal = hitTestResult.normal;
    }
    this.updateCalibration(foundPosition, foundNormal);
  }

  // Where the hit test ray would meet a floor at planeY. Keeps the indicator
  // gliding along that floor under the gaze instead of snapping to a pose fixed
  // in front of the camera whenever a result is missed. The distance saturates
  // when the gaze is level or rising, since the ray never reaches the floor then.
  private getGazeGroundPosition(planeY: number): vec3 {
    var camPos = this.cameraTransform.getWorldPosition();
    //mirror the ray the hit test casts, so held frames land where hits do
    var dir = this.cameraTransform.forward.uniformScale(-1);
    dir.y -= HORIZONTAL_RAY_DOWN_TILT;
    dir = dir.normalize();

    //the same cap on both branches, so panning up through level cannot jump the
    //indicator: the intersection saturates into the very distance looking up uses
    var distance = MAX_HIT_DISTANCE;
    if (dir.y < -MIN_GAZE_DESCENT) {
      distance = (planeY - camPos.y) / dir.y;
    }
    distance = Math.min(MAX_HIT_DISTANCE, Math.max(MIN_HIT_DISTANCE, distance));

    var pos = camPos.add(dir.uniformScale(distance));
    //hold the floor height even where the clamped ray no longer reaches it
    pos.y = planeY;
    return pos;
  }

  private updateCalibration(foundPosition: vec3, foundNormal: vec3) {
    var camPos = this.cameraTransform.getWorldPosition();
    //check if horizontal plane is being tracked
    var foundHorizontalPlane = foundNormal.y > 0.95;
    if (foundHorizontalPlane) {
      this.markSurfaceHit();
      this.singleSurface.useDefaultHeight = false;
      this.singleSurface.lastGroundHeight = foundPosition.y;
      this.singleSurface.desiredPosition = foundPosition;
    } else {
      //no result: keep the floor we know (or an assumed one) and follow the gaze
      //along it, rather than resetting depth to a pose in front of the camera
      var planeY = this.singleSurface.useDefaultHeight
        ? camPos.y - DEFAULT_GROUND_DISTANCE
        : this.singleSurface.lastGroundHeight;
      this.singleSurface.desiredPosition = this.getGazeGroundPosition(planeY);
    }
  }

  private faceCamera() {
    var worldCameraForward = this.cameraTransform.right
      .cross(vec3.up())
      .normalize();

    this.singleSurface.desiredRotation = quat.lookAt(
      worldCameraForward,
      vec3.up(),
    );
  }
}

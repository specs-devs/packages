/**
 * SPECS Inc. 2027
 * Vertical surface detection and placement handler. Detects and tracks vertical surfaces like walls
 * for placing AR content with smooth transitions between surface detection states.
 */
import { SurfaceDetector } from "../Scripts/SurfaceDetector";

import { SingleSurface } from "../Scripts/SingleSurface";
import { HandHintsController } from "./HandHintsController";

// Set min and max hit distance to surfaces
const MAX_HIT_DISTANCE = 1000;
const MIN_HIT_DISTANCE = 50;
const STATE_SWITCH_THRESHOLD = 15; // Number of frames to switch default pose and surface pose (so it doesnt flicker)
const DEFAULT_SCREEN_DISTANCE = 200; // Distance in cm from camera to visual when no surface is hit
// Averaging the wall normal, because a single hit's yaw wobbles by degrees.
const NORMAL_WINDOW_SECONDS = 2.5; // trailing window, long enough to span the whole fill
const NORMAL_MAX_SAMPLES = 12; // keep the newest samples
const NORMAL_OUTLIER_DEGREES = 25; // further off the mean than this is another surface, not noise
const NORMAL_OUTLIER_RESET = 5; // consecutive disagreements before that surface is accepted

@component
export class Vertical extends SurfaceDetector {
  @input
  step1!: SceneObject;

  @input
  step2!: SceneObject;

  private singleSurface!: SingleSurface;
  private currStateCount = 0;
  private currSurfaceDetected = false;
  private lastSurfacePosition = vec3.zero();
  private lastSurfaceRotation = quat.quatIdentity();
  private hasLastSurfacePose = false;
  private normalHistory: vec3[] = [];
  private normalTimeHistory: number[] = [];
  private normalOutliers = 0;

  onAwake() {
    super.onAwake();
    this.singleSurface = this.getSceneObject().getComponent(
      SingleSurface.getTypeName(),
    ) as SingleSurface;
  }

  init(handHints: HandHintsController) {
    super.init(handHints);
    this.singleSurface.init(
      this.cameraTransform,
      this.trans,
      DEFAULT_SCREEN_DISTANCE,
    );
  }

  // Yaw taken from one hit normal wobbles by degrees, and whichever result landed
  // last would otherwise decide the delivered facing. Average the recent ones: the
  // mean of unit vectors is the circular mean of their yaw. Returns null when a
  // normal carries no usable yaw at all.
  private getAveragedWallNormal(normal: vec3): vec3 {
    let projected = new vec3(normal.x, 0.0, normal.z);
    if (projected.length < 0.0001) {
      //pointing straight up or down, so there is no yaw in it
      return null;
    }
    projected = projected.normalize();

    const now = getTime();
    // A stalled hit-test stream must not leave an old wall biasing the next hit.
    while (this.normalTimeHistory.length > 0 &&
      now - this.normalTimeHistory[0] > NORMAL_WINDOW_SECONDS) {
      this.normalHistory.shift();
      this.normalTimeHistory.shift();
    }
    if (this.normalHistory.length === 0) this.normalOutliers = 0;
    let mean = this.getWallNormalMean();
    if (
      mean != null &&
      this.angleBetween(projected, mean) > NORMAL_OUTLIER_DEGREES
    ) {
      this.normalOutliers++;
      if (this.normalOutliers < NORMAL_OUTLIER_RESET) {
        //a lone disagreement is noise, so keep the facing already established
        return mean;
      }
      // Sustained disagreement is a different surface, not noise: panning across
      // a corner keeps the wall state alive, and blending both walls would aim
      // the object diagonally into neither.
      this.normalHistory = [];
      this.normalTimeHistory = [];
    }
    this.normalOutliers = 0;

    this.normalHistory.push(projected);
    this.normalTimeHistory.push(now);
    while (
      this.normalTimeHistory.length > 1 &&
      (now - this.normalTimeHistory[0] > NORMAL_WINDOW_SECONDS ||
        this.normalHistory.length > NORMAL_MAX_SAMPLES)
    ) {
      this.normalHistory.shift();
      this.normalTimeHistory.shift();
    }
    mean = this.getWallNormalMean();
    return mean != null ? mean : projected;
  }

  private getWallNormalMean(): vec3 {
    if (this.normalHistory.length == 0) {
      return null;
    }
    let sum = vec3.zero();
    for (let i = 0; i < this.normalHistory.length; i++) {
      sum = sum.add(this.normalHistory[i]);
    }
    if (sum.length < 0.0001) {
      //samples cancelled out, so trust the newest over a degenerate mean
      return this.normalHistory[this.normalHistory.length - 1];
    }
    return sum.normalize();
  }

  private angleBetween(a: vec3, b: vec3): number {
    let dot = Math.min(1, Math.max(-1, a.dot(b)));
    return Math.acos(dot) * MathUtils.RadToDeg;
  }

  onHoverEnter() {
    if (!this.isCalibrationRunning || this.usesHeadPose) {
      return;
    }
    super.onHoverEnter();
    this.circleAnim.setLoadingColor(false);
  }

  onHoverExit() {
    if (!this.isCalibrationRunning || this.usesHeadPose) {
      return;
    }
    super.onHoverExit();
    this.circleAnim.setLoadingColor(true);
  }

  onInteractionCanceled() {
    if (!this.isCalibrationRunning || this.usesHeadPose) return;
    super.onInteractionCanceled();
    this.circleAnim.animateCircleIn(null);
    this.circleAnim.setLoadingColor(true);
    this.circleAnim.enableScanAnimation(true);
  }

  onInteractionStart() {
    if (!this.isCalibrationRunning || this.usesHeadPose) {
      return;
    }

    super.onInteractionStart();
    if (this.step1.enabled) {
      return;
    }
    this.circleAnim.animateCircleOut(null);
    this.circleAnim.enableScanAnimation(false);
    this.handHintController.disableHint();
  }

  onInteractionEnd() {
    if (!this.isCalibrationRunning || this.usesHeadPose) {
      return;
    }

    super.onInteractionEnd();
    if (
      this.hitTestSession != null &&
      this.step2.enabled &&
      super.isLookingAtCalibrationIcon()
    ) {
      this.startCalibrationComplete();
    } else {
      this.onInteractionCanceled();
    }
  }

  private playHandHint(isMobile: boolean) {
    if (this.usesHeadPose) return;
    if (isMobile) {
      this.handHintController.playMobileTap();
      this.hintAnchor
        .getTransform()
        .setLocalRotation(
          quat.fromEulerVec(new vec3(-30 * MathUtils.DegToRad, 0, 0))
        );
    } else {
      this.handHintController.playFarPinch();
      this.hintAnchor
        .getTransform()
        .setLocalRotation(quat.fromEulerVec(vec3.zero()));
    }
  }

  protected onMobileConnnectionStateChange(isConnected: boolean) {
    super.onMobileConnnectionStateChange(isConnected);
  }

  private setCircleColor(isTracking: boolean) {
    let dotColor = isTracking ? vec4.one() : vec4.one().uniformScale(0.35);
    this.circleAnim.setCircleColor(dotColor);
    if (!this.usesHeadPose) this.circleAnim.enableScanAnimation(isTracking);
  }

  private startCalibrationComplete() {
    this.isCalibrationRunning = false;
    //pop the circle full before delivering, same as the near-surface flow
    if (this.usesHeadPose) {
      this.circleAnim.animateCircleOut(() => {
        super.onCalibrationComplete(this.invokeCalibrationComplete.bind(this));
      });
    } else {
      super.onCalibrationComplete(this.invokeCalibrationComplete.bind(this));
    }
  }

  private invokeCalibrationComplete() {
    // desiredRotation lays the reticle flat on the wall (+Y out of it). Undo that
    // tilt so content stands upright on the wall: +Y up, +Z out toward the user.
    this.onCompleteCallback(
      this.singleSurface.desiredPosition,
      this.singleSurface.desiredRotation.multiply(
        quat.fromEulerVec(new vec3(-Math.PI / 2, 0, 0)),
      ),
    );
  }

  startSurfaceCalibration(callback: (pos: vec3, rot: quat) => void): void {
    this.handHintController.disableHint();
    this.enableStep1(true);
    this.currSurfaceDetected = false;
    this.currStateCount = 0;
    this.hasLastSurfacePose = false;
    this.isCalibrationRunning = true;
    super.startSurfaceCalibration(callback);
    this.startHitTestSession();
    this.singleSurface.startCalibration();
  }

  protected update() {
    super.update();
    if (!this.isCalibrationRunning) {
      return;
    }
    if (!this.usesHeadPose && this.singleSurface.hasFoundPlane()) {
      this.singleSurface.adjustPosition();
    } else {
      this.singleSurface.runHitTest(
        this.hitTestSession,
        MIN_HIT_DISTANCE,
        MAX_HIT_DISTANCE,
        false,
        this.onHitTestResult.bind(this),
      );
    }
    this.singleSurface.interpolatePositionVisuals();
    //after the lerp, so the scale matches where the reticle actually is
    if (!this.usesHeadPose) return;
    this.updateReticleScale();

    // Dwell requires a recently tracked wall, including during the fill.
    if (
      this.step2.enabled &&
      this.hasFreshSurfaceHit()
    ) {
      if (this.hitTestSession != null && this.updateDwellPlacement()) {
        this.startCalibrationComplete();
      }
    } else {
      //step1 keeps the scan dots off, so don't re-enable them on reset
      this.resetDwellPlacement(false);
    }
  }

  private enableStep1(enabled: boolean) {
    if (enabled) {
      //wall lost: normals gathered off it say nothing about the next one
      this.normalHistory = [];
      this.normalTimeHistory = [];
      this.normalOutliers = 0;
    }
    this.step1.enabled = enabled;
    this.step2.enabled = !enabled;
    this.setCircleColor(!enabled);
    this.circleAnim.getSceneObject().getComponent("ColliderComponent").enabled =
      !enabled && !this.usesHeadPose;
    if (!enabled && !this.usesHeadPose) {
      this.handHintController.enableHint(this.hintAnchor.getTransform());
      this.playHandHint(this.isMobileConnected());
    } else {
      this.handHintController.disableHint();
    }
  }

  private onHitTestResult(hitTestResult) {
    if (!this.isCalibrationRunning || this.singleSurface.hasFoundPlane()) {
      //late async result must not move the surface after the dwell completed
      return;
    }
    let foundPosition = vec3.zero();
    let foundNormal = vec3.zero();
    const didHit = hitTestResult != null;
    if (didHit) {
      foundPosition = hitTestResult.position;
      foundNormal = hitTestResult.normal;
    }
    this.updateCalibration(foundPosition, foundNormal, didHit);
  }

  private updateCalibration(
    foundPosition: vec3,
    foundNormal: vec3,
    didHit: boolean,
  ) {
    let camPos = this.cameraTransform.getWorldPosition();

    this.singleSurface.desiredPosition = camPos.add(
      this.cameraTransform.forward.uniformScale(-DEFAULT_SCREEN_DISTANCE),
    );
    this.singleSurface.desiredRotation = quat.lookAt(
      this.cameraTransform.forward,
      vec3.up(),
    );

    //check if vertical plane is being tracking. A miss is identified by didHit,
    //never by a zero normal: a plumb wall reports normal.y of exactly 0, which
    //the old zero test rejected outright (most visible in the editor, where
    //preview geometry is perfectly axis aligned).
    let foundVerticalPlane = didHit && foundNormal.length > 0.0001 && Math.abs(foundNormal.y) < 0.15;
    if (foundVerticalPlane) {
      this.markSurfaceHit();
      // Cache the pose of the last real wall hit. The step2 state below outlives
      // any single result by STATE_SWITCH_THRESHOLD frames, so without this a
      // miss frame would apply its zeroed position and normal: the surface would
      // snap to the world origin with a NaN rotation from normalizing (0,0,0).
      this.lastSurfacePosition = foundPosition;
      let averagedNormal = this.getAveragedWallNormal(foundNormal);
      if (averagedNormal != null) {
        this.lastSurfaceRotation = quat.lookAt(averagedNormal, vec3.up());
      }
      this.hasLastSurfacePose = true;
    }
    //check for state change
    if (this.currSurfaceDetected != foundVerticalPlane) {
      this.currStateCount = 0;
    }
    foundVerticalPlane ? this.currStateCount++ : this.currStateCount--;

    //set UI based on current state
    if (Math.abs(this.currStateCount) > STATE_SWITCH_THRESHOLD) {
      foundVerticalPlane = this.currStateCount > 0;
      if (foundVerticalPlane != this.step2.enabled) {
        this.enableStep1(!foundVerticalPlane);
      }
    }

    this.currSurfaceDetected = foundVerticalPlane;

    if (this.step2.enabled && this.hasLastSurfacePose) {
      this.singleSurface.useDefaultHeight = false;
      //already perpendicular to vec3.up(), from the last accepted wall hit
      this.singleSurface.desiredPosition = this.lastSurfacePosition;
      this.singleSurface.desiredRotation = this.lastSurfaceRotation;
    }

    this.singleSurface.desiredRotation =
      this.singleSurface.desiredRotation.multiply(
        quat.fromEulerVec(new vec3(Math.PI / 2, 0, 0)),
      );
  }
}

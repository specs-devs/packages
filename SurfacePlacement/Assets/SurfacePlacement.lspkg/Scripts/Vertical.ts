/**
 * SPECS Inc. 2027
 * Wall placement: hit-tests along the gaze for a wall, averages its normal to steady the
 * indicator, and places once the view has held steady.
 */
import { RefinePose, SurfaceDetector } from "../Scripts/SurfaceDetector";

import { SingleSurface } from "../Scripts/SingleSurface";

// Set min and max hit distance to surfaces
const MAX_HIT_DISTANCE = 1000;
const MIN_HIT_DISTANCE = 50;
const STATE_SWITCH_THRESHOLD = 15; // Number of frames to switch default pose and surface pose (so it doesnt flicker)
const DEFAULT_SCREEN_DISTANCE = 200; // Distance in cm from camera to visual when no surface is hit
// Averaging the wall normal, because a single hit's yaw wobbles by degrees.
const NORMAL_WINDOW_SECONDS = 2.5; // trailing window, long enough to span the whole fill
const NORMAL_MAX_SAMPLES = 12; // newest win, so stale yaw ages out even when hits come fast
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

  init() {
    super.init();
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
    var projected = new vec3(normal.x, 0.0, normal.z);
    if (projected.length < 0.0001) {
      //pointing straight up or down, so there is no yaw in it
      return null;
    }
    projected = projected.normalize();

    const now = getTime();
    //samples older than the window describe a wall looked at before, so they
    //must not outvote this one as an outlier
    while (
      this.normalTimeHistory.length > 0 &&
      now - this.normalTimeHistory[0] > NORMAL_WINDOW_SECONDS
    ) {
      this.normalHistory.shift();
      this.normalTimeHistory.shift();
    }

    var mean = this.getWallNormalMean();
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
    var sum = vec3.zero();
    for (var i = 0; i < this.normalHistory.length; i++) {
      sum = sum.add(this.normalHistory[i]);
    }
    if (sum.length < 0.0001) {
      //samples cancelled out, so trust the newest over a degenerate mean
      return this.normalHistory[this.normalHistory.length - 1];
    }
    return sum.normalize();
  }

  private angleBetween(a: vec3, b: vec3): number {
    var dot = Math.min(1, Math.max(-1, a.dot(b)));
    return Math.acos(dot) * MathUtils.RadToDeg;
  }

  //spread of the averaged samples, to judge whether averaging is enough
  private getWallNormalSpread(averaged: vec3): number {
    var maxAngle = 0;
    for (var i = 0; i < this.normalHistory.length; i++) {
      maxAngle = Math.max(
        maxAngle,
        this.angleBetween(this.normalHistory[i], averaged),
      );
    }
    return maxAngle;
  }

  private setCircleColor(isTracking: boolean) {
    var dotColor = isTracking ? vec4.one() : vec4.one().uniformScale(0.35);
    this.circleAnim.setCircleColor(dotColor);
  }

  private startCalibrationComplete() {
    this.isCalibrationRunning = false;
    //pop the circle full before delivering, same as the near-surface flow
    this.circleAnim.animateCircleOut(() => {
      super.onCalibrationComplete(() => this.invokeCalibrationComplete());
    });
  }

  private invokeCalibrationComplete() {
    var averaged = this.getWallNormalMean();
    if (averaged != null) {
      this.log(
        "Wall facing from " +
          this.normalHistory.length +
          " normals, spread " +
          this.getWallNormalSpread(averaged).toFixed(1) +
          " deg",
      );
    }
    this.onCompleteCallback(
      this.singleSurface.desiredPosition,
      this.singleSurface.desiredRotation,
    );
  }

  startSurfaceCalibration(callback: (pos: vec3, rot: quat) => void): void {
    this.enableStep1(true);
    this.currSurfaceDetected = false;
    this.hasLastSurfacePose = false;
    this.isCalibrationRunning = true;
    super.startSurfaceCalibration(callback);
    this.startHitTestSession();
    this.singleSurface.startCalibration();
  }

  //the high-accuracy hit replaces both position and rotation here, rebuilding the
  //rotation from its normal with this mode's existing projection convention
  protected getRefineTarget(): vec3 {
    return this.hasLastSurfacePose ? this.lastSurfacePosition : null;
  }

  protected applyRefinedPose(pose: RefinePose) {
    this.lastSurfacePosition = new vec3(pose.x, pose.y, pose.z);
    // One accurate normal against a window of coarse ones would be outvoted by the
    // very wobble it is meant to fix, so it restarts the average instead: the
    // facing is drawn from the accurate hit alone, and coarse hits stay paused for
    // the rest of the dwell so nothing dilutes it.
    this.normalHistory = [];
    this.normalTimeHistory = [];
    this.normalOutliers = 0;
    var averagedNormal = this.getAveragedWallNormal(
      new vec3(pose.nx, pose.ny, pose.nz),
    );
    if (averagedNormal != null) {
      this.lastSurfaceRotation = quat.lookAt(averagedNormal, vec3.up());
    }
    this.singleSurface.desiredPosition = this.lastSurfacePosition;
    //updateCalibration is paused while refining, so apply its trailing tilt here
    this.singleSurface.desiredRotation = this.lastSurfaceRotation.multiply(
      quat.fromEulerVec(new vec3(Math.PI / 2, 0, 0)),
    );
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
        false,
        this.onHitTestResult.bind(this),
      );
    }
    this.singleSurface.interpolatePositionVisuals();
    //after the lerp, so the scale matches where the reticle actually is
    this.updateReticleScale();

    //only allow dwell placement while a wall is actually tracked. While the
    //high-accuracy test is out, the paused coarse hits would go stale, so it stands in
    if (
      this.step2.enabled &&
      (this.isRefining() || this.hasFreshSurfaceHit())
    ) {
      if (this.hitTestSession != null && this.updateDwellPlacement()) {
        this.startCalibrationComplete();
      }
    } else {
      this.resetDwellPlacement();
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
  }

  private onHitTestResult(hitTestResult) {
    if (!this.isCalibrationRunning) {
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
    var camPos = this.cameraTransform.getWorldPosition();

    this.singleSurface.desiredPosition = camPos.add(
      this.cameraTransform.forward.uniformScale(-DEFAULT_SCREEN_DISTANCE),
    );
    this.singleSurface.desiredRotation = quat.lookAt(
      this.cameraTransform.forward,
      vec3.up(),
    );

    //check if vertical plane is being tracked. A miss is identified by didHit,
    //never by a zero normal: a plumb wall reports normal.y of exactly 0, which a
    //zero test would reject outright (most visible in the editor, where preview
    //geometry is perfectly axis aligned).
    //A wall's normal is close to horizontal, so one with almost no horizontal
    //part (a zero or near-zero normal) has no facing and is not a wall.
    var horizontal = Math.sqrt(
      foundNormal.x * foundNormal.x + foundNormal.z * foundNormal.z,
    );
    var foundVerticalPlane =
      didHit && horizontal > 0.5 && Math.abs(foundNormal.y) < 0.15;
    if (foundVerticalPlane) {
      this.markSurfaceHit();
      // Cache the pose of the last real wall hit. The step2 state below outlives
      // any single result by STATE_SWITCH_THRESHOLD frames, so without this a
      // miss frame would apply its zeroed position and normal: the surface would
      // snap to the world origin with a NaN rotation from normalizing (0,0,0).
      this.lastSurfacePosition = foundPosition;
      var averagedNormal = this.getAveragedWallNormal(foundNormal);
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

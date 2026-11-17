/**
 * SPECS Inc. 2027
 * Horizontal surface (ground) placement detector extending SurfaceDetector. Performs hit tests for
 * horizontal planes with configurable distance range (20-500cm), manages default screen distance for
 * non-detected state, integrates SingleSurface for cursor positioning and interaction, updates
 * instruction text on hover, and provides smooth interpolation for ground plane object placement.
 */
import { SurfaceDetector } from "../Scripts/SurfaceDetector";
import { HEAD_POSE_HORIZONTAL_RAY_TILT, SingleSurface } from "../Scripts/SingleSurface";
import { HandHintsController } from "./HandHintsController";

// Set min and max hit distance to surfaces
const MAX_HIT_DISTANCE = 500; //max is 1000
const MIN_HIT_DISTANCE = 20;
const DEFAULT_SCREEN_DISTANCE = 250; // Distance in cm from camera to visual when no surface is hit
const DEFAULT_GROUND_DISTANCE = 100;

@component
export class Horizontal extends SurfaceDetector {
  @ui.separator
  @ui.label('<span style="color: #60A5FA;">UI Configuration</span>')
  @ui.label('<span style="color: #94A3B8; font-size: 11px;">Instruction text for user guidance</span>')

  @input
  screenTextObj: SceneObject;

  private singleSurface: SingleSurface;
  private screenTextTrans = null;

  onAwake() {
    super.onAwake();
    this.singleSurface = this.getSceneObject().getComponent(
      SingleSurface.getTypeName()
    );
    this.screenTextTrans = this.screenTextObj.getTransform();
  }

  init(handHints: HandHintsController) {
    super.init(handHints);
    this.singleSurface.init(
      this.cameraTransform,
      this.trans,
      DEFAULT_SCREEN_DISTANCE
    );
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
    this.circleAnim.setLoadingColor(true);
    this.circleAnim.animateCircleIn(null);
    this.circleAnim.enableScanAnimation(true);
  }

  onInteractionStart() {
    if (!this.isCalibrationRunning || this.usesHeadPose) {
      return;
    }

    super.onInteractionStart();
    this.circleAnim.animateCircleOut(null);
    this.circleAnim.enableScanAnimation(false);
    this.handHintController.disableHint();
  }

  onInteractionEnd() {
    if (!this.isCalibrationRunning || this.usesHeadPose) {
      return;
    }
    super.onInteractionEnd();
    if (this.hitTestSession != null && super.isLookingAtCalibrationIcon()) {
      this.startCalibrationComplete();
    } else {
      this.onInteractionCanceled();
    }
  }

  startSurfaceCalibration(callback: (pos: vec3, rot: quat) => void): void {
    this.handHintController.disableHint();
    super.startSurfaceCalibration(callback);
    this.startHitTestSession();
    this.singleSurface.startCalibration();
    this.circleAnim.setLoadingColor(true);
    this.circleAnim.enableScanAnimation(true);
    if (!this.usesHeadPose) {
      this.handHintController.enableHint(this.hintAnchor.getTransform());
      this.playHandHint(this.isMobileConnected());
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
    this.playHandHint(isConnected);
  }

  private startCalibrationComplete() {
    this.isCalibrationRunning = false;
    if (this.usesHeadPose) {
      this.circleAnim.animateCircleOut(() => {
        super.onCalibrationComplete(this.invokeCalibrationComplete.bind(this));
      });
    } else {
      super.onCalibrationComplete(this.invokeCalibrationComplete.bind(this));
    }
  }

  private invokeCalibrationComplete() {
    this.onCompleteCallback(
      this.singleSurface.desiredPosition,
      this.singleSurface.desiredRotation
    );
  }

  protected update() {
    super.update();
    if (!this.isCalibrationRunning) return;
    if (this.singleSurface.hasFoundPlane()) {
      this.singleSurface.adjustPosition();
    } else {
      this.singleSurface.runHitTest(
        this.hitTestSession,
        MIN_HIT_DISTANCE,
        MAX_HIT_DISTANCE,
        true,
        this.onHitTestResult.bind(this)
      );
    }
    this.faceCamera();
    this.singleSurface.interpolatePositionVisuals();
    if (this.usesHeadPose) {
      this.updateReticleScale();
      if (this.hitTestSession != null && this.hasFreshSurfaceHit()) {
        if (this.updateDwellPlacement()) this.startCalibrationComplete();
      } else {
        this.resetDwellPlacement();
      }
    }

    //keep screen text at same height as camera
    const worldTextPos = this.screenTextObj
      .getParent()
      .getTransform()
      .getWorldTransform()
      .multiplyPoint(new vec3(0, 8, 0));
    worldTextPos.y = this.cameraTransform.getWorldPosition().y;
    //make sure text stays above ground visual
    worldTextPos.y = Math.max(
      worldTextPos.y,
      this.singleSurface.lastGroundHeight + 50
    );
    this.screenTextTrans.setWorldPosition(worldTextPos);
  }

  private onHitTestResult(hitTestResult) {
    if (!this.isCalibrationRunning || this.singleSurface.hasFoundPlane()) return;
    let foundPosition = vec3.zero();
    let foundNormal = vec3.zero();
    if (hitTestResult != null) {
      foundPosition = hitTestResult.position;
      foundNormal = hitTestResult.normal;
    }
    this.updateCalibration(foundPosition, foundNormal);
  }

  private updateCalibration(foundPosition: vec3, foundNormal: vec3) {
    const camPos = this.cameraTransform.getWorldPosition();
    //check if horizontal plane is being tracked
    const foundHorizontalPlane = foundNormal.y > 0.95;
    if (foundHorizontalPlane) {
      this.markSurfaceHit();
      this.singleSurface.useDefaultHeight = false;
      this.singleSurface.lastGroundHeight = foundPosition.y;

      this.singleSurface.desiredPosition = foundPosition;
    } else if (this.usesHeadPose) {
      const planeY = this.singleSurface.useDefaultHeight
        ? camPos.y - DEFAULT_GROUND_DISTANCE : this.singleSurface.lastGroundHeight;
      const direction = this.cameraTransform.forward.uniformScale(-1);
      direction.y -= HEAD_POSE_HORIZONTAL_RAY_TILT;
      const ray = direction.normalize();
      const distance = ray.y < -0.05 ? (planeY - camPos.y) / ray.y : MAX_HIT_DISTANCE;
      const position = camPos.add(ray.uniformScale(Math.max(MIN_HIT_DISTANCE, Math.min(MAX_HIT_DISTANCE, distance))));
      position.y = planeY;
      this.singleSurface.desiredPosition = position;
    } else {
      const worldCameraForward = this.cameraTransform.right
        .cross(vec3.up())
        .normalize();
      this.singleSurface.desiredPosition = camPos.add(
        worldCameraForward.uniformScale(-DEFAULT_SCREEN_DISTANCE)
      );
      this.singleSurface.desiredPosition =
        this.singleSurface.desiredPosition.add(
          vec3.up().uniformScale(-DEFAULT_GROUND_DISTANCE)
        );
    }

    const isGroundHeightLower =
      this.singleSurface.lastGroundHeight < foundPosition.y;

    this.singleSurface.desiredPosition.y =
      this.singleSurface.useDefaultHeight || !isGroundHeightLower
        ? this.singleSurface.desiredPosition.y
        : this.singleSurface.lastGroundHeight;
  }

  private faceCamera() {
    const worldCameraForward = this.cameraTransform.right
      .cross(vec3.up())
      .normalize();

    this.singleSurface.desiredRotation = quat.lookAt(
      worldCameraForward,
      vec3.up()
    );
  }
}

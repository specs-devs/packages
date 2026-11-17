/**
 * SPECS Inc. 2027
 * Single surface interaction handler for cursor positioning and drag operations. Manages interactable
 * hover/trigger events with drag threshold detection (11cm minimum), interpolates desired position and
 * rotation smoothly (speed 8), handles pinch-up and tap events for placement confirmation, integrates
 * with SurfaceDetector for calibration state, and provides click/drag distinction for refined placement.
 */
import {
  Interactable,
  InteractableEventArgs,
} from "SpectaclesInteractionKit.lspkg/Components/Interaction/Interactable/Interactable";
import { SIK } from "SpectaclesInteractionKit.lspkg/SIK";

import { SurfaceDetector } from "./SurfaceDetector";
import { Logger } from "Utilities.lspkg/Scripts/Utils/Logger";

const DRAG_THRESHOLD = 11; // Minimum distance to start drag in CM
export const HEAD_POSE_HORIZONTAL_RAY_TILT = 0.1;
const SPEED = 8; // Interpolation speed

@component
export class SingleSurface extends BaseScriptComponent {
  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Interaction Configuration</span>')
  @ui.label('<span style="color: #94A3B8; font-size: 11px;">Interactable component for hover and drag detection</span>')

  @input interactable: Interactable;

  desiredPosition = vec3.zero();
  desiredRotation = quat.quatIdentity();

  useDefaultHeight = true;
  lastGroundHeight = 0;

  private rightHand = SIK.HandInputData.getHand("right");
  private leftHand = SIK.HandInputData.getHand("left");

  private trans = null;
  private cameraTransform = null;
  private screenDistance = null;
  private currInteractor = null;
  private touchStartPosition = null;
  private isDragging = false;
  private surfaceDetector: SurfaceDetector = null;

  private readonly handleClick = () => this.onClick();
  private subscribedToHands = false;

  onAwake() {
    this.createEvent("OnDestroyEvent").bind(() => {
      if (this.subscribedToHands) {
        this.leftHand.onPinchUp.remove(this.handleClick);
        this.rightHand.onPinchUp.remove(this.handleClick);
      }
    });
    this.createEvent("OnStartEvent").bind(this.onStart.bind(this));
    this.surfaceDetector = this.getSceneObject()
      .getComponents("ScriptComponent")
      .find((s) => s instanceof SurfaceDetector) as SurfaceDetector;
  }

  private onStart() {
    if (this.surfaceDetector.usesHeadPose) return;
    this.subscribedToHands = true;
    //setup generation click/pinch
    this.leftHand.onPinchUp.add(this.handleClick);
    this.rightHand.onPinchUp.add(this.handleClick);
    this.createEvent("TapEvent").bind(this.handleClick);
    //setup direct interaction on UI
    this.interactable.onHoverEnter.add((args: InteractableEventArgs) => {
      this.surfaceDetector.onHoverEnter();
    });
    this.interactable.onHoverExit.add((args: InteractableEventArgs) => {
      this.surfaceDetector.onHoverExit();
    });
    this.interactable.onTriggerStart.add((args: InteractableEventArgs) => {
      this.currInteractor = args.interactor;
      this.surfaceDetector.onInteractionStart();
      this.touchStartPosition = this.desiredPosition;
      this.isDragging = false;
    });

    this.interactable.onTriggerCanceled.add((args: InteractableEventArgs) => {
      args.interactor.clearCurrentInteractable();
      this.currInteractor = null;
      this.surfaceDetector.onInteractionCanceled();
    });
    this.interactable.onTriggerEnd.add((args: InteractableEventArgs) => {
      this.currInteractor = null;
      this.surfaceDetector.onInteractionEnd();
    });
  }

  private onClick() {
    if (this.surfaceDetector.usesHeadPose) return;
    this.surfaceDetector.onInteractionStart();
    this.touchStartPosition = this.desiredPosition;
    this.isDragging = false;
    this.currInteractor = null;
    this.surfaceDetector.onInteractionEnd();
  }

  init(camTrans: Transform, transform: Transform, screenDist: number) {
    this.cameraTransform = camTrans;
    this.trans = transform;
    this.screenDistance = screenDist;
    this.setDefaultPose();
  }

  startCalibration() {
    this.useDefaultHeight = true;
    this.lastGroundHeight = 0;
    this.setDefaultPose();
  }

  setDefaultPose() {
    this.desiredPosition = this.cameraTransform
      .getWorldPosition()
      .add(this.cameraTransform.forward.uniformScale(-this.screenDistance));
    this.desiredRotation = this.cameraTransform.getWorldRotation();
    this.trans.setWorldPosition(this.desiredPosition);
    this.trans.setWorldRotation(this.desiredRotation);
  }

  hasFoundPlane() {
    return this.currInteractor != null;
  }

  runHitTest(
    hitTestSession: any,
    min: number,
    max: number,
    isHorizontal: boolean,
    onHitTestResult: (hitTestResult: any) => void
  ) {
    const isCapturing = getDeltaTime() < 0.001;
    if (isCapturing) {
      return;
    }

    const rayDirection = this.cameraTransform.forward;
    if (isHorizontal) {
      rayDirection.y += this.surfaceDetector.usesHeadPose ? HEAD_POSE_HORIZONTAL_RAY_TILT : 0.2;
    }
    const direction = rayDirection.normalize();
    const camPos = this.cameraTransform.getWorldPosition();
    const rayStart = camPos.add(direction.uniformScale(-min));
    const rayEnd = camPos.add(direction.uniformScale(-max));

    if (hitTestSession != null) {
      hitTestSession.hitTest(rayStart, rayEnd, (hitTestResult) => {
        onHitTestResult(hitTestResult);
      });
    }
  }

  adjustPosition() {
    //find point where camera forward intersects plane
    const planeNormal = this.desiredRotation.multiplyVec3(
      vec3.up().uniformScale(-1)
    );
    const interactorDirection = this.currInteractor.endPoint
      .sub(this.currInteractor.startPoint)
      .normalize();
    const distanceToPlane =
      planeNormal.dot(
        this.desiredPosition.sub(this.currInteractor.startPoint)
      ) / planeNormal.dot(interactorDirection);
    //what point on frozen plane is being pointed to
    const pointPos = this.currInteractor.startPoint.add(
      interactorDirection.uniformScale(distanceToPlane)
    );
    const distance = pointPos.distance(this.touchStartPosition);
    if (distance > DRAG_THRESHOLD && !this.isDragging) {
      this.isDragging = true;
    }
    if (this.isDragging) {
      this.desiredPosition = pointPos;
    }
  }

  interpolatePositionVisuals() {
    this.trans.setWorldPosition(
      vec3.lerp(
        this.trans.getWorldPosition(),
        this.desiredPosition,
        Math.min(1, getDeltaTime() * SPEED)
      )
    );
    this.trans.setWorldRotation(
      quat.slerp(
        this.trans.getWorldRotation(),
        this.desiredRotation,
        Math.min(1, getDeltaTime() * SPEED)
      )
    );
  }
}

/**
 * SPECS Inc. 2027
 * Base surface detection class for AR placement with visual feedback and hit testing. Creates and manages
 * HitTestSession for surface queries, animates circle indicator with scale transitions, updates hint
 * anchor position during detection, handles hover enter/exit for instruction text changes, detects mobile
 * connection state for platform-specific hints, and coordinates calibration workflow with completion callbacks.
 */
import animate, {
  CancelSet,
} from "SpectaclesInteractionKit.lspkg/Utils/animate";

import { Interactable } from "SpectaclesInteractionKit.lspkg/Components/Interaction/Interactable/Interactable";
import { CircleAnimation } from "../Scripts/CircleAnimation";
import { HandHintsController } from "./HandHintsController";
import { PlacementInteraction, PlacementMode, PlacementSettings } from "./PlacementSettings";
import { SIK } from "SpectaclesInteractionKit.lspkg/SIK";
import WorldCameraFinderProvider from "SpectaclesInteractionKit.lspkg/Providers/CameraProvider/WorldCameraFinderProvider";
import { Logger } from "Utilities.lspkg/Scripts/Utils/Logger";
import { bindStartEvent, bindUpdateEvent, bindLateUpdateEvent, bindDestroyEvent } from "SnapDecorators.lspkg/decorators";

// Head-pose placement: measure aim at a fixed depth so hit-depth noise
// cannot restart the dwell timer. A fresh real surface is still required.
const DWELL_AIM_DEPTH = 100;
const STILL_WINDOW_SECONDS = 0.5;
const STILL_MOVEMENT_THRESHOLD = 4;
const DWELL_DRIFT_THRESHOLD = 10;
const DWELL_FILL_SECONDS = 1.5;
const SURFACE_STALE_SECONDS = 0.5;
const RETICLE_REFERENCE_DISTANCE = 300;


@component
export class SurfaceDetector extends BaseScriptComponent {
  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Visual Feedback</span>')
  @ui.label('<span style="color: #94A3B8; font-size: 11px;">Circle animation and hint components</span>')

  @input
  circleAnim: CircleAnimation;

  @input
  hintAnchor: SceneObject;

  @allowUndefined
  @input
  confirmText: Text;

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
  private logger: Logger;  protected cameraTransform: Transform =
    WorldCameraFinderProvider.getInstance().getTransform();
  protected hitTestSession = null;
  protected onCompleteCallback = null;
  protected onAnimCompleteCallback = null;
  protected trans = this.getSceneObject().getTransform();

  private updateEvent = null;
  private worldQueryModule = null;

  private visualParentTrans = this.getSceneObject().getChild(0).getTransform();
  private animCancel: CancelSet = new CancelSet();

  private iconTrans = null;
  private reticleBaseScale = vec3.one();
  private headPose = false;
  private disposed = false;
  private dwellPosHistory: vec3[] = [];
  private dwellTimeHistory: number[] = [];
  private dwellProgress = 0;
  private dwellAnchor = vec3.zero();
  private lastSurfaceHitTime = -1;

  get usesHeadPose(): boolean {
    return this.headPose;
  }

  configure(settings: PlacementSettings) {
    this.headPose = settings.placementMode !== PlacementMode.NEAR_SURFACE &&
      settings.interaction === PlacementInteraction.HEAD_POSE;
    if (this.headPose) {
      this.disableInteractables(this.getSceneObject());
    }
  }

  protected updateReticleScale() {
    const distance = this.trans.getWorldPosition().distance(this.cameraTransform.getWorldPosition());
    const factor = Math.min(4, Math.max(0.1, distance / RETICLE_REFERENCE_DISTANCE));
    this.iconTrans.setLocalScale(this.reticleBaseScale.uniformScale(factor));
  }

  protected markSurfaceHit() {
    this.lastSurfaceHitTime = getTime();
  }

  protected hasFreshSurfaceHit(): boolean {
    return this.lastSurfaceHitTime >= 0 &&
      getTime() - this.lastSurfaceHitTime <= SURFACE_STALE_SECONDS;
  }

  protected setConfirmText(text: string) {
    if (this.confirmText != null) this.confirmText.text = text;
  }

  protected resetDwellPlacement(reenableScan = true) {
    this.dwellPosHistory = [];
    this.dwellTimeHistory = [];
    this.restartDwellLoader(reenableScan);
  }

  private restartDwellLoader(reenableScan = true) {
    this.dwellProgress = 0;
    this.circleAnim.setLoadingAmount(0);
    this.circleAnim.enableScanAnimation(reenableScan);
    this.setConfirmText("Find an empty spot.\nHold still to place.");
  }

  protected updateDwellPlacement(): boolean {
    const dt = getDeltaTime();
    // A capture pause or long frame cannot count as observed stillness.
    if (dt < 0.001 || dt > 0.25) {
      this.resetDwellPlacement();
      return false;
    }
    const now = getTime();
    const pos = this.cameraTransform.getWorldPosition().add(
      this.cameraTransform.forward.uniformScale(-DWELL_AIM_DEPTH)
    );
    this.dwellPosHistory.push(pos);
    this.dwellTimeHistory.push(now);
    while (this.dwellTimeHistory.length > 1 &&
      now - this.dwellTimeHistory[1] >= STILL_WINDOW_SECONDS) {
      this.dwellPosHistory.shift();
      this.dwellTimeHistory.shift();
    }
    const movement = this.dwellPosHistory.reduce(
      (maximum, sample) => Math.max(maximum, sample.distance(pos)), 0
    );
    if (now - this.dwellTimeHistory[0] < STILL_WINDOW_SECONDS ||
      movement > STILL_MOVEMENT_THRESHOLD) {
      this.restartDwellLoader();
      return false;
    }
    if (this.dwellProgress === 0) {
      this.dwellAnchor = pos;
      this.setConfirmText("Placing\nhold still...");
    } else if (pos.distance(this.dwellAnchor) > DWELL_DRIFT_THRESHOLD) {
      this.resetDwellPlacement();
      return false;
    }
    this.dwellProgress = Math.min(1, this.dwellProgress + dt / DWELL_FILL_SECONDS);
    this.circleAnim.setLoadingAmount(this.dwellProgress);
    if (this.dwellProgress < 1) return false;
    this.setConfirmText("Complete");
    return true;
  }

  protected mobileConnected = false;

  protected isCalibrationRunning = false;

  protected handHintController: HandHintsController = null;  /**
   * Called when component is initialized
   */
  onAwake(): void {
    // Initialize logger
    this.logger = new Logger("SurfaceDetector", this.enableLogging || this.enableLoggingLifecycle, true);

    if (this.enableLoggingLifecycle) {
      this.logger.debug("LIFECYCLE: onAwake() - Component initializing");
    }


    this.visualParentTrans.setLocalScale(vec3.zero());
    this.iconTrans = this.circleAnim.getSceneObject().getTransform();
    this.reticleBaseScale = this.iconTrans.getLocalScale();
  }

  init(handHints: HandHintsController) {
    this.handHintController = handHints;
    this.onMobileConnnectionStateChange(this.isMobileConnected());
  }

  onDestroy() {
    this.disposed = true;
    this.isCalibrationRunning = false;
    this.onCompleteCallback = null;
    this.onAnimCompleteCallback = null;
    this.circleAnim.cancelAnimations();
    this.logger.debug("SurfaceDetector destroyed");
    if (this.hitTestSession != null) {
      this.hitTestSession.stop();
      this.hitTestSession = null;
    }
    if (this.updateEvent != null) {
      this.removeEvent(this.updateEvent);
      this.updateEvent = null;
    }
    if (this.animCancel) this.animCancel.cancel();
  }

  /**
   * Tears the detector down without leaving SIK's cursor referencing a
   * destroyed interactable. The interactables are disabled first so SIK's
   * InteractionManager deregisters them on this frame, and the SceneObject is
   * destroyed on the next frame. Destroying it synchronously here can happen
   * mid cursor update and leaves a dangling interactable that SIK trips over
   * ("Exception in HostFunction: Object is null" in CursorViewModel).
   */
  destroySafely() {
    if (this.disposed) return;
    this.onDestroy();
    this.disableInteractables(this.getSceneObject());
    const sceneObject = this.getSceneObject();
    const delayedDestroy = this.createEvent("DelayedCallbackEvent");
    delayedDestroy.bind(() => {
      sceneObject.destroy();
    });
    delayedDestroy.reset(0);
  }

  private disableInteractables(sceneObject: SceneObject) {
    const interactables = sceneObject.getComponents(
      Interactable.getTypeName()
    ) as Interactable[];
    interactables.forEach((interactable) => {
      interactable.enabled = false;
    });
    const childCount = sceneObject.getChildrenCount();
    for (let i = 0; i < childCount; i++) {
      this.disableInteractables(sceneObject.getChild(i));
    }
  }

  startSurfaceCalibration(callback: (pos: vec3, rot: quat) => void): void {
    this.isCalibrationRunning = true;
    this.visualParentTrans.getSceneObject().enabled = true;
    this.circleAnim.reset();
    this.lastSurfaceHitTime = -1;
    if (this.usesHeadPose) this.resetDwellPlacement();
    this.animateVisuals(true, null);
    this.onCompleteCallback = callback;
    this.updateEvent = this.createEvent("UpdateEvent");
    this.updateEvent.bind(this.update.bind(this));
  }

  onHoverEnter() {
    //change instruction text
    if (this.confirmText != null) {
      this.confirmText.text = "Drag to Move";
    }
  }

  onHoverExit() {
    //change instruction text
    if (this.confirmText != null && this.isCalibrationRunning) {
      this.confirmText.text = this.isMobileConnected()
        ? "Tap to Confirm"
        : "Pinch to Confirm";
    }
  }

  onInteractionCanceled() {}

  onInteractionStart() {}

  onInteractionEnd() {}

  protected isLookingAtCalibrationIcon() {
    const camComp = this.cameraTransform.getSceneObject().getComponent("Camera");
    return camComp.isSphereVisible(this.iconTrans.getWorldPosition(), 10);
  }

  protected animateVisuals(animateIn: boolean, callback: () => void) {
    if (this.animCancel) this.animCancel.cancel();
    const start = animateIn ? vec3.zero() : vec3.one();
    const end = animateIn ? vec3.one() : vec3.zero();
    const easingType = animateIn
      ? ("ease-out-cubic" as const)
      : ("ease-in-cubic" as const);
    animate({
      easing: easingType,
      duration: 0.5,
      update: (t: number) => {
        this.visualParentTrans.setLocalScale(vec3.lerp(start, end, t));
      },
      ended: callback,
      cancelSet: this.animCancel,
    });
  }

  // Zero scale alone leaves the reticle's colliders and interactables live until
  // the session is stopped, so switch the finished detector off.
  private hideVisuals() {
    if (this.disposed) return;
    this.disableInteractables(this.getSceneObject());
    this.visualParentTrans.getSceneObject().enabled = false;
  }

  protected startHitTestSession() {
    try {
      this.worldQueryModule =
        require("LensStudio:WorldQueryModule") as WorldQueryModule;
      const options = HitTestSessionOptions.create();
      options.filter = true;
      this.hitTestSession =
        this.worldQueryModule.createHitTestSessionWithOptions(options);
      this.hitTestSession.start();
    } catch (e) {
      this.logger.debug("Hit test error: " + e);
    }
  }

  protected onMobileConnnectionStateChange(isConnected: boolean) {
    if (this.usesHeadPose) return;
    //change instruction text
    if (this.confirmText != null) {
      this.confirmText.text = isConnected
        ? "Tap to Confirm"
        : "Pinch to Confirm";
    }
  }

  protected isMobileConnected() {
    return SIK.MobileInputData.isAvailable();
  }

  protected update() {
    const isMobileAvailable = SIK.MobileInputData.isAvailable();
    if (this.mobileConnected != isMobileAvailable) {
      this.mobileConnected = isMobileAvailable;
      this.onMobileConnnectionStateChange(this.mobileConnected);
    }
  }

  protected onCalibrationComplete(callback: () => void) {
    if (this.disposed) return;
    this.isCalibrationRunning = false;
    this.logger.debug("Calibration complete..");
    //remove events
    this.removeEvent(this.updateEvent);
    this.updateEvent = null;
    //delay stop hit test session
    const delay = this.createEvent("DelayedCallbackEvent");
    delay.bind(() => {
      if (this.hitTestSession != null) {
        this.logger.debug("Stopping hit test session...");
        this.hitTestSession.stop();
        this.hitTestSession = null;
      }
    });
    delay.reset(0.1);
    //play audio
    this.getSceneObject()
      .getParent()
      .getComponent("Component.AudioComponent")
      .play(1);

    //animate circle
    this.onAnimCompleteCallback = callback;
    this.circleAnim.animateCircleIn(() => {
      if (this.disposed) return;
      // Near-surface widgets read the reticle's world pose here. Deliver before
      // scaling its parent to zero, which makes world rotation ambiguous.
      const complete = this.onAnimCompleteCallback;
      this.onAnimCompleteCallback = null;
      if (complete) complete.call(this);
      // A consumer can cancel or restart placement from its callback.
      if (!this.disposed) this.animateVisuals(false, () => this.hideVisuals());
    });
  }
}

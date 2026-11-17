/**
 * SPECS Inc. 2027
 * Base of the placement modes: runs the hit test session, confirms placement by dwell, keeps the
 * reticle a constant size on screen, and plays the placement visuals in and out.
 */
import animate, {
  CancelSet,
} from "InteractionKit.lspkg/Utils/animate";

import { CircleAnimation } from "../Scripts/CircleAnimation";
import { IK } from "InteractionKit.lspkg/IK";
import WorldCameraFinderProvider from "InteractionKit.lspkg/Providers/CameraProvider/WorldCameraFinderProvider";

// Dwell-to-place: placement confirms by holding the view steady, no pinch/tap.
//
// Stillness is measured on a point a fixed depth along the camera's gaze, not on
// the placement indicator. Hit-test depth noise jitters the indicator by cm even
// when the wearer is perfectly still, which restarts the loader and can make
// placement unreachable; the wearer's aim is the thing we actually want to judge.
// The depth is only a lever arm converting head rotation into cm: at 100cm, one
// degree of head turn moves the aim point ~1.75cm.
const DWELL_AIM_DEPTH = 100; // cm in front of the camera where stillness is measured
const STILL_WINDOW_SECONDS = 0.5; // trailing window of aim positions judged for stillness
const STILL_MOVEMENT_THRESHOLD = 4; // cm the aim point may wander across that window (~2.3 deg)
// Total budget from where the loader started. The window check alone cannot see
// a drift slower than threshold/window, which would otherwise fill the loader
// while the wearer is still slowly panning.
const DWELL_DRIFT_THRESHOLD = 10; // cm the aim point may drift while the loader fills (~5.7 deg)
// These two are what the wearer feels: the window has to pass before the loader
// starts, so placement takes their sum from the moment they hold still. The fill
// is also exactly how long the high-accuracy hit test gets to report, since the
// two start together. Measured on device: the first accurate answer lands
// ~0.5s in (session warm-up) and the pose converges within 1-2 applied hits,
// so 1.0s still fits the answer plus a retry with margin; below ~0.8s a
// missed first query would start racing the window.
const DWELL_FILL_SECONDS = 1.0; // seconds for the loader to fill once the aim is steady
// Placement must never complete on a guessed pose, so it also requires a recent
// real hit. Time-based rather than a miss counter so it covers a hit test that
// stops reporting altogether, not just one dropping frames.
const SURFACE_STALE_SECONDS = 0.5; // no accepted hit for this long means we are not on a surface

// A high-accuracy hit test runs underneath the loader: it fires when the loader
// starts filling and is abandoned the moment the wearer moves.
//
// What the highAccuracy option actually promises: one hitTest invokes its callback
// once, with the best hit it could produce along the ray, or null if no surface
// was found. Same shape as a standard hit test, it just favors accuracy over
// response time, and the session draws extra power until it is stopped. Nothing in
// that contract says when the result arrives, so the fill is the only timer: a hit
// that lands inside it is placed, otherwise the coarse pose is, and the accurate
// test never delays placement itself.
const MIN_REFINE_RAY_LENGTH = 50; // cm - depth starts at 50cm, nothing closer can be measured
const REFINE_RAY_OVERSHOOT = 100; // cm - the accurate depth may sit further out than the coarse estimate
// One answer per query means a single early hit would freeze the depth for the
// rest of the fill. Warm queries answer in ~20ms (measured 45/s sustained), so
// answered queries are re-fired at the settled target for the whole fill and the
// newest answer keeps folding in.
const REFINE_REFIRE_SECONDS = 0.2; // min gap between follow-up queries during the fill

// The reticle is a world-space object, so what the wearer sees shrinks as it lands
// further away. Growing its scale in step with range keeps the angular size, and
// so the on-display size, constant. Each mode's authored scale is taken as the one
// that looks right at the reference distance, so their sizes stay distinct.
//
// This is the one knob for how big the reticle reads: scale is proportional to
// distance / reference, so raising it shrinks the reticle at every range by the
// same proportion. Calibrated on device rather than derived.
const RETICLE_REFERENCE_DISTANCE = 300; // cm
const RETICLE_MIN_SCALE = 0.1; // rails, in case a pose lands on or behind the camera
const RETICLE_MAX_SCALE = 4.0;
// An angular-constant reticle reads too small right up close, so modes can grow
// it by reticleCloseBoost at point-blank range. The boost is full at or inside
// this distance and fades linearly to nothing at the reference distance, so far
// behavior is untouched.
const RETICLE_BOOST_NEAR = 100; // cm

export interface RefinePose {
  x: number; // hit position (world, cm)
  y: number;
  z: number;
  nx: number; // hit normal
  ny: number;
  nz: number;
}

const dwellIdleText = "<b>Find</b> an empty spot.";
//shared with modes that run their own loader, so every mode reads the same
export const dwellFillingText = "Placing...";
export const dwellCompleteText = "<b>Complete</b>";

@component
export class SurfaceDetector extends BaseScriptComponent {
  @input
  circleAnim!: CircleAnimation;

  @allowUndefined
  @input
  confirmText!: Text;

  protected cameraTransform: Transform =
    WorldCameraFinderProvider.getInstance().getTransform();
  protected hitTestSession = null;
  protected onCompleteCallback = null;
  protected trans = this.getSceneObject().getTransform();

  private updateEvent = null;
  private worldQueryModule = null;

  private visualParentTrans = this.getSceneObject().getChild(0).getTransform();
  private animCancel: CancelSet = new CancelSet();
  //set by onDestroy, after which nothing may start animating this detector
  private disposed = false;

  private reticleTrans!: Transform;
  //whatever the prefab authored, treated as correct at the reference distance
  private reticleBaseScale: vec3 = vec3.one();
  //extra size at point-blank range, fading out by the reference distance; modes
  //that read too small up close raise it, 1 keeps the scale purely angular
  protected reticleCloseBoost = 1;
  // Movement tolerance multiplier once the loader is filling. Starting the fill
  // keeps the tight thresholds, but a wearer mid-fill has committed: cancelling
  // a mostly-complete dwell over a wobble costs a full restart. Modes raise this
  // to give the fill extra buffer; 1 polices the fill as tightly as the start.
  protected dwellFillingBuffer = 1;

  protected isCalibrationRunning = false;

  private dwellPosHistory: vec3[] = [];
  private dwellTimeHistory: number[] = [];
  private dwellProgress = 0;
  //only meaningful while dwellProgress > 0
  private dwellAnchor: vec3 = vec3.zero();
  private lastSurfaceHitTime = -1;

  //see PlacementSettings.showDebug
  public showDebug = false;
  private refineSession = null;
  private refineSessionFailed = false;
  private refineActive = false;
  //set from the hit test callback, consumed on the next tick
  private refinePending: RefinePose = null;
  //the callback fires once per hitTest: still to come, landed on a surface, found
  //none, or landed somewhere the mode vetoed
  private refineOutcome: "pending" | "hit" | "miss" | "rejected" = "pending";
  private refineStartTime = 0;
  //when the first query of this dwell fired, for whole-window elapsed logging
  private refineFirstFireTime = 0;
  //poses applied this dwell; >0 means the delivered pose is high-accuracy
  private refineAppliedCount = 0;
  //bumped per hitTest, so a callback from an abandoned one cannot pose as the current
  private refineGeneration = 0;
  //coarse point the ray was aimed at, so a log can show how far the accurate hit moved things
  private refineTarget: vec3 = vec3.zero();
  // Re-fire the moment each answer lands rather than every
  // REFINE_REFIRE_SECONDS, for modes that pool every hit instead of following
  // the newest. They log a summary of their own, so the per-hit lines are left out.
  protected refineContinuously = false;

  onAwake() {
    this.visualParentTrans.setLocalScale(vec3.zero());
    this.reticleTrans = this.circleAnim.getTransform();
    this.reticleBaseScale = this.reticleTrans.getLocalScale();
  }

  // Holds the reticle at a fixed size on the display. Modes that place at a range
  // call this each frame; near-surface placement is always within arm's reach, so
  // it leaves its authored scale alone.
  protected updateReticleScale() {
    const distance = this.trans
      .getWorldPosition()
      .distance(this.cameraTransform.getWorldPosition());
    let factor = Math.min(
      RETICLE_MAX_SCALE,
      Math.max(RETICLE_MIN_SCALE, distance / RETICLE_REFERENCE_DISTANCE),
    );
    if (this.reticleCloseBoost != 1) {
      const t = Math.min(
        1,
        Math.max(
          0,
          (RETICLE_REFERENCE_DISTANCE - distance) /
            (RETICLE_REFERENCE_DISTANCE - RETICLE_BOOST_NEAR),
        ),
      );
      factor *= MathUtils.lerp(1, this.reticleCloseBoost, t);
    }
    this.reticleTrans.setLocalScale(this.reticleBaseScale.uniformScale(factor));
  }

  init() {
    this.setConfirmText(dwellIdleText);
  }

  onDestroy() {
    this.disposed = true;
    if (this.hitTestSession != null) {
      this.hitTestSession.stop();
      this.hitTestSession = null;
    }
    //an unstopped high-accuracy session keeps its extra power draw alive for the Lens
    this.cancelRefine();
    this.stopRefineSession();
    if (this.updateEvent != null) {
      this.removeEvent(this.updateEvent);
      this.updateEvent = null;
    }
    if (this.animCancel) this.animCancel.cancel();
    //its animations run off a shared update that outlives this detector
    if (this.circleAnim) this.circleAnim.cancelAnimations();
  }

  startSurfaceCalibration(callback: (pos: vec3, rot: quat) => void): void {
    this.isCalibrationRunning = true;
    this.lastSurfaceHitTime = -1;
    this.resetDwellPlacement();
    this.setConfirmText(dwellIdleText);
    this.circleAnim.reset();
    this.circleAnim.setLoadingAmount(0);
    this.animateVisuals(true, null);
    this.onCompleteCallback = callback;
    this.updateEvent = this.createEvent("UpdateEvent");
    this.updateEvent.bind(this.update.bind(this));
  }

  // True from the moment the high-accuracy hit test fires until the dwell completes
  // or is abandoned. Modes stop their coarse hit tests for the duration: results
  // would fight the accurate pose once it lands, and the pose is frozen on the
  // point the wearer settled on rather than tracking later aim drift.
  protected isRefining(): boolean {
    return this.refineActive;
  }

  // Modes override this pair to opt into the high-accuracy pass. Returning null
  // from the target means "none available", and placement completes on the coarse
  // pose exactly as it would without the API.
  protected getRefineTarget(): vec3 {
    return null;
  }

  protected applyRefinedPose(pose: RefinePose) {}

  //an answer that found no surface along the ray, for modes that keep count
  protected onRefineMiss() {}

  // Lets a mode veto an accurate hit before it is applied, for surfaces it can
  // tell are wrong; a vetoed hit leaves the current pose standing. Accepts every
  // hit by default.
  protected acceptRefinedPose(pose: RefinePose): boolean {
    return true;
  }

  // For modes that run their own calibration instead of the dwell: call
  // startRefine when calibration starts, tickRefine every frame it runs, and
  // cancelRefine when it is abandoned. That is the same high-accuracy pass the
  // dwell drives for the modes that use it, re-fires included.
  protected startRefine() {
    this.beginRefine();
  }

  protected tickRefine() {
    this.applyPendingRefinement();
    this.maybeRefireRefine();
  }

  // High-accuracy session, created lazily on the first dwell that needs it and
  // kept for the rest of calibration: re-aiming is a fresh hitTest, not a fresh
  // session. Deliberately NOT pre-warmed at calibration start: depth data is
  // shared across sessions, and a live high-accuracy session during the aiming
  // phase starves the coarse tracker of hits at close range, which blocks the
  // dwell gate entirely. The ~0.5s warm-up costs the fill its first couple of
  // refinements; the re-fire loop still lands several more before commit.
  private getOrCreateRefineSession() {
    if (this.refineSession != null || this.refineSessionFailed) {
      return this.refineSession;
    }
    try {
      if (this.worldQueryModule == null) {
        this.worldQueryModule =
          require("LensStudio:WorldQueryModule") as WorldQueryModule;
      }
      const options = HitTestSessionOptions.create();
      //one result per hitTest, so there is nothing for the smoothing filter to do
      options.filter = false;
      options.highAccuracy = true;
      // Read it back: a device runtime older than the option may not carry the
      // property, in which case the write does not stick and there is nothing
      // accurate to wait for, so the caller should not pay for the session.
      if (options.highAccuracy !== true) {
        print(
          "High-accuracy hit test unavailable on this runtime, using coarse placement",
        );
        this.refineSessionFailed = true;
        return null;
      }
      const session =
        this.worldQueryModule.createHitTestSessionWithOptions(options);
      session.start();
      this.refineSession = session;
    } catch (e) {
      print("High-accuracy session unavailable, using coarse placement: " + e);
      this.refineSessionFailed = true;
      this.refineSession = null;
    }
    return this.refineSession;
  }

  //stopping ends the extra power draw; a result still outstanding is dropped by
  //the callback, which finds the dwell gone
  private stopRefineSession() {
    if (this.refineSession == null) {
      return;
    }
    this.refineSession.stop();
    this.refineSession = null;
  }

  // Fire one high-accuracy hit test along camera -> the settled coarse point.
  // Silently does nothing on runtimes or modes without it, leaving the dwell to
  // complete on the coarse pose. Re-fires (refire=true) aim at the latest
  // refined target and skip the per-dwell bookkeeping reset.
  private beginRefine(refire: boolean = false) {
    const target = this.getRefineTarget();
    if (target == null) {
      return;
    }
    // Build and validate the ray before touching the session, so a degenerate
    // target cannot leave a started session (and its power draw) behind.
    const camPos = this.cameraTransform.getWorldPosition();
    const toTarget = target.sub(camPos);
    const dist = toTarget.length;
    // A degenerate direction would normalize to NaN and the hit test throws on a
    // non-finite ray. Nothing is measured closer than the depth near limit
    // either, so a target inside it has nothing to measure against.
    if (!(dist > MIN_REFINE_RAY_LENGTH)) {
      if (!refire) {
        this.log(
          "High-accuracy hit test skipped: target " +
            dist.toFixed(0) +
            "cm out, inside the " +
            MIN_REFINE_RAY_LENGTH +
            "cm depth limit",
        );
      }
      return;
    }
    const session = global.deviceInfoSystem.isEditor()
      ? null
      : this.getOrCreateRefineSession();
    if (session == null) {
      return;
    }
    const dir = toTarget.normalize();
    const rayStart = camPos.add(dir.uniformScale(MIN_REFINE_RAY_LENGTH));
    const rayEnd = camPos.add(dir.uniformScale(dist + REFINE_RAY_OVERSHOOT));

    this.refineActive = true;
    this.refinePending = null;
    this.refineOutcome = "pending";
    this.refineStartTime = getTime();
    this.refineTarget = target;
    if (!refire) {
      this.refineFirstFireTime = this.refineStartTime;
      this.refineAppliedCount = 0;
      this.log(
        "High-accuracy hit test fired, coarse target " +
          dist.toFixed(0) +
          "cm out",
      );
    }
    const generation = ++this.refineGeneration;
    try {
      session.hitTest(rayStart, rayEnd, (hit) => {
        // A result for a point the wearer has since left: the dwell was abandoned,
        // or restarted and re-aimed with a newer hitTest. Only the current counts.
        if (!this.refineActive || generation != this.refineGeneration) {
          return;
        }
        if (hit == null) {
          //no surface along the ray: nothing to apply, the coarse pose stands
          this.refineOutcome = "miss";
          this.onRefineMiss();
          if (!this.refineContinuously) {
            this.log(
              "High-accuracy hit test found no surface after " +
                this.refineElapsed().toFixed(2) +
                "s, coarse pose stands",
            );
          }
          return;
        }
        //the one and only result, applied on the next tick
        this.refineOutcome = "hit";
        this.refinePending = {
          x: hit.position.x,
          y: hit.position.y,
          z: hit.position.z,
          nx: hit.normal.x,
          ny: hit.normal.y,
          nz: hit.normal.z,
        };
      });
    } catch (e) {
      // hitTest() validates the ray natively and throws on non-finite input.
      // Never let that escape into the dwell tick.
      print("High-accuracy hit test failed, using coarse placement: " + e);
      this.cancelRefine();
    }
  }

  // Abandons the current high-accuracy hit test. The session is left running for
  // the next dwell; if the abandoned test still reports, its callback finds the
  // dwell gone or re-aimed and drops the result.
  protected cancelRefine() {
    //guarded so a mode resetting the dwell every frame does not spam the log
    if (this.refineActive) {
      this.log(
        "High-accuracy hit test abandoned " +
          this.refineElapsed().toFixed(2) +
          "s in, result " +
          this.refineOutcome,
      );
    }
    this.clearRefine();
  }

  private clearRefine() {
    this.refineActive = false;
    this.refinePending = null;
  }

  private refineElapsed(): number {
    return getTime() - this.refineStartTime;
  }

  // Folds in the accurate hit on the tick after it lands. The callback fires once
  // per hitTest, so this applies at most one pose per dwell.
  private applyPendingRefinement() {
    if (!this.refineActive || this.refinePending == null) {
      return;
    }
    const pose = this.refinePending;
    this.refinePending = null;
    const pos = new vec3(pose.x, pose.y, pose.z);
    if (!this.acceptRefinedPose(pose)) {
      this.refineOutcome = "rejected";
      if (this.refineContinuously) {
        return;
      }
      this.log(
        "High-accuracy hit rejected at " +
          this.refineElapsed().toFixed(2) +
          "s, " +
          pos.distance(this.refineTarget).toFixed(2) +
          "cm from the target (height " +
          (pose.y - this.refineTarget.y >= 0 ? "+" : "") +
          (pose.y - this.refineTarget.y).toFixed(2) +
          "cm), normal.y=" +
          pose.ny.toFixed(3),
      );
      return;
    }
    this.refineAppliedCount++;
    if (!this.refineContinuously) {
      this.log(
        "High-accuracy hit " +
          this.refineAppliedCount +
          " at " +
          this.refineElapsed().toFixed(2) +
          "s, moved " +
          pos.distance(this.refineTarget).toFixed(2) +
          "cm, normal.y=" +
          pose.ny.toFixed(3),
      );
    }
    this.applyRefinedPose(pose);
  }

  // The one-shot query answers once, so a single early hit would freeze the
  // depth for the rest of the fill. While the loader is still filling, follow up
  // with another query aimed at the latest refined target; movement voids the
  // whole thing through the usual dwell restart.
  private maybeRefireRefine() {
    if (!this.refineActive || this.refineOutcome == "pending") {
      return;
    }
    if (
      !this.refineContinuously &&
      getTime() - this.refineStartTime < REFINE_REFIRE_SECONDS
    ) {
      return;
    }
    this.beginRefine(true);
  }

  //modes call this whenever a hit test lands on a surface they accept
  protected markSurfaceHit() {
    this.lastSurfaceHitTime = getTime();
  }

  //true while a surface hit is recent enough to place against
  protected hasFreshSurfaceHit(): boolean {
    return (
      this.lastSurfaceHitTime >= 0 &&
      getTime() - this.lastSurfaceHitTime <= SURFACE_STALE_SECONDS
    );
  }

  //point a fixed depth along the gaze, the reference for stillness
  private getAimPoint() {
    return this.cameraTransform
      .getWorldPosition()
      .add(this.cameraTransform.forward.uniformScale(-DWELL_AIM_DEPTH));
  }

  //restart the dwell loader and wait for the aim to settle again
  protected resetDwellPlacement() {
    this.dwellPosHistory = [];
    this.dwellTimeHistory = [];
    this.cancelRefine();
    this.restartDwellLoader();
  }

  private restartDwellLoader() {
    if (this.dwellProgress > 0) {
      this.dwellProgress = 0;
      //the wearer moved off the point being measured, so that result is void
      this.cancelRefine();
      this.circleAnim.setLoadingAmount(0);
      this.setConfirmText(dwellIdleText);
    }
  }

  //how far the aim point wandered across the sampled window, in cm
  private getDwellMovement() {
    var newest = this.dwellPosHistory[this.dwellPosHistory.length - 1];
    var maxMovement = 0;
    for (var i = 0; i < this.dwellPosHistory.length - 1; i++) {
      maxMovement = Math.max(
        maxMovement,
        this.dwellPosHistory[i].distance(newest),
      );
    }
    return maxMovement;
  }

  // Dwell confirm: samples the aim point over a trailing STILL_WINDOW_SECONDS
  // window; while it stays within STILL_MOVEMENT_THRESHOLD the loading circle
  // fills over DWELL_FILL_SECONDS, and while filling the aim may not drift more
  // than DWELL_DRIFT_THRESHOLD from where it started. Any wander past either
  // threshold restarts the loader, and it cannot start again until a full steady
  // window has been collected. Callers gate this on hasFreshSurfaceHit(), so a
  // steady aim at nothing trackable never places.
  //
  // The high-accuracy hit test rides along: it fires when the loader starts
  // filling, is voided by the same movement that restarts the loader, and never
  // delays completion. Returns true on the frame placement should complete.
  protected updateDwellPlacement(): boolean {
    const dt = getDeltaTime();
    if (dt < 0.001) {
      return false; //capture pause, same guard as runHitTest
    }
    const now = getTime();
    const pos = this.getAimPoint();
    this.dwellPosHistory.push(pos);
    this.dwellTimeHistory.push(now);
    //drop samples that aged out, keeping the one that spans the window edge so
    //the window can still be proven full
    while (
      this.dwellTimeHistory.length > 1 &&
      now - this.dwellTimeHistory[1] >= STILL_WINDOW_SECONDS
    ) {
      this.dwellPosHistory.shift();
      this.dwellTimeHistory.shift();
    }

    //a partial window cannot prove stillness yet
    const windowFilled = now - this.dwellTimeHistory[0] >= STILL_WINDOW_SECONDS;
    //starting stays tight; a fill already underway gets the mode's extra buffer
    const buffer = this.dwellProgress > 0 ? this.dwellFillingBuffer : 1;
    if (
      !windowFilled ||
      this.getDwellMovement() > STILL_MOVEMENT_THRESHOLD * buffer
    ) {
      this.restartDwellLoader();
      return false;
    }

    if (this.dwellProgress == 0) {
      this.dwellAnchor = pos;
      this.setConfirmText(dwellFillingText);
      //the fill and the high-accuracy hit test start together, so the wearer waits once
      this.beginRefine();
    } else if (
      pos.distance(this.dwellAnchor) >
      DWELL_DRIFT_THRESHOLD * this.dwellFillingBuffer
    ) {
      //creeping away from where the loader started, too slowly for the window
      this.restartDwellLoader();
      return false;
    }
    this.dwellProgress = Math.min(
      1,
      this.dwellProgress + dt / DWELL_FILL_SECONDS,
    );
    this.circleAnim.setLoadingAmount(this.dwellProgress);
    //take the accurate hit if it landed during the fill; it never extends the wait
    this.applyPendingRefinement();
    //one early answer must not freeze the depth for the rest of the fill
    this.maybeRefireRefine();
    if (this.dwellProgress < 1) {
      return false;
    }
    this.logRefineOutcome();
    //shown for the whole outro: the success pop, the circle collapse, and the
    //scale-away all play under it
    this.setConfirmText(dwellCompleteText);
    return true;
  }

  // Says which pose placement is completing on. Call it on the frame placement
  // commits, not at onCalibrationComplete, which trails the circle animation and
  // so overstates how long the refinement actually had.
  protected logRefineOutcome() {
    if (this.refineActive) {
      //an applied pose is what was delivered, even if a later re-fire missed
      this.log(
        (this.refineAppliedCount > 0
          ? "Placing on the high-accuracy hit (" +
            this.refineAppliedCount +
            " update(s)), "
          : "Placing on the coarse pose (high-accuracy result " +
            this.refineOutcome +
            "), ") +
          (getTime() - this.refineFirstFireTime).toFixed(2) +
          "s after first firing",
      );
    }
  }

  //printed only with showDebug on
  protected log(message: string) {
    if (this.showDebug) {
      print(message);
    }
  }

  protected setConfirmText(text: string) {
    if (this.confirmText != null) {
      this.confirmText.text = text;
    }
  }

  protected animateVisuals(animateIn: boolean, callback: () => void) {
    if (this.animCancel) this.animCancel.cancel();
    var start = animateIn ? vec3.zero() : vec3.one();
    var end = animateIn ? vec3.one() : vec3.zero();
    const easingType = animateIn
      ? ("ease-out-cubic" as "ease-out-cubic")
      : ("ease-in-cubic" as "ease-in-cubic");
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
      print("Hit test error: " + e);
    }
  }

  // Per-frame hook. Nothing to do at this level, but the update event is bound to
  // it here and resolves to whichever mode is running, so the modes' overrides can
  // still chain up through it.
  protected update() {}

  protected onCalibrationComplete(callback: () => void) {
    this.isCalibrationRunning = false;
    this.log("Calibration complete");
    //the high-accuracy session is kept alive across dwell attempts, so release it here
    this.clearRefine();
    this.stopRefineSession();
    //remove events
    this.removeEvent(this.updateEvent);
    this.updateEvent = null;
    //delay stop hit test session
    var delay = this.createEvent("DelayedCallbackEvent");
    delay.bind(() => {
      if (this.hitTestSession != null) {
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

    //placement is delivered as the circle closes, while the visuals scale away
    this.circleAnim.animateCircleIn(() => {
      callback();
      //the callback may have stopped placement, destroying this detector
      if (!this.disposed) {
        this.animateVisuals(false, null);
      }
    });
  }
}

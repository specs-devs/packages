import {SECS_TO_MS} from "Leaf.lspkg/Utils/common/Constants"
import {nextFrame, sleep} from "Leaf.lspkg/Utils/common/Utils"
import {Interactable} from "SpectaclesInteractionKit.lspkg/Components/Interaction/Interactable/Interactable"
import {HandInteractor} from "SpectaclesInteractionKit.lspkg/Core/HandInteractor/HandInteractor"
import {InteractorInputType} from "SpectaclesInteractionKit.lspkg/Core/Interactor/Interactor"
import {HandType} from "SpectaclesInteractionKit.lspkg/Providers/HandInputData/HandType"
import TrackedHand from "SpectaclesInteractionKit.lspkg/Providers/HandInputData/TrackedHand"
import {SIK} from "SpectaclesInteractionKit.lspkg/SIK"
import {AiBaseInteractor} from "./BaseInteractor"
import {Hand} from "./Hand"
import {TrackedHandWrapper} from "./TrackedHandWrapper"

// Time given to the relaxed-pose pre-roll before sampling the wrist→indexTip
// offset for an approach. Must be > 0: the animate library special-cases
// `duration=0` by skipping the per-frame update tick entirely, so the
// rotation is never applied and the sampled offset reflects the previous
// pose. ~80ms lets the animation tick advance through several frames at
// 60fps and settle the relaxed pose before we measure.
const GESTURE_SETTLE_MS = 80

/**
 * Hand puppet for AI preview testing.
 *
 * Controls the visible rig (position, rotation, gesture pose) and drives
 * SIK's `PinchDetector` pipeline at every real pinch boundary. SIK then
 * handles targeting, triggers, hover, drag, and manipulation natively — the
 * pinch event stream is identical to device input, so `hand.onPinchDown`,
 * `hand.onPinchUp`, `hand.isPinching()`, and `hand.getPinchStrength()` all
 * report puppet activity through the same code paths SIK uses for real hands.
 */
export class AiHandInteractor extends AiBaseInteractor {
  private handWrapper: TrackedHandWrapper
  private trackedHand: TrackedHand

  constructor(protected handType: HandType) {
    const sikHandInteractor = SIK.InteractionManager.getInteractorsByType(
      handType === "right" ? InteractorInputType.RightHand : InteractorInputType.LeftHand
    )[0] as HandInteractor

    if (!sikHandInteractor) {
      // SIK's InteractionManager registers interactors during the
      // ScriptComponent boot cycle (HandInteractor.onAwake → register).
      // First interactions immediately after a lens reset can land before
      // that cycle completes. Throw a recognizable error here so the
      // caller can retry on the next frame instead of crashing inside
      // BaseInteractor with `Cannot set property 'isActive' of undefined`.
      throw new Error(
        `SIK ${handType} HandInteractor not yet registered with InteractionManager — retry on next frame.`
      )
    }

    super(sikHandInteractor)

    this.trackedHand = SIK.HandInputData.getHand(handType)
    if (!this.trackedHand) {
      throw new Error(`Hand of type ${handType} not found`)
    }

    this.handWrapper = new TrackedHandWrapper(this.trackedHand, handType)

    this.hand.hide()
  }

  override destroy(): void {
    this.handWrapper.destroy(this.trackedHand)
    super.destroy()
  }

  get hand(): Hand {
    return this.handWrapper.hand
  }

  // ─── Helpers ───────────────────────────────────────────────────────────

  /**
   * Sample the handRoot→indexTip offset while the rig is in pinch pose, then
   * leave the rig in relaxed pose ready for the actual relaxed → pinch
   * transition SIK uses to detect a new trigger.
   *
   * The offset is measured against `handRoot`, not the wrist: `setPosition`
   * translates handRoot, so to land the indexTip on a target the caller adds
   * `handRoot − indexTip` to it. Using the wrist instead leaves the indexTip
   * off by the handRoot→wrist vector (~3cm in y for the puppet rig) — the same
   * bug pokeInteractable and hoverInteractable already avoid.
   *
   * Why pinch pose: the offset is pose-dependent. Pinch curls the index finger
   * toward the thumb, so the fingertip ends up closer to the wrist than in
   * relaxed. If we sample in relaxed and `setPosition` accordingly, by the time
   * SIK runs proximity detection (during/after the relaxed → pinch transition)
   * the fingertip has moved to the pinch position, ~12 units away from where we
   * aimed. Sampling in pinch pose makes the curled fingertip the one that lands
   * on target.
   *
   * GESTURE_SETTLE_MS is non-zero because the animate library special-cases
   * `duration=0` by skipping the per-frame update tick — the rotation
   * never actually applies and the offset reads the previous pose.
   */
  private async measurePinchOffset(): Promise<vec3> {
    await this.hand.makeGesture("pinch", undefined, GESTURE_SETTLE_MS)
    const offset = this.hand.getHandRootWorldPosition().sub(this.hand.indexTip.position)
    await this.hand.makeGesture("relaxed", undefined, GESTURE_SETTLE_MS)
    return offset
  }

  /**
   * Walk up the parent chain collecting every Interactable above `target`.
   * Empty when the target lives at the scene root or under non-interactable
   * ancestors (e.g. a classic SIK cube). Non-empty when the target is nested
   * under a UIKit container that has its own Interactable, like a ScrollWindow
   * (`Interactable.isScrollable === true`).
   */
  private getInteractableAncestors(target: Interactable): Interactable[] {
    const ancestors: Interactable[] = []
    const interactableTypeName = Interactable.getTypeName()
    let current: SceneObject | null = target.getSceneObject().getParent()
    while (current && !isNull(current)) {
      const components = current.getComponents(interactableTypeName) as Interactable[]
      for (const c of components) {
        if (c && !isNull(c)) ancestors.push(c)
      }
      current = current.getParent()
    }
    return ancestors
  }

  /**
   * Silence every collider on the given ancestor Interactables and force-enable
   * every collider on the target Interactable. Returns a restore closure that
   * puts each collider back to its prior enabled state.
   *
   * Why: SIK's `PhysicalInteractionProvider.checkForNewInteraction` picks the
   * first entry of `currentInteractableSet`, which is the first hit from the
   * fingertip spherecast. When a UIKit leaf widget sits inside a ScrollWindow,
   * both the ScrollWindow's own front-face collider and the widget's child
   * collider are at almost the same depth and both get hit. The parent often
   * wins the order race, so SIK fires `onTriggerStart` on the ScrollWindow
   * instead of the leaf widget — and our per-target `awaitEventOnce` times
   * out forever. Removing the ancestor colliders from the physics world for
   * the duration of the pinch leaves the widget's collider as the only
   * candidate, and SIK fires the trigger on the right Interactable.
   *
   * The target's own colliders are force-enabled because ScrollWindow's
   * hover-driven `enableChildColliders(false)` can leave a leaf widget's
   * collider disabled when the fingertip enters outside the boundary or when
   * the ScrollWindow lost hover before this call.
   */
  private silenceAncestorColliders(target: Interactable, ancestors: Interactable[]): () => void {
    const restorations: Array<{collider: ColliderComponent; wasEnabled: boolean}> = []
    for (const ancestor of ancestors) {
      for (const collider of ancestor.colliders) {
        if (!collider || isNull(collider)) continue
        restorations.push({collider, wasEnabled: collider.enabled})
        collider.enabled = false
      }
    }
    for (const collider of target.colliders) {
      if (!collider || isNull(collider)) continue
      restorations.push({collider, wasEnabled: collider.enabled})
      collider.enabled = true
    }
    return () => {
      for (const r of restorations) {
        if (r.collider && !isNull(r.collider)) {
          r.collider.enabled = r.wasEnabled
        }
      }
    }
  }

  // ─── Interaction methods ───────────────────────────────────────────────

  /**
   * Pinch at a world position. SIK's DirectTargetProvider detects
   * any interactable at that position via collider overlap.
   */
  async pinch(position: vec3, hold: boolean = false, durationMs?: number): Promise<void> {
    // The wrist→indexTip offset is pose-dependent — pinch curls the finger
    // inward, so the indexTip's relative-to-wrist position is different
    // from relaxed. To land the indexTip at `position` once SIK reads it,
    // measure the offset while the rig is in pinch pose, then transition
    // back to relaxed before doing the actual relaxed → pinch transition
    // SIK uses to detect a new trigger.
    const offset = await this.measurePinchOffset()
    await this.hand.setPosition(position.add(offset))
    await nextFrame()
    await this.hand.makeGesture("pinch")
    // Drive SIK's PinchDetector pipeline. Both `hand.onPinchDown` event
    // subscribers and `hand.isPinching()` polling consumers downstream see
    // the pinch through SIK's natural plumbing (state machine → events).
    this.handWrapper.firePinchDown()
    await nextFrame()

    if (!hold && durationMs !== undefined && durationMs > 0) {
      await sleep(durationMs)
    }

    if (!hold) {
      // Fire Up BEFORE the gesture transition so `hand.isPinching()` reads
      // false the moment user code sees the pinch end. The neutral gesture
      // then animates the visible fingers apart.
      this.handWrapper.firePinchUp()
      await this.hand.makeGesture("neutral")
      await this.hand.hide()
    }
  }

  /**
   * Pinch at an interactable's position and wait for SIK to confirm
   * it targeted the interactable (onTriggerStart fires).
   */
  async pinchInteractable(interactable: Interactable, hold: boolean = false, durationMs?: number): Promise<void> {
    const targetPos = interactable.getSceneObject().getTransform().getWorldPosition()
    const name = interactable.getSceneObject().name

    // See silenceAncestorColliders() for why this is needed. Skip the work
    // when the target has no Interactable ancestors — classic SIK targets
    // don't need it, and silencing only the empty ancestor list is a no-op.
    const ancestors = this.getInteractableAncestors(interactable)
    const restoreColliders = ancestors.length > 0 ? this.silenceAncestorColliders(interactable, ancestors) : null

    try {
      // Subscribe to events BEFORE making gestures — the events may fire
      // during the gesture animation and we'd miss them if we subscribe after.
      const triggerStarted = this.awaitEventOnce(interactable.onTriggerStart, 5000, `onTriggerStart for "${name}"`)

      // See pinch() for why we sample the wrist→indexTip offset in pinch
      // pose, not relaxed. With pinch-pose offset, the curled fingertip
      // lands on the interactable at the moment SIK fires onTriggerStart.
      const offset = await this.measurePinchOffset()
      await this.hand.setPosition(targetPos.add(offset))
      await nextFrame()
      // Relaxed → pinch transition is what SIK reads as a new trigger.
      // Without this, rapid consecutive interactions can leave SIK in a state
      // where it doesn't fire onTriggerStart.
      await this.hand.makeGesture("pinch")
      // Drive SIK's PinchDetector pipeline. SIK's interactable trigger logic
      // gates onTriggerStart on `hand.isPinching()` returning true — the
      // pipeline drive makes that happen via the natural state machine.
      this.handWrapper.firePinchDown()
      await triggerStarted

      if (!hold && durationMs !== undefined && durationMs > 0) {
        await sleep(durationMs)
      }

      if (!hold) {
        // Subscribe BEFORE retraction so we don't miss onTriggerEnd firing
        // mid-animation. Retract via hide() — gesture-neutral alone changes
        // the finger pose but the indexTip can still sit inside the
        // proximity-sensor volume of buttons that listen on both ends of
        // the trigger lifecycle (e.g. PinchButton fires its action on
        // onTriggerEnd, and won't dispatch unless the hand actually leaves).
        const triggerEnded = this.awaitEventOnce(interactable.onTriggerEnd, 5000, `onTriggerEnd for "${name}"`)
        // Fire Up BEFORE retraction so SIK sees `isPinching()` false the
        // moment the trigger should end — the gesture/hide animation that
        // follows handles the visual rig retract.
        this.handWrapper.firePinchUp()
        await this.hand.makeGesture("neutral")
        await this.hand.hide()
        await triggerEnded
      }
    } finally {
      restoreColliders?.()
    }
  }

  /**
   * Poke at a world position with the index fingertip — relaxed/extended
   * pose, no pinch. SIK's PhysicalInteractionProvider distinguishes poke
   * from pinch by gesture state: with `isPinching` returning false, the
   * fingertip pushing into a collider fires the poke trigger. Targets
   * gated on `targetingMode = Poke` only fire through this path.
   */
  async pokeAt(position: vec3, durationMs: number = 200): Promise<void> {
    await this.hand.makeGesture("relaxed", undefined, GESTURE_SETTLE_MS)
    // Offset against handRoot (not the wrist) since setPosition translates
    // handRoot — see measurePinchOffset / pokeInteractable for the rationale.
    const offset = this.hand.getHandRootWorldPosition().sub(this.hand.indexTip.position)
    await this.hand.setPosition(position.add(offset))
    await sleep(durationMs)
    await this.hand.makeGesture("neutral")
    await this.hand.hide()
  }

  /**
   * Poke an interactable with the index fingertip and wait for SIK to fire
   * `onTriggerStart` in poke mode.
   *
   * Why the approach motion exists: SIK 0.18's PhysicalInteractionProvider
   * runs its fingertip spherecast from `indexUpperJoint` to slightly behind
   * `indexTip` — the cast volume never extends past the fingertip itself.
   * If the puppet teleports the indexTip onto the button's collider centre,
   * the cast starts already inside the collider, the physics engine fires
   * no entry event, and `indexFingerTouchedInteractables` stays empty even
   * though the proximity sensor reports overlaps. A real user's finger
   * sweeps through the collider's front face — that motion is what the
   * spherecast is shaped to detect. We mirror that here: stage the
   * fingertip a few cm in front of the button along the outward facing
   * normal, then animate into the target so the cast sweeps through the
   * boundary.
   *
   * Important: `Hand.setPosition` operates on `handRoot`, not the wrist
   * keypoint. Computing the offset as `wrist - indexTip` and adding it to
   * the target leaves indexTip at `target + wristLocal` (~3cm off in y for
   * the puppet rig) — outside the button collider. We compute the offset
   * against `handRoot` so the indexTip lands on target. Pinch survived
   * this bug because the relaxed→pinch curl moves the fingertip ~12cm
   * during the gesture, and the spherecast catches the entry somewhere
   * along that motion regardless of the starting offset.
   *
   * We only wait for `onTriggerStart` here. In SIK 0.18, the puppet's
   * instant hide() retract doesn't produce a corresponding end event
   * (`onTriggerEnd` / `onTriggerEndOutside` / `onTriggerCanceled` all
   * stay silent; only `onHoverExit` fires). The button's click handler
   * runs on TriggerStart — which is what users see — so the test reports
   * success the moment the trigger started. One frame after hide() lets
   * SIK settle internal hover state before the next call.
   */
  async pokeInteractable(interactable: Interactable, durationMs: number = 200): Promise<void> {
    const targetTransform = interactable.getSceneObject().getTransform()
    const targetPos = targetTransform.getWorldPosition()
    const name = interactable.getSceneObject().name

    const ancestors = this.getInteractableAncestors(interactable)
    const restoreColliders = ancestors.length > 0 ? this.silenceAncestorColliders(interactable, ancestors) : null

    try {
      // Subscribe BEFORE motion — SIK can fire start on the same tick the
      // moving fingertip crosses the collider.
      const triggerStarted = this.awaitEventOnce(
        interactable.onTriggerStart,
        5000,
        `onTriggerStart for "${name}" (poke)`
      )

      await this.hand.makeGesture("relaxed", undefined, GESTURE_SETTLE_MS)

      // Stage the fingertip in front of the button along its outward normal.
      // `transform.forward` points away from the front face (real users poke
      // in the `-forward` direction, dotted negative against forward — see
      // PhysicalInteractionProvider.isValidPokeDirection). POKE_APPROACH_CM
      // is enough to start the fingertip OUTSIDE any reasonable UIKit
      // collider, so the spherecast sees the boundary cross when we animate
      // to targetPos.
      const POKE_APPROACH_CM = 4
      const approachStart = targetPos.add(targetTransform.forward.uniformScale(POKE_APPROACH_CM))

      // setPosition translates handRoot — to land indexTip at a target the
      // caller passes `target + (handRoot - indexTip)`. The rig's
      // wrist→indexTip vector keeps drifting through several frames after
      // makeGesture awaits (the relaxed→curl-extension animation isn't
      // tick-bounded by the 80ms settle). Re-sample the offset right before
      // each setPosition so it reflects the current pose, and after each
      // setPosition apply one instant correction step to absorb any pose
      // drift that happens during the animation itself.
      const aimIndexTipAt = async (worldTarget: vec3): Promise<void> => {
        const offset = this.hand.getHandRootWorldPosition().sub(this.hand.indexTip.position)
        await this.hand.setPosition(worldTarget.add(offset))
        const tipErr = this.hand.indexTip.position.sub(worldTarget)
        if (tipErr.length > 0.1) {
          const corrected = this.hand.getHandRootWorldPosition().sub(tipErr)
          this.hand.setWorldPosition(corrected)
        }
      }

      await aimIndexTipAt(approachStart)
      await aimIndexTipAt(targetPos)
      await triggerStarted

      if (durationMs > 0) {
        await sleep(durationMs)
      }

      // Retract along the approach direction first, then hide. A real user
      // poke retract pulls the finger straight back out of the front face;
      // SIK's spherecast sees that motion and naturally transitions the
      // Poke trigger to None, which both fires the end events and clears
      // `_currentTrigger` / `_currentInteractableHitInfo`. Skipping the
      // intermediate retract (e.g. teleporting straight to the hidden
      // position) leaves SIK stuck in Poke — the spherecast jumps over
      // the boundary too fast for the end edge to register — and blocks
      // the next interaction's trigger from acquiring this Interactable.
      await this.hand.makeGesture("neutral")
      const retract = targetPos.add(targetTransform.forward.uniformScale(POKE_APPROACH_CM))
      await aimIndexTipAt(retract)
      await this.hand.hide()
    } finally {
      restoreColliders?.()
    }
  }

  /**
   * Hover at a world position with relaxed gesture.
   */
  async hoverAt(position: vec3, durationMs: number = 200): Promise<void> {
    // Snap to the relaxed pose (still at the hidden location) before
    // measuring the wrist-to-indexTip offset. Otherwise the offset reflects
    // the previous gesture and the indexTip lands offset from the hover
    // target after the subsequent relaxed pose shifts the fingers.
    await this.hand.makeGesture("relaxed", undefined, GESTURE_SETTLE_MS)
    const offset = this.hand.getHandRootWorldPosition().sub(this.hand.indexTip.position)
    await this.hand.setPosition(position.add(offset))
    await sleep(durationMs)
    await this.hand.makeGesture("neutral")
    await this.hand.hide()
  }

  /**
   * Hover at an interactable's position and wait for SIK to confirm hover.
   */
  async hoverInteractable(interactable: Interactable, durationMs: number = 200): Promise<void> {
    const targetTransform = interactable.getSceneObject().getTransform()
    const targetPos = targetTransform.getWorldPosition()
    const hoverName = interactable.getSceneObject().name

    const ancestors = this.getInteractableAncestors(interactable)
    const restoreColliders = ancestors.length > 0 ? this.silenceAncestorColliders(interactable, ancestors) : null

    try {
      await this.hand.makeGesture("relaxed", undefined, GESTURE_SETTLE_MS)

      // See pokeInteractable for the rationale: re-sample the handRoot→indexTip
      // offset right before each setPosition (the relaxed pose keeps drifting
      // for a few frames after makeGesture awaits) and apply one instant
      // correction step to absorb pose drift during the animation.
      const aimIndexTipAt = async (worldTarget: vec3): Promise<void> => {
        const offset = this.hand.getHandRootWorldPosition().sub(this.hand.indexTip.position)
        await this.hand.setPosition(worldTarget.add(offset))
        const tipErr = this.hand.indexTip.position.sub(worldTarget)
        if (tipErr.length > 0.1) {
          const corrected = this.hand.getHandRootWorldPosition().sub(tipErr)
          this.hand.setWorldPosition(corrected)
        }
      }

      // Stage the fingertip in front of the target along its outward normal,
      // then animate IN so SIK's proximity sensor sees the fingertip CROSS the
      // hover shell. Teleporting straight onto the collider centre lands the
      // fingertip already inside the shell with no sampled boundary crossing,
      // so onHoverEnter never fires for small container UI buttons (large
      // standalone 3D interactables tolerate the teleport). Confirmed via CDP:
      // the fingertip landed exactly on target with the collider enabled, yet
      // onHoverEnter timed out. Same root cause and fix as pokeInteractable.
      const HOVER_APPROACH_CM = 4
      const approachStart = targetPos.add(targetTransform.forward.uniformScale(HOVER_APPROACH_CM))

      // Subscribe BEFORE motion — SIK can fire enter on the same tick the
      // moving fingertip crosses the shell.
      const hoverEntered = this.awaitEventOnce(interactable.onHoverEnter, 5000, `onHoverEnter for "${hoverName}"`)
      await aimIndexTipAt(approachStart)
      await aimIndexTipAt(targetPos)
      await hoverEntered

      await sleep(durationMs)

      // Subscribe to exit BEFORE retraction so we don't miss it firing
      // mid-animation, then retract along the approach normal so the fingertip
      // CROSSES back out of the hover shell. hide() alone teleports the hand
      // away and can skip the exit crossing, leaving onHoverExit silent.
      const hoverExited = this.awaitEventOnce(interactable.onHoverExit, 5000, `onHoverExit for "${hoverName}"`)
      await aimIndexTipAt(approachStart)
      await this.hand.makeGesture("neutral")
      await this.hand.hide()
      await hoverExited
    } finally {
      restoreColliders?.()
    }
  }

  /**
   * Interpolate hand position to a target over durationMs.
   * Just moves the hand — SIK's InteractableManipulation follows natively
   * by reading the hand's startPoint each frame. No direct object writes.
   *
   * `releaseMidDrag` implements throw semantics: the pinch is released
   * partway along the path so the remainder of the hand motion moves past
   * the release point without driving the object, which imparts momentum.
   * Implies hold=false.
   */
  async drag(
    targetPosition: vec3,
    durationMs: number,
    hold: boolean = false,
    releaseMidDrag: boolean = false
  ): Promise<void> {
    const handStartPos = this.hand.getHandRootWorldPosition()
    // Drag is called while the hand is already pinching (held), so the
    // offset reflects the active pinch pose.
    const offset = this.hand.getHandRootWorldPosition().sub(this.hand.indexTip.position)
    const handTargetPos = targetPosition.add(offset)

    const durationSecs = durationMs / SECS_TO_MS
    const startTimeSecs = getTime()

    // Release at 80% of path progress. Earlier release = shorter throw;
    // later release = less residual velocity. 0.8 keeps the object near
    // its target while still leaving the hand motion to convey momentum.
    const RELEASE_RATIO = 0.8
    let midReleased = false

    while (getTime() < startTimeSecs + durationSecs) {
      const t = Math.min((getTime() - startTimeSecs) / durationSecs, 1.0)
      const handPos = vec3.lerp(handStartPos, handTargetPos, t)
      // Set transform directly — hand.setPosition(pos, 0) uses the animation
      // system which produces NaN with duration=0 (0/0 division).
      this.hand.setWorldPosition(handPos)

      if (releaseMidDrag && !midReleased && t >= RELEASE_RATIO) {
        // Fire pinch-up THROUGH SIK's PinchDetector so listeners see the
        // release boundary on the same frame the gesture flips. Without this,
        // a manipulation listening on `hand.onPinchUp` (or polling
        // `isPinching()`) would never see the drop. The remaining hand
        // motion through t=1.0 no longer drives the object.
        this.handWrapper.firePinchUp()
        this.hand.makeGesture("neutral")
        midReleased = true
      }

      await nextFrame()
    }
    this.hand.setWorldPosition(handTargetPos)

    if (midReleased) {
      // Gesture already neutralised; just tidy the hand away.
      await nextFrame()
      await this.hand.hide()
    } else if (!hold) {
      // Fire Up BEFORE the gesture transition so user code sees the pinch
      // end synchronously with the drag completing.
      this.handWrapper.firePinchUp()
      await this.hand.makeGesture("neutral")
      await nextFrame()
      await this.hand.hide()
    }
  }

  /**
   * Rotate the hand by euler angle deltas over durationMs.
   * SIK's InteractableManipulation applies rotation naturally.
   */
  async rotate(rotationDegrees: vec3, durationMs: number = 500): Promise<void> {
    const degToRad = Math.PI / 180
    const eulerRad = new vec3(rotationDegrees.x * degToRad, rotationDegrees.y * degToRad, rotationDegrees.z * degToRad)
    const deltaQuat = quat.fromEulerAngles(eulerRad.x, eulerRad.y, eulerRad.z)
    const currentRot = this.hand.getWorldRotation()
    const targetRot = currentRot.multiply(deltaQuat)

    const durationSecs = durationMs / SECS_TO_MS
    const startTimeSecs = getTime()

    while (getTime() < startTimeSecs + durationSecs) {
      const t = Math.min((getTime() - startTimeSecs) / durationSecs, 1.0)
      this.hand.setWorldRotation(quat.slerp(currentRot, targetRot, t))
      await nextFrame()
    }
    this.hand.setWorldRotation(targetRot)
  }

  /**
   * Release — fire pinch-up through SIK's PinchDetector pipeline, then
   * neutralise the visible rig. `hand.isPinching()` reads false immediately
   * (state machine flips on the notify), and `hand.onPinchUp` listeners fire
   * before the rig animation kicks off.
   */
  async release(interactable?: Interactable): Promise<void> {
    const triggerEnded = interactable
      ? this.awaitEventOnce(interactable.onTriggerEnd, 5000, `onTriggerEnd for "${interactable.getSceneObject().name}"`)
      : undefined
    this.handWrapper.firePinchUp()
    await this.hand.makeGesture("neutral")
    if (triggerEnded) {
      await triggerEnded
    } else {
      await nextFrame()
    }
    await this.hand.hide()
  }
}

import {UpdateDispatcher} from "Leaf.lspkg/Utils/common/UpdateDispatcher"
import {PinchEventType} from "SpectaclesInteractionKit.lspkg/Providers/HandInputData/GestureProvider/PinchEventType"
import {HandType} from "SpectaclesInteractionKit.lspkg/Providers/HandInputData/HandType"
import {Keypoint} from "SpectaclesInteractionKit.lspkg/Providers/HandInputData/Keypoint"
import TrackedHand from "SpectaclesInteractionKit.lspkg/Providers/HandInputData/TrackedHand"
import {Hand} from "./Hand"

/**
 * Toggle the puppet hand mesh visibility. Default off so the simulated hand
 * doesn't render in the preview during AI-driven interactions. Flip to `true`
 * when debugging hand placement / pose to see the rig on-screen.
 */
const DEBUG_SHOW_HAND_MODEL = false

/**
 * Runtime-only view onto a TrackedHand's private SIK pinch pipeline.
 * Used to drive `onPinchDown`/`onPinchUp` events and `getPinchStrength()`
 * through the same chokepoints the native HCI strategy hits on device.
 *
 * Marked `unknown` in the official SIK types — accessed here via runtime cast.
 */
type PinchDetectorInternals = {
  pinchStrength: number
  pinchDetectorStateMachine: {
    notifyPinchEvent(eventType: PinchEventType): void
    isPinching(): boolean
  }
}

/**
 * Bag of private fields on TrackedHand the puppet writes to. Held as a single
 * `unknown`-cast view so the type assertions live in one place.
 */
type TrackedHandPrivate = {
  pinchDetector: PinchDetectorInternals
}

/**
 * Lightweight wrapper that takes programmatic control of a SIK TrackedHand for
 * AI preview interaction testing.
 *
 * Pinch drive model:
 *   - Public events (`hand.onPinchDown` / `hand.onPinchUp` / `hand.onPinchCancel`)
 *     and gated state (`hand.isPinching()` / `hand.getPinchStrength()`) flow
 *     through SIK's own `PinchDetector` pipeline, identical to device. The
 *     puppet pushes signals into that pipeline via `firePinchDown/Up/Cancel`
 *     and `setPinchStrength`; SIK fans them out from there.
 *
 * Visual rig:
 *   - Reparents `handVisuals.root` under a freshly created `AiPuppetParent_*`
 *     SceneObject so the rig stays enabled-in-hierarchy even when the native
 *     hand-tracking subsystem disables `*HandModelOwner`.
 *   - Runs a per-frame guard that re-asserts the reparent and mesh visibility
 *     against SIK 0.17.x lifecycle re-asserts, and feeds LEAF's gesture-based
 *     pinch strength into SIK's PinchDetector so `getPinchStrength()` varies
 *     smoothly during the pinch animation.
 *
 * Works in the Lens Studio preview without a webcam since there is no
 * competing real hand-tracking data.
 */
export class TrackedHandWrapper {
  readonly hand: Hand

  private originalIsTracked: () => boolean
  private originalSetEnabled: (enabled: boolean) => void
  private originalIsVisible: boolean = true
  private hiddenMeshSceneObjects: SceneObject[] = []
  private meshObjectsToHide: SceneObject[] = []
  private handVisualsRef: ReturnType<TrackedHand["getHandVisuals"]> | null = null
  private originalRigParent: SceneObject | null = null
  private rigSceneObject: SceneObject | null = null
  private puppetParent: SceneObject | null = null
  private updateUnsubscribe: () => void = () => {}

  /** Runtime view onto TrackedHand's private fields and SIK state machines. */
  private hpriv: TrackedHandPrivate

  constructor(trackedHand: TrackedHand, handType: HandType) {
    // Save originals so we can restore on destroy
    this.originalIsTracked = trackedHand.isTracked.bind(trackedHand)
    this.originalSetEnabled = trackedHand.setEnabled.bind(trackedHand)

    const keypoints = (trackedHand as unknown as {keypoints: Map<string, Keypoint>}).keypoints
    const handVisuals = trackedHand.getHandVisuals()
    const handVisualsRoot = handVisuals.root
    this.handVisualsRef = handVisuals

    this.hand = new Hand(keypoints, handType, handVisualsRoot)

    // Hide the hand mesh by default so the puppet doesn't render mid-action.
    // SIK 0.17.x bounces `isVisible` back to true via OnEnableEvent, so we
    // also collect the mesh SceneObjects and re-disable them in the update
    // loop below as a defense-in-depth measure.
    this.originalIsVisible = handVisuals.isVisible
    handVisuals.isVisible = DEBUG_SHOW_HAND_MODEL

    if (!DEBUG_SHOW_HAND_MODEL) {
      const collectMeshObj = (m: {getSceneObject(): SceneObject} | undefined) => (m ? m.getSceneObject() : undefined)
      this.meshObjectsToHide = [
        collectMeshObj(handVisuals.handMeshFull),
        collectMeshObj(handVisuals.handMeshIndexThumb),
        collectMeshObj(handVisuals.handMeshPin)
      ].filter((o): o is SceneObject => o !== undefined)
      for (const meshObj of this.meshObjectsToHide) {
        if (meshObj.enabled) {
          meshObj.enabled = false
          this.hiddenMeshSceneObjects.push(meshObj)
        }
      }
    }

    // Always report as tracked. Two reasons:
    //   1. PhysicalInteractionProvider gates `isAvailable()` on isTracked.
    //   2. `PinchDetector.getPinchStrength()` returns 0 when isTracked is
    //      false — so the strength we feed via `setPinchStrength()` would be
    //      masked. With isTracked pinned true, the strength flows through.
    trackedHand.isTracked = () => true

    // Force the TrackedHand JS-level enabled flag to remain true, even if the
    // native hand-tracking subsystem flips it off when no real hand is
    // detected. PhysicalInteractionProvider gates `isAvailable()` on
    // `hand.enabled`, so without this the spherecast loop never runs.
    trackedHand.setEnabled = () => {}
    ;(trackedHand as unknown as {_enabled: boolean})._enabled = true

    // Acquire the bag of private fields we need to drive. Single cast point.
    this.hpriv = trackedHand as unknown as TrackedHandPrivate

    // Reparent the hand-visuals root (RightHandModel / LeftHandModel) out
    // from under the engine-managed *HandModelOwner. The native hand-tracking
    // subsystem keeps that owner SceneObject `enabled = false` in editor
    // preview because no real hand is being tracked, which propagates through
    // the rig and silences the ProximitySensor that lives on the index-3
    // attachment point (the gate PhysicalInteractionProvider uses before its
    // spherecast). By moving the rig under a fresh always-enabled puppet
    // parent, every keypoint scene object becomes enabled-in-hierarchy, the
    // proximity sensor fires native overlap events again, and SIK runs the
    // spherecast → onTriggerStart fires.
    //
    // Cached world transforms are preserved across the reparent so the rig
    // doesn't visually jump.
    this.puppetParent = global.scene.createSceneObject(`AiPuppetParent_${handType}`)
    this.puppetParent.enabled = true
    this.rigSceneObject = handVisualsRoot
    this.originalRigParent = this.rigSceneObject.getParent()
    const rigWorldPosition = this.rigSceneObject.getTransform().getWorldPosition()
    const rigWorldRotation = this.rigSceneObject.getTransform().getWorldRotation()
    const rigWorldScale = this.rigSceneObject.getTransform().getWorldScale()
    this.rigSceneObject.setParent(this.puppetParent)
    this.rigSceneObject.getTransform().setWorldPosition(rigWorldPosition)
    this.rigSceneObject.getTransform().setWorldRotation(rigWorldRotation)
    this.rigSceneObject.getTransform().setWorldScale(rigWorldScale)

    // Per-frame guard against SIK 0.17.x lifecycle re-asserting state we just
    // overrode. Three things flip back without this loop:
    //   1. HandVisual.OnStartEvent + onHandFound re-run `initHandVisuals`,
    //      which calls `handVisuals.root.setParent(ownerSceneObject)` and
    //      undoes our reparent to puppetParent.
    //   2. `OnEnableEvent` writes `_isVisible = true`, so the mesh re-renders.
    //   3. The mesh SceneObjects flip back to enabled when the HandVisual
    //      update loop re-evaluates visibility against `_isVisible = true`.
    // Re-asserting each frame wins the race; the engine's own re-asserts
    // happen at most once per frame, so we always have the last word.
    //
    // Also drives pinch strength: each frame we sample LEAF's gesture-based
    // strength and push it into SIK's PinchDetector so `getPinchStrength()`
    // varies smoothly during the pinch animation — matching device semantics
    // where strength is continuously updated from real fingertip proximity.
    const rig = this.rigSceneObject
    const puppet = this.puppetParent
    const visuals = this.handVisualsRef
    const meshes = this.meshObjectsToHide
    const handRef = this.hand
    const pdRef = this.hpriv.pinchDetector
    this.updateUnsubscribe = UpdateDispatcher.getInstance().onUpdate.add(() => {
      const parent = rig.getParent()
      if (!parent || !parent.isSame(puppet)) {
        const wp = rig.getTransform().getWorldPosition()
        const wr = rig.getTransform().getWorldRotation()
        const ws = rig.getTransform().getWorldScale()
        rig.setParent(puppet)
        rig.getTransform().setWorldPosition(wp)
        rig.getTransform().setWorldRotation(wr)
        rig.getTransform().setWorldScale(ws)
      }
      if (!DEBUG_SHOW_HAND_MODEL && visuals !== null) {
        if (visuals.isVisible) {
          visuals.isVisible = false
        }
        for (const meshObj of meshes) {
          if (meshObj.enabled) {
            meshObj.enabled = false
          }
        }
      }
      // Push LEAF's gesture-driven pinch strength into SIK's PinchDetector.
      // LEAF computes strength from thumb→index distance against a relaxed
      // baseline, which is exactly the proximity signal the native
      // HciPinchDetectionStrategy emits on device.
      pdRef.pinchStrength = handRef.getPinchStrength()
    })

    // NOTE: we intentionally do NOT fire onHandFoundEvent here. SIK's
    // HandVisual subscribes to onHandFound and re-runs `initHandVisuals`,
    // which calls `handVisuals.root.setParent(ownerSceneObject)` (undoing
    // our reparent) and re-binds every keypoint attachment via
    // `objectTracking3DComponent.removeAttachmentPoint` + `addAttachmentPoint`.
    // That re-bind leaves ObjectTracking3D in a state where SIK's
    // onTriggerStart spherecast never fires for the lifetime of the
    // wrapper — UI button pinches time out. The per-frame guard recovers
    // the reparent but cannot undo the ObjectTracking3D re-registration.
    // `isTracked() === true` (which we force) is a sufficient substitute
    // for the onHandFound edge for most user code.
  }

  // ─── Pinch ─────────────────────────────────────────────────────────────

  /**
   * Fire a pinch-down through SIK's PinchDetector state machine. Transitions
   * the public `hand.onPinchDown` event listeners and flips
   * `hand.isPinching()` true.
   *
   * Idempotent: re-firing Down while the state machine is already in the
   * Pinching state is a no-op (the state machine guards against duplicate
   * transitions). The puppet's interactor methods always fire Down/Up in
   * pairs around real pinch boundaries.
   */
  firePinchDown(): void {
    this.hpriv.pinchDetector.pinchDetectorStateMachine.notifyPinchEvent(PinchEventType.Down)
  }

  /**
   * Fire a pinch-up through SIK's PinchDetector state machine. Transitions
   * the public `hand.onPinchUp` event listeners and flips
   * `hand.isPinching()` false.
   *
   * Idempotent: re-firing Up while in Idle is a no-op.
   */
  firePinchUp(): void {
    this.hpriv.pinchDetector.pinchDetectorStateMachine.notifyPinchEvent(PinchEventType.Up)
  }

  /**
   * Fire a pinch-cancel through SIK's PinchDetector state machine. Used by
   * destroy() to clean up any in-flight pinch state, or by callers wanting
   * to abort an interaction without firing a normal Up.
   */
  firePinchCancel(): void {
    this.hpriv.pinchDetector.pinchDetectorStateMachine.notifyPinchEvent(PinchEventType.Cancel)
  }

  /**
   * Set the puppet's instantaneous pinch strength. Overrides the per-frame
   * LEAF-driven feed for the next read. Useful at pinch boundaries where the
   * interactor wants to snap strength to 1.0 (pinch confirmed) or 0.0
   * (release) without waiting for the rig animation to drive it there.
   */
  setPinchStrength(strength: number): void {
    this.hpriv.pinchDetector.pinchStrength = strength
  }

  destroy(trackedHand: TrackedHand): void {
    // Reset any in-flight pinch state in SIK's state machine so subsequent
    // tracked-hand sessions start clean.
    this.firePinchCancel()
    this.hpriv.pinchDetector.pinchStrength = 0

    this.updateUnsubscribe()
    if (this.rigSceneObject !== null && this.originalRigParent !== null) {
      this.rigSceneObject.setParent(this.originalRigParent)
    }
    if (this.puppetParent !== null) {
      this.puppetParent.destroy()
    }
    for (const meshObj of this.hiddenMeshSceneObjects) {
      meshObj.enabled = true
    }
    this.hiddenMeshSceneObjects = []
    trackedHand.getHandVisuals().isVisible = this.originalIsVisible
    trackedHand.isTracked = this.originalIsTracked
    trackedHand.setEnabled = this.originalSetEnabled
    this.hand.hide(0)
  }
}

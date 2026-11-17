import {UpdateDispatcher} from "Leaf.lspkg/Utils/common/UpdateDispatcher"
import {HandMeshType} from "InteractionKit.lspkg/Components/Interaction/HandVisual/HandVisual"
import {PinchEventType} from "InteractionKit.lspkg/Providers/HandInputData/GestureProvider/PinchEventType"
import {HandType} from "InteractionKit.lspkg/Providers/HandInputData/HandType"
import {Keypoint} from "InteractionKit.lspkg/Providers/HandInputData/Keypoint"
import TrackedHand from "InteractionKit.lspkg/Providers/HandInputData/TrackedHand"
import {Hand} from "./Hand"

const DEBUG_SHOW_HAND_MODEL = false

/** Start SIK 3's lazy hand-rig load (idempotent); its bones are the puppet's only tracking-free keypoint source. */
export function requestHandRig(trackedHand: TrackedHand): void {
  const visuals = trackedHand.getHandVisuals()
  if (visuals && visuals.meshType !== HandMeshType.Full) {
    visuals.meshType = HandMeshType.Full
  }
}

type PinchDetectorInternals = {
  pinchStrength: number
  pinchDetectorStateMachine: {
    notifyPinchEvent(eventType: PinchEventType): void
    isPinching(): boolean
  }
}

type TrackedHandPrivate = {
  pinchDetector: PinchDetectorInternals
}

/**
 * Programmatic control of an IK TrackedHand for AI preview interaction, driven without hand-tracking data.
 * Pinch events and strength flow through IK's PinchDetector; geometry comes from the lazily-loaded hand rig.
 */
export class TrackedHandWrapper {
  readonly hand: Hand

  private originalIsTracked: () => boolean
  private originalSetEnabled: (enabled: boolean) => void
  private originalIsVisible: boolean = true
  private handVisualsRef: ReturnType<TrackedHand["getHandVisuals"]> = null
  private updateUnsubscribe: () => void = () => {}
  private hpriv: TrackedHandPrivate

  constructor(trackedHand: TrackedHand, handType: HandType) {
    this.originalIsTracked = trackedHand.isTracked.bind(trackedHand)
    this.originalSetEnabled = trackedHand.setEnabled.bind(trackedHand)

    const keypoints = (trackedHand as unknown as {keypoints: Map<string, Keypoint>}).keypoints

    // Rig accessors return undefined until the async load lands; throw the retryable
    // error InteractionHandler.getInteractor already retries against.
    requestHandRig(trackedHand)
    const handVisuals = trackedHand.getHandVisuals()
    const handVisualsRoot = handVisuals?.root
    if (!handVisuals || !handVisualsRoot) {
      throw new Error(
        `IK ${handType} hand rig not loaded yet (HandVisuals.root is undefined) — retry on next frame.`
      )
    }
    this.handVisualsRef = handVisuals

    this.hand = new Hand(keypoints, handType, handVisualsRoot)

    this.originalIsVisible = handVisuals.isVisible
    handVisuals.isVisible = DEBUG_SHOW_HAND_MODEL

    // Report tracked+enabled so PhysicalInteractionProvider keeps the hand available and PinchDetector reports fed strength.
    trackedHand.isTracked = () => true
    trackedHand.setEnabled = () => {}
    ;(trackedHand as unknown as {_enabled: boolean})._enabled = true

    this.hpriv = trackedHand as unknown as TrackedHandPrivate

    // Per frame: feed pinch strength into PinchDetector and re-hide the rig mesh (HandVisual re-shows it on enable).
    const visuals = this.handVisualsRef
    const handRef = this.hand
    const pdRef = this.hpriv.pinchDetector
    this.updateUnsubscribe = UpdateDispatcher.getInstance().onUpdate.add(() => {
      pdRef.pinchStrength = handRef.getPinchStrength()
      if (!DEBUG_SHOW_HAND_MODEL && visuals.isVisible) {
        visuals.isVisible = false
      }
    })
  }

  firePinchDown(): void {
    this.hpriv.pinchDetector.pinchDetectorStateMachine.notifyPinchEvent(PinchEventType.Down)
  }

  firePinchUp(): void {
    this.hpriv.pinchDetector.pinchDetectorStateMachine.notifyPinchEvent(PinchEventType.Up)
  }

  firePinchCancel(): void {
    this.hpriv.pinchDetector.pinchDetectorStateMachine.notifyPinchEvent(PinchEventType.Cancel)
  }

  destroy(trackedHand: TrackedHand): void {
    this.firePinchCancel()
    this.hpriv.pinchDetector.pinchStrength = 0

    this.updateUnsubscribe()
    if (this.handVisualsRef) {
      this.handVisualsRef.isVisible = this.originalIsVisible
    }
    trackedHand.isTracked = this.originalIsTracked
    trackedHand.setEnabled = this.originalSetEnabled
    this.hand.hide(0)
  }
}

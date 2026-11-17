/**
 * Glasses Inc. 2026
 * CaptureFlowManager — explicit "scan an area" flow on top of AnchorController (native AnchorModule).
 *
 * 1. `prepareSession(areaId)` opens the session EARLY (on Capture screen entry) so mapping warms up
 *    while the user reads the instructions.
 * 2. `startCapture(pose)` creates a world anchor and awaits `saveAnchor`. The save resolves once the
 *    device has mapped enough of the surroundings, so the user keeps looking around meanwhile.
 * 3. On success `capturedAnchor` holds the saved anchor (persist its `id` to resolve it later) and
 *    `onCaptureComplete` fires. A fallback timer turns a hanging save into `onCaptureTimeout`.
 */
import Event, {PublicApi} from "InteractionKit.lspkg/Utils/Event"
import {Logger} from "../../Scripts/Logger"
import {Anchor, AnchorController} from "../../Scripts/AnchorController"
import {CaptureState} from "../App/AppState"

/**
 * Fallback timeout (seconds) after anchor creation. If saveAnchor hasn't completed by then the
 * capture is reported as timed out (an unsaved anchor cannot be resolved in a later session).
 */
const CAPTURE_FALLBACK_TIMEOUT_SEC = 90

export class CaptureFlowManager {
  private static instance: CaptureFlowManager

  private logger: Logger
  private anchorController: AnchorController

  private state: CaptureState = CaptureState.Idle
  private preparedAreaId: string | null = null

  // Events
  private onCaptureCompleteEvent: Event<void> = new Event<void>()
  readonly onCaptureComplete: PublicApi<void> = this.onCaptureCompleteEvent.publicApi()

  private onCaptureTimeoutEvent: Event<void> = new Event<void>()
  readonly onCaptureTimeout: PublicApi<void> = this.onCaptureTimeoutEvent.publicApi()

  private onStateChangedEvent: Event<CaptureState> = new Event<CaptureState>()
  readonly onStateChanged: PublicApi<CaptureState> = this.onStateChangedEvent.publicApi()

  private onMappingProgressEvent: Event<{quality?: number, capacityUsed?: number}> = new Event<{quality?: number, capacityUsed?: number}>()
  /** Reserved: the native API does not expose mapping quality yet; never invoked today. */
  readonly onMappingProgress: PublicApi<{quality?: number, capacityUsed?: number}> = this.onMappingProgressEvent.publicApi()

  private fallbackTimerObj: SceneObject | null = null

  /** World anchor created for this capture; deleted on cancel / failure. */
  private pendingAnchor: Anchor | null = null

  /** The saved anchor of the last successful capture. */
  private _capturedAnchor: Anchor | null = null

  private constructor() {
    this.logger = new Logger("CaptureFlowManager", true)
    this.anchorController = AnchorController.getInstance()
  }

  static getInstance(): CaptureFlowManager {
    if (CaptureFlowManager.instance) {
      return CaptureFlowManager.instance
    }
    CaptureFlowManager.instance = new CaptureFlowManager()
    return CaptureFlowManager.instance
  }

  /** Current capture state. */
  get currentState(): CaptureState {
    return this.state
  }

  /** Saved anchor of the last completed capture (null until `onCaptureComplete`). */
  get capturedAnchor(): Anchor | null {
    return this._capturedAnchor
  }

  /**
   * Opens the anchor session early so mapping can warm up.
   * Call this when the user enters the Capture screen — BEFORE they press Start Capture.
   */
  async prepareSession(areaId: string): Promise<void> {
    this.preparedAreaId = areaId
    this.logger.info(`Preparing session for area "${areaId}"`)
    const session = await this.anchorController.openSession(areaId)
    this.logger.info(session ? `Session prepared for "${areaId}"` : `No anchor service — capture will be stubbed`)
  }

  /**
   * Starts the capture: creates the anchor and saves it.
   * The session must already be open via prepareSession().
   */
  async startCapture(toWorldFromAnchor: mat4): Promise<void> {
    if (this.state === CaptureState.Scanning) {
      this.logger.warn("Capture already in progress — ignoring startCapture call")
      return
    }

    this.setState(CaptureState.Scanning)
    this.pendingAnchor = null
    this._capturedAnchor = null

    if (!this.anchorController.hasActiveSession) {
      if (!this.anchorController.isSupported) {
        // Lens Studio Preview: nothing to map, complete right away so the flow can be exercised.
        this.logger.info("No anchor service (editor) — completing capture immediately")
        this.completeCapture()
        return
      }
      this.logger.error("No active session — call prepareSession first")
      this.setState(CaptureState.Idle)
      return
    }

    this.logger.info("Starting capture (session already warmed up)")
    const anchor = await this.anchorController.createWorldAnchor(toWorldFromAnchor)
    if (!anchor) {
      this.logger.warn("Anchor creation failed — aborting capture")
      this.cleanupCapture()
      this.setState(CaptureState.Idle)
      return
    }
    if (this.currentState !== CaptureState.Scanning) {
      this.logger.info("Capture was cancelled during anchor creation")
      await this.anchorController.deleteAnchor(anchor)
      return
    }

    this.pendingAnchor = anchor
    this.logger.info(`Anchor created — id: ${anchor.id}. Saving...`)
    this.startFallbackTimer()

    const saved = await this.anchorController.saveAnchor(anchor)
    if (this.currentState !== CaptureState.Scanning) {
      this.logger.info("Save finished after the capture stopped — ignoring")
      return
    }
    if (saved) {
      this._capturedAnchor = anchor
      this.pendingAnchor = null
      this.logger.info(`Anchor SAVED — capture complete, id: ${anchor.id}`)
      this.completeCapture()
    } else {
      this.cleanupCapture()
      await this.deletePendingAnchorQuietly()
      this.setState(CaptureState.TimedOut)
      this.logger.error("saveAnchor failed — capture did not complete")
      this.onCaptureTimeoutEvent.invoke()
    }
  }

  /** Cancels an in-progress capture: delete the unsaved world anchor, then close the session. */
  stopCapture(): void {
    if (this.currentState !== CaptureState.Scanning) {
      return
    }
    this.cleanupCapture()
    const toDelete = this.pendingAnchor
    this.pendingAnchor = null
    this.setState(CaptureState.Cancelled)
    this.logger.info("Capture cancelled by user")
    void this.finishStopCapture(toDelete)
  }

  /** Closes any prepared session without capturing. */
  async cancelPreparedSession(): Promise<void> {
    this.cleanupCapture()
    this.preparedAreaId = null
    if (this.anchorController.hasActiveSession) {
      await this.anchorController.closeSession()
      this.logger.info("Prepared session closed (no capture)")
    }
  }

  /** Resets the capture state back to Idle so a new capture can begin. */
  reset(): void {
    this.cleanupCapture()
    this.pendingAnchor = null
    this.preparedAreaId = null
    this.setState(CaptureState.Idle)
  }

  private async finishStopCapture(anchor: Anchor | null): Promise<void> {
    if (anchor) {
      await this.anchorController.deleteAnchor(anchor)
    }
    await this.anchorController.closeSession()
  }

  private async deletePendingAnchorQuietly(): Promise<void> {
    const a = this.pendingAnchor
    this.pendingAnchor = null
    if (!a) return
    await this.anchorController.deleteAnchor(a)
  }

  // -------------------------------------------------------
  // Internals
  // -------------------------------------------------------

  private completeCapture(): void {
    if (this.currentState !== CaptureState.Scanning) return
    this.cleanupCapture()
    this.pendingAnchor = null
    this.setState(CaptureState.Complete)
    this.onCaptureCompleteEvent.invoke()
  }

  private startFallbackTimer(): void {
    this.cancelFallbackTimer()
    const helper = global.scene.createSceneObject("_captureFallback")
    this.fallbackTimerObj = helper
    const sc = helper.createComponent("ScriptComponent") as ScriptComponent
    const evt = sc.createEvent("DelayedCallbackEvent") as DelayedCallbackEvent
    evt.bind(() => {
      if (this.fallbackTimerObj === helper) {
        this.fallbackTimerObj = null
      }
      helper.destroy()
      if (this.currentState !== CaptureState.Scanning) return
      this.logger.warn(
        `Fallback timer fired (${CAPTURE_FALLBACK_TIMEOUT_SEC}s) — save still pending: ${this.anchorController.isSavePending}. ` +
        `Reporting capture timeout.`
      )
      this.cleanupCapture()
      void this.deletePendingAnchorQuietly()
      this.setState(CaptureState.TimedOut)
      this.onCaptureTimeoutEvent.invoke()
    })
    evt.reset(CAPTURE_FALLBACK_TIMEOUT_SEC)
  }

  private cancelFallbackTimer(): void {
    if (this.fallbackTimerObj) {
      this.fallbackTimerObj.destroy()
      this.fallbackTimerObj = null
    }
  }

  private cleanupCapture(): void {
    this.cancelFallbackTimer()
  }

  private setState(newState: CaptureState): void {
    if (this.state === newState) return
    this.state = newState
    this.onStateChangedEvent.invoke(newState)
  }
}

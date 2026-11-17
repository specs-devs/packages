/**
 * Glasses Inc. 2026
 * AnchorController — reusable wrapper around the native `AnchorModule` API (Lens Scripting 376+).
 *
 * The native API is small: an `AnchorModule` asset opens an `AnchorSession` (optionally scoped to an
 * `area`), the session creates / saves / resolves / deletes anchors, and a `Component.AnchorComponent`
 * drives a SceneObject's transform from a tracked anchor while reporting `AnchorTrackingState`.
 *
 * This controller adds what most Lenses need on top of it:
 * - one session at a time, re-opened when the area changes (`openSession` / `closeSession`)
 * - create + save in one call (`createAndSaveWorldAnchor`), with a save-pending flag
 * - restore by id (`resolveAnchor`) or by discovery (`onAnchorNearby`)
 * - tracker management (`track` / `untrack`) with SIK events for state and uncertainty changes
 * - editor stubs: in Lens Studio Preview there is no anchor service, so every call is a no-op that
 *   returns `null` / `false` and logs once; use `isSupported` to branch.
 *
 * Migration notes (from the old `Spatial Anchors.lspkg` framework):
 * - `anchor.toWorldFromAnchor` / `anchor.state` / `anchor.onFound` are gone. Tracking state and pose
 *   live on the `AnchorComponent` (`tracker.state`, `tracker.onStateChanged`, the SceneObject transform).
 * - `createWorldAnchor` is synchronous and returns immediately; `saveAnchor` is the async part.
 * - there is no `updateAnchor`: to move an anchor, create + save a new one, then delete the old one.
 * - `AnchorSession.reset()` became `clearArea()` / `clearAllAnchors()`.
 */
import Event, {PublicApi} from "SpectaclesInteractionKit.lspkg/Utils/Event"
import {Logger} from "./Logger"

export type Anchor = AnchorModule.Anchor
export type AnchorSession = AnchorModule.AnchorSession
export type AnchorTrackingState = AnchorModule.AnchorTrackingState

export interface TrackingStateChange {
  target: SceneObject
  anchor: Anchor
  state: AnchorTrackingState
}

export interface UncertaintyChange {
  target: SceneObject
  anchor: Anchor
  uncertaintyCm: number
}

interface TrackedEntry {
  anchor: Anchor
  tracker: AnchorComponent
  unsubscribe: (() => void)[]
}

export class AnchorController {
  private static instance: AnchorController

  private readonly logger = new Logger("AnchorController", true)
  private module: AnchorModule | null = null
  private moduleResolved = false
  private session: AnchorSession | null = null
  private sessionArea: string | null = null
  private opening: Promise<AnchorSession | null> | null = null
  private pendingSaves = 0
  private readonly tracked = new Map<SceneObject, TrackedEntry>()
  private nearbyRegistration: EventRegistration | null = null

  private readonly onSessionOpenedEvent = new Event<string | null>()
  /** A session is open; payload is its area (null = default area). */
  readonly onSessionOpened: PublicApi<string | null> = this.onSessionOpenedEvent.publicApi()

  private readonly onSessionClosedEvent = new Event<string | null>()
  readonly onSessionClosed: PublicApi<string | null> = this.onSessionClosedEvent.publicApi()

  private readonly onAnchorNearbyEvent = new Event<Anchor>()
  /** A previously saved anchor of the session's area was discovered. Call `track()` to follow it. */
  readonly onAnchorNearby: PublicApi<Anchor> = this.onAnchorNearbyEvent.publicApi()

  private readonly onAnchorSavedEvent = new Event<Anchor>()
  readonly onAnchorSaved: PublicApi<Anchor> = this.onAnchorSavedEvent.publicApi()

  private readonly onAnchorDeletedEvent = new Event<Anchor>()
  readonly onAnchorDeleted: PublicApi<Anchor> = this.onAnchorDeletedEvent.publicApi()

  private readonly onTrackingStateChangedEvent = new Event<TrackingStateChange>()
  /** Forwarded from every tracker created with `track()`. */
  readonly onTrackingStateChanged: PublicApi<TrackingStateChange> = this.onTrackingStateChangedEvent.publicApi()

  private readonly onUncertaintyChangedEvent = new Event<UncertaintyChange>()
  readonly onUncertaintyChanged: PublicApi<UncertaintyChange> = this.onUncertaintyChangedEvent.publicApi()

  private constructor() {}

  static getInstance(): AnchorController {
    if (!AnchorController.instance) {
      AnchorController.instance = new AnchorController()
    }
    return AnchorController.instance
  }

  /** Human readable name for an `AnchorTrackingState`. */
  static stateName(state: AnchorTrackingState | null | undefined): string {
    switch (state) {
      case AnchorModule.AnchorTrackingState.Initializing:
        return "Initializing"
      case AnchorModule.AnchorTrackingState.Ready:
        return "Ready"
      case AnchorModule.AnchorTrackingState.Tracking:
        return "Tracking"
      case AnchorModule.AnchorTrackingState.Lost:
        return "Lost"
      case AnchorModule.AnchorTrackingState.Error:
        return "Error"
      default:
        return "Unknown"
    }
  }

  // ── Module ───────────────────────────────────────────────────────────────

  /**
   * Optionally provide the `AnchorModule` asset (for example from an `@input`). When not called the
   * controller acquires it with `require("LensStudio:AnchorModule")` on first use.
   */
  setModule(module: AnchorModule | null | undefined): void {
    if (module) {
      this.module = module
      this.moduleResolved = true
    }
  }

  /** Verbose logging on/off (errors are always printed). */
  setLoggingEnabled(enabled: boolean): void {
    this.logger.setEnabled(enabled)
  }

  get isEditor(): boolean {
    return global.deviceInfoSystem.isEditor()
  }

  /** True when the native anchor module is available (never in Lens Studio Preview). */
  get isSupported(): boolean {
    return this.resolveModule() !== null
  }

  get hasActiveSession(): boolean {
    return this.session !== null
  }

  get activeSession(): AnchorSession | null {
    return this.session
  }

  get currentArea(): string | null {
    return this.sessionArea
  }

  get isSavePending(): boolean {
    return this.pendingSaves > 0
  }

  private resolveModule(): AnchorModule | null {
    if (this.moduleResolved) return this.module
    this.moduleResolved = true
    if (this.isEditor) {
      this.logger.info("Running in Lens Studio — anchor operations are stubbed (no anchor service in Preview)")
      return null
    }
    try {
      this.module = require("LensStudio:AnchorModule") as AnchorModule
    } catch (e) {
      this.logger.error(`AnchorModule is not available on this build: ${e}`)
      this.module = null
    }
    return this.module
  }

  // ── Session ──────────────────────────────────────────────────────────────

  /**
   * Open a session for `area` (null = the default area). An existing session for another area is
   * closed first; an existing session for the same area is reused. Resolves to null when anchors are
   * unsupported (editor) or the session could not be opened.
   */
  async openSession(area: string | null = null): Promise<AnchorSession | null> {
    if (this.opening) {
      await this.opening
    }
    if (this.session && this.sessionArea === area) {
      return this.session
    }
    const module = this.resolveModule()
    if (!module) {
      return null
    }
    this.opening = this.openSessionInternal(module, area)
    try {
      return await this.opening
    } finally {
      this.opening = null
    }
  }

  private async openSessionInternal(module: AnchorModule, area: string | null): Promise<AnchorSession | null> {
    if (this.session) {
      await this.closeSession()
    }
    try {
      const options = new AnchorModule.AnchorSessionOptions()
      options.area = area
      this.logger.info(`Opening session for area "${area ?? "default"}"`)
      const session = await module.openSession(options)
      this.session = session
      this.sessionArea = area
      this.nearbyRegistration = session.onAnchorNearby.add((anchor: Anchor) => {
        this.logger.info(`Anchor nearby: ${anchor.id}`)
        this.onAnchorNearbyEvent.invoke(anchor)
      })
      this.logger.info(`Session opened for area "${area ?? "default"}"`)
      this.onSessionOpenedEvent.invoke(area)
      return session
    } catch (e) {
      this.logger.error(`openSession failed: ${e}`)
      this.session = null
      this.sessionArea = null
      return null
    }
  }

  /** Close the current session. Trackers keep their last pose but stop updating. */
  async closeSession(): Promise<void> {
    const session = this.session
    const area = this.sessionArea
    if (!session) return
    this.session = null
    this.sessionArea = null
    if (this.nearbyRegistration) {
      try {
        session.onAnchorNearby.remove(this.nearbyRegistration)
      } catch (e) {
        this.logger.debug(`onAnchorNearby.remove: ${e}`)
      }
      this.nearbyRegistration = null
    }
    try {
      await session.close()
      this.logger.info(`Session closed (area "${area ?? "default"}")`)
    } catch (e) {
      this.logger.error(`closeSession failed: ${e}`)
    }
    this.onSessionClosedEvent.invoke(area)
  }

  // ── Anchors ──────────────────────────────────────────────────────────────

  /** Create a world anchor at `toWorldFromAnchor` (synchronous). Save it with `saveAnchor`. */
  createWorldAnchor(toWorldFromAnchor: mat4): Anchor | null {
    if (!this.session) {
      this.logger.warn("createWorldAnchor: no active session")
      return null
    }
    try {
      const anchor = this.session.createWorldAnchor(toWorldFromAnchor)
      this.logger.info(`Created anchor ${anchor.id}`)
      return anchor
    } catch (e) {
      this.logger.error(`createWorldAnchor failed: ${e}`)
      return null
    }
  }

  /** Convenience: gravity-aligned world anchor at a position, facing `forward` on the horizontal plane. */
  createWorldAnchorAt(position: vec3, forward: vec3 = vec3.forward()): Anchor | null {
    let flat = new vec3(forward.x, 0, forward.z)
    flat = flat.length < 1e-4 ? vec3.forward() : flat.normalize()
    const rotation = quat.lookAt(flat, vec3.up())
    return this.createWorldAnchor(mat4.compose(position, rotation, vec3.one()))
  }

  /** Save an anchor so it can be resolved / discovered in later sessions. */
  async saveAnchor(anchor: Anchor): Promise<boolean> {
    if (!this.session) {
      this.logger.warn("saveAnchor: no active session")
      return false
    }
    this.pendingSaves++
    try {
      await this.session.saveAnchor(anchor)
      this.logger.info(`Saved anchor ${anchor.id}`)
      this.onAnchorSavedEvent.invoke(anchor)
      return true
    } catch (e) {
      this.logger.error(`saveAnchor failed for ${anchor.id}: ${e}`)
      return false
    } finally {
      this.pendingSaves--
    }
  }

  /**
   * Create a world anchor and save it. The save only succeeds once the device has mapped enough of
   * the surroundings, so keep the wearer looking / moving around while it is pending.
   */
  async createAndSaveWorldAnchor(toWorldFromAnchor: mat4): Promise<Anchor | null> {
    const anchor = this.createWorldAnchor(toWorldFromAnchor)
    if (!anchor) return null
    const saved = await this.saveAnchor(anchor)
    if (!saved) {
      await this.deleteAnchor(anchor)
      return null
    }
    return anchor
  }

  /** Turn a stored `Anchor.id` back into an anchor. */
  async resolveAnchor(anchorId: string): Promise<Anchor | null> {
    if (!this.session) {
      this.logger.warn("resolveAnchor: no active session")
      return null
    }
    try {
      const anchor = await this.session.resolveAnchor(anchorId)
      this.logger.info(`Resolved anchor ${anchorId}`)
      return anchor
    } catch (e) {
      this.logger.warn(`resolveAnchor failed for "${anchorId}": ${e}`)
      return null
    }
  }

  /** Permanently delete a saved anchor; tracking stops immediately. */
  async deleteAnchor(anchor: Anchor): Promise<boolean> {
    if (!this.session) return false
    for (const [target, entry] of this.tracked) {
      if (entry.anchor === anchor) this.untrack(target)
    }
    try {
      await this.session.deleteAnchor(anchor)
      this.logger.info(`Deleted anchor ${anchor.id}`)
      this.onAnchorDeletedEvent.invoke(anchor)
      return true
    } catch (e) {
      this.logger.error(`deleteAnchor failed for ${anchor.id}: ${e}`)
      return false
    }
  }

  /** Delete every anchor this Lens saved in the session's area (the session needs an area). */
  async clearArea(): Promise<boolean> {
    if (!this.session) return false
    this.untrackAll()
    try {
      await this.session.clearArea()
      this.logger.info(`Cleared area "${this.sessionArea ?? "default"}"`)
      return true
    } catch (e) {
      this.logger.error(`clearArea failed: ${e}`)
      return false
    }
  }

  /** Delete every anchor this Lens saved, across all areas. Opens a session if needed. */
  async clearAllAnchors(): Promise<boolean> {
    const session = this.session ?? (await this.openSession(null))
    if (!session) return false
    this.untrackAll()
    try {
      await session.clearAllAnchors()
      this.logger.info("Cleared all anchors")
      return true
    } catch (e) {
      this.logger.error(`clearAllAnchors failed: ${e}`)
      return false
    }
  }

  // ── Tracking ─────────────────────────────────────────────────────────────

  /**
   * Drive `target`'s transform from `anchor` using a native `Component.AnchorComponent`. Any previous
   * tracker on the target is replaced. State / uncertainty changes are forwarded to the controller
   * events. Returns the tracker (null when anchors are unsupported).
   */
  track(target: SceneObject, anchor: Anchor): AnchorComponent | null {
    this.untrack(target)
    let tracker = target.getComponent("Component.AnchorComponent") as AnchorComponent | null
    if (!tracker) {
      tracker = target.createComponent("Component.AnchorComponent") as AnchorComponent
    }
    // Native events return an EventRegistration; keep closures that remove them.
    const unsubscribe: (() => void)[] = []
    const stateRegistration = tracker.onStateChanged.add((state: AnchorTrackingState) => {
      this.logger.debug(`${target.name}: ${AnchorController.stateName(state)} (${anchor.id})`)
      this.onTrackingStateChangedEvent.invoke({target, anchor, state})
    })
    unsubscribe.push(() => {
      if (!isNull(tracker)) tracker.onStateChanged.remove(stateRegistration)
    })
    const uncertaintyRegistration = tracker.onPositionalUncertaintyChanged.add((uncertaintyCm: number) => {
      this.onUncertaintyChangedEvent.invoke({target, anchor, uncertaintyCm})
    })
    unsubscribe.push(() => {
      if (!isNull(tracker)) tracker.onPositionalUncertaintyChanged.remove(uncertaintyRegistration)
    })
    tracker.anchor = anchor
    this.tracked.set(target, {anchor, tracker, unsubscribe})
    return tracker
  }

  /** Stop tracking on `target` (the SceneObject keeps its last pose). */
  untrack(target: SceneObject): void {
    const entry = this.tracked.get(target)
    if (!entry) return
    this.tracked.delete(target)
    for (const u of entry.unsubscribe) u()
    if (!isNull(entry.tracker)) {
      // Clearing the anchor stops tracking; null is accepted by the runtime binding.
      entry.tracker.anchor = null as unknown as Anchor
    }
  }

  untrackAll(): void {
    for (const target of Array.from(this.tracked.keys())) {
      this.untrack(target)
    }
  }

  /** The anchor currently tracked on `target`, if any. */
  getTrackedAnchor(target: SceneObject): Anchor | null {
    return this.tracked.get(target)?.anchor ?? null
  }

  /** Current tracking state of `target`, or null when it is not tracked. */
  getTrackingState(target: SceneObject): AnchorTrackingState | null {
    const entry = this.tracked.get(target)
    if (!entry || isNull(entry.tracker)) return null
    return entry.tracker.state
  }

  /** True when `target` is tracked and its anchor is currently being tracked by the device. */
  isTracking(target: SceneObject): boolean {
    return this.getTrackingState(target) === AnchorModule.AnchorTrackingState.Tracking
  }
}

/**
 * Glasses Inc. 2026
 * AppController — main entry point and lifecycle coordinator of the AnchorExamples Lens.
 *
 * Coordinates area selection, the anchor session (native AnchorModule through AnchorController),
 * widget spawning / persistence, capture and localization flows and navigation between screens.
 */
import {Logger} from "../../Scripts/Logger"
import {AppScreen, AppLifecycleState, CaptureState} from "./AppState"
import {EventBus} from "../Shared/EventBus"
import {UIController} from "../UI/UIController"
import {ScreenFactory} from "../UI/ScreenFactory"
import {StorageController} from "../Storage/StorageController"
import {Anchor, AnchorController, TrackingStateChange} from "../../Scripts/AnchorController"
import {CaptureFlowManager} from "../Anchors/CaptureFlowManager"
import {WidgetController} from "../Widgets/WidgetController"
import {WidgetType} from "../Widgets/WidgetTypes"
import {SnapToSurface} from "../Widgets/Actions/SnapToSurface"
import {AreaInfo} from "../UI/Components/AreaGridBuilder"
import WorldCameraFinderProvider from "SpectaclesInteractionKit.lspkg/Providers/CameraProvider/WorldCameraFinderProvider"
import {MAX_AREAS, CAMERA_GAZE_OFFSET, CAPTURE_ANCHOR_FORWARD_DISTANCE, LOCALIZATION_TIMEOUT_MS} from "../Shared/Constants"

@component
export class AppController extends BaseScriptComponent {

  @ui.label('<span style="color: #60A5FA;">AppController – Main entry point and lifecycle coordinator</span><br/><span style="color: #94A3B8; font-size: 11px;">Attach to a single SceneObject. Wire minimal inspector refs below.</span>')
  @ui.separator

  @ui.label('<span style="color: #60A5FA;">Scene References</span>')

  @input
  @hint("Parent SceneObject for all programmatic UI")
  rootContainer: SceneObject

  @input
  @hint("Parent SceneObject for spawned widgets. Tracked by a native AnchorComponent once an area anchor exists")
  widgetParent: SceneObject

  @input
  @allowUndefined
  @hint("World camera reference. Optional: falls back to the SIK world camera when unset (drop-in prefab).")
  camera: Camera

  @input
  @hint("WorldQueryModule for surface snapping")
  worldQueryModule: WorldQueryModule

  // ── Widget Prefabs ─────────────────────────────────
  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Widget Prefabs</span>')

  @input
  @allowUndefined
  @hint("Prefab for Note Widget (scene object with NoteWidget script)")
  noteWidgetPrefab: ObjectPrefab

  @input
  @allowUndefined
  @hint("Prefab for Watch Widget (scene object with WatchWidget script)")
  watchWidgetPrefab: ObjectPrefab

  @input
  @allowUndefined
  @hint("Prefab for Photo Widget (scene object with PhotoWidget script)")
  photoWidgetPrefab: ObjectPrefab

  // ── Logging ──────────────────────────────────────────
  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Logging</span>')

  @input
  @hint("Enable general logging")
  enableLogging: boolean = false

  @input
  @hint("Enable lifecycle logging (onAwake, onStart, onDestroy)")
  enableLoggingLifecycle: boolean = false

  // ── Private state ────────────────────────────────────
  private logger: Logger
  private lifecycleState: AppLifecycleState = AppLifecycleState.Idle
  private currentScreen: AppScreen = AppScreen.GetStarted
  private currentAreaName: string | null = null
  private currentAreaId: string | null = null
  private snapToSurfaceActive: boolean = false
  private widgetsRestored: boolean = false
  private isExiting: boolean = false
  private isNewArea: boolean = false
  private captureTimerHelper: SceneObject | null = null
  private captureStartTime: number = 0

  /** Anchor the widget parent is tracked against in the current area (null until created / resolved). */
  private areaAnchor: Anchor | null = null
  /** True once widgets may be spawned in the current area. */
  private areaReady: boolean = false

  private anchorUnsubscribes: (() => void)[] = []
  private anchorFallbackTimer: SceneObject | null = null

  // Controllers
  private eventBus: EventBus
  private uiController: UIController
  private screenFactory: ScreenFactory
  private storageController: StorageController
  private anchorController: AnchorController
  private captureFlowManager: CaptureFlowManager
  private widgetController: WidgetController
  private snapToSurface: SnapToSurface

  onAwake(): void {
    this.logger = new Logger("AppController", this.enableLogging || this.enableLoggingLifecycle)
    if (this.enableLoggingLifecycle) this.logger.debug("LIFECYCLE: onAwake()")

    this.lifecycleState = AppLifecycleState.Initializing
    this.initializeControllers()
    this.subscribeToEvents()
    this.subscribeToCaptureEvents()
    this.lifecycleState = AppLifecycleState.Ready

    this.logger.info("AppController initialized — GetStarted screen will show after deferred UI init")
  }

  onDestroy(): void {
    if (this.enableLoggingLifecycle) this.logger.debug("LIFECYCLE: onDestroy()")
    this.cleanup()
  }

  // ── Public API ───────────────────────────────────────

  getLifecycleState(): AppLifecycleState {
    return this.lifecycleState
  }

  getCurrentScreen(): AppScreen {
    return this.currentScreen
  }

  getCurrentAreaName(): string | null {
    return this.currentAreaName
  }

  // ── Initialization ───────────────────────────────────

  private initializeControllers(): void {
    this.eventBus = EventBus.getInstance(this.logger)
    this.storageController = StorageController.getInstance()
    this.anchorController = AnchorController.getInstance()
    this.anchorController.setLoggingEnabled(this.enableLogging)
    this.captureFlowManager = CaptureFlowManager.getInstance()
    const prefabMap: Record<string, ObjectPrefab> = {}
    if (this.noteWidgetPrefab) prefabMap[WidgetType.Note] = this.noteWidgetPrefab
    if (this.watchWidgetPrefab) prefabMap[WidgetType.Watch] = this.watchWidgetPrefab
    if (this.photoWidgetPrefab) prefabMap[WidgetType.Photo] = this.photoWidgetPrefab
    this.widgetController = new WidgetController(this.widgetParent, this.logger, prefabMap)
    this.snapToSurface = new SnapToSurface(this.worldQueryModule, this.logger)

    // Single UIController: reuse the scene's "UIController" object if present, or a
    // component on this object — do NOT always createComponent (that left the wired
    // UIController uninitialized and built a second orphaned panel stack).
    this.uiController = this.resolveUIController()

    // When snap is active and a new widget is spawned, add it to snap tracking
    this.widgetController.onWidgetAdded.add((widget) => {
      if (!this.snapToSurfaceActive) return

      const frameObj = this.widgetController.getTransformTargetForWidget(widget)
      if (frameObj) {
        this.snapToSurface.repinObject(frameObj)
      }

      const frame = this.widgetController.getFrameForWidget(widget)
      if (frame && frameObj) {
        frame.onTranslationStart.add(() => {
          this.snapToSurface.unpinObject(frameObj)
        })
        frame.onTranslationEnd.add(() => {
          if (this.snapToSurfaceActive) {
            this.snapToSurface.repinObject(frameObj)
          }
        })
      }
    })

    // Defer UI build to allow UIController's onAwake to run
    const initEvent = this.createEvent("OnStartEvent") as OnStartEvent
    initEvent.bind(() => {
      this.uiController.initialize(this.rootContainer)
      this.screenFactory = new ScreenFactory(this.uiController, this.eventBus, this.logger)
      this.screenFactory.buildAllScreens()
      this.navigateTo(AppScreen.GetStarted)
      this.refreshMyAreasGrid()
    })

    if (this.enableLogging) this.logger.debug("Controllers initialized")
  }

  private subscribeToEvents(): void {
    // SideNavigation emits "navigate" with an AppScreen value
    this.eventBus.on<AppScreen>("navigate", (screen) => {
      // "New Area" button emits navigate → Capture. Intercept and go directly to InArea.
      if (screen === AppScreen.Capture) {
        this.prepareNewArea()
        this.isNewArea = true
        this.navigateTo(AppScreen.InArea, this.currentAreaName)
        return
      }
      this.navigateTo(screen)
    })

    // CaptureScreen "Start Capturing" button
    this.eventBus.on("startCapture", () => {
      this.startCapture()
    })

    // CaptureScreen / InCaptureScreen "Exit Capture" button
    this.eventBus.on("exitCapture", () => {
      this.stopCapture()
    })

    // AreaGridBuilder emits "areaSelected" with AreaInfo
    this.eventBus.on<AreaInfo>("areaSelected", (info) => {
      this.handleAreaSelected(info)
    })

    // InAreaScreen widget spawn buttons
    this.eventBus.on<{type: string}>("spawnWidget", (data) => {
      this.spawnWidget(data.type as WidgetType)
    })

    // InAreaScreen "Recall Widgets" button
    this.eventBus.on("recallWidgets", () => {
      this.recallWidgets()
    })

    // InAreaScreen "Snap to Surface" toggle
    this.eventBus.on("toggleSnapToSurface", () => {
      this.toggleSnapToSurface()
    })

    // InAreaScreen "Exit Area" button
    this.eventBus.on("exitArea", () => {
      void this.exitAreaAsync()
    })

    // MyAreasScreen "Delete All Areas" button
    this.eventBus.on("deleteAllAreas", () => {
      this.deleteAllAreas()
    })

    if (this.enableLogging) this.logger.debug("Event subscriptions registered")
  }

  private subscribeToCaptureEvents(): void {
    // Capture completes only after the anchor save succeeds. The scanning phase is the
    // capture itself — the user scans while on InCapture. Once saved, enter the area.
    this.captureFlowManager.onCaptureComplete.add(() => {
      void this.onCaptureCompleteAsync()
    })

    this.captureFlowManager.onCaptureTimeout.add(() => {
      void this.onCaptureTimeoutAsync()
    })

    this.captureFlowManager.onStateChanged.add((state: CaptureState) => {
      if (state === CaptureState.Scanning) {
        this.startCaptureTimer()
      }
    })

    // Show mapping quality during capture on the InCapture screen (reserved: the native API does
    // not expose mapping quality yet, so this only fires if a future controller emits it).
    this.captureFlowManager.onMappingProgress.add((status) => {
      if (this.currentScreen !== AppScreen.InCapture) return
      const qualityPct = status.quality != null ? Math.round(status.quality * 100) : null
      const sec = Math.floor((Date.now() - this.captureStartTime) / 1000)
      if (qualityPct != null && qualityPct > 0) {
        this.screenFactory?.setCaptureStatus(
          `Mapping… quality ~${qualityPct}% (${sec}s)\nKeep moving slowly; save completes after a checkpoint.`
        )
      }
    })
  }

  private async onCaptureCompleteAsync(): Promise<void> {
    this.stopCaptureTimer()
    const anchor = this.captureFlowManager.capturedAnchor
    this.logger.info(`Capture complete${anchor ? ` — anchor ${anchor.id} saved` : " (no anchor service)"}`)

    if (this.currentAreaName && this.currentAreaId) {
      this.storageController.saveArea(this.currentAreaName, this.currentAreaId)
      if (anchor) this.storageController.saveAnchorId(this.currentAreaName, anchor.id)
    }

    this.captureFlowManager.reset()
    // Enter as an existing area: the saved id is resolved and the widget parent tracked.
    this.isNewArea = false
    this.navigateTo(AppScreen.InArea, this.currentAreaName)
  }

  private async onCaptureTimeoutAsync(): Promise<void> {
    this.stopCaptureTimer()
    this.logger.warn("Capture failed — save did not complete")

    await this.anchorController.closeSession()
    this.currentAreaName = null
    this.currentAreaId = null

    this.screenFactory?.setCaptureStatus("Scan failed. Please try again.")
    this.captureFlowManager.reset()
    this.navigateTo(AppScreen.GetStarted)
  }

  /**
   * Prefer the scene root object named "UIController" (how this template is wired),
   * then a UIController on this object; only then create one dynamically.
   */
  private resolveUIController(): UIController {
    const onSelf = this.getSceneObject().getComponent(UIController.getTypeName()) as UIController | null
    if (onSelf) {
      return onSelf
    }
    // Search the whole scene (any depth) so the UIController is found whether it is a scene root
    // or nested inside the PLACE_IN_SCENE prefab.
    const rootCount = global.scene.getRootObjectsCount()
    for (let i = 0; i < rootCount; i++) {
      const found = this.findUIController(global.scene.getRootObject(i))
      if (found) {
        return found
      }
    }
    return this.getSceneObject().createComponent(UIController.getTypeName()) as UIController
  }

  /** Depth-first search for the first UIController component under `obj` (inclusive). */
  private findUIController(obj: SceneObject): UIController | null {
    const comp = obj.getComponent(UIController.getTypeName()) as UIController | null
    if (comp) {
      return comp
    }
    const childCount = obj.getChildrenCount()
    for (let i = 0; i < childCount; i++) {
      const found = this.findUIController(obj.getChild(i))
      if (found) {
        return found
      }
    }
    return null
  }

  /** Camera transform: the wired `camera` input if present, else the SIK world camera (prefab drop-in). */
  private getCameraTransform(): Transform {
    if (this.camera) {
      return this.camera.getSceneObject().getTransform()
    }
    return WorldCameraFinderProvider.getInstance().getTransform()
  }

  // ── Anchor Localization Status ────────────────────────

  private subscribeToAnchorEvents(): void {
    this.unsubscribeFromAnchorEvents()

    // Tracking state of the widget parent's native AnchorComponent
    this.anchorUnsubscribes.push(
      this.anchorController.onTrackingStateChanged.add((change: TrackingStateChange) => {
        if (change.target !== this.widgetParent) return
        this.onAreaTrackingStateChanged(change.state)
      })
    )

    // Discovery fallback: a saved anchor of this area was found nearby before we resolved one by id
    this.anchorUnsubscribes.push(
      this.anchorController.onAnchorNearby.add((anchor: Anchor) => {
        if (this.areaAnchor || this.currentScreen !== AppScreen.InArea || !this.currentAreaName) return
        this.logger.info(`Adopting nearby anchor ${anchor.id} for "${this.currentAreaName}"`)
        this.storageController.saveAnchorId(this.currentAreaName, anchor.id)
        this.adoptAreaAnchor(anchor, true)
      })
    )
  }

  private onAreaTrackingStateChanged(state: AnchorModule.AnchorTrackingState): void {
    this.logger.info(`Area anchor: ${AnchorController.stateName(state)}`)
    switch (state) {
      case AnchorModule.AnchorTrackingState.Tracking:
        this.cancelAnchorFallbackTimer()
        this.screenFactory?.setLocalizationStatus("Area found!")
        this.restoreWidgetsOnce()
        break
      case AnchorModule.AnchorTrackingState.Lost:
        this.screenFactory?.setLocalizationStatus("Area lost — look around to find it again...")
        break
      case AnchorModule.AnchorTrackingState.Error:
        this.screenFactory?.setLocalizationStatus("Anchor error — exit and re-enter the area to retry.")
        break
      default:
        break
    }
  }

  /**
   * Make `anchor` the area anchor: the widget parent is driven by a native AnchorComponent from now
   * on and widgets may be spawned (positions are stored relative to the widget parent).
   * @param expectRestore - true when re-entering a saved area; starts the localization timeout.
   */
  private adoptAreaAnchor(anchor: Anchor, expectRestore: boolean): void {
    this.areaAnchor = anchor
    this.areaReady = true
    this.anchorController.track(this.widgetParent, anchor)
    if (expectRestore) {
      this.startAnchorFallbackTimer()
    }
  }

  /**
   * Restore the saved widgets once, one frame after the anchor started tracking so the widget parent
   * already sits at the anchor pose (Frame / InteractableManipulation capture world positions when
   * they initialize).
   */
  private restoreWidgetsOnce(): void {
    if (this.widgetsRestored || !this.currentAreaName) return
    this.widgetsRestored = true
    const areaName = this.currentAreaName
    const delayed = this.createEvent("DelayedCallbackEvent") as DelayedCallbackEvent
    delayed.bind(() => {
      this.removeEvent(delayed)
      if (this.currentAreaName !== areaName) return
      this.widgetController.restoreWidgets(areaName, this.storageController)
      this.logger.info("Widgets restored")
    })
    delayed.reset(0)
  }

  /** Seat the widget parent at a gravity-aligned pose (used before / without anchor tracking). */
  private placeWidgetParent(position: vec3, forward: vec3): void {
    let flat = new vec3(forward.x, 0, forward.z)
    flat = flat.length < 1e-4 ? vec3.forward() : flat.normalize()
    const t = this.widgetParent.getTransform()
    t.setWorldPosition(position)
    t.setWorldRotation(quat.lookAt(flat, vec3.up()))
  }

  private unsubscribeFromAnchorEvents(): void {
    this.cancelAnchorFallbackTimer()
    for (const unsub of this.anchorUnsubscribes) {
      unsub()
    }
    this.anchorUnsubscribes = []
  }

  /**
   * Localization timeout: if the anchor isn't tracking within LOCALIZATION_TIMEOUT_MS, inform the user.
   */
  private startAnchorFallbackTimer(): void {
    this.cancelAnchorFallbackTimer()
    const helper = global.scene.createSceneObject("_anchorFallback")
    this.anchorFallbackTimer = helper
    const sc = helper.createComponent("ScriptComponent") as ScriptComponent
    const evt = sc.createEvent("DelayedCallbackEvent") as DelayedCallbackEvent
    evt.bind(() => {
      if (this.anchorFallbackTimer === helper) {
        this.anchorFallbackTimer = null
      }
      helper.destroy()

      if (this.widgetsRestored) return
      if (this.currentScreen !== AppScreen.InArea) return
      if (!this.currentAreaName) return

      this.logger.warn(`Anchor not tracking after ${LOCALIZATION_TIMEOUT_MS / 1000}s — localization pending`)
      this.screenFactory?.setLocalizationStatus(
        "Could not find the saved area yet.\nKeep scanning slowly, or go back and try again."
      )
    })
    evt.reset(LOCALIZATION_TIMEOUT_MS / 1000)
  }

  private cancelAnchorFallbackTimer(): void {
    if (this.anchorFallbackTimer) {
      this.anchorFallbackTimer.destroy()
      this.anchorFallbackTimer = null
    }
  }

  // ── Navigation ───────────────────────────────────────

  private navigateTo(screen: AppScreen, areaName?: string): void {
    const prev = this.currentScreen
    this.currentScreen = screen

    if (areaName !== undefined) {
      this.currentAreaName = areaName
    }

    if (this.enableLogging) {
      this.logger.debug(`Navigate: ${prev} → ${screen}` +
        (areaName ? ` (area: ${areaName})` : ""))
    }

    this.uiController?.showScreen(screen)
    this.handleScreenEntry(screen)
  }

  // ── Screen Entry Handlers ────────────────────────────

  private handleScreenEntry(screen: AppScreen): void {
    switch (screen) {
      case AppScreen.GetStarted:
        this.lifecycleState = AppLifecycleState.Ready
        break

      case AppScreen.Capture:
        this.lifecycleState = AppLifecycleState.Ready
        // Generate area ID and pre-open session so mapping warms up
        // while user reads capture instructions (~5-10s).
        if (!this.currentAreaId) {
          this.prepareNewArea()
        }
        if (this.currentAreaId) {
          void this.captureFlowManager.prepareSession(this.currentAreaId)
        }
        break

      case AppScreen.InCapture:
        this.lifecycleState = AppLifecycleState.CapturingArea
        break

      case AppScreen.MyAreas:
        this.lifecycleState = AppLifecycleState.Ready
        this.refreshMyAreasGrid()
        break

      case AppScreen.InArea:
        this.lifecycleState = AppLifecycleState.InArea
        this.widgetsRestored = false
        this.logger.info(`InArea entry: area="${this.currentAreaName}", id="${this.currentAreaId}", isNew=${this.isNewArea}`)
        if (this.currentAreaName && this.currentAreaId) {
          if (this.isNewArea) {
            this.isNewArea = false
            void this.enterNewArea()
          } else {
            void this.enterExistingArea()
          }
        } else {
          this.logger.warn("InArea entry: missing areaName or areaId — cannot proceed")
        }
        break
    }
  }

  // ── Action Handlers ──────────────────────────────────

  /** Generate area name/ID early so session can open on Capture screen entry. */
  private prepareNewArea(): void {
    const areaCount = this.storageController.getAreaCount()
    if (areaCount >= MAX_AREAS) {
      this.logger.warn("Maximum number of areas reached")
      return
    }
    this.currentAreaName = `Area ${areaCount + 1}`
    this.currentAreaId = "area_" + Date.now().toString(36) + "_" + Math.random().toString(36).substring(2, 10)
    this.logger.info(`Prepared new area: "${this.currentAreaName}" → "${this.currentAreaId}"`)
  }

  private startCapture(): void {
    if (this.enableLogging) this.logger.debug("startCapture()")

    if (!this.currentAreaName || !this.currentAreaId) {
      this.logger.error("startCapture: no area prepared — cannot start")
      return
    }

    this.navigateTo(AppScreen.InCapture)

    // Anchor pose: a few units along camera -Z (in front of user)
    const toWorldFromAnchor = this.getCameraTransform()
      .getWorldTransform()
      .mult(mat4.fromTranslation(new vec3(0, 0, -CAPTURE_ANCHOR_FORWARD_DISTANCE)))
    void this.captureFlowManager.startCapture(toWorldFromAnchor)
  }

  private stopCapture(): void {
    if (this.enableLogging) this.logger.debug("stopCapture()")
    this.stopCaptureTimer()

    if (this.captureFlowManager.currentState === CaptureState.Scanning) {
      this.captureFlowManager.stopCapture()
    } else {
      // Session was prepared but capture never started — close it
      void this.captureFlowManager.cancelPreparedSession()
    }

    this.logger.info("stopCapture: capture cancelled — area was not persisted")
    this.currentAreaName = null
    this.currentAreaId = null

    this.navigateTo(AppScreen.GetStarted)
  }

  private handleAreaSelected(info: AreaInfo): void {
    if (this.enableLogging) this.logger.debug(`areaSelected: ${info.name} (index=${info.index})`)

    if (!info.occupied) {
      // New Area — go directly to InArea. Anchor is created silently in background.
      this.prepareNewArea()
      this.isNewArea = true
      this.navigateTo(AppScreen.InArea, this.currentAreaName)
      return
    }

    // Existing area — enter it and resolve / rediscover the saved anchor
    const areas = this.storageController.getAreas()
    const areaId = areas[info.name]

    if (areaId) {
      this.currentAreaId = areaId
      this.isNewArea = false
      this.navigateTo(AppScreen.InArea, info.name)
    } else {
      this.logger.warn(`Area "${info.name}" occupied but no areaId found in storage`)
    }
  }

  // ── Area Entry ──────────────────────────────────────

  /**
   * New area (native AnchorModule flow):
   *   openSession(areaId) → createWorldAnchor in front of the wearer → track widgetParent
   *   → saveAnchor (resolves once the device mapped enough) → persist the anchor id.
   * Widgets can be spawned as soon as the anchor exists; their positions are relative to the
   * widget parent, which the AnchorComponent keeps on the anchor.
   */
  private async enterNewArea(): Promise<void> {
    const areaName = this.currentAreaName
    const areaId = this.currentAreaId
    if (!areaName || !areaId) return
    this.logger.info(`Entering NEW area: "${areaName}" (${areaId})`)
    this.areaAnchor = null
    this.areaReady = false
    this.storageController.clearWidgets(areaName)
    this.subscribeToAnchorEvents()

    const cameraTransform = this.getCameraTransform()
    const forward = cameraTransform.back
    const position = cameraTransform.getWorldPosition().add(forward.uniformScale(CAMERA_GAZE_OFFSET))
    // Seat the widget parent right away so widgets spawned before tracking are placed relative to it.
    this.placeWidgetParent(position, forward)

    const session = await this.anchorController.openSession(areaId)
    if (this.currentAreaId !== areaId) return // user left the area meanwhile

    if (!session) {
      // Lens Studio Preview (or a device without the anchor service): the area works, the pose is
      // remembered locally so re-entering puts the widgets back, but nothing is world-anchored.
      this.areaReady = true
      this.storageController.saveArea(areaName, areaId)
      this.storageController.saveAnchorPose(areaName, position, this.widgetParent.getTransform().getWorldRotation())
      this.screenFactory?.setLocalizationStatus(
        this.anchorController.isEditor
          ? "Area ready (Lens Studio: anchors are simulated)"
          : "Anchors are unavailable on this device — widgets will not persist across sessions."
      )
      return
    }

    this.screenFactory?.setLocalizationStatus(
      "Look and move around slowly to map the area.\nThe area is saved once mapping has enough data."
    )
    const anchor = await this.anchorController.createWorldAnchorAt(position, forward)
    if (!anchor) {
      this.screenFactory?.setLocalizationStatus("Could not create an anchor here. Exit and try again.")
      return
    }
    this.adoptAreaAnchor(anchor, false)
    this.storageController.saveArea(areaName, areaId)

    const saved = await this.anchorController.saveAnchor(anchor)
    if (this.currentAreaId !== areaId) return
    if (saved) {
      this.storageController.saveAnchorId(areaName, anchor.id)
      this.screenFactory?.setLocalizationStatus("Area saved! Widgets come back here next time.")
    } else {
      this.screenFactory?.setLocalizationStatus(
        "Saving the area failed — keep moving around, then exit and re-enter to retry."
      )
    }
  }

  /**
   * Existing area (native AnchorModule flow):
   *   openSession(areaId) → resolveAnchor(saved id) → track widgetParent → Tracking → restore widgets.
   * If no id was saved (or it cannot be resolved) the session's onAnchorNearby discovery adopts the
   * first saved anchor of the area instead.
   */
  private async enterExistingArea(): Promise<void> {
    const areaName = this.currentAreaName
    const areaId = this.currentAreaId
    if (!areaName || !areaId) return
    this.logger.info(`Entering EXISTING area: "${areaName}" (${areaId})`)
    this.areaAnchor = null
    this.areaReady = false
    this.subscribeToAnchorEvents()
    this.screenFactory?.setLocalizationStatus("Look and move around to help recognize the area.")

    const session = await this.anchorController.openSession(areaId)
    if (this.currentAreaId !== areaId) return

    if (!session) {
      // Lens Studio Preview: restore the remembered pose instead of tracking an anchor.
      const pose = this.storageController.loadAnchorPose(areaName)
      if (pose) {
        this.widgetParent.getTransform().setWorldPosition(pose.position)
        this.widgetParent.getTransform().setWorldRotation(pose.rotation)
      } else {
        const cameraTransform = this.getCameraTransform()
        this.placeWidgetParent(
          cameraTransform.getWorldPosition().add(cameraTransform.back.uniformScale(CAMERA_GAZE_OFFSET)),
          cameraTransform.back
        )
      }
      this.areaReady = true
      this.screenFactory?.setLocalizationStatus(
        this.anchorController.isEditor ? "Area ready (Lens Studio: anchors are simulated)" : "Anchors unavailable — showing last known layout."
      )
      this.restoreWidgetsOnce()
      return
    }

    const anchorId = this.storageController.loadAnchorId(areaName)
    if (anchorId) {
      const anchor = await this.anchorController.resolveAnchor(anchorId)
      if (this.currentAreaId !== areaId) return
      if (anchor) {
        this.adoptAreaAnchor(anchor, true)
        return
      }
      this.logger.warn(`Saved anchor ${anchorId} could not be resolved — waiting for discovery`)
    }

    this.screenFactory?.setLocalizationStatus("Looking for the saved area anchor — look around slowly.")
    this.startAnchorFallbackTimer()
  }

  private async exitAreaAsync(): Promise<void> {
    if (this.isExiting) {
      this.logger.info("exitArea: already exiting — ignoring")
      return
    }

    if (this.anchorController.isSavePending) {
      this.logger.warn("exitArea: anchor save still in progress — cannot exit yet")
      this.screenFactory?.setLocalizationStatus(
        "Area is still being saved — keep walking around.\nYou can exit once the save completes."
      )
      return
    }

    this.isExiting = true
    this.logger.info("exitArea() — begin")
    this.unsubscribeFromAnchorEvents()

    if (this.currentAreaName) {
      this.widgetController.saveAllWidgets(this.storageController, this.currentAreaName)
      const verified = this.storageController.loadWidgets(this.currentAreaName)
      this.logger.info(`exitArea: saved & verified ${verified.length} widgets for "${this.currentAreaName}"`)
      if (!this.areaAnchor) {
        // No anchor (editor / unsupported): remember the layout pose for re-entry.
        const t = this.widgetParent.getTransform()
        this.storageController.saveAnchorPose(this.currentAreaName, t.getWorldPosition(), t.getWorldRotation())
      }
    } else {
      this.logger.warn("exitArea: no currentAreaName — widgets NOT saved")
    }

    await this.finishExitArea()
  }

  private async finishExitArea(): Promise<void> {
    // Stop driving the widget parent; the session stays open (re-opening is slow and the next
    // area switch re-opens it with its own area id anyway).
    this.anchorController.untrack(this.widgetParent)
    this.areaAnchor = null
    this.areaReady = false

    this.logger.info("exitArea: clearAllWidgets start")
    this.widgetController.clearAllWidgets()
    this.logger.info("exitArea: clearAllWidgets done")

    this.snapToSurface.stopSession()
    this.snapToSurfaceActive = false

    this.widgetsRestored = false
    this.isExiting = false
    this.currentAreaName = null
    this.currentAreaId = null
    this.logger.info("exitArea: navigating to MyAreas")
    this.navigateTo(AppScreen.MyAreas)
  }

  private spawnWidget(type: WidgetType): void {
    if (this.enableLogging) this.logger.debug(`spawnWidget: ${type}`)

    if (!this.currentAreaName) {
      this.logger.error("Cannot spawn widget — no active area")
      return
    }

    if (!this.areaReady) {
      this.logger.warn("Cannot spawn widget — area anchor not ready yet")
      this.screenFactory?.setLocalizationStatus(
        "Area not ready yet — keep looking and moving around.\nWidgets are available once the anchor exists."
      )
      return
    }

    this.widgetController.spawnWidget(type, this.storageController, this.currentAreaName)
  }

  private recallWidgets(): void {
    if (this.enableLogging) this.logger.debug("recallWidgets()")
    const cameraTransform = this.getCameraTransform()
    this.widgetController.recallAllWidgets(cameraTransform)
    this.screenFactory?.setRecallActive(this.widgetController.isRecallActive())
  }

  private toggleSnapToSurface(): void {
    this.snapToSurfaceActive = !this.snapToSurfaceActive
    if (this.snapToSurfaceActive) {
      // Start snap session with NO existing widgets — only newly spawned
      // widgets will be added via the onWidgetAdded subscription
      this.snapToSurface.startContinuousSnap([])
      this.logger.info("Snap to Surface: ON — only new widgets will be snapped")
    } else {
      this.snapToSurface.stopContinuousSnap()
      this.logger.info("Snap to Surface: OFF")
    }
    this.screenFactory?.setSnapActive(this.snapToSurfaceActive)
  }

  private deleteAllAreas(): void {
    this.logger.info("deleteAllAreas — clearing storage and every saved anchor")
    this.unsubscribeFromAnchorEvents()
    this.anchorController.untrack(this.widgetParent)
    this.areaAnchor = null
    this.areaReady = false
    void this.anchorController.clearAllAnchors().then(() => this.anchorController.closeSession())
    this.storageController.clearAllAreas()
    this.widgetController.clearAllWidgets()
    this.currentAreaName = null
    this.currentAreaId = null
    this.refreshMyAreasGrid()
    this.navigateTo(AppScreen.GetStarted)
  }

  // ── Capture Timer ──────────────────────────────────

  private startCaptureTimer(): void {
    this.stopCaptureTimer()
    this.captureStartTime = Date.now()

    this.captureTimerHelper = global.scene.createSceneObject("_captureTimer")
    const sc = this.captureTimerHelper.createComponent("ScriptComponent") as ScriptComponent
    const evt = sc.createEvent("UpdateEvent") as SceneEvent

    let lastSec = -1
    evt.bind(() => {
      const sec = Math.floor((Date.now() - this.captureStartTime) / 1000)
      if (sec === lastSec) return
      lastSec = sec
      if (sec === 45 || sec === 90 || sec === 120) {
        this.screenFactory?.setCaptureStatus(
          `Still saving map… (${sec}s)\n` +
            `This is normal. Walk 2–3 m, turn, look at floor and walls — mapping needs motion, not standing still.`
        )
      } else if (sec > 0 && sec % 10 === 0) {
        this.screenFactory?.setCaptureStatus(
          `Mapping for save… (${sec}s)\n` +
            `Move slowly; the anchor is stored once the device has mapped enough of the area.`
        )
      }
    })
  }

  private stopCaptureTimer(): void {
    if (this.captureTimerHelper) {
      this.captureTimerHelper.destroy()
      this.captureTimerHelper = null
    }
  }

  // ── Helpers ──────────────────────────────────────────

  private refreshMyAreasGrid(): void {
    const areas = this.storageController.getAreas()
    const areaNames = Object.keys(areas)
    const areaInfos: AreaInfo[] = []

    for (let i = 0; i < areaNames.length; i++) {
      areaInfos.push({index: i, name: areaNames[i], occupied: true})
    }

    this.screenFactory?.refreshMyAreas(areaInfos)
  }

  // ── Cleanup ──────────────────────────────────────────

  private cleanup(): void {
    this.stopCaptureTimer()
    this.unsubscribeFromAnchorEvents()
    this.eventBus.removeAllListeners()
    this.anchorController?.untrackAll()
    void this.anchorController?.closeSession()
    this.widgetController?.clearAllWidgets()
    this.snapToSurface?.stopSession()
    if (this.enableLogging) this.logger.debug("Cleanup complete")
  }
}

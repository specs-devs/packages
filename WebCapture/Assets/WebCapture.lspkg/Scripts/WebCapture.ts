/**
 * SPECS Inc. 2027
 * Web Capture: mirror a Lens scene in a browser, record what happens while the Lens plays, and
 * edit the recording in the Web Capture portal (scene editor + video editor).
 *
 * Step 1, scene sync: while the Lens runs, the captured objects (poses, shapes, colours, text) are
 * sent to the portal, which rebuilds the scene live. Locally through the WebCapture Lens Studio
 * plugin, or through Snap Cloud (Supabase).
 * Step 2, record: press Play; the Lens records keyframe tracks (only changes) and saves a light
 * recording file (webcapture/1 JSON) to the project's WebCaptureRecordings/ folder or Snap Cloud.
 * Step 3, edit: open the recording in the portal to replay it, re-frame it, trim and cut it, add
 * titles and music, and export a video. See the package README.
 */
import {SnapCloudRequirements} from "../SnapCloudRequirements"
import {BackgroundRecorder, CaptureAssets} from "./CaptureAssets"
import {NdkCamera} from "./NdkCamera"
import {CameraCalibration, readCameraCalibration} from "./CameraCalibration"
import {cameraPose, CaptureEntry, CaptureRecorder, relativePose} from "./CaptureRecorder"
import {
  AuthMode,
  CaptureTransport,
  LocalPortalTransport,
  OfflineTransport,
  SaveResult,
  SnapCloudTransport
} from "./CaptureTransports"
import {
  CaptureObject,
  CaptureParams,
  makeId,
  MAX_OBJECTS,
  MAX_RECORDING_SECONDS,
  PACKAGE_VERSION,
  Pose,
  projectCode,
  Recording,
  SceneSnapshot,
  SCENE_FORMAT,
  validateRecording
} from "./WebCaptureProtocol"
import {describeObject, readParams, WebCaptureTarget} from "./WebCaptureTarget"

export type CaptureMode = "auto" | "local" | "snapcloud" | "both" | "offline"

interface PanelShape {
  object: SceneObject
  size: number[]
  radius: number
  color: number[]
  border?: number[]
  layer?: number
}

// The AR reference layer is a second encoder pipeline next to the camera. It is switched off in code while the
// camera stream is being stabilised, whatever the Record Reference input says.
const AR_REFERENCE_ENABLED = false

@component
export class WebCapture extends BaseScriptComponent {
  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Where the capture goes</span>')
  @ui.label(
    '<span style="color: #94A3B8; font-size: 11px;">Local: the WebCapture plugin in this Lens Studio (needs Experimental APIs). Snap Cloud: your Supabase project (works on Specs). Auto: local when the plugin answers, else Snap Cloud.</span>'
  )
  @input
  @widget(
    new ComboBoxWidget([
      new ComboBoxItem("Auto (local, else Snap Cloud)", "auto"),
      new ComboBoxItem("Local portal (Lens Studio plugin)", "local"),
      new ComboBoxItem("Snap Cloud", "snapcloud"),
      new ComboBoxItem("Local and Snap Cloud", "both"),
      new ComboBoxItem("Offline (keep in memory)", "offline")
    ])
  )
  mode: string = "auto"

  @input
  @hint("WebSocket of the WebCapture Lens Studio plugin")
  localPortalUrl: string = "ws://127.0.0.1:47791"

  @input
  @allowUndefined
  @hint("SnapCloudRequirements holding the SupabaseProject asset. Only needed for Snap Cloud")
  snapCloudRequirements: SnapCloudRequirements

  @input
  @hint("How the Lens signs in to Snap Cloud")
  @widget(
    new ComboBoxWidget([
      new ComboBoxItem("Snapchat, then anonymous", "snapchat-then-anonymous"),
      new ComboBoxItem("Snapchat only", "snapchat"),
      new ComboBoxItem("Anonymous only", "anonymous")
    ])
  )
  authMode: string = "snapchat-then-anonymous"

  @ui.separator
  @ui.label('<span style="color: #60A5FA;">What to capture</span>')
  @ui.label(
    '<span style="color: #94A3B8; font-size: 11px;">Poses are relative to the Capture Origin, in cm. Objects come from WebCaptureTarget components, Tracked Objects and the descendants of Capture Root.</span>'
  )
  @input
  @allowUndefined
  @hint("Reference frame for every pose (e.g. your stage root). Empty = this SceneObject")
  captureOrigin: SceneObject

  @input
  @hint("Capture every SceneObject that has a WebCaptureTarget component")
  includeTargets: boolean = true

  @input
  @allowUndefined
  @hint("Extra SceneObjects to capture (shape guessed from their mesh or Text)")
  trackedObjects: SceneObject[] = []

  @input
  @allowUndefined
  @hint("Also capture every descendant of this object that has a mesh or a Text (optional)")
  captureRoot: SceneObject

  @input
  @allowUndefined
  @hint("Camera to record (the viewer's head on Specs). Empty = the first Camera in the scene")
  camera: Camera

  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Step 1 · Live scene sync</span>')
  @input
  @hint("Send the scene to the portal while the Lens runs")
  liveSync: boolean = true

  @input("float")
  @widget(new SliderWidget(1, 30, 1))
  @hint("Live updates per second (only sent when something changed)")
  liveRate: number = 10

  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Step 2 · Record</span>')
  @input
  @hint("Start recording as soon as the Lens starts. Off: press the Start Button (or Record in the portal)")
  recordOnStart: boolean = false

  @input("float")
  @hint("Stop and save after this many seconds (max 90). The panel's length button sets 30, 60 or 90. 0 = 90, or until Stop")
  recordSeconds: number = 30

  @input("float")
  @widget(new SliderWidget(5, 60, 1))
  @hint("Samples per second while recording")
  recordRate: number = 30

  @input("float")
  @hint("Movement (cm) below which no keyframe is stored")
  positionTolerance: number = 0.1

  @input("float")
  @hint("Rotation change (quaternion component) below which no keyframe is stored")
  rotationTolerance: number = 0.001

  @input
  @hint("Recording name. Empty = Lens name + date")
  recordingName: string = ""

  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Look · what the portal rebuilds</span>')
  @ui.label(
    '<span style="color: #94A3B8; font-size: 11px;">Geometry and textures are captured once per recording. The background is a texture recorded as small JPEG frames: the Preview background in Lens Studio, the camera on Specs.</span>'
  )
  @input
  @hint("Capture real mesh geometry, base colour textures and culling instead of boxes")
  captureGeometry: boolean = true

  @input
  @hint("Record a background texture track")
  captureBackground: boolean = true

  @input
  @allowUndefined
  @hint("Texture to record as the background (Device Camera Texture, or the camera / Preview background texture)")
  backgroundTexture: Texture

  @input
  @hint("On Specs, record the real camera through the NDK (NDKCapture module) at the camera's own resolution and aspect ratio. In Lens Studio the texture above is used")
  useNdkCamera: boolean = true

  @input
  @hint("Debug: with the NDK camera video, also record the system's AR layer rendered from the camera's viewpoint (same clock) as a ground truth for checking the alignment. Needs a recent SPECS OS build; adds a few MB")
  recordReference: boolean = false

  @input
  @hint("Experimental: record the camera as hardware-encoded H.265 video through the NDK (smooth, small) instead of JPEG frames. The portal can't play it yet; use it to check the data with ffmpeg")
  ndkVideo: boolean = false

  @input
  @hint("Start the NDK camera when the Lens opens and keep it running, so pressing Start Capture doesn't wait for the camera to open (uses a little more power while the Lens is open)")
  keepCameraWarm: boolean = true

  @input("float")
  @hint("NDK camera frame width in pixels (height follows the camera's aspect ratio)")
  ndkCameraWidth: number = 640

  @input("float")
  @widget(new SliderWidget(5, 30, 1))
  @hint("NDK camera frames per second. Higher is smoother and bigger: ~35 KB a frame at 640 px. A 30 s capture is ~13 MB at 12 fps")
  ndkCameraFps: number = 12

  @input("float")
  @widget(new SliderWidget(30, 100, 5))
  @hint("NDK camera JPEG quality")
  ndkCameraQuality: number = 60

  @input("float")
  @widget(new SliderWidget(1, 15, 1))
  @hint("Background frames per second (each frame is a JPEG: more frames, bigger recording)")
  backgroundFps: number = 6

  @input
  @hint("Background JPEG quality")
  @widget(
    new ComboBoxWidget([
      new ComboBoxItem("Low", "low"),
      new ComboBoxItem("Medium", "medium"),
      new ComboBoxItem("High", "high")
    ])
  )
  backgroundQuality: string = "high"

  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Start / stop button</span>')
  @input
  @allowUndefined
  @hint(
    "Optional button object. Pinch it (Specs, needs an Interactable on it) or tap it (Lens Studio) to start capturing; again to stop and save"
  )
  startButton: SceneObject

  @input
  @allowUndefined
  @hint("Optional: keep the Start Button hidden until this object is enabled (e.g. the demo stage a guide panel reveals)")
  showButtonWhenEnabled: SceneObject

  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Status</span>')
  @input
  @allowUndefined
  @hint("Text that shows the connection and recording status (optional)")
  statusText: Text

  @input
  @hint("Print details to the Logger")
  debugLogs: boolean = false

  private transports: CaptureTransport[] = []
  private recorder: CaptureRecorder | null = null
  private entries: CaptureEntry[] = []
  private entriesAge = 999
  private liveElapsed = 999
  private resendElapsed = 0
  private lastLive = ""
  private revision = 0
  private session = makeId("ses")
  private statusMessage = "Starting"
  private lastRecording: Recording | null = null
  private lastSave: SaveResult[] = []
  private savedCallbacks: ((recording: Recording, saved: SaveResult[]) => void)[] = []
  private statusCallbacks: ((status: string) => void)[] = []
  private warned: {[key: string]: boolean} = {}
  private foundCamera: Camera | null = null
  private waitingToRecord = false
  private assets: CaptureAssets | null = null
  private background: BackgroundRecorder | null = null
  private buttonShown = true
  private labelSink: ((label: string, recording: boolean) => void) | null = null
  private panelManaged = false
  private lastToggle = -100
  private extraRoots: SceneObject[] = []
  private panelShapes: PanelShape[] = []
  private collectedCount = -1
  private ndkCamera: NdkCamera | null = null
  private calibration: CameraCalibration | null = null
  private referencePath: string | null = null
  private buttonLabel = ""

  onAwake(): void {
    this.recorder = new CaptureRecorder(
      this.lensName(),
      Math.max(5, Math.min(60, this.recordRate)),
      {position: Math.max(0, this.positionTolerance), rotation: Math.max(0, this.rotationTolerance), scale: 0.001},
      this.recordSeconds > 0 ? Math.min(this.recordSeconds, MAX_RECORDING_SECONDS) : MAX_RECORDING_SECONDS
    )
    this.assets = new CaptureAssets(this.captureGeometry, (m) => this.log(m))
    this.background = new BackgroundRecorder(
      this.captureBackground ? this.backgroundTexture : null,
      this.backgroundFps,
      this.backgroundQuality === "high"
        ? CompressionQuality.HighQuality
        : this.backgroundQuality === "medium"
          ? CompressionQuality.IntermediateQuality
          : CompressionQuality.LowQuality,
      (m) => this.log(m)
    )
    this.createEvent("OnStartEvent").bind(() => {
      this.bindStartButton()
      void this.onStart()
    })
    this.createEvent("UpdateEvent").bind(() => this.onUpdate())
    this.createEvent("OnDestroyEvent").bind(() => this.dispose())
  }

  /** Sets how long the next capture runs (5 to 90 s); the panel's length button calls this. */
  setRecordSeconds(seconds: number): void {
    this.recordSeconds = Math.max(5, Math.min(MAX_RECORDING_SECONDS, Math.round(seconds)))
    if (this.recorder) this.recorder.setMaxSeconds(this.recordSeconds)
  }

  /** Connection and recording status, as shown in Status Text. */
  get status(): string {
    return this.statusMessage
  }

  get isRecording(): boolean {
    return !!this.recorder && this.recorder.active
  }

  /** The Snap Cloud session code the portal opens (empty when Snap Cloud isn't used). */
  get sessionCode(): string {
    for (const t of this.transports) if (t.name === "snapcloud" && t.connected) return t.sessionCode
    return ""
  }

  /** The last recording saved in this run, or null. */
  get recording(): Recording | null {
    return this.lastRecording
  }

  onRecordingSaved(callback: (recording: Recording, saved: SaveResult[]) => void): void {
    this.savedCallbacks.push(callback)
  }

  onStatusChanged(callback: (status: string) => void): void {
    this.statusCallbacks.push(callback)
  }

  /** Starts a new recording (stopping and saving the current one first). */
  startRecording(name?: string): string {
    if (!this.recorder) return ""
    this.waitingToRecord = false
    if (this.recorder.active) void this.stopRecording()
    this.refreshEntries()
    // Meshes and textures are collected while idle (see onUpdate); this only picks up objects that appeared since.
    if (this.assets) this.assets.collect(this.entries)
    this.calibration = readCameraCalibration((m) => this.log(m))
    this.referencePath = null
    if (this.background) this.background.begin(this.clock())
    const id = this.recorder.start(this.clock(), name || this.recordingName)
    this.recorder.sample(this.clock(), this.entries, this.origin(), this.cameraComponent(), true)
    this.setStatus("Recording · 0.0 s")
    this.log("Recording " + id + " started with " + this.entries.length + " objects")
    return id
  }

  /** Stops the recording and saves it to every connected destination. */
  async stopRecording(): Promise<Recording | null> {
    // Everything up to recorder.stop() runs before the first await, so a second call (or a new recording
    // started while this one saves) sees recorder.active and can't stop the same recording twice.
    if (!this.recorder || !this.recorder.active) return null
    this.recorder.sample(this.clock(), this.entries, this.origin(), this.cameraComponent(), true)
    const recording = this.recorder.stop(this.clock(), {device: this.deviceName()})
    // H.265 mode: let the encoder hand over its last buffered frames before the stream is closed.
    if (this.background) await this.background.flushVideo(() => this.clock(), (seconds) => this.sleep(seconds))
    const background = this.background ? this.background.finish() : null
    // The heavy steps below are spread over a few frames so the Lens (and the headset UI) never freezes for long.
    await this.yieldFrame()
    if (this.assets) {
      await this.assets.whenReady()
      const data = this.assets.result()
      if (data) recording.assets = data
    }
    if (background) {
      background.source = background.video ? "ndk-video" : background.width ? "ndk" : "texture"
      recording.background = background
    }
    // The capture's ratio: the calibrated camera (Specs), else the real camera frame, else the Lens camera.
    if (this.calibration) {
      recording.meta.camera = this.calibration
      recording.meta.aspect = Math.round((this.calibration.resolution[0] / this.calibration.resolution[1]) * 1000) / 1000
    } else if (background && background.width && background.height) {
      recording.meta.aspect = Math.round((background.width / background.height) * 1000) / 1000
    } else {
      try {
        const cam = this.cameraComponent()
        if (cam && cam.aspect > 0) recording.meta.aspect = Math.round(cam.aspect * 1000) / 1000
      } catch {
        // the camera has no aspect yet
      }
    }
    const problem = validateRecording(recording)
    if (problem) {
      this.setStatus("Recording not saved: " + problem)
      return null
    }
    this.lastRecording = recording
    await this.yieldFrame()
    // One serialization for every destination and for the size shown (a 10+ MB recording is costly to stringify).
    const json = JSON.stringify(recording)
    const kb = Math.round(json.length / 102.4) / 10
    this.setStatus("Saving recording (" + kb + " KB)…")
    await this.yieldFrame()
    const saved: SaveResult[] = []
    const errors: string[] = []
    for (const t of this.transports) {
      if (!t.connected) continue
      try {
        saved.push(await t.saveRecording(recording, json))
      } catch (e) {
        errors.push(t.name + ": " + ((e as Error).message || e))
      }
    }
    this.lastSave = saved
    if (saved.length > 0) {
      const where = saved
        .map((s) =>
          s.transport === "local"
            ? s.location
            : s.transport === "snapcloud"
              ? "Snap Cloud " + this.sessionCode
              : "memory"
        )
        .join(" + ")
      this.setStatus(
        "Saved " +
          recording.meta.duration.toFixed(1) +
          " s · " +
          where +
          (errors.length ? " · " + errors.join("; ") : "")
      )
    } else {
      this.setStatus(
        "Recording kept in memory only" + (errors.length ? ": " + errors.join("; ") : " (no destination connected)")
      )
    }
    print(
      "[WebCapture] Recording '" +
        recording.meta.name +
        "' (" +
        recording.meta.id +
        "): " +
        recording.objects.length +
        " objects, " +
        recording.meta.duration.toFixed(1) +
        " s, " +
        kb +
        " KB"
    )
    for (const callback of this.savedCallbacks) callback(recording, saved)
    return recording
  }

  /** Keeps the button honest: "Start Capture" when idle, "Stop Capture · 12 s" (and the Secondary style) while recording. */
  /**
   * The one clock for everything recorded. With the NDK camera it is the native monotonic clock, the same one
   * the camera frames are stamped with, so poses and frames line up exactly; otherwise the Lens clock.
   */
  /** Resolves on a later frame, so long work can be split without blocking rendering and input. */
  private yieldFrame(): Promise<void> {
    return new Promise<void>((resolve) => {
      const event = this.createEvent("DelayedCallbackEvent")
      event.bind(() => resolve())
      event.reset(0.05)
    })
  }

  private sleep(seconds: number): Promise<void> {
    return new Promise<void>((resolve) => {
      const event = this.createEvent("DelayedCallbackEvent")
      event.bind(() => resolve())
      event.reset(seconds)
    })
  }

  private clock(): number {
    return this.ndkCamera ? this.ndkCamera.now() : getTime()
  }

  /** Records a flat rounded rectangle at this object's pose (a UI panel, button or dot the portal draws itself). */
  addPanelShape(object: SceneObject, shape: {size: number[]; radius: number; color: number[]; border?: number[]; layer?: number}): void {
    this.panelShapes.push({object: object, ...shape})
  }

  /** Also records everything under this object (e.g. a UIKit panel built outside Capture Root). */
  addCaptureRoot(root: SceneObject): void {
    if (this.extraRoots.indexOf(root) < 0) this.extraRoots.push(root)
  }

  /** Used by CapturePanel: the panel's button toggles recording and its label follows the state. */
  attachPanel(button: SceneObject, setLabel: (label: string, recording: boolean) => void): void {
    // The panel's button is the only one: a separate Start Button object, if any, stays off
    if (this.startButton && this.startButton !== button) this.startButton.enabled = false
    this.startButton = button
    this.labelSink = setLabel
    this.panelManaged = true
    this.buttonShown = true
    this.buttonLabel = ""
    this.bindStartButton()
    this.syncButton()
  }

  private syncButton(): void {
    const button = this.startButton
    if (!button || !this.buttonShown) return
    const recording = this.isRecording
    const label = recording
      ? "■  Stop Capture · " + Math.floor(this.recorder ? this.recorder.elapsed(this.clock()) : 0) + " s"
      : "●  Start Capture"
    if (label === this.buttonLabel) return
    const styleChanged = this.buttonLabel === "" || this.buttonLabel.indexOf("Stop") === 0 !== recording
    this.buttonLabel = label
    if (this.labelSink) {
      this.labelSink(label, recording)
      return
    }
    for (const component of button.getComponents("Component.ScriptComponent")) {
      // Duck-typed UIKit parts: ElementContent has .text, Button has .setVariant().
      const part = component as unknown as {
        text?: string
        textComponent?: unknown
        setVariant?: (options: {style?: string}) => void
      }
      if ("textComponent" in part) part.text = label
      if (styleChanged && typeof part.setVariant === "function") {
        try {
          part.setVariant({style: recording ? "Secondary" : "Primary"})
        } catch {
          // style not available in this theme
        }
      }
    }
  }

  /** Toggles recording: the same action as the Start button. */
  toggleRecording(): void {
    // A UIKit button can fire through more than one of its components for a single press: one toggle per press
    const now = getTime()
    if (now - this.lastToggle < 1.2) {
      this.log("Button press ignored (second trigger within 1.2 s)")
      return
    }
    this.lastToggle = now
    this.log("Button pressed: " + (this.isRecording ? "stop" : "start"))
    if (this.isRecording) void this.stopRecording()
    else this.startRecording()
  }

  /** Hooks the optional Start button: a SpectaclesInteractionKit Interactable, or a plain tap. */
  private bindStartButton(): void {
    const button = this.startButton
    if (!button) return
    if (!this.panelManaged && this.showButtonWhenEnabled && !this.showButtonWhenEnabled.isEnabledInHierarchy) {
      button.enabled = false
      this.buttonShown = false
    }
    let bound = false
    for (const component of button.getComponents("Component.ScriptComponent")) {
      // Duck-typed so the package doesn't depend on SIK / UIKit: an Interactable has onTriggerEnd.add(),
      // a UIKit Button has onTriggerUp.add().
      const events = component as unknown as {
        onTriggerEnd?: {add?: (cb: () => void) => void}
        onTriggerUp?: {add?: (cb: () => void) => void}
      }
      const hook = events.onTriggerUp && typeof events.onTriggerUp.add === "function" ? events.onTriggerUp : events.onTriggerEnd
      if (hook && typeof hook.add === "function") {
        hook.add(() => this.toggleRecording())
        bound = true
        break // one hook per button
      }
    }
    const touch = bound ? null : button.getComponent("Component.InteractionComponent")
    if (touch) {
      touch.onTap.add(() => this.toggleRecording())
      bound = true
    }
    if (!bound) this.warnOnce("button", "Start Button needs an Interactable (Specs) or an InteractionComponent (tap)")
  }

  /** Adds a labelled marker at the current time of the recording (shown on the portal timeline). */
  mark(label: string): void {
    if (this.recorder) this.recorder.mark(this.clock(), label)
  }

  /** The snapshot that would be sent now (useful for tests and debugging). */
  buildSnapshot(): SceneSnapshot {
    this.refreshEntries()
    const origin = this.origin()
    const poses: {[id: string]: Pose} = {}
    const params: {[id: string]: CaptureParams} = {}
    const objects: CaptureObject[] = []
    for (const e of this.entries) {
      // Skip objects destroyed since the refresh instead of failing the whole snapshot.
      try {
        const pose: Pose = relativePose(e.object, origin)
        const p: CaptureParams = e.readParams()
        poses[e.desc.id] = pose
        params[e.desc.id] = p
        objects.push(e.desc)
      } catch (err) {
        continue
      }
    }
    return {
      format: SCENE_FORMAT,
      session: this.session,
      revision: this.revision,
      time: Math.round(this.clock() * 1000) / 1000,
      lens: this.lensName(),
      objects: objects,
      poses: poses,
      params: params,
      camera: cameraPose(this.cameraComponent(), origin),
      recording:
        this.recorder && this.recorder.active
          ? {id: this.recorder.id, elapsed: Math.round(this.recorder.elapsed(this.clock()) * 100) / 100}
          : null
    }
  }

  private async onStart(): Promise<void> {
    if (this.useNdkCamera && this.captureBackground && this.background && !global.deviceInfoSystem.isEditor()) {
      const camera = new NdkCamera()
      if (await camera.load((m) => this.log(m))) {
        this.ndkCamera = camera
        if (this.ndkVideo) {
          this.background.useNdkVideo(camera, 30, 3000000, this.keepCameraWarm)
          // Ground truth: the system's AR layer rendered from the camera's viewpoint, on the same clock (opt-in)
          // A debugging aid that runs a second camera pipeline (it can starve the camera video), so it also needs Debug Logs.
          if (AR_REFERENCE_ENABLED && this.recordReference && this.debugLogs) this.background.useArReference(4)
          if (this.keepCameraWarm) this.background.warm()
          this.log("Background: NDK H.265 camera layer" + (this.keepCameraWarm ? " (kept warm)" : ""))
        } else {
          this.background.useNdk(camera, this.ndkCameraWidth, this.ndkCameraQuality, this.ndkCameraFps, this.keepCameraWarm)
          if (this.keepCameraWarm) this.background.warm()
        }
        this.log("Background: NDK camera")
      } else {
        this.log("NDK camera unavailable: using the background texture")
      }
    }
    this.refreshEntries()
    if (this.assets) {
      this.assets.collect(this.entries)
      this.collectedCount = this.entries.length
    }
    await this.connectTransports()
    if (!this.recordOnStart) return
    // Objects inside a disabled parent (e.g. the demo stage behind the guide panel) only register
    // once enabled: wait for the first one instead of saving an empty recording.
    this.refreshEntries()
    if (this.entries.length > 0) this.startRecording()
    else {
      this.waitingToRecord = true
      this.setStatus(
        "Waiting for objects to capture, then recording " +
          (this.recordSeconds > 0 ? this.recordSeconds + " s" : "until stopped")
      )
    }
  }

  private async connectTransports(): Promise<void> {
    const mode = this.mode as CaptureMode
    const wantLocal = mode === "auto" || mode === "local" || mode === "both"
    const wantCloud = mode === "snapcloud" || mode === "both"
    const notes: string[] = []
    if (mode === "offline") {
      this.transports.push(new OfflineTransport())
      this.setStatus("Offline: recordings stay in memory")
      return
    }
    if (wantLocal) {
      const local = new LocalPortalTransport(
        this.localPortalUrl,
        {lens: this.lensName(), session: this.session, packageVersion: PACKAGE_VERSION},
        (action, args) => this.onCommand(action, args),
        (m) => this.log(m)
      )
      try {
        await local.connect()
        this.transports.push(local)
        notes.push("local portal")
      } catch (e) {
        local.dispose()
        notes.push("local: " + ((e as Error).message || e))
      }
    }
    if (wantCloud || (mode === "auto" && this.transports.length === 0)) {
      const cloud = this.makeCloud()
      if (cloud) {
        try {
          await cloud.connect()
          this.transports.push(cloud)
          notes.push("Snap Cloud session " + cloud.sessionCode)
        } catch (e) {
          notes.push("Snap Cloud: " + ((e as Error).message || e))
        }
      } else if (wantCloud || mode === "auto") {
        notes.push("Snap Cloud: assign a SupabaseProject on SnapCloudRequirements")
      }
    }
    if (this.transports.length === 0) {
      this.transports.push(new OfflineTransport())
      this.setStatus("Not connected, recording in memory · " + notes.join(" · "))
    } else {
      this.setStatus("Connected · " + notes.join(" · "))
    }
  }

  private makeCloud(): SnapCloudTransport | null {
    const project = this.snapCloudRequirements ? this.snapCloudRequirements.getSupabaseProject() : null
    if (!project) return null
    let url = ""
    let token = ""
    try {
      url = project.url
      token = project.publicToken
    } catch {
      return null
    }
    if (!url || !token) return null
    return new SnapCloudTransport(url, token, this.authMode as AuthMode, this.lensName(), (m) => this.log(m), projectCode(url, token))
  }

  private onCommand(action: string, args: {[key: string]: unknown}): void {
    // Capturing is controlled only from inside the Lens (Start Capture button, startRecording() / stopRecording()).
    this.log("Ignored remote command '" + action + "': start and stop the capture in the Lens")
  }

  private onUpdate(): void {
    const dt = getDeltaTime()
    this.entriesAge += dt
    if (this.entriesAge > 1 || this.waitingToRecord) this.refreshEntries()
    if (this.waitingToRecord && this.entries.length > 0) {
      this.waitingToRecord = false
      this.startRecording()
    }
    this.syncButton()
    if (!this.panelManaged && !this.buttonShown && this.startButton && this.showButtonWhenEnabled && this.showButtonWhenEnabled.isEnabledInHierarchy) {
      this.startButton.enabled = true
      this.buttonShown = true
    }
    if (!this.isRecording) {
      // Idle: collect new meshes/textures as objects appear, and keep the warm camera queue empty.
      if (this.assets && this.entries.length !== this.collectedCount) {
        this.assets.collect(this.entries)
        this.collectedCount = this.entries.length
      }
      if (this.background) this.background.drain(this.clock())
    }
    if (this.recorder && this.recorder.active) {
      if (this.background) this.background.sample(this.clock())
      const keepGoing = this.recorder.sample(this.clock(), this.entries, this.origin(), this.cameraComponent(), false)
      const elapsed = this.recorder.elapsed(this.clock())
      if (!keepGoing) {
        this.log("Stopping: reached the " + elapsed.toFixed(1) + " s limit")
        void this.stopRecording()
      } else if (Math.floor(elapsed * 10) % 5 === 0) this.setStatus("Recording · " + elapsed.toFixed(1) + " s", true)
    }
    if (!this.liveSync || this.transports.length === 0) return
    this.liveElapsed += dt
    this.resendElapsed += dt
    if (this.liveElapsed < 1 / Math.max(1, Math.min(30, this.liveRate))) return
    this.liveElapsed = 0
    const snapshot = this.buildSnapshot()
    const signature = JSON.stringify({
      o: snapshot.objects,
      p: snapshot.poses,
      a: snapshot.params,
      c: snapshot.camera,
      r: snapshot.recording ? 1 : 0
    })
    // Unchanged scenes are re-sent every 5 s so a portal that opens late still gets the scene.
    if (signature === this.lastLive && this.resendElapsed < 5) return
    this.lastLive = signature
    this.resendElapsed = 0
    this.revision++
    snapshot.revision = this.revision
    for (const t of this.transports) if (t.connected) t.publishScene(snapshot)
  }

  /** Rebuilds the list of captured objects (targets can appear or disappear at runtime). */
  private refreshEntries(): void {
    this.entriesAge = 0
    const entries: CaptureEntry[] = []
    const used: {[id: string]: boolean} = {}
    const seen: SceneObject[] = []
    const add = (object: SceneObject, target: WebCaptureTarget | null, shape?: PanelShape) => {
      if (!object || seen.indexOf(object) >= 0) return
      if (object.name.indexOf("CaptureOriginMarker") === 0) return // the prefab's own helper, not part of your scene
      if (entries.length >= MAX_OBJECTS) {
        this.warnOnce("max", "More than " + MAX_OBJECTS + " objects: the extra objects are not captured")
        return
      }
      seen.push(object)
      let id = target ? target.captureId : object.name.substring(0, 80)
      if (!id) id = "object"
      if (used[id]) {
        let n = 2
        while (used[id + "#" + n]) n++
        this.warnOnce("dup:" + id, "Duplicate capture id '" + id + "': set a unique Target Id on its WebCaptureTarget")
        id = id + "#" + n
      }
      used[id] = true
      const desc = shape
        ? describeObject(object, id, null, "panel", new vec4(shape.color[0], shape.color[1], shape.color[2], shape.color[3]), false)
        : target
        ? describeObject(object, id, null, target.primitive, target.color, target.useMaterialColor)
        : describeObject(object, id, null, "auto", new vec4(0.8, 0.8, 0.8, 1))
      if (shape) {
        desc.primitive = "panel" as typeof desc.primitive // explicit: an older WebCaptureProtocol in the bundle can lack it and coerce to empty
        desc.size = shape.size
        desc.radius = shape.radius
        desc.layer = shape.layer || 0
        if (shape.border) desc.border = shape.border
      }
      const read = shape ? () => readParams(object, false, true, false) : target ? () => target.readParams() : () => readParams(object, true, true, true)
      entries.push({object: object, desc: desc, readParams: read})
    }
    if (this.includeTargets) for (const t of WebCaptureTarget.all) add(t.getSceneObject(), t)
    for (const o of this.trackedObjects || []) if (o) add(o, null)
    if (this.captureRoot) {
      const walk = (o: SceneObject) => {
        if (o.getComponent("Component.RenderMeshVisual") || o.getComponent("Component.Text")) add(o, null)
        for (let i = 0; i < o.getChildrenCount(); i++) walk(o.getChild(i))
      }
      walk(this.captureRoot)
    }
    for (const shape of this.panelShapes) {
      if (!shape.object) continue
      try {
        add(shape.object, null, shape)
      } catch (err) {
        continue
      }
    }
    for (const root of this.extraRoots) {
      // UIKit visuals are shader-sized unit meshes: only their text is captured; the plates come from addPanelShape.
      const walk = (o: SceneObject) => {
        if (o.getComponent("Component.Text")) add(o, null)
        for (let i = 0; i < o.getChildrenCount(); i++) walk(o.getChild(i))
      }
      try {
        walk(root)
      } catch (err) {
        continue
      }
    }
    this.entries = entries
  }

  private origin(): SceneObject {
    return this.captureOrigin || this.getSceneObject()
  }

  private cameraComponent(): Camera | null {
    if (this.camera) return this.camera
    if (this.foundCamera) return this.foundCamera
    const find = (o: SceneObject): Camera | null => {
      const c = o.getComponent("Component.Camera")
      if (c) return c
      for (let i = 0; i < o.getChildrenCount(); i++) {
        const r = find(o.getChild(i))
        if (r) return r
      }
      return null
    }
    for (let i = 0; i < global.scene.getRootObjectsCount(); i++) {
      const c = find(global.scene.getRootObject(i))
      if (c) {
        this.foundCamera = c
        return c
      }
    }
    return null
  }

  private lensName(): string {
    try {
      return global.deviceInfoSystem.isEditor() ? "Lens Studio Preview" : "Specs Lens"
    } catch {
      return "Lens"
    }
  }

  private deviceName(): string {
    try {
      return global.deviceInfoSystem.isEditor() ? "Lens Studio" : "Specs"
    } catch {
      return ""
    }
  }

  private dispose(): void {
    if (this.ndkCamera) {
      // Stop every native stream when the Lens closes. The H.265 camera layer runs the whole time the Lens is open
      // (kept warm); left running, its encoder pipeline stays alive in the glasses' camera service after the Lens is
      // gone, and later captures stall after a few frames until the glasses are rebooted.
      this.ndkCamera.stopVideo()
      this.ndkCamera.stopAr()
      this.ndkCamera.stop()
    }
    for (const t of this.transports) t.dispose()
    this.transports = []
  }

  private setStatus(message: string, quiet?: boolean): void {
    this.statusMessage = message
    if (this.statusText) this.statusText.text = message
    if (!quiet) this.log(message)
    for (const callback of this.statusCallbacks) callback(message)
  }

  private log(message: string): void {
    if (this.debugLogs) print("[WebCapture] " + message)
  }

  private warnOnce(key: string, message: string): void {
    if (this.warned[key]) return
    this.warned[key] = true
    print("[WebCapture] " + message)
  }
}

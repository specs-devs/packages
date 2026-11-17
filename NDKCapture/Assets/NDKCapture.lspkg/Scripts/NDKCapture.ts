/**
 * SPECS Inc. 2027
 * NDK Capture: streaming and capture in one asset, built on SpecsNDK 1.1.0.
 *
 * Layers: camera (natural video), ar (rendered overlay), ui (an optional extra render target) and
 * mic (audio). On Specs, camera / ar / mic are separate SpecsRecorder sessions in the native module
 * (H.265 / AAC); every visual layer also has a low-rate JPEG proxy for live previews and editing.
 *
 * Stream: layers go live to the NDK Capture Studio (the Lens Studio plugin serves it at
 * http://127.0.0.1:47792), which composites them with per-layer opacity, blend, transform and
 * order. Every change made in the Studio (or through setLayer()) is applied live and logged.
 * Record: the same layers are recorded as SEPARATE tracks plus a light manifest (settings timeline
 * and markers), so the composite can be re-edited later; on Specs a finished SpecsCapture MP4
 * (camera + AR + audio) can be recorded alongside. Edit: open the recording in the Studio.
 */
import {loadNDKCaptureNative, NativeLayer, NDKCaptureNativeExports} from "./NDKCaptureNativeModule"
import {
  ALL_LAYERS,
  DEFAULT_STUDIO_URL,
  defaultSettings,
  LayerId,
  LayerSettings,
  LayerTrack,
  LensMessage,
  makeId,
  Marker,
  MANIFEST_FORMAT,
  PACKAGE_VERSION,
  sanitizeSettings,
  SessionManifest,
  SettingsChange,
  StudioCommand,
  VISUAL_LAYERS
} from "./NDKCaptureProtocol"
import {StudioLink} from "./StudioLink"

const NATIVE_LAYERS: NativeLayer[] = ["camera", "ar", "mic"]
const POLL_BYTES = 192 * 1024

function isNative(layer: LayerId): layer is NativeLayer {
  return layer === "camera" || layer === "ar" || layer === "mic"
}

@component
export class NDKCapture extends BaseScriptComponent {
  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Studio</span>')
  @ui.label(
    '<span style="color: #94A3B8; font-size: 11px;">The NDK Capture plugin serves the Studio at http://127.0.0.1:47792 and listens for this Lens on the URL below. Local ws:// needs Experimental APIs; on Specs use your computer\'s LAN address.</span>'
  )
  @input
  @hint("WebSocket of the NDK Capture Studio")
  studioUrl: string = DEFAULT_STUDIO_URL

  @input
  @hint("Connect to the Studio when the Lens starts")
  connectOnStart: boolean = true

  @input
  @hint("Start streaming the enabled layers as soon as the Lens starts")
  streamOnStart: boolean = true

  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Layers</span>')
  @input
  @hint("Natural camera video (native SpecsRecorder VIDEO on Specs, camera texture in the editor)")
  cameraLayer: boolean = true

  @input
  @hint("Rendered AR overlay (native SpecsRecorder AR_VIDEO on Specs)")
  arLayer: boolean = true

  @input
  @hint("Render target for the AR layer's proxy frames. Empty = the Lens's live target (what the main camera renders)")
  @allowUndefined
  arTexture: Texture

  @input
  @hint("Optional extra visual layer (for example a UI-only camera's render target)")
  uiLayer: boolean = false

  @input
  @allowUndefined
  uiTexture: Texture

  @input
  @hint("Microphone audio (native SpecsRecorder AUDIO on Specs; not available in the editor)")
  micLayer: boolean = true

  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Proxies</span>')
  @input
  @hint("Width of the JPEG proxy frames (preview and editing proxy)")
  @widget(new SliderWidget(160, 960, 16))
  proxyWidth: number = 480

  @input
  @hint("JPEG quality of the proxy frames")
  @widget(new SliderWidget(10, 95, 1))
  proxyQuality: number = 50

  @ui.separator
  @ui.label('<span style="color: #60A5FA;">On-device files (Specs)</span>')
  @input
  @hint("Folder on the device for native NKC1 track files and the composite MP4. Empty = Studio only.")
  deviceFolder: string = ""

  @input
  @hint("Also record a finished SpecsCapture MP4 (camera + AR composited + audio) on the device")
  recordComposite: boolean = false

  @input
  @hint("Composite AR opacity (SpecsCapture arAlpha)")
  @widget(new SliderWidget(0, 1, 0.05))
  compositeAlpha: number = 1

  @input
  @hint("Composite AR blend: alpha (opaque) or additive")
  @widget(new ComboBoxWidget([new ComboBoxItem("Alpha", "alpha"), new ComboBoxItem("Additive", "additive")]))
  compositeBlend: string = "alpha"

  @ui.separator
  @input
  @hint("Optional Text that shows the capture status")
  @allowUndefined
  statusText: Text

  @input
  @hint("Print status to the log")
  verbose: boolean = false

  private native: NDKCaptureNativeExports | null = null
  private link: StudioLink | null = null
  private settings: {[layer: string]: LayerSettings} = {}
  private streaming = false
  private recording: SessionManifest | null = null
  private recordStartedAt = 0
  private nextProxyAt: {[layer: string]: number} = {}
  private proxyBusy: {[layer: string]: boolean} = {}
  private cameraTexture: Texture | null = null
  private statsAt = 0
  /** Proxies wait until textures (camera, render targets) have had time to produce a frame. */
  private proxiesFrom = 0
  private status = "Starting"
  private nativeProxy = false
  /** True once start() has finished; public calls made earlier are queued. */
  private ready = false
  private destroyed = false
  private pendingStream = false
  /** Name (or "") of a recording asked for before start() finished; null = none. */
  private pendingRecording: string | null = null
  /** Device-file settings captured when the current recording began. */
  private recDeviceFolder = ""
  private recComposite = false
  /** One reusable event that sends the settings right after the hello. */
  private settingsEvent: DelayedCallbackEvent | null = null

  onAwake(): void {
    for (const layer of ALL_LAYERS) this.settings[layer] = defaultSettings(layer)
    this.settings.camera.enabled = this.cameraLayer
    this.settings.ar.enabled = this.arLayer
    this.settings.ui.enabled = this.uiLayer
    this.settings.mic.enabled = this.micLayer
    this.settingsEvent = this.createEvent("DelayedCallbackEvent")
    this.settingsEvent.bind(() => this.sendSettings())
    this.createEvent("OnStartEvent").bind(() => this.start())
    this.createEvent("UpdateEvent").bind(() => this.update())
    this.createEvent("OnDestroyEvent").bind(() => this.shutdown())
  }

  // ---------- public API

  /** Current settings of a layer (a copy). */
  getLayer(layer: LayerId): LayerSettings {
    return JSON.parse(JSON.stringify(this.settings[layer])) as LayerSettings
  }

  /** Change one layer live. Encoding changes reach the native encoder; everything is logged in the recording. */
  setLayer(layer: LayerId, patch: Partial<LayerSettings>): void {
    const s = this.settings[layer]
    if (!s) return
    const before = JSON.stringify(s)
    const wasEnabled = s.enabled
    const transform = Object.assign({}, s.transform, patch.transform || {})
    Object.assign(s, patch)
    s.transform = transform
    if (JSON.stringify(s) === before) return
    if (this.native && isNative(layer)) {
      if (patch.bitrate !== undefined) this.native.layerAction(layer, 1, s.bitrate)
      if (patch.fps !== undefined || patch.keyFrameInterval !== undefined || patch.bitrate !== undefined)
        this.configureNative(layer)
      if (this.streaming && wasEnabled !== s.enabled) {
        if (s.enabled) this.startNativeLayer(layer)
        else this.stopNativeLayer(layer)
      }
    }
    if (layer === "camera" && wasEnabled !== s.enabled) {
      if (s.enabled) {
        if (this.streaming) this.startCameraProxy()
        if (!this.native && !this.cameraTexture && this.ready) this.cameraTexture = this.requestEditorCamera()
      } else this.stopCameraProxy()
    } else if (layer === "camera" && patch.proxyFps !== undefined && this.nativeProxy) {
      this.stopCameraProxy()
      this.startCameraProxy()
    }
    this.sendSettings()
    if (this.recording) {
      const change: SettingsChange = {t: Math.round(this.sessionMs()), layer: layer, set: patch}
      this.recording.timeline.push(change)
      this.send({type: "record-change", change: change})
    }
  }

  startStream(): void {
    if (this.destroyed) return
    if (!this.ready) {
      this.pendingStream = true
      return
    }
    if (this.streaming) return
    this.streaming = true
    for (const layer of NATIVE_LAYERS) if (this.settings[layer].enabled) this.startNativeLayer(layer)
    if (this.settings.camera.enabled) this.startCameraProxy()
    this.setStatus("Streaming")
  }

  stopStream(): void {
    if (!this.ready) {
      this.pendingStream = false
      this.pendingRecording = null
      return
    }
    if (!this.streaming) return
    if (this.recording) this.stopRecording()
    this.streaming = false
    if (this.native) for (const layer of NATIVE_LAYERS) this.stopNativeLayer(layer)
    this.stopCameraProxy()
    this.setStatus("Stopped")
  }

  /** Start recording every enabled layer as its own track. Starts the stream if needed. */
  startRecording(name?: string): void {
    if (this.destroyed) return
    if (!this.ready) {
      this.pendingRecording = name || ""
      return
    }
    if (this.recording) return
    if (!this.streaming) this.startStream()
    // Device-file settings are fixed for the whole recording, so stopRecording() closes exactly what was opened.
    this.recDeviceFolder = this.native ? this.deviceFolder : ""
    this.recComposite = this.recDeviceFolder !== "" && this.recordComposite
    const id = makeId("rec")
    this.recordStartedAt = getTime()
    const layers: LayerTrack[] = []
    for (const layer of ALL_LAYERS) {
      if (!this.settings[layer].enabled) continue
      if (layer === "mic") {
        if (this.native) layers.push({id: "mic", kind: "audio", codec: "aac", source: "native", file: "mic.nkc"})
        continue
      }
      layers.push({id: layer, kind: "video", codec: "jpeg", source: "proxy", file: layer + ".proxy.ndjson"})
      if (this.native && isNative(layer))
        layers.push({id: layer, kind: "video", codec: "hevc", source: "native", file: layer + ".nkc"})
    }
    const manifest: SessionManifest = {
      format: MANIFEST_FORMAT,
      version: PACKAGE_VERSION,
      id: id,
      name: name || "Capture " + new Date().toISOString().substring(0, 19).replace("T", " "),
      createdAt: new Date().toISOString(),
      lens: "NDK Capture",
      durationMs: 0,
      device: this.native ? "specs" : "editor",
      ndk: this.native ? "1.1.0" : "editor",
      layers: layers,
      initial: JSON.parse(JSON.stringify(this.settings)),
      timeline: [],
      markers: []
    }
    if (this.native) {
      manifest.clock = {nativeStartNs: this.native.clockNs()}
      for (const layer of NATIVE_LAYERS) this.native.layerAction(layer, 0, 0) // fresh key frames
      if (this.recDeviceFolder) this.startDeviceFiles(manifest)
    }
    this.recording = manifest
    if (!this.send({type: "record-begin", manifest: manifest}) && !this.recDeviceFolder)
      this.log("Recording without a Studio connection: nothing will be saved until the Studio connects")
    this.setStatus("Recording")
  }

  stopRecording(): SessionManifest | null {
    if (!this.ready) this.pendingRecording = null
    const manifest = this.recording
    if (!manifest) return null
    this.recording = null
    manifest.durationMs = Math.round(this.sessionMsFrom(this.recordStartedAt))
    if (this.native && this.recDeviceFolder) this.stopDeviceFiles()
    this.recDeviceFolder = ""
    this.recComposite = false
    this.send({type: "record-end", manifest: manifest})
    this.setStatus(this.streaming ? "Streaming" : "Stopped")
    return manifest
  }

  /** Bookmark the current moment (for example "take 2" or "good part") for later edits. */
  addMarker(label: string, layer?: LayerId, color?: string): void {
    if (!this.recording) return
    const marker: Marker = {t: Math.round(this.sessionMs()), label: label || "Marker", color: color || "#F5A524"}
    if (layer) marker.layer = layer
    this.recording.markers.push(marker)
    this.send({type: "record-marker", marker: marker})
  }

  get isStreaming(): boolean {
    return this.streaming
  }

  get isRecording(): boolean {
    return this.recording !== null
  }

  get studioConnected(): boolean {
    return !!this.link && this.link.connected
  }

  // ---------- lifecycle

  private async start(): Promise<void> {
    if (!this.arTexture) this.arTexture = global.scene.liveTarget
    const native = await loadNDKCaptureNative((m) => this.log(m))
    if (this.destroyed) {
      // Destroyed while the module loaded: release anything the module may hold and stop here.
      if (native) {
        for (const layer of NATIVE_LAYERS) {
          native.streamLayer(layer, 0)
          native.stopLayer(layer)
        }
        native.stopProxy()
      }
      return
    }
    this.native = native
    if (this.native) {
      for (const layer of NATIVE_LAYERS) this.configureNative(layer)
    } else if (this.settings.camera.enabled) {
      this.cameraTexture = this.requestEditorCamera()
    }
    if (this.connectOnStart) {
      this.link = new StudioLink(
        this.studioUrl,
        () => this.helloMessage(),
        (command) => this.onCommand(command),
        (m) => this.log(m)
      )
    }
    this.proxiesFrom = getTime() + 1
    this.ready = true
    const wantStream = this.streamOnStart || this.pendingStream
    const wantRecording = this.pendingRecording
    this.pendingStream = false
    this.pendingRecording = null
    if (wantStream || wantRecording !== null) this.startStream()
    else this.setStatus("Ready")
    if (wantRecording !== null) this.startRecording(wantRecording || undefined)
  }

  private shutdown(): void {
    this.stopStream()
    this.destroyed = true
    this.pendingStream = false
    this.pendingRecording = null
    if (this.link) this.link.close()
  }

  private update(): void {
    const now = getTime()
    if (this.link) this.link.tick(now)
    if (!this.streaming) return
    if (this.native) this.pumpNative()
    for (const layer of VISUAL_LAYERS) this.pumpProxy(layer, now)
    if (now >= this.statsAt) {
      this.statsAt = now + 1
      if (this.native) this.send({type: "stats", stats: this.native.stats()})
      this.updateStatusText()
    }
  }

  // ---------- native layers

  /** Encoder settings for the next start. A bitrate selects CBR; 0 keeps the SDK default (constant QP). */
  private configureNative(layer: NativeLayer): void {
    if (!this.native) return
    const s = this.settings[layer]
    const rateControl = s.bitrate > 0 && layer !== "mic" ? 1 : 0
    this.native.configureLayer(layer, s.fps, s.bitrate, s.keyFrameInterval, rateControl, layer === "mic" ? 48000 : 0)
  }

  private startNativeLayer(layer: NativeLayer): void {
    if (!this.native) return
    const r = this.native.startLayer(layer)
    if (r !== 0) {
      this.log("Couldn't start the " + layer + " layer (" + r + ")")
      return
    }
    this.native.streamLayer(layer, 1)
  }

  private stopNativeLayer(layer: NativeLayer): void {
    if (!this.native) return
    this.native.streamLayer(layer, 0)
    this.native.stopLayer(layer)
  }

  /** Start the native camera proxy (Specs). The editor reads the camera texture instead. */
  private startCameraProxy(): void {
    if (!this.native || this.nativeProxy) return
    this.nativeProxy = this.native.startProxy(this.proxyWidth, this.proxyQuality, this.settings.camera.proxyFps) === 0
    if (!this.nativeProxy) this.log("Camera proxy unavailable (the camera is busy)")
  }

  private stopCameraProxy(): void {
    if (this.native && this.nativeProxy) this.native.stopProxy()
    this.nativeProxy = false
  }

  private pumpNative(): void {
    const native = this.native as NDKCaptureNativeExports
    for (const layer of NATIVE_LAYERS) {
      if (!this.settings[layer].enabled) continue
      for (let i = 0; i < 4; i++) {
        const data = native.pollLayer(layer, POLL_BYTES)
        if (!data) break
        this.send({type: "packets", layer: layer, codec: layer === "mic" ? "aac" : "hevc", data: data})
      }
    }
  }

  private startDeviceFiles(manifest: SessionManifest): void {
    const native = this.native as NDKCaptureNativeExports
    const base = this.recDeviceFolder.replace(/\/+$/, "") + "/" + manifest.id
    manifest.deviceFiles = {}
    for (const layer of NATIVE_LAYERS) {
      if (!this.settings[layer].enabled) continue
      const path = base + "-" + layer + ".nkc"
      const header = JSON.stringify({layer: layer, codec: layer === "mic" ? "aac" : "hevc", id: manifest.id})
      if (native.recordLayer(layer, path, header) === 0) manifest.deviceFiles[layer] = path
      else this.log("Couldn't write " + path)
    }
    if (this.recComposite) {
      const path = base + "-composite.mp4"
      const blend = this.compositeBlend === "additive" ? 1 : 0
      const r = native.startComposite(
        path,
        this.settings.ar.enabled ? 1 : 0,
        blend,
        this.compositeAlpha,
        1280,
        960,
        0,
        0
      )
      if (r === 0) {
        manifest.deviceFiles.composite = path
        manifest.composite = {
          file: path,
          withAr: this.settings.ar.enabled,
          blend: this.compositeBlend,
          alpha: this.compositeAlpha
        }
      } else this.log("SpecsCapture composite failed to start (" + r + ")")
    }
  }

  private stopDeviceFiles(): void {
    const native = this.native as NDKCaptureNativeExports
    for (const layer of NATIVE_LAYERS) native.recordLayer(layer, "", "")
    if (this.recComposite) native.stopComposite()
  }

  // ---------- proxies (JPEG frames for every visual layer)

  private pumpProxy(layer: LayerId, now: number): void {
    const s = this.settings[layer]
    if (!s.enabled || s.proxyFps <= 0 || this.proxyBusy[layer] || now < this.proxiesFrom) return
    if (now < (this.nextProxyAt[layer] || 0)) return
    this.nextProxyAt[layer] = now + 1 / s.proxyFps
    if (layer === "camera" && this.native) {
      if (!this.nativeProxy) return
      const frame = this.native.proxyFrame()
      if (!frame) return
      const colon = frame.indexOf(":")
      this.emitFrame("camera", frame.substring(colon + 1))
      return
    }
    const texture = layer === "camera" ? this.cameraTexture : layer === "ar" ? this.arTexture : this.uiTexture
    if (!texture) return
    this.proxyBusy[layer] = true
    Base64.encodeTextureAsync(
      texture,
      (encoded: string) => {
        this.proxyBusy[layer] = false
        this.emitFrame(layer, encoded)
      },
      () => {
        this.proxyBusy[layer] = false
      },
      CompressionQuality.LowQuality,
      EncodingType.Jpg
    )
  }

  private emitFrame(layer: LayerId, base64: string): void {
    this.send({type: "frame", layer: layer, t: Math.round(this.sessionMs()), codec: "jpeg", data: base64})
  }

  private requestEditorCamera(): Texture | null {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports -- Lens Studio module import
      const cameraModule = require("LensStudio:CameraModule") as CameraModule
      const request = CameraModule.createCameraRequest()
      request.cameraId = CameraModule.CameraId.Default_Color
      return cameraModule.requestCamera(request)
    } catch (e) {
      this.log("Editor camera unavailable: " + e)
      return null
    }
  }

  // ---------- Studio

  private onCommand(command: StudioCommand): void {
    const args = command.args || {}
    switch (command.action) {
      case "setLayer": {
        const layer = args.layer as LayerId
        if (ALL_LAYERS.indexOf(layer) < 0) return
        this.setLayer(layer, sanitizeSettings((args.set as {[key: string]: unknown}) || {}))
        break
      }
      case "startStream":
        this.startStream()
        break
      case "stopStream":
        this.stopStream()
        break
      case "startRecording":
        this.startRecording(typeof args.name === "string" ? args.name : undefined)
        break
      case "stopRecording":
        this.stopRecording()
        break
      case "marker":
        this.addMarker(typeof args.label === "string" ? args.label : "Marker")
        break
      case "keyFrame":
        if (this.native) for (const layer of NATIVE_LAYERS) this.native.layerAction(layer, 0, 0)
        break
    }
  }

  private helloMessage(): LensMessage {
    // The Studio gets the current settings right after the hello.
    if (this.settingsEvent) this.settingsEvent.reset(0)
    return {
      type: "hello",
      lens: "NDK Capture",
      device: this.native ? "specs" : "editor",
      ndk: this.native ? this.native.version() : "editor",
      version: PACKAGE_VERSION,
      layers: ALL_LAYERS.filter((l) => this.settings[l].enabled)
    }
  }

  private sendSettings(): void {
    this.send({type: "settings", layers: this.settings})
  }

  private send(message: LensMessage): boolean {
    return !!this.link && this.link.send(message)
  }

  // ---------- helpers

  private sessionMs(): number {
    return this.recording ? this.sessionMsFrom(this.recordStartedAt) : getTime() * 1000
  }

  private sessionMsFrom(start: number): number {
    return (getTime() - start) * 1000
  }

  private setStatus(status: string): void {
    this.status = status
    this.updateStatusText()
    if (this.verbose) this.log(status)
  }

  private updateStatusText(): void {
    if (!this.statusText) return
    const studio = this.studioConnected ? "Studio connected" : "Studio not connected"
    const layers = ALL_LAYERS.filter((l) => this.settings[l].enabled).join(", ")
    this.statusText.text = "NDK Capture · " + this.status + "\n" + studio + "\nLayers: " + layers
  }

  private log(message: string): void {
    print("[NDKCapture] " + message)
  }
}

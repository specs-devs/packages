/**
 * DecartRealtimeRestyle — "distorting reality" via Decart AI. Two modes:
 *
 * 1. mode = "bridge" (default, FAST — needs the companion bridge running):
 *    camera frame → JPEG (Base64.encodeTextureAsync) → WebSocket text frame →
 *    DecartBridge/bridge.py on the Mac → Decart Lucy realtime (WebRTC/LiveKit)
 *    → transformed frames stream back over the same WebSocket → texture.
 *    Continuous video, sub-second latency, ~10 fps each way.
 *    Run the bridge first:  cd DecartBridge && python bridge.py
 *    In the editor use ws://localhost:8765; on device use ws://<mac-ip>:8765.
 *
 * 2. mode = "http" (no companion needed, SLOW):
 *    camera frame → multipart POST https://api.decart.ai/v1/generate/lucy-image-2
 *    → binary PNG response → texture. Decart's synchronous image-edit model
 *    takes ~15–18 s per frame; this is a slideshow, not video.
 *
 * Notes:
 *  - Decart realtime models are WebRTC-only; the Lens runtime has no WebRTC
 *    stack, hence the bridge. The HTTP mode exists as a zero-infra fallback.
 *  - LS 5.23 editor bug: resetting the preview while an HTTP request is in
 *    flight can crash Lens Studio (orphaned response → use-after-free). Hence
 *    autoStart=false, the editor warmup for HTTP mode, and the UI Start/Stop
 *    (runtime prompt edits don't reset the Lens; Inspector edits do).
 *  - Camera + Internet triggers Transparent Permission on Glasses (publishable).
 *
 * 3. target = "device" (native on-device WebRTC via the NDK module):
 *    the Lens drives libDecartWebRTCModule.so (SpecsNDK CoreJs ABI) which owns
 *    the WebRTC session to Decart directly — no Mac, no JPEG hop. Frames come
 *    back via getFrameRGBA() into a ProceduralTexture on the display quad.
 *    The NDK module only resolves ON DEVICE, so `target` auto-picks: editor →
 *    the Mac path (bridge/http), Glasses device → native WebRTC.
 */

import {DecartRequirements} from './DecartRequirements'
import {DecartWebRTCNativeModule, type DecartWebRTCNativeExports} from './DecartWebRTCNativeModule'
import {DecartWebRTCSession} from './DecartWebRTCSession'

const DECART_ENDPOINT = 'https://api.decart.ai/v1/generate/lucy-image-2'
const MULTIPART_BOUNDARY = '----DecartLensBoundary2f8a91c4e7'
const ERROR_RETRY_SECONDS = 1.5
const BRIDGE_RECONNECT_SECONDS = 2.0
const STATS_INTERVAL_SECONDS = 2.0

// Decart realtime (/v1/stream) model → fixed server-side OUTPUT resolution. Realtime
// is 720p-capped; there is no higher realtime model (1080p is async video/image only).
//   'lucy-restyle-2' → 1280×704  (the reality-distort/restyle model — default)
//   'lucy-2.5'       → 1280×720  (true 16:9, the max realtime resolution; general model)
//   'lucy-2.1'       → 1088×624  (lower)
// Switch here to change output resolution/model, then rebuild + redeploy to device.
const NATIVE_MODEL = 'lucy-restyle-2'

// Default style prompt. A well-formed Decart "restyle the entire scene" instruction
// (concrete visual traits + preserve subjects/layout/motion) — this is the Zombie preset,
// mirrored by the first button in DecartControlsUI. Vague prompts (e.g. "everyone has long
// hair") make the enhancer hallucinate a whole-scene recolor, so keep prompts concrete.
const DEFAULT_PROMPT =
  'Transform the entire scene into a post-apocalyptic zombie wasteland. The final video should show decayed grey-green skin, ashen desaturated color, crumbling debris-strewn surroundings, drifting dust and haze, and dim overcast light, while preserving the original subjects, layout, and motion.'

// Appended to EVERY outgoing prompt (preset, default, or custom) — the restyle model
// tends to redraw faces turned away; this preservation clause keeps head/gaze as filmed.
// The UI text field still shows only the user's prompt; this is added at send time.
const FACING_CLAUSE =
  ' Keep each person facing the camera with a direct gaze toward the viewer, preserving their original head orientation.'

// Uplink (camera → Decart) H.264 bitrate, kbps. The main lever on INPUT sharpness →
// crisper restyle within Decart's FIXED 720p output. 4000 is the proven-smooth
// baseline. To chase quality, try 6000–8000 and watch the on-device `stat/` line:
// if ovfDrop climbs or rx sags, the extra uplink is starving the downlink — back off.
const NATIVE_UPLINK_KBPS = 4000

@component
export class DecartRealtimeRestyle extends BaseScriptComponent {
  @input('string')
  @widget(new ComboBoxWidget([
    new ComboBoxItem('Auto — editor→Mac path, device→native WebRTC', 'auto'),
    new ComboBoxItem('Editor / Mac — bridge or http (see mode)', 'editor'),
    new ComboBoxItem('Device — native on-device WebRTC (NDK)', 'device'),
  ]))
  @hint('Top-level switch. auto = pick by isEditor(): the editor runs the Mac path, a Glasses device runs the native NDK WebRTC path. The native path resolves ONLY on device — forcing "device" in the editor shows a load error.')
  target: string = 'auto'

  @input('string')
  @widget(new ComboBoxWidget([
    new ComboBoxItem('Realtime via Mac bridge (fast)', 'bridge'),
    new ComboBoxItem('Cloud HTTP lucy-image-2 (~16s/frame)', 'http'),
  ]))
  @hint('bridge = live video through DecartBridge/bridge.py (run it first). http = direct slow image API, no companion needed')
  mode: string = 'bridge'

  @input('string')
  @hint('WebSocket URL of the bridge. Editor: ws://localhost:8765 — Glasses device: ws://<your-mac-LAN-ip>:8765')
  bridgeUrl: string = 'ws://localhost:8765'

  @input('number', '10')
  @hint('Camera frames per second sent to the bridge')
  bridgeSendFps: number = 10

  @input('string')
  @hint('DEVICE path only: Decart realtime WebRTC signaling endpoint (native NDK module). api_key + model are appended.')
  nativeEndpoint: string = 'wss://api3.decart.ai/v1/stream'

  @input('string')
  @hint('DEVICE path only: Decart realtime model requested by the native NDK module')
  nativeModel: string = 'lucy-2.5'

  @input('boolean', 'false')
  @hint('DEVICE path only: encode the camera with H.265 (HEVC). Off = H.264 (default — Decart realtime does not support H.265; VP8/H.264 only)')
  nativeUseH265: boolean = false

  @input('number', '30')
  @hint('DEVICE path only: camera encode frame rate')
  nativeFps: number = 30

  @input('number', '6000')
  @hint('DEVICE path only: target video bitrate (kbps)')
  nativeBitrateKbps: number = 6000

  @input('number', '1280')
  @hint('DEVICE path only: max camera capture width')
  nativeMaxWidth: number = 1280

  @input('number', '2500')
  @hint('INACTIVE — this engine has no REMB/receiver-side bitrate control, so there is no way to cap Decart’s downlink from the device. Kept only so old scenes still deserialize; changing it does nothing.')
  nativeDownlinkKbps: number = 2500

  @input('number', '2.09')
  @hint('Display fill — UNIFORM zoom of the head-locked video quad. >1 overscans past the FOV so the feed fills the view and crops at the edges (no letterbox). Aspect is preserved, so no squish. Live-tunable via the in-app Scale slider.')
  displayZoom: number = 2.09

  @input('number', '11')
  @hint('Horizontal offset of the video quad, cm (+ = right). Live-tunable via the in-app X slider.')
  displayOffsetX: number = 11

  @input('number', '7')
  @hint('Vertical offset of the video quad, cm (+ = up). Live-tunable via the in-app Y slider.')
  displayOffsetY: number = 7

  @input('number', '0.15')
  @hint('Depth offset of the video quad, cm (+ = nearer/bigger, − = farther/smaller). 0 = the authored ~110cm distance. Default 0.15 keeps it at that comfortable focus distance (NOT the near clip, which sits on your eyes and causes strain). Live-tunable via the in-app Z slider.')
  displayOffsetZ: number = 0.15

  @input('boolean', 'true')
  @hint('Size the quad to the DECODED frame aspect (e.g. 1280×704 → 1.82:1) so the video is never stretched. Off = keep the authored quad aspect.')
  matchAspect: boolean = true

  @input('string')
  @hint('Decart API key — x-api-key header (http mode / on-device WebRTC; the bridge has its own key). Falls back to the DecartRequirements script.')
  apiKey: string = 'PASTE_YOUR_DECART_API_KEY'

  @input('string')
  @hint('Style prompt applied to the camera feed — editable at runtime via the UI text field')
  prompt: string = DEFAULT_PROMPT

  @input('string')
  @widget(new ComboBoxWidget([
    new ComboBoxItem('480p', '480p'),
    new ComboBoxItem('720p', '720p'),
  ]))
  @hint('Decart output resolution (http mode) — 480p is lower latency')
  resolution: string = '480p'

  @input('number', '1234')
  @hint('Fixed seed keeps frame-to-frame style coherent in http mode (0–4294967295)')
  seed: number = 1234

  @input('boolean', 'true')
  @hint('Let Decart expand the prompt server-side')
  enhancePrompt: boolean = true

  @input('boolean', 'false')
  @hint('Start automatically once the camera is ready. Off = wait for startLoop() (the UI Start button) — safest in the editor')
  autoStart: boolean = false

  @input
  @hint('World-space quad that displays the Decart-transformed feed')
  targetImage: Image

  @input
  @allowUndefined
  @hint('Optional status readout (latency / errors)')
  statusText: Text

  @input('number', '3')
  @hint('Seconds to wait after camera-ready before the first http request')
  startDelaySeconds: number = 3

  @input('number', '40')
  @hint('EDITOR ONLY extra first-request delay for http autoStart — dodges the launch-time reset storm that can crash LS 5.23 mid-request. Ignored on device and in bridge mode')
  editorWarmupSeconds: number = 40

  private cameraModule: CameraModule = require('LensStudio:CameraModule')
  private internetModule: InternetModule = require('LensStudio:InternetModule')

  private cameraTexture: Texture
  private cameraProvider: CameraTextureProvider
  private frameRegistration: EventRegistration | null = null
  private retryEvent: DelayedCallbackEvent
  private reconnectEvent: DelayedCallbackEvent
  private displayMaterial: Material

  // Authored display-quad scale + position, captured in start(); the quad is then
  // sized to (video aspect × displayZoom) and offset by displayOffsetX/Y — see
  // applyDisplayTransform(). curAspect tracks the latest decoded frame's aspect so
  // the slider setters can re-apply size without waiting for a new frame.
  private baseQuadW = 1
  private baseQuadH = 1
  private baseQuadZ = 1
  private baseQuadPos: vec3 = vec3.zero()
  private curAspect = 16 / 9
  private displayReady = false

  private cameraReady = false
  private running = false
  private inFlight = false
  private frameCount = 0

  // bridge-mode state
  private ws: WebSocket | null = null
  private wsOpen = false
  private encodeInFlight = false
  private decodeInFlight = false
  private pendingFrameB64: string | null = null
  private timeSinceSend = 0
  private statsClock = 0
  private sentCount = 0
  private recvCount = 0

  // ── native (device / NDK) WebRTC path state ──
  @DecartWebRTCNativeModule()
  private nativeExports: DecartWebRTCNativeExports | null = null
  private ndkSession: DecartWebRTCSession | null = null
  private useNative = false
  private ndkReady = false
  private ndkProcTex: Texture | null = null
  private ndkProcProvider: any = null
  private ndkRgbaBuf: Uint8Array | null = null
  private ndkKeyframeClock = 0

  onAwake(): void {
    // ComboBoxItem is (label, value). Older scenes and prefabs stored the label text
    // (e.g. "Realtime via Mac bridge (fast)"); map those back to the option keys.
    const legacyTarget: Record<string, string> = {Auto: 'auto', Editor: 'editor', Device: 'device'}
    const legacyMode: Record<string, string> = {Realtime: 'bridge', Cloud: 'http'}
    this.target = legacyTarget[this.target.split(' ')[0]] || this.target
    this.mode = legacyMode[this.mode.split(' ')[0]] || this.mode
    // Default-prompt migration: a saved scene may still carry an OLD default; move it
    // forward to the current default without clobbering a genuinely custom prompt.
    if (
      !this.prompt ||
      this.prompt === 'turn the world into a vivid watercolor painting' ||
      this.prompt === 'turn the view into a zombie apocalypse' ||
      this.prompt === 'everyone has long hair'
    ) {
      this.prompt = DEFAULT_PROMPT
    }
    this.retryEvent = this.createEvent('DelayedCallbackEvent')
    this.retryEvent.bind(() => this.dispatchFrame())
    this.reconnectEvent = this.createEvent('DelayedCallbackEvent')
    this.reconnectEvent.bind(() => {
      if (this.running && this.mode === 'bridge') {
        this.openBridge()
      }
    })
    this.createEvent('UpdateEvent').bind(() => this.onUpdate())
    // createCameraRequest must NOT run in onAwake — bind to OnStartEvent.
    this.createEvent('OnStartEvent').bind(() => this.start())
    this.createEvent('OnDestroyEvent').bind(() => this.cleanup())
  }

  private start(): void {
    if (isNull(this.targetImage)) {
      print('[Decart] ERROR: targetImage @input is not wired.')
      this.setStatus('ERROR: targetImage input not wired')
      return
    }

    this.useNative = this.resolveUseNative()

    // Clone so runtime texture writes never mutate the shared material asset.
    this.displayMaterial = this.targetImage.mainMaterial.clone()
    this.targetImage.mainMaterial = this.displayMaterial

    // Capture the authored quad size as the baseline, then size the quad to match
    // the video's aspect (no stretch) scaled by displayZoom (fill/crop). The true
    // aspect is applied once the first decoded frame arrives (uploadNativeFrame);
    // until then use 16:9 so the editor/bridge path also looks right.
    const quadSo = this.targetImage.getSceneObject()
    if (quadSo) {
      const t = quadSo.getTransform()
      const s = t.getLocalScale()
      this.baseQuadW = s.x
      this.baseQuadH = s.y
      this.baseQuadZ = s.z
      this.baseQuadPos = t.getLocalPosition()
      this.displayReady = true
      this.applyDisplayTransform() // uses curAspect (16:9 until the first decoded frame)
    }

    if (this.useNative) {
      // Device path: the native NDK module owns camera capture + the WebRTC
      // session, so no TS CameraModule request here.
      this.startNative()
      return
    }

    // ───────── editor / Mac path (bridge + http) ─────────
    if (this.mode === 'http' && this.resolveApiKey().length === 0) {
      this.setStatus('ERROR: Decart apiKey missing — set it on this object or the DecartRequirements script')
      return
    }

    this.setStatus('Starting camera…')

    const request = CameraModule.createCameraRequest()
    request.cameraId = global.deviceInfoSystem.isEditor()
      ? CameraModule.CameraId.Default_Color
      : CameraModule.CameraId.Right_Color
    this.cameraTexture = this.cameraModule.requestCamera(request)
    this.cameraProvider = this.cameraTexture.control as CameraTextureProvider

    // Wait for the first frame before encoding (the texture is blank until
    // then, especially in editor); the kept subscription holds the pipeline warm.
    this.frameRegistration = this.cameraProvider.onNewFrame.add(() => {
      if (!this.cameraReady) {
        this.cameraReady = true
        if (this.mode === 'bridge') {
          if (this.autoStart && !this.running) {
            this.startLoop()
          } else if (!this.running) {
            this.setStatus('Ready — press Start  (bridge: ' + this.bridgeUrl + ')')
          }
          // if already running, the send loop begins now that cameraReady is set
        } else if (this.autoStart) {
          let delay = Math.max(0, this.startDelaySeconds)
          if (global.deviceInfoSystem.isEditor()) {
            delay = Math.max(delay, this.editorWarmupSeconds)
          }
          this.running = true
          this.setStatus('Camera ready — contacting Decart in ' + delay.toFixed(0) + 's…')
          this.retryEvent.reset(delay)
        } else if (this.running) {
          // startLoop() was called before the camera was ready
          const delay = Math.max(0, this.startDelaySeconds)
          this.setStatus('Starting — first frame in ' + delay.toFixed(0) + 's…')
          this.retryEvent.reset(delay)
        } else {
          this.setStatus('Ready — press Start  ("' + this.shortPrompt() + '")')
        }
      }
    })
  }

  // ────────────────────────── native (device / NDK) path ──────────────────────────

  /** True when the on-device native WebRTC path should run (never in the editor). */
  /**
   * Effective Decart key: this object's Inspector value when real, else the
   * DecartRequirements script's. Empty string while nothing is configured
   * (the placeholder never counts); tells DecartRequirements when a key is
   * present so its reminder Text hides itself.
   */
  private resolveApiKey(): string {
    const key = DecartRequirements.isRealKey(this.apiKey)
      ? this.apiKey
      : DecartRequirements.getApiKey('DecartRealtimeRestyle') || ''
    if (key.length > 0) {
      DecartRequirements.markConfigured()
    }
    return key
  }

  private resolveUseNative(): boolean {
    if (this.target === 'device') {
      return true
    }
    if (this.target === 'editor') {
      return false
    }
    return !global.deviceInfoSystem.isEditor() // auto
  }

  private startNative(): void {
    this.setStatus('Loading native WebRTC module…')
    DecartWebRTCNativeModule.load(this, (lib) => this.onNativeLoaded(lib))
  }

  private onNativeLoaded(lib: DecartWebRTCNativeExports | null): void {
    if (!lib || !lib.startSession) {
      this.ndkReady = false
      this.setStatus('Native WebRTC unavailable — the NDK module resolves only on a Glasses device, not in the editor')
      print('[Decart] native module failed to load (expected in the editor)')
      return
    }
    this.ndkReady = true
    this.ndkSession = new DecartWebRTCSession(
      lib,
      this.internetModule,
      'wss://api3.decart.ai/v1/stream', // FORCED clean endpoint (stale scene value had ?model=lucy-2.5 baked in → double model param)
      this.resolveApiKey(),
      NATIVE_MODEL, // resolution/model set by the NATIVE_MODEL constant at the top of this file
      (m) => {
        print('[Decart] ' + m)
        this.setStatus(m)
      }
    )
    print('[Decart] native module loaded, ping=' + lib.ping())
    if (this.running) {
      this.startNativeSession() // Start was pressed before the library finished loading
    } else if (this.autoStart) {
      this.startLoop()
    } else {
      this.setStatus('Ready — press Start  (native WebRTC · ' + NATIVE_MODEL + ')')
    }
  }

  private startNativeSession(): void {
    if (!this.ndkSession) {
      this.setStatus('Native module not ready yet…')
      return
    }
    this.statsClock = 0
    this.recvCount = 0
    this.ndkSession.start(
      this.promptForDecart(this.prompt),
      false, // FORCED H.264 (Decart has no H.265; overrides any stale scene value)
      Math.max(1, Math.floor(this.nativeFps)),
      NATIVE_UPLINK_KBPS, // uplink (camera→Decart) bitrate — the main INPUT-sharpness lever
      Math.max(240, Math.floor(this.nativeMaxWidth))
    )
    this.setStatus('Native session starting…  (' + NATIVE_MODEL + ')')
  }

  private onUpdateNative(): void {
    if (!this.running) {
      return
    }
    if (this.ndkSession) {
      this.ndkSession.pump() // forward native offer/ICE to Decart's signaling socket
    }
    const lib = this.nativeExports
    if (!lib || !lib.pullFrameInto) {
      return
    }
    // Ask Decart for a keyframe only occasionally, as a safety net so any lingering
    // packet-loss corruption self-heals (the HW decoder re-syncs). The native module
    // ALSO requests one reactively when it has to drop a frame, and rate-limits every
    // request to ≤1/s at a single choke point — so this cadence can't stack into an IDR
    // storm. (The old 0.6s cadence flooded the downlink with big intra frames → Wi-Fi
    // packet loss → more corruption → more keyframes, which helped starve the pipeline.)
    this.ndkKeyframeClock += getDeltaTime()
    if (this.ndkKeyframeClock >= 2.5) {
      this.ndkKeyframeClock = 0
      if (lib.requestKeyframe) {
        lib.requestKeyframe()
      }
    }
    // NOTE: no periodic requestDownlinkKbps() here anymore. It mapped to the native
    // encoder (uplink) bitrate, not Decart's downlink — repeating it every 2s only
    // churned the camera encoder. Uplink bitrate is set once in startNativeSession().
    if (!this.ndkRgbaBuf) {
      // Persistent buffer reused every frame — zero per-frame allocation. Sized for up
      // to 1280×768 so a ≥704-tall decoded frame is never silently rejected by
      // pullFrameInto (which requires frameBytes ≤ buffer capacity) and dropped.
      this.ndkRgbaBuf = new Uint8Array(1280 * 768 * 4)
    }
    const info = lib.pullFrameInto(this.ndkRgbaBuf.buffer)
    if (info && info.width > 0) {
      // width 0 = no new decoded frame since last poll → no upload work
      this.uploadNativeFrame(this.ndkRgbaBuf, info.width, info.height)
      this.recvCount++
    }

    this.statsClock += getDeltaTime()
    if (this.statsClock >= STATS_INTERVAL_SECONDS) {
      const fps = (this.recvCount / this.statsClock).toFixed(1)
      const state = lib.getState ? lib.getState() : -1
      this.setStatus('NATIVE ▼' + fps + 'fps  ' + this.stateName(state) + '  "' + this.shortPrompt() + '"')
      this.recvCount = 0
      this.statsClock = 0
    }
  }

  private uploadNativeFrame(buf: Uint8Array, width: number, height: number): void {
    if (!buf || !this.displayMaterial || width <= 0 || height <= 0) {
      return
    }
    const need = width * height * 4
    if (buf.length < need) {
      return
    }

    if (!this.ndkProcTex || this.ndkProcTex.getWidth() !== width || this.ndkProcTex.getHeight() !== height) {
      this.ndkProcTex = ProceduralTextureProvider.createWithFormat(width, height, TextureFormat.RGBA8Unorm)
      this.ndkProcProvider = this.ndkProcTex.control
      this.displayMaterial.mainPass.baseTex = this.ndkProcTex
      // Match the quad to the REAL decoded aspect so the feed is never stretched.
      this.curAspect = width / height
      this.applyDisplayTransform()
    }

    // Native already wrote the buffer vertically flipped for display — upload as-is.
    const rgba = buf.length === need ? buf : buf.subarray(0, need)
    ;(this.ndkProcProvider as ProceduralTextureProvider).setPixels(0, 0, width, height, rgba)
  }

  /**
   * Size + place the head-locked display quad from the current tunables:
   *  • scale  = (baseQuad × displayZoom), width following curAspect when matchAspect
   *             is on (no stretch); displayZoom>1 overscans the FOV → fills + crops.
   *  • position = authored base + (displayOffsetX, displayOffsetY) cm.
   * Safe to call any time; no-ops until start() has captured the baseline.
   */
  private applyDisplayTransform(): void {
    if (!this.displayReady || isNull(this.targetImage)) {
      return
    }
    const quadSo = this.targetImage.getSceneObject()
    if (!quadSo) {
      return
    }
    const t = quadSo.getTransform()
    const h = this.baseQuadH * this.displayZoom
    const w = this.matchAspect ? h * this.curAspect : this.baseQuadW * this.displayZoom
    t.setLocalScale(new vec3(w, h, this.baseQuadZ))
    t.setLocalPosition(
      new vec3(
        this.baseQuadPos.x + this.displayOffsetX,
        this.baseQuadPos.y + this.displayOffsetY,
        this.baseQuadPos.z + this.displayOffsetZ
      )
    )
  }

  /** Live display tuning — driven by the in-app sliders (DecartControlsUI). */
  setDisplayZoom(zoom: number): void {
    this.displayZoom = zoom
    this.applyDisplayTransform()
  }

  setDisplayOffsetX(x: number): void {
    this.displayOffsetX = x
    this.applyDisplayTransform()
  }

  setDisplayOffsetY(y: number): void {
    this.displayOffsetY = y
    this.applyDisplayTransform()
  }

  setDisplayOffsetZ(z: number): void {
    this.displayOffsetZ = z
    this.applyDisplayTransform()
  }

  /** Current display tunables — for the UI to initialise its sliders/labels. */
  getDisplayZoom(): number {
    return this.displayZoom
  }

  getDisplayOffsetX(): number {
    return this.displayOffsetX
  }

  getDisplayOffsetY(): number {
    return this.displayOffsetY
  }

  getDisplayOffsetZ(): number {
    return this.displayOffsetZ
  }

  private stateName(s: number): string {
    switch (s) {
      case 0:
        return 'new'
      case 1:
        return 'connecting'
      case 2:
        return 'connected'
      case 3:
        return 'disconnected'
      case 4:
        return 'failed'
      case 5:
        return 'closed'
      case 6:
        return 'streaming'
      default:
        return '?'
    }
  }

  /** Begin streaming (UI Start button / other scripts). */
  startLoop(): void {
    if (this.running) {
      return
    }
    this.running = true
    print('[Decart] startLoop() target=' + this.target + ' native=' + this.useNative + ' mode=' + this.mode)
    if (this.useNative) {
      if (this.ndkReady) {
        this.startNativeSession()
      } else {
        this.setStatus('Starting — waiting for native module…')
      }
      return
    }
    if (this.mode === 'bridge') {
      this.openBridge()
      return
    }
    if (this.cameraReady) {
      const delay = Math.max(0, this.startDelaySeconds)
      this.setStatus('Starting — first frame in ' + delay.toFixed(0) + 's…')
      this.retryEvent.reset(delay)
    } else {
      this.setStatus('Starting — waiting for camera…')
    }
  }

  /**
   * Stop streaming. In http mode the frame already in flight finishes (fetches
   * cannot be aborted in the Lens runtime) and then no further frames are sent.
   */
  stopLoop(): void {
    if (!this.running) {
      return
    }
    this.running = false
    print('[Decart] stopLoop()')
    if (this.useNative) {
      if (this.ndkSession) {
        this.ndkSession.stop()
      }
      this.setStatus('Stopped (native)')
      return
    }
    this.closeBridge()
    this.setStatus(this.inFlight ? 'Stopping — finishing current frame…' : 'Stopped')
  }

  /** The prompt actually sent to Decart: the user's prompt + the facing-preservation clause. */
  private promptForDecart(base: string): string {
    return base + FACING_CLAUSE
  }

  /** Replace the style prompt; applies live in bridge mode, next frame in http mode. */
  setPrompt(newPrompt: string): void {
    if (!newPrompt || newPrompt.length === 0) {
      return
    }
    this.prompt = newPrompt
    print('[Decart] prompt updated: ' + newPrompt)
    if (this.useNative) {
      if (this.ndkSession) {
        this.ndkSession.setPrompt(this.promptForDecart(newPrompt))
      }
      return
    }
    if (this.wsOpen && this.ws) {
      this.ws.send(JSON.stringify({type: 'prompt', prompt: this.promptForDecart(newPrompt), enhance: this.enhancePrompt}))
    } else if (!this.inFlight) {
      this.setStatus('Prompt: "' + this.shortPrompt() + '"' + (this.running ? '' : ' — press Start'))
    }
  }

  isRunning(): boolean {
    return this.running
  }

  // ────────────────────────── bridge (realtime) mode ──────────────────────────

  private openBridge(): void {
    this.closeBridge()
    this.setStatus('Connecting to bridge ' + this.bridgeUrl + '…')
    try {
      this.ws = this.internetModule.createWebSocket(this.bridgeUrl)
    } catch (e) {
      this.setStatus('Bridge connect failed: ' + String(e) + ' — retrying')
      this.reconnectEvent.reset(BRIDGE_RECONNECT_SECONDS)
      return
    }
    const sock = this.ws
    sock.onopen = () => {
      this.wsOpen = true
      this.sentCount = 0
      this.recvCount = 0
      this.statsClock = 0
      sock.send(JSON.stringify({type: 'prompt', prompt: this.promptForDecart(this.prompt), enhance: this.enhancePrompt}))
      this.setStatus('Bridge connected — streaming…')
      print('[Decart] bridge connected: ' + this.bridgeUrl)
    }
    sock.onmessage = (event: WebSocketMessageEvent) => {
      if (typeof event.data === 'string') {
        this.handleBridgeMessage(event.data)
      }
    }
    sock.onclose = () => {
      this.wsOpen = false
      if (this.running) {
        this.setStatus('Bridge closed — retrying in ' + BRIDGE_RECONNECT_SECONDS + 's (is bridge.py running?)')
        this.reconnectEvent.reset(BRIDGE_RECONNECT_SECONDS)
      }
    }
    sock.onerror = () => {
      print('[Decart] bridge socket error')
    }
  }

  private closeBridge(): void {
    if (this.ws) {
      try {
        this.ws.close()
      } catch (e) {
        // already closed
      }
      this.ws = null
    }
    this.wsOpen = false
  }

  private handleBridgeMessage(raw: string): void {
    let msg: {type?: string; data?: string; message?: string}
    try {
      msg = JSON.parse(raw)
    } catch (e) {
      return
    }
    if (msg.type === 'frame' && msg.data) {
      if (this.decodeInFlight) {
        this.pendingFrameB64 = msg.data // keep only the newest
        return
      }
      this.decodeFrame(msg.data)
    } else if (msg.type === 'status' && msg.message) {
      this.setStatus('[bridge] ' + msg.message)
      print('[Decart] bridge status: ' + msg.message)
    }
  }

  private decodeFrame(b64: string): void {
    this.decodeInFlight = true
    Base64.decodeTextureAsync(
      b64,
      (tex) => {
        this.decodeInFlight = false
        this.displayMaterial.mainPass.baseTex = tex
        this.recvCount++
        if (this.pendingFrameB64) {
          const next = this.pendingFrameB64
          this.pendingFrameB64 = null
          this.decodeFrame(next)
        }
      },
      () => {
        this.decodeInFlight = false
        this.pendingFrameB64 = null
        print('[Decart] bridge frame decode failed')
      }
    )
  }

  private onUpdate(): void {
    if (this.useNative) {
      this.onUpdateNative()
      return
    }
    if (!this.running || this.mode !== 'bridge' || !this.wsOpen || !this.cameraReady) {
      return
    }
    const dt = getDeltaTime()
    this.timeSinceSend += dt
    this.statsClock += dt

    const interval = 1.0 / Math.max(1, this.bridgeSendFps)
    if (this.timeSinceSend >= interval && !this.encodeInFlight) {
      this.timeSinceSend = 0
      this.sendBridgeFrame()
    }

    if (this.statsClock >= STATS_INTERVAL_SECONDS) {
      const up = (this.sentCount / this.statsClock).toFixed(1)
      const down = (this.recvCount / this.statsClock).toFixed(1)
      this.setStatus('LIVE  ▲' + up + 'fps ▼' + down + 'fps  "' + this.shortPrompt() + '"')
      this.sentCount = 0
      this.recvCount = 0
      this.statsClock = 0
    }
  }

  private sendBridgeFrame(): void {
    this.encodeInFlight = true
    Base64.encodeTextureAsync(
      this.cameraTexture,
      (b64) => {
        this.encodeInFlight = false
        if (this.wsOpen && this.ws) {
          // b64 contains no characters needing JSON escaping.
          this.ws.send('{"type":"frame","data":"' + b64 + '"}')
          this.sentCount++
        }
      },
      () => {
        this.encodeInFlight = false
      },
      CompressionQuality.IntermediateQuality,
      EncodingType.Jpg
    )
  }

  // ────────────────────────── http (slow fallback) mode ──────────────────────────

  private dispatchFrame(): void {
    if (this.inFlight || !this.cameraReady || !this.running) {
      return
    }
    this.inFlight = true
    const startedAt = getTime()
    print('[Decart] sending frame ' + (this.frameCount + 1) + ' ("' + this.shortPrompt() + '", ' + this.resolution + ')')

    this.processOneFrame()
      .then(() => {
        this.inFlight = false
        this.frameCount++
        const secs = getTime() - startedAt
        print('[Decart] frame ' + this.frameCount + ' round-trip: ' + secs.toFixed(2) + 's')
        if (this.running) {
          this.setStatus('~' + secs.toFixed(1) + 's/frame  #' + this.frameCount + '  "' + this.shortPrompt() + '"')
          this.dispatchFrame() // continuous loop — next frame immediately
        } else {
          this.setStatus('Stopped  (#' + this.frameCount + ' frames)')
        }
      })
      .catch((err) => {
        this.inFlight = false
        const msg = String(err && (err as Error).message ? (err as Error).message : err)
        print('[Decart] frame failed: ' + msg)
        if (this.running) {
          this.setStatus('Error: ' + msg.substring(0, 140) + ' — retrying in ' + ERROR_RETRY_SECONDS + 's')
          this.retryEvent.reset(ERROR_RETRY_SECONDS) // never tight-loop errors
        } else {
          this.setStatus('Stopped')
        }
      })
  }

  private async processOneFrame(): Promise<void> {
    // 1. Encode the latest camera frame as JPEG (base64), then to raw bytes.
    const jpegBase64 = await this.encodeCameraFrame()
    const jpegBytes = Base64.decode(jpegBase64)

    // 2. Hand-build the multipart/form-data body as one Uint8Array.
    const body = this.buildMultipartBody(jpegBytes)

    // 3. POST to Decart's synchronous image-edit endpoint.
    const response = await this.internetModule.fetch(DECART_ENDPOINT, {
      method: 'POST',
      headers: {
        'x-api-key': this.resolveApiKey(),
        'content-type': 'multipart/form-data; boundary=' + MULTIPART_BOUNDARY,
      },
      body: body,
    })

    if (response.status !== 200) {
      let detail = ''
      try {
        detail = await response.text()
      } catch (e) {
        detail = '<unreadable body>'
      }
      throw new Error('HTTP ' + response.status + ' ' + detail.substring(0, 300))
    }

    // 4. The response body IS the transformed image (binary PNG, no polling).
    const pngBytes = await response.bytes()
    const pngBase64 = Base64.encode(pngBytes)
    const texture = await new Promise<Texture>((resolve, reject) => {
      Base64.decodeTextureAsync(
        pngBase64,
        (tex) => resolve(tex),
        () => reject(new Error('PNG texture decode failed (' + pngBytes.length + ' bytes)'))
      )
    })

    // 5. Show it on the (cloned) display material.
    this.displayMaterial.mainPass.baseTex = texture
  }

  private encodeCameraFrame(): Promise<string> {
    return new Promise((resolve, reject) => {
      Base64.encodeTextureAsync(
        this.cameraTexture,
        (b64) => resolve(b64),
        () => reject(new Error('camera frame JPEG encode failed')),
        CompressionQuality.IntermediateQuality,
        EncodingType.Jpg
      )
    })
  }

  private buildMultipartBody(jpegBytes: Uint8Array): Uint8Array {
    const b = MULTIPART_BOUNDARY
    const seedValue = Math.max(0, Math.min(4294967295, Math.floor(this.seed)))
    const head =
      this.textField(b, 'prompt', this.promptForDecart(this.prompt)) +
      this.textField(b, 'resolution', this.resolution) +
      this.textField(b, 'enhance_prompt', this.enhancePrompt ? 'true' : 'false') +
      this.textField(b, 'seed', seedValue.toString()) +
      '--' + b + '\r\n' +
      'Content-Disposition: form-data; name="data"; filename="frame.jpg"\r\n' +
      'Content-Type: image/jpeg\r\n\r\n'
    const tail = '\r\n--' + b + '--\r\n'

    const headBytes = this.utf8Bytes(head)
    const tailBytes = this.utf8Bytes(tail)
    const out = new Uint8Array(headBytes.length + jpegBytes.length + tailBytes.length)
    out.set(headBytes, 0)
    out.set(jpegBytes, headBytes.length)
    out.set(tailBytes, headBytes.length + jpegBytes.length)
    return out
  }

  private textField(boundary: string, name: string, value: string): string {
    return (
      '--' + boundary + '\r\n' +
      'Content-Disposition: form-data; name="' + name + '"\r\n\r\n' +
      value + '\r\n'
    )
  }

  /** Minimal UTF-8 encoder (no TextEncoder in the Lens runtime). */
  private utf8Bytes(text: string): Uint8Array {
    const out: number[] = []
    for (let i = 0; i < text.length; i++) {
      const c = text.charCodeAt(i)
      if (c < 0x80) {
        out.push(c)
      } else if (c < 0x800) {
        out.push(0xc0 | (c >> 6), 0x80 | (c & 0x3f))
      } else if (c >= 0xd800 && c <= 0xdbff && i + 1 < text.length) {
        const c2 = text.charCodeAt(++i)
        const cp = 0x10000 + ((c & 0x3ff) << 10) + (c2 & 0x3ff)
        out.push(
          0xf0 | (cp >> 18),
          0x80 | ((cp >> 12) & 0x3f),
          0x80 | ((cp >> 6) & 0x3f),
          0x80 | (cp & 0x3f)
        )
      } else {
        out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f))
      }
    }
    return new Uint8Array(out)
  }

  private shortPrompt(): string {
    return this.prompt.length > 40 ? this.prompt.substring(0, 37) + '…' : this.prompt
  }

  private setStatus(message: string): void {
    if (!isNull(this.statusText)) {
      this.statusText.text = message
    }
  }

  private cleanup(): void {
    if (this.useNative) {
      if (this.ndkSession) {
        this.ndkSession.stop()
      }
    }
    this.closeBridge()
    if (this.cameraProvider && this.frameRegistration) {
      this.cameraProvider.onNewFrame.remove(this.frameRegistration)
      this.frameRegistration = null
    }
  }
}

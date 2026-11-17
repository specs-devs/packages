/**
 * SPECS Inc. 2027
 * Captures what the portal needs to rebuild the scene as it looked: mesh geometry (positions, normals,
 * UVs, indices), the first material of each mesh (colour, base texture, culling, blending) and the
 * background texture as a track of small JPEG frames. Everything is stored once and referenced by id.
 */
import {CaptureEntry} from "./CaptureRecorder"
import {firstPacketIsKey, firstPacketNs, jpegSize, NdkCamera} from "./NdkCamera"
import {CaptureAssetsData, CaptureBackground, CaptureMaterial} from "./WebCaptureProtocol"

/** How old the newest video packet is when the Lens polls it (encoder + pipeline), measured on a Specs. */
const VIDEO_PACKET_AGE_NS = 166e6
const MAX_TRIANGLES = 40000
const MAX_VERTICES = 65000
const MAX_TEXTURE_SIDE = 2048
const MAX_BACKGROUND_FRAMES = 600

function bytesOf(array: Float32Array | Uint32Array): Uint8Array {
  return new Uint8Array(array.buffer, array.byteOffset, array.byteLength)
}

function jpegDataUrl(b64: string): string {
  return "data:image/jpeg;base64," + b64
}

export class CaptureAssets {
  private meshIds: {mesh: RenderMesh; id: string}[] = []
  private textureIds: {texture: Texture; id: string}[] = []
  private data: CaptureAssetsData = {meshes: {}, textures: {}}
  private pending = 0
  private waiters: (() => void)[] = []

  constructor(
    private captureGeometry: boolean,
    private log: (message: string) => void
  ) {}

  reset(): void {
    this.meshIds = []
    this.textureIds = []
    this.data = {meshes: {}, textures: {}}
  }

  /** Adds geometry and material info to the entries' descriptions (call right before a recording starts). */
  collect(entries: CaptureEntry[]): void {
    if (!this.captureGeometry) return
    for (const e of entries) {
      try {
        const visual = e.object.getComponent("Component.RenderMeshVisual")
        if (!visual || !visual.mesh) {
          // A placeholder shape (WebCaptureTarget "box" etc.) on an object whose real visuals are its children:
          // keep only the transform, or the portal would draw the placeholder over the real meshes.
          if (e.desc.primitive !== "empty" && e.desc.primitive !== "text" && this.hasMeshDescendant(e.object)) {
            e.desc.primitive = "empty"
          }
          continue
        }
        const meshId = this.addMesh(visual.mesh)
        if (meshId) e.desc.meshId = meshId
        const material = this.describeMaterial(visual)
        if (material) e.desc.materials = [material]
      } catch (err) {
        this.log("Asset capture skipped for " + e.desc.id + ": " + err)
      }
    }
  }

  private hasMeshDescendant(object: SceneObject): boolean {
    for (let i = 0; i < object.getChildrenCount(); i++) {
      const child = object.getChild(i)
      const v = child.getComponent("Component.RenderMeshVisual")
      if ((v && v.mesh) || this.hasMeshDescendant(child)) return true
    }
    return false
  }

  private addMesh(mesh: RenderMesh): string | null {
    const known = this.meshIds.find((m) => m.mesh === mesh)
    if (known) return known.id
    const positions = mesh.getVertexDataForAttribute("position")
    if (!positions || positions.length === 0 || positions.length / 3 > MAX_VERTICES) {
      this.log("Mesh '" + mesh.name + "' skipped (" + (positions ? positions.length / 3 : 0) + " vertices)")
      return null
    }
    const indices = mesh.getIndexBuffer()
    if (indices.length / 3 > MAX_TRIANGLES) {
      this.log("Mesh '" + mesh.name + "' skipped (" + indices.length / 3 + " triangles)")
      return null
    }
    const id = "m" + this.meshIds.length
    const asset: {p: string; n?: string; u?: string; i?: string} = {p: Base64.encode(bytesOf(positions))}
    try {
      const n = mesh.getVertexDataForAttribute("normal")
      if (n && n.length === positions.length) asset.n = Base64.encode(bytesOf(n))
    } catch {
      // no normals: the portal computes them
    }
    try {
      const u = mesh.getVertexDataForAttribute("texture0")
      if (u && (u.length / 2) * 3 === positions.length) asset.u = Base64.encode(bytesOf(u))
    } catch {
      // no UVs
    }
    asset.i = Base64.encode(bytesOf(Uint32Array.from(indices as ArrayLike<number>)))
    this.data.meshes[id] = asset
    this.meshIds.push({mesh: mesh, id: id})
    return id
  }

  private describeMaterial(visual: RenderMeshVisual): CaptureMaterial | null {
    const material = visual.mainMaterial
    if (!material) return null
    const pass = material.mainPass
    const out: CaptureMaterial = {}
    try {
      out.twoSided = !!pass.twoSided
    } catch {
      // not exposed by this material
    }
    try {
      // BlendMode.Disabled is 0 in every Lens Studio version; any blending means a see-through material.
      if (pass.blendMode !== undefined && pass.blendMode !== 0) out.alpha = "blend"
    } catch {
      // opaque
    }
    try {
      const tex = pass.baseTex as Texture
      if (tex) {
        const id = this.addTexture(tex)
        if (id) out.tex = id
      }
    } catch {
      // no base texture
    }
    return out
  }

  private addTexture(texture: Texture): string | null {
    const known = this.textureIds.find((t) => t.texture === texture)
    if (known) return known.id
    if (texture.getWidth() > MAX_TEXTURE_SIDE || texture.getHeight() > MAX_TEXTURE_SIDE) {
      this.log("Texture '" + texture.name + "' skipped (too large)")
      return null
    }
    const id = "t" + this.textureIds.length
    this.textureIds.push({texture: texture, id: id})
    this.pending++
    Base64.encodeTextureAsync(
      texture,
      (b64) => {
        this.data.textures[id] = jpegDataUrl(b64)
        this.done()
      },
      () => {
        this.log("Texture '" + texture.name + "' could not be encoded")
        this.done()
      },
      CompressionQuality.IntermediateQuality,
      EncodingType.Jpg
    )
    return id
  }

  private done(): void {
    this.pending = Math.max(0, this.pending - 1)
    if (this.pending === 0) {
      const waiters = this.waiters
      this.waiters = []
      for (const w of waiters) w()
    }
  }

  /** Resolves once every texture started so far is encoded. */
  whenReady(): Promise<void> {
    if (this.pending === 0) return Promise.resolve()
    return new Promise<void>((resolve) => this.waiters.push(resolve))
  }

  result(): CaptureAssetsData | null {
    const hasMesh = Object.keys(this.data.meshes).length > 0
    const hasTexture = Object.keys(this.data.textures).length > 0
    return hasMesh || hasTexture ? this.data : null
  }
}

/** Records a texture (the Preview background, or the camera on Specs) as a track of JPEG frames. */
export class BackgroundRecorder {
  private frames: string[] = []
  private times: number[] = []
  private inFlight = false
  private lastRequest = -1e9
  private active = false
  private start = 0
  private lastB64 = ""

  private ndk: NdkCamera | null = null
  private ndkStart = 0
  private width = 0
  private height = 0

  constructor(
    private texture: Texture | null,
    private fps: number,
    private quality: CompressionQuality,
    private log: (message: string) => void
  ) {}

  /** Use the NDK camera (Specs) instead of the texture. Call before begin(). */
  useNdk(camera: NdkCamera, maxWidth: number, jpegQuality: number, fps: number, keepWarm: boolean = false): void {
    this.ndk = camera
    this.keepWarm = keepWarm
    this.ndkWidth = maxWidth
    this.ndkQuality = jpegQuality
    this.ndkFps = fps
  }
  private ndkFps = 15
  private keepWarm = false
  private warmRunning = false
  private ndkWidth = 1280
  private ndkQuality = 80

  private videoFps = 0
  private videoBitrate = 0
  private videoBatches: string[] = []
  private videoStartNs = 0
  private videoMinDeltaNs = Number.MAX_VALUE

  /** Use the NDK H.265 camera layer instead of JPEG frames. Call before begin(). */
  useNdkVideo(camera: NdkCamera, fps: number, bitrate: number, keepWarm: boolean = false): void {
    this.ndk = camera
    this.videoFps = fps
    this.videoBitrate = bitrate
    this.keepWarm = keepWarm
  }

  // Reference AR layer (rendered by the system from the camera's viewpoint): ground truth for the alignment. Opt-in.
  private arEye = 0
  private arBatches: string[] = []
  private arRunning = false
  private arBytes = 0

  useArReference(eye: number): void {
    this.arEye = eye
  }

  private pollAr(): void {
    if (!this.ndk || !this.arRunning) return
    for (let n = 0; n < 4; n++) {
      const batch = this.ndk.pollAr(192 * 1024)
      if (!batch) break
      if (this.arBytes + batch.length < 24 * 1024 * 1024) {
        this.arBatches.push(batch)
        this.arBytes += batch.length
      }
    }
  }

  // Warm H.265 stream: while idle the packets are kept from the newest keyframe on, and handed to the next capture,
  // so it starts with real camera frames instead of waiting ~0.8 s for the encoder.
  private preRoll: string[] = []
  private warmSince = 0
  private lastWarmRestartAt = -1e9
  private warmRestarts = 0
  private statsAt = 0

  /** One log line with the native camera layer counters, to see what the stream is doing. */
  private logCameraStats(tag: string): void {
    if (!this.ndk) return
    const raw = this.ndk.layerStats()
    if (!raw) return
    try {
      const c = (JSON.parse(raw) as {layers: {camera: {frames: number; queued: number; dropped: number; running: boolean; streaming: boolean; error: string}}}).layers.camera
      this.log("Camera layer (" + tag + "): frames " + c.frames + ", queued " + c.queued + ", dropped " + c.dropped + (c.running ? ", running" : ", NOT running") + (c.streaming ? "" : ", not streaming") + (c.error ? ", error: " + c.error : ""))
    } catch (e) {
      // stats are only a diagnostic
    }
  }
  private lastWarmBatchAt = 0
  private warmVideoRunning = false

  /**
   * The video packets are stamped on a different clock than the poses (a fixed offset of a few seconds). Every poll,
   * (now - packet time) = clock offset + the packet's age; its minimum over the capture is the offset plus the
   * smallest latency, which is what the portal needs to put frames on the pose timeline.
   */
  private lastVideoBatchAt = 0
  private videoRestarts = 0

  private takeVideoBatch(batch: string, nowSeconds: number): void {
    this.lastVideoBatchAt = nowSeconds
    this.lastWarmBatchAt = nowSeconds
    this.videoBatches.push(batch)
    const ts = firstPacketNs(batch)
    if (ts > 0) this.videoMinDeltaNs = Math.min(this.videoMinDeltaNs, nowSeconds * 1e9 - ts)
  }

  /** After Stop: keep polling a moment so the encoder's last frames (it buffers about a second) are not lost. */
  async flushVideo(now: () => number, wait: (seconds: number) => Promise<void>): Promise<void> {
    if (!this.ndk || this.videoFps <= 0 || !this.active) return
    let quiet = 0
    for (let n = 0; n < 24 && quiet < 4; n++) {
      let got = false
      for (let k = 0; k < 6; k++) {
        const batch = this.ndk.pollVideo(192 * 1024)
        if (!batch) break
        got = true
        this.takeVideoBatch(batch, now())
      }
      quiet = got ? 0 : quiet + 1
      await wait(0.1)
    }
  }

  /** Starts the NDK camera now and leaves it running between captures (no start-up wait on Start Capture). */
  warm(): void {
    if (this.ndk && this.videoFps > 0) {
      if (!this.warmVideoRunning) {
        this.warmVideoRunning = this.ndk.startVideo(this.videoFps, this.videoBitrate, this.log)
      }
      return
    }
    if (!this.ndk || this.warmRunning) return
    this.warmRunning = this.ndk.start(this.ndkWidth, this.ndkQuality, this.ndkFps)
    if (!this.warmRunning) this.log("NDK camera proxy could not warm up")
  }

  /** While idle, throw away frames the warm camera produced so none are queued when a capture starts. */
  drain(now: number): void {
    if (!this.ndk || this.active) return
    if (this.warmVideoRunning) {
      if (this.warmSince === 0) {
        this.warmSince = now
        this.lastWarmBatchAt = now
      }
      // A warm camera stream that goes quiet (seen on the glasses: it stopped delivering while the Lens sat idle, so
      // the next capture had no video) is restarted here, so it is alive when Start Capture is pressed.
      // At most two idle restarts: on a device whose camera service stops after a burst, more restarts only churn
      // pipelines. Start Capture opens a fresh stream anyway.
      if (now - this.lastWarmBatchAt > 6 && now - this.lastWarmRestartAt > 10 && this.warmRestarts < 2) {
        this.warmRestarts++
        this.lastWarmRestartAt = now
        this.logCameraStats("idle, quiet")
        this.log("Warm camera stream went quiet: restarting it")
        this.ndk.stopVideo()
        this.warmVideoRunning = this.ndk.startVideo(this.videoFps, this.videoBitrate, this.log)
        this.preRoll = []
        this.lastWarmBatchAt = now
        return
      }
      for (let n = 0; n < 6; n++) {
        const batch = this.ndk.pollVideo(192 * 1024)
        if (!batch) break
        this.lastWarmBatchAt = now
        // A batch that starts with a keyframe restarts the buffer: only the latest GOP is worth keeping.
        if (firstPacketIsKey(batch)) this.preRoll = [batch]
        else if (this.preRoll.length > 0 && this.preRoll.length < 90) this.preRoll.push(batch)
      }
      return
    }
    if (this.warmRunning) this.ndk.poll()
  }

  begin(now: number): void {
    this.frames = []
    this.times = []
    this.inFlight = false
    this.lastRequest = -1e9
    this.lastB64 = ""
    this.start = now
    this.width = 0
    this.height = 0
    this.videoBatches = []
    this.videoMinDeltaNs = Number.MAX_VALUE
    this.arBatches = []
    this.arBytes = 0
    this.lastVideoBatchAt = now
    this.videoRestarts = 0
    if (this.ndk && this.videoFps > 0 && this.arEye > 0 && !this.arRunning) {
      this.arRunning = this.ndk.startAr(30, 2000000, this.arEye, this.log)
    }
    if (this.ndk && this.videoFps > 0) {
      this.videoStartNs = Math.round(now * 1e9)
      if (this.warmVideoRunning && now - this.lastWarmBatchAt > 6 && this.warmSince > 0) {
        this.log("Warm camera stream was quiet at Start: opening it fresh")
        this.ndk.stopVideo()
        this.warmVideoRunning = false
        this.preRoll = []
      }
      if (this.warmVideoRunning) {
        this.videoBatches = this.preRoll.slice() // starts at a keyframe, a moment before Start
        this.preRoll = []
        this.active = true
      } else {
        this.active = this.ndk.startVideo(this.videoFps, this.videoBitrate, this.log)
      }
      return
    }
    if (this.ndk) {
      if (this.warmRunning) {
        for (let i = 0; i < 8 && this.ndk.poll(); i++) {
          // drop frames from before this capture
        }
        this.active = true
      } else {
        this.active = this.ndk.start(this.ndkWidth, this.ndkQuality, this.ndkFps)
      }
      this.ndkStart = now // `now` is already the native clock (WebCapture.clock()), shared with the poses
      if (!this.active) this.log("NDK camera proxy could not start")
      return
    }
    this.active = !!this.texture
  }

  /** Call every update while recording. */
  sample(now: number): void {
    if (this.active && this.ndk && this.videoFps > 0) {
      for (let n = 0; n < 6; n++) {
        const batch = this.ndk.pollVideo(192 * 1024)
        if (!batch) break
        this.takeVideoBatch(batch, now)
      }
      // Watchdog: a camera stream that goes quiet (seen once: only the pre-roll arrived, then nothing for the whole
      // capture, so the portal video froze on its first frame) is restarted, up to three times.
      if (now - this.statsAt > 2) {
        this.statsAt = now
        this.logCameraStats("recording " + (now - this.videoStartNs / 1e9).toFixed(1) + " s")
      }
      if (now - this.lastVideoBatchAt > 4 && this.videoRestarts < 2) {
        this.videoRestarts++
        this.lastVideoBatchAt = now
        this.logCameraStats("stalled")
        this.log("Camera video stalled for 4 s: restarting the stream (" + this.videoRestarts + "/2)")
        if (this.arRunning) {
          // Two layers at once is what stalled it (the AR reference is only a debugging aid): drop it for good.
          this.ndk.stopAr()
          this.arRunning = false
          this.arEye = 0
          this.arBatches = []
          this.log("AR reference layer switched off: the camera video matters more")
        }
        this.ndk.stopVideo()
        this.warmVideoRunning = this.ndk.startVideo(this.videoFps, this.videoBitrate, this.log)
        this.active = this.warmVideoRunning
      }
      this.pollAr()
      return
    }
    if (this.active && this.ndk) {
      // Drain what the native proxy produced since the last update; stamp with the camera clock.
      for (let n = 0; n < 4; n++) {
        const frame = this.ndk.poll()
        if (!frame) break
        if (this.frames.length >= MAX_BACKGROUND_FRAMES) break
        if (!this.width) {
          const size = jpegSize(frame.b64)
          if (size) {
            this.width = size.width
            this.height = size.height
          }
        }
        this.times.push(Math.max(0, Math.round((frame.t - this.ndkStart) * 1000) / 1000))
        this.frames.push(jpegDataUrl(frame.b64))
      }
      return
    }
    if (!this.active || !this.texture || this.inFlight) return
    if (now - this.lastRequest < 1 / Math.max(1, this.fps)) return
    if (this.frames.length >= MAX_BACKGROUND_FRAMES) return
    this.lastRequest = now
    this.inFlight = true
    const t = Math.round((now - this.start) * 1000) / 1000
    Base64.encodeTextureAsync(
      this.texture,
      (b64) => {
        // Keep only frames that differ from the previous one: a still background (the editor's) costs one frame.
        if (b64 !== this.lastB64) {
          this.times.push(t)
          this.frames.push(jpegDataUrl(b64))
          this.lastB64 = b64
        }
        this.inFlight = false
      },
      () => {
        this.log("Background frame could not be encoded")
        this.inFlight = false
      },
      this.quality,
      EncodingType.Jpg
    )
  }

  /** Stops and returns the track (null when nothing was captured). */
  finish(): CaptureBackground | null {
    if (this.videoFps > 0 && this.ndk) {
      this.active = false
      for (let n = 0; n < 40; n++) {
        const batch = this.ndk.pollVideo(192 * 1024)
        if (!batch) break
        this.videoBatches.push(batch)
      }
      if (this.arRunning) {
        for (let n = 0; n < 40; n++) {
          const batch = this.ndk.pollAr(192 * 1024)
          if (!batch) break
          this.arBatches.push(batch)
        }
        this.ndk.stopAr()
        this.arRunning = false
      }
      if (!this.keepWarm) {
        this.ndk.stopVideo()
        this.warmVideoRunning = false
      }
      if (this.videoBatches.length === 0) return null
      // Packet clock -> pose clock. The freshest packet is ~166 ms old when polled (measured on a Specs: image motion
      // vs head-pose speed over three captures gave -5.07, -5.16 and -5.14 s against a measured delta of -4.97 s).
      const offsetNs = this.videoMinDeltaNs === Number.MAX_VALUE ? 0 : Math.round(this.videoMinDeltaNs - VIDEO_PACKET_AGE_NS)
      return {
        t: [],
        frames: [],
        source: "ndk-video",
        video: {
          codec: "hevc",
          batches: this.videoBatches,
          startNs: this.videoStartNs,
          fps: this.videoFps,
          offsetNs: offsetNs,
          ar: this.arBatches.length > 0 ? {codec: "hevc", batches: this.arBatches, eye: this.arEye} : undefined
        }
      }
    }
    this.active = false
    if (this.ndk && !this.keepWarm) this.ndk.stop()
    if (this.frames.length === 0) return null
    const out: CaptureBackground = {t: this.times, frames: this.frames}
    if (this.width > 0 && this.height > 0) {
      out.width = this.width
      out.height = this.height
    }
    return out
  }
}

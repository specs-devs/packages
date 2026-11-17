/**
 * SpecsVideoPlayer — plays a video URL on Specs through the SpecsNDK SpecsPlayer
 * (libVideoPlayerModule.so) and shows it on a texture.
 *
 * Backends
 *  - "native"  (device, source = url): the native module decodes the URL (file://, http://,
 *    https://), audio goes to the speaker, RGBA frames are pulled every frame into a
 *    ProceduralTexture (only when a new frame arrived).
 *  - "texture" (Lens Studio editor, source = bundled, or native unavailable): a
 *    VideoTextureProvider drives play / pause / seek / volume / loop. In the editor a URL
 *    source is loaded through RemoteMediaModule when `remoteMediaModule` and
 *    `internetModule` are assigned, otherwise the bundled `videoTexture` plays instead.
 *
 * Public API: open(url), play(), pause(), resume(), stop(), seek(t), seekRelative(dt),
 * setVolume(v), setLoop(b), isPlaying(), getCurrentTime(), getDuration(), getMediaInfo(),
 * getState(), getTexture(), getBackend(), getLastError().
 * Events: onStateChanged, onEnded, onError, onDurationChanged, onTextureChanged.
 */
import {
  VideoPlayerFrameInfo,
  VideoPlayerMediaInfo,
  VideoPlayerNativeExports,
  VideoPlayerNativeModule,
  VideoPlayerState,
} from "./VideoPlayerNativeModule"

export { VideoPlayerState } from "./VideoPlayerNativeModule"
export type { VideoPlayerMediaInfo } from "./VideoPlayerNativeModule"

export type VideoPlayerBackend = "none" | "native" | "texture"

/** Minimal synchronous event: add(cb) returns an unsubscribe function. */
export class VideoPlayerEvent<T> {
  private callbacks: ((arg: T) => void)[] = []

  add(cb: (arg: T) => void): () => void {
    this.callbacks.push(cb)
    return () => this.remove(cb)
  }

  remove(cb: (arg: T) => void): void {
    this.callbacks = this.callbacks.filter((c) => c !== cb)
  }

  invoke(arg: T): void {
    for (const cb of this.callbacks.slice()) {
      try {
        cb(arg)
      } catch (e) {
        print("[SpecsVideoPlayer] event listener threw: " + e)
      }
    }
  }
}

export const VIDEO_PLAYER_STATE_NAMES: Record<number, string> = {
  [VideoPlayerState.Idle]: "Idle",
  [VideoPlayerState.Opening]: "Loading",
  [VideoPlayerState.Buffering]: "Buffering",
  [VideoPlayerState.Playing]: "Playing",
  [VideoPlayerState.Paused]: "Paused",
  [VideoPlayerState.Stopped]: "Stopped",
  [VideoPlayerState.Ended]: "Ended",
  [VideoPlayerState.Error]: "Error",
}

const EMPTY_MEDIA_INFO: VideoPlayerMediaInfo = {
  available: false,
  hasVideo: false,
  hasAudio: false,
  width: 0,
  height: 0,
  framerate: 0,
  videoCodec: "",
  audioCodec: "",
  sampleRate: 0,
  channels: 0,
}

@component
export class SpecsVideoPlayer extends BaseScriptComponent {
  @ui.label(
    '<span style="color: #60A5FA;">SpecsVideoPlayer – SpecsNDK video player</span><br/><span style="color: #94A3B8; font-size: 11px;">URL playback runs natively on Specs (file:// or http(s)://). In Lens Studio Preview the VideoTexture fallback plays instead.</span>'
  )
  @ui.separator

  // ── Source ──────────────────────────────────────────────────────────────
  @ui.group_start("Source")
  @input("string", "url")
  @hint("url: play the URL (native on device). bundled: play the VideoTexture everywhere.")
  @widget(new ComboBoxWidget([new ComboBoxItem("URL", "url"), new ComboBoxItem("Bundled VideoTexture", "bundled")]))
  source: string = "url"

  @input
  @hint("Media URL: file:///absolute/path.mp4, http:// or https://. Needs the INTERNET permission (embedded in the module).")
  url: string = ""

  @input
  @allowUndefined
  @hint("Bundled VideoTexture. Played when source = bundled, and used as the editor fallback for a URL source.")
  videoTexture: Texture

  @input
  @hint("Start playing as soon as the media is ready")
  autoPlay: boolean = true

  @input
  @hint("Loop at end of stream")
  loop: boolean = false

  @input("number", "1.0")
  @hint("Initial volume (0 – 1)")
  @widget(new SliderWidget(0, 1, 0.05))
  volume: number = 1.0
  @ui.group_end

  // ── Display ─────────────────────────────────────────────────────────────
  @ui.separator
  @ui.group_start("Display")
  @input
  @allowUndefined
  @hint("Optional Image / RenderMeshVisual whose main material receives the video texture")
  displayVisual: MaterialMeshVisual

  @input
  @allowUndefined
  @hint("Optional material that receives the video texture (in addition to displayVisual)")
  displayMaterial: Material

  @input
  @hint("Material texture parameter to write (Unlit / Image materials use baseTex)")
  textureParameter: string = "baseTex"

  @input("int", "1280")
  @hint("Max width of the RGBA frames copied from native (larger videos are scaled down, aspect kept)")
  maxFrameWidth: number = 1280

  @input("int", "720")
  @hint("Max height of the RGBA frames copied from native")
  maxFrameHeight: number = 720
  @ui.group_end

  // ── Backend ─────────────────────────────────────────────────────────────
  @ui.separator
  @ui.group_start("Backend")
  @input("string", "auto")
  @hint("auto: native on device, VideoTexture in the editor. native / videoTexture force one backend.")
  @widget(
    new ComboBoxWidget([
      new ComboBoxItem("Auto", "auto"),
      new ComboBoxItem("Native (device)", "native"),
      new ComboBoxItem("VideoTexture", "videoTexture"),
    ])
  )
  backend: string = "auto"

  @input
  @allowUndefined
  @hint("Optional: lets the VideoTexture backend stream a URL source (editor Preview) via RemoteMediaModule")
  remoteMediaModule: RemoteMediaModule

  @input
  @allowUndefined
  @hint("Optional: InternetModule used with remoteMediaModule to make the URL resource")
  internetModule: InternetModule

  @input
  @hint("Print state changes and errors")
  enableLogging: boolean = false
  @ui.group_end

  // ── Events ──────────────────────────────────────────────────────────────
  public readonly onStateChanged = new VideoPlayerEvent<VideoPlayerState>()
  public readonly onEnded = new VideoPlayerEvent<void>()
  public readonly onError = new VideoPlayerEvent<string>()
  public readonly onDurationChanged = new VideoPlayerEvent<number>()
  /** Fires when the displayed texture object changes (new ProceduralTexture size, new VideoTexture). */
  public readonly onTextureChanged = new VideoPlayerEvent<Texture>()

  // ── Native backend ──────────────────────────────────────────────────────
  @VideoPlayerNativeModule()
  private nativeExports: VideoPlayerNativeExports | null = null
  private nativeLoadAttempted = false
  private nativeLoading = false
  private frameBuf: Uint8Array | null = null
  private procTex: Texture | null = null
  private procProvider: ProceduralTextureProvider | null = null

  // ── Texture backend ─────────────────────────────────────────────────────
  private activeVideoTexture: Texture | null = null
  private provider: VideoTextureProvider | null = null
  private providerDoneUnsub: (() => void) | null = null
  private texWantPlaying = false
  private texEnded = false
  private texStopped = false
  private texLoading = false

  // ── Shared state ────────────────────────────────────────────────────────
  private mode: VideoPlayerBackend = "none"
  private state: VideoPlayerState = VideoPlayerState.Idle
  private lastDuration = 0
  private lastError = ""
  private currentUrl = ""
  private pendingOpen: string | null = null
  private loopFlag = false
  private volumeLevel = 1
  private currentTexture: Texture | null = null
  private wasPlayingBeforeDisable = false

  onAwake(): void {
    this.loopFlag = this.loop
    this.volumeLevel = this.clamp01(this.volume)
    this.createEvent("OnStartEvent").bind(() => this.onStart())
    this.createEvent("UpdateEvent").bind(() => this.onUpdate())
    this.createEvent("OnDisableEvent").bind(() => {
      this.wasPlayingBeforeDisable = this.isPlaying()
      if (this.wasPlayingBeforeDisable) this.pause()
    })
    this.createEvent("OnEnableEvent").bind(() => {
      if (this.wasPlayingBeforeDisable) this.resume()
      this.wasPlayingBeforeDisable = false
    })
    this.createEvent("OnDestroyEvent").bind(() => this.shutdown())
  }

  private onStart(): void {
    if (this.source === "bundled") {
      this.useTextureBackend(this.videoTexture ?? null)
      if (this.autoPlay) this.play()
      return
    }
    if (this.url && this.url.length > 0) {
      this.open(this.url)
    }
  }

  // ════════════════════════════════ Public API ═══════════════════════════════

  /** Open a URL (file://, http://, https://). Starts playback when autoPlay is on. */
  public open(url: string): void {
    this.currentUrl = url
    this.lastError = ""
    this.lastDuration = 0
    if (this.shouldUseNative()) {
      if (this.nativeExports) {
        this.openNative(url)
      } else {
        this.pendingOpen = url
        this.setState(VideoPlayerState.Opening)
        this.ensureNativeLoaded()
      }
      return
    }
    this.openWithTextureBackend(url)
  }

  /** Start (or restart after Ended / Stopped) playback. */
  public play(): void {
    if (this.mode === "native" && this.nativeExports) {
      this.nativeExports.play()
      return
    }
    if (this.pendingOpen !== null || this.texLoading) {
      this.autoPlay = true // applied once the media is ready
      return
    }
    if (!this.provider) return
    if (this.texEnded || this.texStopped || this.provider.status === VideoStatus.Stopped) {
      this.provider.play(1)
    } else if (this.provider.status === VideoStatus.Paused) {
      this.provider.resume()
    } else if (this.provider.status !== VideoStatus.Playing) {
      this.provider.play(1)
    }
    this.texWantPlaying = true
    this.texEnded = false
    this.texStopped = false
  }

  public pause(): void {
    if (this.mode === "native" && this.nativeExports) {
      this.nativeExports.pause()
      return
    }
    if (this.pendingOpen !== null || this.texLoading) {
      this.autoPlay = false
      return
    }
    if (this.provider && this.provider.status === VideoStatus.Playing) this.provider.pause()
    this.texWantPlaying = false
  }

  /** Resume from a paused position (same as play()). */
  public resume(): void {
    this.play()
  }

  /** Pause and rewind to the start. */
  public stop(): void {
    if (this.mode === "native" && this.nativeExports) {
      this.nativeExports.stop()
      return
    }
    if (this.provider) {
      if (this.provider.status === VideoStatus.Playing) this.provider.pause()
      this.provider.seek(0)
    }
    this.texWantPlaying = false
    this.texStopped = true
    this.texEnded = false
  }

  public seek(seconds: number): void {
    const d = this.getDuration()
    const t = Math.max(0, d > 0 ? Math.min(seconds, d) : seconds)
    if (this.mode === "native" && this.nativeExports) {
      this.nativeExports.seek(t)
      return
    }
    if (this.provider) {
      this.provider.seek(t)
      if (this.texEnded) {
        this.texEnded = false
        this.texStopped = false
      }
    }
  }

  public seekRelative(delta: number): void {
    this.seek(this.getCurrentTime() + delta)
  }

  public setVolume(volume: number): void {
    this.volumeLevel = this.clamp01(volume)
    if (this.nativeExports) this.nativeExports.setVolume(this.volumeLevel)
    if (this.provider) this.provider.volume = this.volumeLevel
  }

  public getVolume(): number {
    return this.volumeLevel
  }

  public setLoop(loop: boolean): void {
    this.loopFlag = loop
    if (this.nativeExports) this.nativeExports.setLoop(loop)
  }

  public getLoop(): boolean {
    return this.loopFlag
  }

  public isPlaying(): boolean {
    return this.state === VideoPlayerState.Playing || this.state === VideoPlayerState.Buffering
  }

  public getCurrentTime(): number {
    if (this.mode === "native" && this.nativeExports) return this.nativeExports.getPosition()
    if (this.provider) {
      if (this.texEnded) return this.getDuration()
      return Math.max(0, this.provider.currentTime)
    }
    return 0
  }

  public getDuration(): number {
    if (this.mode === "native" && this.nativeExports) return this.nativeExports.getDuration()
    if (this.provider) return Math.max(0, this.provider.totalDuration)
    return 0
  }

  public getMediaInfo(): VideoPlayerMediaInfo {
    if (this.mode === "native" && this.nativeExports) {
      try {
        return JSON.parse(this.nativeExports.getMediaInfo()) as VideoPlayerMediaInfo
      } catch (e) {
        return { ...EMPTY_MEDIA_INFO }
      }
    }
    const tex = this.activeVideoTexture
    if (tex && this.provider) {
      return {
        ...EMPTY_MEDIA_INFO,
        available: this.provider.isPlaybackReady,
        hasVideo: true,
        width: tex.getWidth(),
        height: tex.getHeight(),
      }
    }
    return { ...EMPTY_MEDIA_INFO }
  }

  public getState(): VideoPlayerState {
    return this.state
  }

  public getStateName(): string {
    return VIDEO_PLAYER_STATE_NAMES[this.state] ?? "Unknown"
  }

  public getLastError(): string {
    return this.lastError
  }

  public getBackend(): VideoPlayerBackend {
    return this.mode
  }

  public getCurrentUrl(): string {
    return this.currentUrl
  }

  /** The texture currently showing the video (ProceduralTexture on device, VideoTexture in the editor). */
  public getTexture(): Texture | null {
    return this.currentTexture
  }

  /** Close the media and release the native player. */
  public close(): void {
    if (this.nativeExports) this.nativeExports.close()
    this.detachProvider()
    this.pendingOpen = null
    this.setState(VideoPlayerState.Idle)
  }

  // ══════════════════════════════ Backend selection ══════════════════════════

  private shouldUseNative(): boolean {
    if (this.backend === "videoTexture") return false
    if (this.backend === "native") return !this.nativeLoadFailed()
    return !global.deviceInfoSystem.isEditor() && !this.nativeLoadFailed()
  }

  private nativeLoadFailed(): boolean {
    return this.nativeLoadAttempted && !this.nativeLoading && this.nativeExports == null
  }

  private ensureNativeLoaded(): void {
    if (this.nativeLoadAttempted) return
    this.nativeLoadAttempted = true
    this.nativeLoading = true
    VideoPlayerNativeModule.load(this, (lib) => this.onNativeLoaded(lib))
  }

  private onNativeLoaded(lib: VideoPlayerNativeExports | null): void {
    this.nativeLoading = false
    const pending = this.pendingOpen
    this.pendingOpen = null
    if (!lib || !lib.open) {
      this.log("native module unavailable (expected in the Lens Studio editor) – using the VideoTexture fallback")
      if (pending !== null) this.openWithTextureBackend(pending)
      return
    }
    this.log("native module loaded, ping=" + lib.ping())
    lib.setMaxFrameSize(Math.max(16, this.maxFrameWidth), Math.max(16, this.maxFrameHeight))
    lib.setVolume(this.volumeLevel)
    if (pending !== null) this.openNative(pending)
  }

  private openNative(url: string): void {
    const lib = this.nativeExports
    if (!lib) return
    this.detachProvider()
    this.mode = "native"
    lib.setVolume(this.volumeLevel)
    const r = lib.open(url, this.loopFlag)
    if (r !== 0) {
      this.fail("open failed: " + lib.getLastError())
      return
    }
    if (this.autoPlay) lib.play()
    this.setState(VideoPlayerState.Opening)
  }

  private openWithTextureBackend(url: string): void {
    if (this.source === "url" && url.length > 0 && this.remoteMediaModule && this.internetModule) {
      this.texLoading = true
      this.setState(VideoPlayerState.Opening)
      try {
        const resource = this.internetModule.makeResourceFromUrl(url)
        this.remoteMediaModule.loadResourceAsVideoTexture(
          resource,
          (texture: Texture) => {
            this.texLoading = false
            if (this.currentUrl !== url) return // superseded by a later open()
            this.useTextureBackend(texture)
            if (this.autoPlay) this.play()
          },
          (message: string) => {
            this.texLoading = false
            this.log("RemoteMediaModule failed (" + message + ") – falling back to the bundled VideoTexture")
            this.useBundledFallback()
          }
        )
      } catch (e) {
        this.texLoading = false
        this.log("RemoteMediaModule threw (" + e + ") – falling back to the bundled VideoTexture")
        this.useBundledFallback()
      }
      return
    }
    this.useBundledFallback()
  }

  private useBundledFallback(): void {
    if (!this.videoTexture) {
      this.fail("No playable source: native module unavailable and no videoTexture assigned")
      return
    }
    this.useTextureBackend(this.videoTexture)
    if (this.autoPlay) this.play()
  }

  private useTextureBackend(texture: Texture | null): void {
    this.detachProvider()
    this.mode = "texture"
    if (!texture) {
      this.fail("No videoTexture assigned")
      return
    }
    const provider = texture.control as VideoTextureProvider
    if (!provider || typeof provider.play !== "function") {
      this.fail("videoTexture.control is not a VideoTextureProvider")
      return
    }
    this.activeVideoTexture = texture
    this.provider = provider
    provider.volume = this.volumeLevel
    this.texWantPlaying = false
    this.texEnded = false
    this.texStopped = false
    const onDone = () => {
      if (this.provider !== provider) return
      if (this.loopFlag && this.texWantPlaying) {
        provider.play(1) // restart: looping is handled here so setLoop() works mid-playback
        return
      }
      this.texWantPlaying = false
      this.texEnded = true
    }
    const unsub = provider.onPlaybackDone.add(onDone)
    this.providerDoneUnsub = () => provider.onPlaybackDone.remove(unsub)
    this.setTexture(texture)
    this.setState(VideoPlayerState.Paused)
  }

  private detachProvider(): void {
    if (this.providerDoneUnsub) {
      this.providerDoneUnsub()
      this.providerDoneUnsub = null
    }
    if (this.provider && this.provider.status === VideoStatus.Playing) this.provider.pause()
    this.provider = null
    this.activeVideoTexture = null
  }

  // ══════════════════════════════════ Update ═════════════════════════════════

  private onUpdate(): void {
    if (this.mode === "native") this.updateNative()
    else if (this.mode === "texture") this.updateTexture()
  }

  private updateNative(): void {
    const lib = this.nativeExports
    if (!lib) return
    const s = lib.getState() as VideoPlayerState
    if (s !== this.state) {
      if (s === VideoPlayerState.Error) this.lastError = lib.getLastError()
      this.setState(s)
    }
    const d = lib.getDuration()
    if (d > 0 && Math.abs(d - this.lastDuration) > 0.01) {
      this.lastDuration = d
      this.onDurationChanged.invoke(d)
    }
    this.pullNativeFrame(lib)
  }

  private pullNativeFrame(lib: VideoPlayerNativeExports): void {
    const cap = Math.max(16, this.maxFrameWidth) * Math.max(16, this.maxFrameHeight) * 4
    if (!this.frameBuf || this.frameBuf.length < cap) {
      // Persistent buffer reused every frame (no per-frame allocation).
      this.frameBuf = new Uint8Array(cap)
    }
    let info: VideoPlayerFrameInfo = lib.pullFrameInto(this.frameBuf.buffer)
    if (!info.updated && info.width * info.height * 4 > this.frameBuf.length) {
      this.frameBuf = new Uint8Array(info.width * info.height * 4) // native cap larger than ours
      info = lib.pullFrameInto(this.frameBuf.buffer)
    }
    if (!info.updated || info.width <= 0 || info.height <= 0) return
    const w = info.width
    const h = info.height
    if (!this.procTex || this.procTex.getWidth() !== w || this.procTex.getHeight() !== h) {
      this.procTex = ProceduralTextureProvider.createWithFormat(w, h, TextureFormat.RGBA8Unorm)
      this.procProvider = this.procTex.control as ProceduralTextureProvider
      this.setTexture(this.procTex)
    }
    const need = w * h * 4
    // Native already wrote the frame vertically flipped for setPixels — upload as-is.
    const rgba = this.frameBuf.length === need ? this.frameBuf : this.frameBuf.subarray(0, need)
    this.procProvider?.setPixels(0, 0, w, h, rgba)
  }

  private updateTexture(): void {
    const p = this.provider
    if (!p) {
      if (this.state !== VideoPlayerState.Error && !this.texLoading) this.setState(VideoPlayerState.Idle)
      return
    }
    let s: VideoPlayerState
    if (this.texEnded) s = VideoPlayerState.Ended
    else if (this.texStopped) s = VideoPlayerState.Stopped
    else if (p.status === VideoStatus.Playing) s = VideoPlayerState.Playing
    else if (p.status === VideoStatus.Preparing) s = this.texWantPlaying ? VideoPlayerState.Buffering : VideoPlayerState.Opening
    else if (p.status === VideoStatus.Stopped) s = this.texWantPlaying ? VideoPlayerState.Buffering : VideoPlayerState.Stopped
    else s = VideoPlayerState.Paused
    if (s !== this.state) this.setState(s)
    const d = p.totalDuration
    if (d > 0 && Math.abs(d - this.lastDuration) > 0.01) {
      this.lastDuration = d
      this.onDurationChanged.invoke(d)
    }
  }

  // ══════════════════════════════════ Helpers ════════════════════════════════

  private setState(s: VideoPlayerState): void {
    if (s === this.state) return
    const prev = this.state
    this.state = s
    this.log("state " + (VIDEO_PLAYER_STATE_NAMES[prev] ?? prev) + " -> " + (VIDEO_PLAYER_STATE_NAMES[s] ?? s))
    this.onStateChanged.invoke(s)
    if (s === VideoPlayerState.Ended) this.onEnded.invoke()
    if (s === VideoPlayerState.Error) {
      print("[SpecsVideoPlayer] error: " + this.lastError)
      this.onError.invoke(this.lastError)
    }
  }

  private fail(message: string): void {
    this.lastError = message
    if (this.state === VideoPlayerState.Error) {
      print("[SpecsVideoPlayer] error: " + message)
      this.onError.invoke(message)
      return
    }
    this.setState(VideoPlayerState.Error)
  }

  private setTexture(tex: Texture): void {
    this.currentTexture = tex
    const param = this.textureParameter || "baseTex"
    try {
      if (this.displayVisual && this.displayVisual.mainMaterial) {
        ;(this.displayVisual.mainMaterial.mainPass as any)[param] = tex
      }
      if (this.displayMaterial) {
        ;(this.displayMaterial.mainPass as any)[param] = tex
      }
    } catch (e) {
      print("[SpecsVideoPlayer] could not assign texture to '" + param + "': " + e)
    }
    this.onTextureChanged.invoke(tex)
  }

  private shutdown(): void {
    if (this.nativeExports) this.nativeExports.close()
    this.detachProvider()
  }

  private clamp01(v: number): number {
    return Math.max(0, Math.min(1, v))
  }

  private log(msg: string): void {
    if (this.enableLogging) print("[SpecsVideoPlayer] " + msg)
  }
}

// Preload ThemeService before any UIKit visual to break a circular-import init-order
// crash in the package (Visual.ts imports ThemeService before defining COLORS, and the
// theme chain reads COLORS at module-load). Entering the import cycle via ThemeService
// lets Visual.ts finish defining COLORS first. Must remain the FIRST import.
import "SpectaclesUIKit.lspkg/Scripts/Themes/ThemeService"
/**
 * ExampleVideoPlayer – programmatic video player with transport controls.
 * No prefabs. Assign a VideoTexture in the inspector — full UI is built at runtime.
 * Public API: play(), pause(), resume(), stop(), seek(t), seekRelative(dt),
 *             setVolume(v), setPlaybackRate(r), isPlaying(), getCurrentTime().
 */
import { Button } from "SpectaclesUIKit.lspkg/Scripts/Components/Button/Button"
import { RoundedRectangle } from "SpectaclesUIKit.lspkg/Scripts/Visuals/RoundedRectangle/RoundedRectangle"
import { ElementContent } from "SpectaclesUIKit.lspkg/Scripts/Components/Content/ElementContent"
import { Frame } from "SpectaclesUIKit.lspkg/Scripts/Components/Frame/Frame"
import { FlexItem } from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexItem"
import { FlexLayout } from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexLayout"
import { FlexAlign, FlexDirection, FlexJustify } from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexTypes"
import { Slider } from "SpectaclesUIKit.lspkg/Scripts/Components/Slider/Slider"

import { Logger } from "Utilities.lspkg/Scripts/Utils/Logger"
import { bindStartEvent, bindUpdateEvent } from "SnapDecorators.lspkg/decorators"

const FONT_LIGHT: Font   = requireAsset("../../Fonts/SpecsSans-Light.otf")   as Font
const FONT_REGULAR: Font = requireAsset("../../Fonts/SpecsSans-Regular.otf") as Font
const FONT_MEDIUM: Font  = requireAsset("../../Fonts/SpecsSans-Medium.otf")  as Font
const FONT_BOLD: Font    = requireAsset("../../Fonts/SpecsSans-Bold.otf")    as Font

type FontWeight = "light" | "regular" | "medium" | "bold"

const CONTENT_Z_OFFSET     = 0.08
const LAYOUT_Z_LIFT        = 0.005
const LABEL_EDGE_INSET     = 0.75
const PANEL_CONTENT_Z_LIFT = 0.005
const CONTENT_RO           = 8
const BTN_CONTENT_RO       = 3

const ASPECT_RATIOS: Record<string, number> = {
  "16:9": 9 / 16,
  "4:3":  3 / 4,
  "1:1":  1.0,
}

// Corner-grab resize limits (frame inner size, cm)
const FRAME_MIN_SIZE = new vec2(24, 24)
const FRAME_MAX_SIZE = new vec2(80, 72)

const TRANSPORT_BTN_HEIGHT = 4.0
const TRANSPORT_BTN_GAP    = 1.2

@component
export class ExampleVideoPlayer extends BaseScriptComponent {

  @ui.label('<span style="color: #60A5FA;">ExampleVideoPlayer – programmatic video player</span><br/><span style="color: #94A3B8; font-size: 11px;">No prefabs. Assign a VideoTexture and set duration. API: play(), pause(), resume(), stop(), seek(t), seekRelative(dt), setVolume(v), setPlaybackRate(r), isPlaying(), getCurrentTime().</span>')
  @ui.separator

  // ── Video ──────────────────────────────────────────────────────────────
  @ui.group_start("Video")
  @input
  @hint("Video texture asset to display and control (must have VideoTextureProvider)")
  videoTexture: Texture

  @input("number", "60.0")
  @hint("Total video duration in seconds — drives the seek slider and time display")
  videoDuration: number = 60.0

  @input
  @hint("Start playing automatically when the component initializes")
  autoPlay: boolean = false

  @input("number", "1")
  @hint("Loop count passed to VideoTextureProvider.play() — 0 = infinite")
  loopCount: number = 1
  @ui.group_end

  // ── Controls ───────────────────────────────────────────────────────────
  @ui.separator
  @ui.group_start("Controls")
  @input("number", "5.0")
  @hint("Seconds to seek per forward / rewind button press")
  seekStepSeconds: number = 5.0

  @input
  @hint("Show the volume slider below the transport controls")
  showVolumeSlider: boolean = true

  @input("number", "1.0")
  @hint("Initial volume (0 – 1)")
  initialVolume: number = 1.0

  @input("number", "1.0")
  @hint("Initial playback rate (0.5 = half speed, 2.0 = double speed)")
  initialPlaybackRate: number = 1.0
  @ui.group_end

  // ── Layout ─────────────────────────────────────────────────────────────
  @ui.separator
  @ui.group_start("Layout")
  @input
  @hint(
    "Corner-grab resize behavior. <br><br><b>ON — flex layout:</b> web-style resize. Grabbing a corner changes the frame's inner area per axis; content keeps its 1× scale and the layout reflows to the new size, cropping overflow where a mask exists — like resizing a browser window. <br><br><b>OFF — scaling:</b> grabbing a corner uniformly scales the frame and everything inside it, preserving proportions — like zooming an image."
  )
  flexLayoutResize: boolean = false

  @input("number", "32.0")
  @hint("Panel content area width in cm")
  panelWidth: number = 32.0

  @input("string")
  @hint("Video display aspect ratio — determines the height of the video cell")
  @widget(new ComboBoxWidget([
    new ComboBoxItem("16:9", "16:9"),
    new ComboBoxItem("4:3",  "4:3"),
    new ComboBoxItem("1:1",  "1:1"),
  ]))
  aspectRatio: string = "16:9"

  @input("number", "0")
  @hint("World X position")
  positionX: number = 0

  @input("number", "0")
  @hint("World Y position")
  positionY: number = 0

  @input("number", "-110")
  @hint("Offset from the parent in cm (negative Z = in front)")
  positionZ: number = -110

  @input("number", "1.5")
  @hint("Corner radius of the video display in cm (0 = sharp corners)")
  videoCornerRadius: number = 1.5
  @ui.group_end

  // ── Typography ─────────────────────────────────────────────────────────
  @ui.separator
  @ui.group_start("Typography")
  @input("number", "24")
  @hint("Font size for the current time / duration label")
  timeLabelFontSize: number = 24

  @input("number", "20")
  @hint("Font size for the transport buttons (Play, Pause, Seek back/forward)")
  buttonFontSize: number = 20

  @input("number", "22")
  @hint("Font size for the Volume label and percentage readout")
  volumeLabelFontSize: number = 22
  @ui.group_end

  // ── Logging ────────────────────────────────────────────────────────────
  @ui.separator
  @ui.group_start("Logging")
  @input
  @hint("Enable general logging (play, pause, seek events)")
  enableLogging: boolean = false

  @input
  @hint("Enable lifecycle logging (onAwake, onStart)")
  enableLoggingLifecycle: boolean = false
  @ui.group_end

  // ── Private state ──────────────────────────────────────────────────────
  private provider:         VideoTextureProvider | null = null
  private seekSlider:       Slider | null = null
  private volumeSlider:     Slider | null = null
  private timeText:         Text   | null = null

  private playBtnObj:       SceneObject | null = null
  private pauseBtnObj:      SceneObject | null = null

  // ── Flex-resize reflow refs (populated in buildUI when flexLayoutResize) ──
  private frame:              Frame      | null = null
  private colLayout:          FlexLayout | null = null
  private videoRR:            RoundedRectangle | null = null
  private videoItem:          FlexItem   | null = null
  private timeItem:           FlexItem   | null = null
  private seekItem:           FlexItem   | null = null
  private transportItem:      FlexItem   | null = null
  private transportRowLayout: FlexLayout | null = null
  private transportSlotItems: FlexItem[] = []
  private transportButtons:   Button[]   = []
  private volumeItem:         FlexItem   | null = null
  private volumeColLayout:    FlexLayout | null = null
  private volHeaderItem:      FlexItem   | null = null
  private volSliderItem:      FlexItem   | null = null
  private buildPanelH:        number = 0
  private buildVideoH:        number = 0
  private videoAspect:        number = 0

  private _isPlaying:       boolean = false
  private resumeOnEnable:   boolean = false
  private _currentTime:     number  = 0
  private skipSeekSync:     boolean = false
  private skipVolumeSync:   boolean = false
  private initialized:      boolean = false
  private logger:           Logger

  onAwake(): void {
    this.logger = new Logger("ExampleVideoPlayer", this.enableLogging || this.enableLoggingLifecycle, true)
    if (this.enableLoggingLifecycle) this.logger.debug("LIFECYCLE: onAwake()")
    // The audio comes from the VideoTexture's provider, which keeps playing on its own: pause it
    // with the object and resume it when the object is enabled again.
    this.createEvent("OnDisableEvent").bind(() => {
      this.resumeOnEnable = this._isPlaying
      if (this._isPlaying) this.pause()
    })
    this.createEvent("OnEnableEvent").bind(() => {
      if (this.initialized && this.resumeOnEnable) this.resume()
      this.resumeOnEnable = false
    })
    this.createEvent("OnDestroyEvent").bind(() => this.stop())
  }

  @bindStartEvent
  onStart(): void {
    if (this.enableLoggingLifecycle) this.logger.debug("LIFECYCLE: onStart()")
    this.buildUI()
    this.initProvider()
    if (this.autoPlay) this.play()
    this.initialized = true
  }

  @bindUpdateEvent
  onUpdate(): void {
    if (!this.initialized) return
    this.tickTime()
    this.syncSeekSlider()
    this.syncTimeLabel()
  }

  // ── Provider ──────────────────────────────────────────────────────────────
  private initProvider(): void {
    if (!this.videoTexture) return
    this.provider = this.videoTexture.control as VideoTextureProvider
    if (!this.provider) {
      if (this.enableLogging) this.logger.debug("videoTexture.control is not a VideoTextureProvider")
      return
    }
    this.provider.volume = Math.max(0, Math.min(1, this.initialVolume))
    this.provider.playbackRate = Math.max(0.1, this.initialPlaybackRate)
  }

  // ── Tick ──────────────────────────────────────────────────────────────────
  private tickTime(): void {
    if (!this._isPlaying) return
    this._currentTime += getDeltaTime() * (this.provider?.playbackRate ?? this.initialPlaybackRate)
    if (this.videoDuration > 0 && this._currentTime >= this.videoDuration) {
      if (this.loopCount === 0) {
        this._currentTime = this._currentTime % this.videoDuration
      } else {
        this._currentTime = this.videoDuration
        this._isPlaying = false
        this.syncPlayPauseButtons()
      }
    }
  }

  private syncSeekSlider(): void {
    if (!this.seekSlider || this.videoDuration <= 0) return
    this.skipSeekSync = true
    this.seekSlider.currentValue = Math.min(1, this._currentTime / this.videoDuration)
    this.skipSeekSync = false
  }

  private syncTimeLabel(): void {
    if (!this.timeText) return
    this.timeText.text = this.fmt(this._currentTime) + " / " + this.fmt(this.videoDuration)
  }

  private syncPlayPauseButtons(): void {
    if (this.playBtnObj)  this.playBtnObj.enabled  = !this._isPlaying
    if (this.pauseBtnObj) this.pauseBtnObj.enabled  =  this._isPlaying
  }

  private fmt(s: number): string {
    const t = Math.max(0, Math.floor(s))
    const m = Math.floor(t / 60)
    const sec = t % 60
    return m + ":" + (sec < 10 ? "0" : "") + sec
  }

  // ── UI build ──────────────────────────────────────────────────────────────
  private buildUI(): void {
    const root = this.sceneObject
    // Relative to the parent, so the layout moves with wherever its example is placed.
    root.getTransform().setLocalPosition(new vec3(this.positionX, this.positionY, this.positionZ))

    const pw     = this.panelWidth
    const aspect = ASPECT_RATIOS[this.aspectRatio] ?? (9 / 16)
    const videoH = pw * aspect
    const extraH = this.showVolumeSlider ? 4.5 : 0
    const ph     = videoH + 11.5 + extraH

    // Build-time baselines for reflowToFrameSize() (flex resize mode).
    this.buildPanelH = ph
    this.buildVideoH = videoH
    this.videoAspect = aspect

    const content = this.scenePanel(root, "VideoPlayerPanel", pw, ph)
    const col = this.flexColumn(content, pw, ph, { gap: 0.8, padX: 0.5, padY: 0.5 })
    this.colLayout = col.getComponent(FlexLayout.getTypeName()) as FlexLayout

    // 1. Video display ──────────────────────────────────────────────────
    this.flexChild(col, { w: pw, h: videoH }, (cell) => {
      this.videoItem = cell.getComponent(FlexItem.getTypeName()) as FlexItem
      this.buildVideoCell(cell, pw, videoH)
    })

    // 2. Time label ────────────────────────────────────────────────────
    this.flexChild(col, { w: pw, h: 2.2 }, (cell) => {
      this.timeItem = cell.getComponent(FlexItem.getTypeName()) as FlexItem
      this.timeText = this.dynamicText(
        cell, "Time", "0:00 / " + this.fmt(this.videoDuration),
        this.timeLabelFontSize, new vec3(0, 0, 0.1), new vec4(1, 1, 1, 0.7),
        FONT_REGULAR, HorizontalAlignment.Center
      )
    })

    // 3. Seek slider ───────────────────────────────────────────────────
    this.flexChild(col, { w: pw, h: 2.5 }, (cell) => {
      this.seekItem = cell.getComponent(FlexItem.getTypeName()) as FlexItem
      const s = cell.createComponent(Slider.getTypeName()) as Slider
      s.size = new vec3(pw, 2.2, 1)
      s.initialize()
      s.currentValue = 0
      this.seekSlider = s
      s.onValueChange.add((v: number) => {
        if (this.skipSeekSync) return
        const t = v * this.videoDuration
        this._currentTime = t
        if (this.provider) this.provider.seek(t)
      })
    })

    // 4. Transport controls ────────────────────────────────────────────
    const btnH = TRANSPORT_BTN_HEIGHT
    const btnW = (pw - TRANSPORT_BTN_GAP * 2) / 3
    this.flexChild(col, { w: pw, h: btnH }, (cell) => {
      this.transportItem = cell.getComponent(FlexItem.getTypeName()) as FlexItem
      const row = this.flexRow(cell, pw, btnH, {
        gap: TRANSPORT_BTN_GAP, justify: FlexJustify.Center, align: FlexAlign.Center,
      })
      this.transportRowLayout = row.getComponent(FlexLayout.getTypeName()) as FlexLayout
      // Seek back
      this.flexChild(row, { w: btnW, h: btnH }, (bo) => {
        this.transportSlotItems.push(bo.getComponent(FlexItem.getTypeName()) as FlexItem)
        const btn = this.btn(bo, "Secondary", "Capsule", btnW, btnH)
        this.transportButtons.push(btn)
        this.content(bo, { text: "⏮ " + this.seekStepSeconds + "s", textSize: this.buttonFontSize, fontWeight: "medium", renderOrderOffset: BTN_CONTENT_RO })
        btn.onTriggerUp.add(() => this.seekRelative(-this.seekStepSeconds))
      })
      // Play / Pause toggle (two objects stacked in the same slot)
      this.flexChild(row, { w: btnW, h: btnH }, (slot) => {
        this.transportSlotItems.push(slot.getComponent(FlexItem.getTypeName()) as FlexItem)
        this.playBtnObj = this.obj(slot, "PlayBtn")
        const playBtn = this.btn(this.playBtnObj, "Prism", "Capsule", btnW, btnH)
        this.transportButtons.push(playBtn)
        this.content(this.playBtnObj, { text: "▶ Play", textSize: this.buttonFontSize, fontWeight: "bold", renderOrderOffset: BTN_CONTENT_RO })
        playBtn.onTriggerUp.add(() => {
          if (this._currentTime < 0.01) this.play()
          else this.resume()
        })

        this.pauseBtnObj = this.obj(slot, "PauseBtn")
        this.pauseBtnObj.enabled = false
        const pauseBtn = this.btn(this.pauseBtnObj, "Prism", "Capsule", btnW, btnH)
        this.transportButtons.push(pauseBtn)
        this.content(this.pauseBtnObj, { text: "⏸ Pause", textSize: this.buttonFontSize, fontWeight: "bold", renderOrderOffset: BTN_CONTENT_RO })
        pauseBtn.onTriggerUp.add(() => this.pause())
      })
      // Seek forward
      this.flexChild(row, { w: btnW, h: btnH }, (bo) => {
        this.transportSlotItems.push(bo.getComponent(FlexItem.getTypeName()) as FlexItem)
        const btn = this.btn(bo, "Secondary", "Capsule", btnW, btnH)
        this.transportButtons.push(btn)
        this.content(bo, { text: "⏭ " + this.seekStepSeconds + "s", textSize: this.buttonFontSize, fontWeight: "medium", renderOrderOffset: BTN_CONTENT_RO })
        btn.onTriggerUp.add(() => this.seekRelative(this.seekStepSeconds))
      })
    })

    // 5. Volume slider (optional) ──────────────────────────────────────
    if (this.showVolumeSlider) {
      this.flexChild(col, { w: pw, h: 4.2 }, (cell) => {
        this.volumeItem = cell.getComponent(FlexItem.getTypeName()) as FlexItem
        const volCol = this.flexColumn(cell, pw, 4.2, { gap: 0.4 })
        this.volumeColLayout = volCol.getComponent(FlexLayout.getTypeName()) as FlexLayout
        this.flexChild(volCol, { w: pw, h: 1.8 }, (hdr) => {
          this.volHeaderItem = hdr.getComponent(FlexItem.getTypeName()) as FlexItem
          this.label(hdr, "Volume", pw, 1.8, { textSize: this.volumeLabelFontSize, align: "center", fontWeight: "medium" })
        })
        this.flexChild(volCol, { w: pw, h: 2.2 }, (sCell) => {
          this.volSliderItem = sCell.getComponent(FlexItem.getTypeName()) as FlexItem
          const vs = sCell.createComponent(Slider.getTypeName()) as Slider
          vs.size = new vec3(pw, 2.2, 1)
          vs.initialize()
          vs.currentValue = Math.max(0, Math.min(1, this.initialVolume))
          this.volumeSlider = vs
          vs.onValueChange.add((v: number) => {
            if (this.skipVolumeSync) return
            if (this.provider) this.provider.volume = v
          })
        })
      })
    }

    // Corner-grab → reflow. Fires on every scaling update while dragging.
    if (this.flexLayoutResize) {
      this.frame?.onSizeChanged.add(() => this.reflowToFrameSize())
    }
  }

  /**
   * Pushes the frame's current inner size into the layout tree (flex resize
   * mode). The control bar keeps its fixed heights and only tracks the new
   * width; the video cell absorbs the full vertical delta. The video surface
   * is fit (contain) within the cell preserving its aspect ratio, so unmatched
   * area letterboxes rather than stretching. Never writes frame.innerSize, so
   * it cannot re-trigger onSizeChanged.
   */
  private reflowToFrameSize(): void {
    if (!this.frame) return
    const contentW = this.frame.innerSize.x
    const contentH = this.frame.innerSize.y
    const dy = contentH - this.buildPanelH

    if (this.colLayout) {
      this.colLayout.width = contentW
      this.colLayout.height = contentH
    }

    // Video cell absorbs the vertical delta; the surface fits within it,
    // preserving aspect (letterbox / pillarbox on the unmatched axis).
    const cellH = Math.max(2, this.buildVideoH + dy)
    if (this.videoItem) {
      this.videoItem.overrideWidth = contentW
      this.videoItem.overrideHeight = cellH
    }
    if (this.videoRR) {
      let vidW = contentW
      let vidH = contentW * this.videoAspect
      if (vidH > cellH) {
        vidH = cellH
        vidW = cellH / this.videoAspect
      }
      this.videoRR.size = new vec2(vidW, vidH)
    }

    // Control bar tracks the new width at its fixed height.
    if (this.timeItem) this.timeItem.overrideWidth = contentW
    if (this.seekItem) this.seekItem.overrideWidth = contentW
    // The Slider's own onSizeChanged remaps the knob from currentValue and
    // recomputes trackLength, so the scrubber progress mapping stays correct.
    if (this.seekSlider) this.seekSlider.size = new vec3(contentW, this.seekSlider.size.y, this.seekSlider.size.z)

    if (this.transportItem) this.transportItem.overrideWidth = contentW
    if (this.transportRowLayout) this.transportRowLayout.width = contentW
    const btnW = (contentW - TRANSPORT_BTN_GAP * 2) / 3
    for (const item of this.transportSlotItems) item.overrideWidth = btnW
    for (const btn of this.transportButtons) btn.size = new vec3(btnW, TRANSPORT_BTN_HEIGHT, 1)

    if (this.volumeItem) this.volumeItem.overrideWidth = contentW
    if (this.volumeColLayout) this.volumeColLayout.width = contentW
    if (this.volHeaderItem) this.volHeaderItem.overrideWidth = contentW
    if (this.volSliderItem) this.volSliderItem.overrideWidth = contentW
    if (this.volumeSlider) this.volumeSlider.size = new vec3(contentW, this.volumeSlider.size.y, this.volumeSlider.size.z)
  }

  private buildVideoCell(parent: SceneObject, w: number, h: number): void {
    const rrObj = this.obj(parent, "VideoDisplay")
    const rr = rrObj.createComponent(RoundedRectangle.getTypeName()) as RoundedRectangle
    rr.cornerRadius = this.videoCornerRadius
    rr.initialize()
    rr.size = new vec2(w, h)
    if (this.videoTexture) {
      rr.useTexture = true
      rr.texture = this.videoTexture
      rr.textureMode = "Stretch"
    }
    this.videoRR = rr
  }

  // ── Public API ────────────────────────────────────────────────────────────

  /** Start playback from the beginning. */
  public play(loops?: number): void {
    if (!this.provider) { if (this.enableLogging) this.logger.debug("play: no provider"); return }
    const n = loops ?? this.loopCount
    this.provider.play(n)
    this._isPlaying = true
    this.syncPlayPauseButtons()
    if (this.enableLogging) this.logger.debug("play(loops=" + n + ")")
  }

  /** Pause playback at the current position. */
  public pause(): void {
    if (!this.provider) return
    this.provider.pause()
    this._isPlaying = false
    this.syncPlayPauseButtons()
    if (this.enableLogging) this.logger.debug("pause()")
  }

  /** Resume from a paused position. */
  public resume(): void {
    if (!this.provider) return
    this.provider.resume()
    this._isPlaying = true
    this.syncPlayPauseButtons()
    if (this.enableLogging) this.logger.debug("resume()")
  }

  /** Pause and reset to the beginning. */
  public stop(): void {
    this.pause()
    this._currentTime = 0
    if (this.provider) this.provider.seek(0)
    this.syncSeekSlider()
    this.syncTimeLabel()
    if (this.enableLogging) this.logger.debug("stop()")
  }

  /** Seek to an absolute time in seconds. */
  public seek(seconds: number): void {
    this._currentTime = Math.max(0, Math.min(seconds, this.videoDuration))
    if (this.provider) this.provider.seek(this._currentTime)
    if (this.enableLogging) this.logger.debug("seek(" + seconds.toFixed(2) + ")")
  }

  /** Seek relative to the current position (negative = rewind). */
  public seekRelative(delta: number): void {
    this.seek(this._currentTime + delta)
  }

  /** Set volume (0–1). Also updates the volume slider UI. */
  public setVolume(volume: number): void {
    const v = Math.max(0, Math.min(1, volume))
    if (this.provider) this.provider.volume = v
    if (this.volumeSlider) {
      this.skipVolumeSync = true
      this.volumeSlider.currentValue = v
      this.skipVolumeSync = false
    }
    if (this.enableLogging) this.logger.debug("setVolume(" + v.toFixed(2) + ")")
  }

  /** Set playback rate (0.5 = half speed, 1.0 = normal, 2.0 = double). */
  public setPlaybackRate(rate: number): void {
    const r = Math.max(0.1, rate)
    if (this.provider) this.provider.playbackRate = r
    if (this.enableLogging) this.logger.debug("setPlaybackRate(" + r.toFixed(2) + ")")
  }

  public isPlaying(): boolean                           { return this._isPlaying }
  public getCurrentTime(): number                       { return this._currentTime }
  public getProvider(): VideoTextureProvider | null     { return this.provider }

  // ── Composition helpers (same pattern as ExampleModalLayout) ─────────────

  private fontForWeight(weight: FontWeight): Font {
    switch (weight) {
      case "light":  return FONT_LIGHT
      case "medium": return FONT_MEDIUM
      case "bold":   return FONT_BOLD
      default:       return FONT_REGULAR
    }
  }

  private obj(parent: SceneObject, name: string, position?: vec3): SceneObject {
    const so = global.scene.createSceneObject(name)
    so.setParent(parent)
    if (position) so.getTransform().setLocalPosition(position)
    return so
  }

  private liftInZ(so: SceneObject, z: number): void {
    const t = so.getTransform()
    const p = t.getLocalPosition()
    t.setLocalPosition(new vec3(p.x, p.y, p.z + z))
  }

  private dynamicText(
    parent: SceneObject, name: string, text: string, size: number,
    localPos: vec3, color: vec4, font: Font,
    hAlign: HorizontalAlignment = HorizontalAlignment.Center
  ): Text {
    const textObj = this.obj(parent, name, localPos)
    const tc = textObj.createComponent("Component.Text") as Text
    tc.text = text; tc.size = size; tc.textFill.color = color; tc.font = font
    tc.horizontalAlignment = hAlign
    tc.verticalAlignment = VerticalAlignment.Center
    tc.horizontalOverflow = HorizontalOverflow.Overflow
    tc.verticalOverflow = VerticalOverflow.Overflow
    const pass = (tc as any).getMaterial(0).mainPass
    pass.depthTest = true; pass.depthWrite = true
    return tc
  }

  private scenePanel(
    parent: SceneObject, name: string, width: number, height: number
  ): SceneObject {
    const frameObj = this.obj(parent, name)
    const frame = frameObj.createComponent(Frame.getTypeName()) as Frame
    frame.autoShowHide = false
    frame.allowTranslation = true
    // Flex mode: content keeps its 1× scale while the corner grab changes the
    // inner area per axis; reflowToFrameSize() re-lays-out the video surface
    // and control bar. Scaling mode: the frame zooms its content uniformly
    // (UIKit default).
    frame.autoScaleContent = !this.flexLayoutResize
    frame.allowNonUniformScaling = this.flexLayoutResize
    ;(frame as any)._showCloseButton = true
    ;(frame as any)._showFollowButton = true
    ;(frame as any)._innerSize = new vec2(width, height)
    ;(frame as any)._padding = new vec2(0.3, 0.3)
    ;(frame as any)._minimumSize = FRAME_MIN_SIZE
    ;(frame as any)._maximumSize = FRAME_MAX_SIZE
    this.frame = frame
    return this.obj(frameObj, "FrameContent", new vec3(0, 0, PANEL_CONTENT_Z_LIFT))
  }

  private btn(
    so: SceneObject, style: string, shape: string,
    width: number, height: number, renderOrder: number = 0
  ): Button {
    const button = so.createComponent(Button.getTypeName()) as Button
    ;(button as any)._shapeSystem3 = shape
    ;(button as any)._styleSystem3 = style
    button.size = new vec3(width, height, 1)
    button.renderOrder = renderOrder
    button.initialize()
    return button
  }

  private content(
    so: SceneObject,
    opts: {
      text?: string; contentAlignment?: string; textSize?: number
      paddingLeft?: number; paddingRight?: number; sizeOverride?: vec2
      useThemeColors?: boolean; textColorOverride?: vec4; fontWeight?: FontWeight
      renderOrderOffset?: number; zOffset?: number
    }
  ): ElementContent {
    const ec = so.createComponent(ElementContent.getTypeName()) as ElementContent
    const a = ec as any
    a._zOffset = opts.zOffset ?? CONTENT_Z_OFFSET
    ec.hostRenderOrderOffset = opts.renderOrderOffset ?? CONTENT_RO
    a._font = this.fontForWeight(opts.fontWeight ?? "regular")
    if (opts.text !== undefined) a._text = opts.text
    if (opts.contentAlignment) a._contentAlignment = opts.contentAlignment
    if (opts.textSize) a._textSize = opts.textSize
    if (opts.paddingLeft !== undefined) a._paddingLeft = opts.paddingLeft
    if (opts.paddingRight !== undefined) a._paddingRight = opts.paddingRight
    if (opts.sizeOverride) a._sizeOverride = opts.sizeOverride
    if (opts.useThemeColors !== undefined) a._useThemeColors = opts.useThemeColors
    if (opts.textColorOverride) {
      a._useTextColorOverride = true; a._textColorOverride = opts.textColorOverride
    }
    return ec
  }

  private label(
    so: SceneObject, text: string, width: number, height: number,
    opts?: {
      textSize?: number; align?: string; color?: vec4
      fontWeight?: FontWeight; renderOrderOffset?: number
    }
  ): ElementContent {
    const align = opts?.align ?? "center"
    return this.content(so, {
      text, sizeOverride: new vec2(width, height), useThemeColors: false,
      textSize: opts?.textSize ?? 32, contentAlignment: align,
      textColorOverride: opts?.color, fontWeight: opts?.fontWeight ?? "regular",
      paddingLeft:  align === "left"  ? LABEL_EDGE_INSET : 0,
      paddingRight: align === "right" ? LABEL_EDGE_INSET : 0,
      renderOrderOffset: opts?.renderOrderOffset,
    })
  }

  private flexColumn(
    parent: SceneObject, width: number, height: number,
    opts?: { gap?: number; padY?: number; padX?: number; justify?: FlexJustify; align?: FlexAlign }
  ): SceneObject {
    return this.makeFlex(parent, FlexDirection.Column, width, height, opts)
  }

  private flexRow(
    parent: SceneObject, width: number, height: number,
    opts?: { gap?: number; padY?: number; padX?: number; justify?: FlexJustify; align?: FlexAlign }
  ): SceneObject {
    return this.makeFlex(parent, FlexDirection.Row, width, height, opts)
  }

  private makeFlex(
    parent: SceneObject, direction: FlexDirection, width: number, height: number,
    opts?: { gap?: number; padY?: number; padX?: number; justify?: FlexJustify; align?: FlexAlign }
  ): SceneObject {
    const container = this.obj(parent, "Flex")
    this.liftInZ(container, LAYOUT_Z_LIFT)
    const fl = container.createComponent(FlexLayout.getTypeName()) as FlexLayout
    // Items are added manually via addItems() before init; disable
    // auto-discovery so addItems() doesn't throw on an uninitialized layout.
    fl.autoDiscoverItemsOnStart = false
    const fi = container.createComponent(FlexItem.getTypeName()) as FlexItem
    if (width > 0) fi.overrideWidth = width
    if (height > 0) fi.overrideHeight = height
    fl.onInitialized.add(() => {
      fl.width = width; fl.height = height; fl.direction = direction
      if (direction === FlexDirection.Row) fl.columnGap = opts?.gap ?? 0
      else fl.rowGap = opts?.gap ?? 0
      fl.paddingTop    = opts?.padY ?? 0; fl.paddingBottom = opts?.padY ?? 0
      fl.paddingLeft   = opts?.padX ?? 0; fl.paddingRight  = opts?.padX ?? 0
      fl.justifyContent = opts?.justify ?? FlexJustify.Start
      fl.alignItems     = opts?.align   ?? FlexAlign.Stretch
    })
    return container
  }

  private flexChild(
    parent: SceneObject,
    size: { w?: number; h?: number; grow?: number },
    builder: (child: SceneObject) => void
  ): SceneObject {
    const child = this.obj(parent, "Item")
    this.liftInZ(child, LAYOUT_Z_LIFT)
    const fi = child.createComponent(FlexItem.getTypeName()) as FlexItem
    if (size.w !== undefined && size.w > 0) fi.overrideWidth  = size.w
    if (size.h !== undefined && size.h > 0) fi.overrideHeight = size.h
    fi.flexGrow   = size.grow ?? 0
    fi.flexShrink = 0
    builder(child)
    const parentFl = parent.getComponent(FlexLayout.getTypeName()) as FlexLayout | null
    if (parentFl) parentFl.addItems([fi])
    return child
  }
}

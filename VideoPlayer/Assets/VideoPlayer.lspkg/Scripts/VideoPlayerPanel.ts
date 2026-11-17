// Preload ThemeService before any UIKit visual to break a circular-import init-order
// crash in the package (Visual.ts imports ThemeService before defining COLORS, and the
// theme chain reads COLORS at module-load). Entering the import cycle via ThemeService
// lets Visual.ts finish defining COLORS first. Must remain the FIRST import.
import "UIKit.lspkg/Scripts/Themes/ThemeService"
/**
 * VideoPlayerPanel – UIKit player UI for SpecsVideoPlayer, built at runtime (no prefabs).
 * Frame + video cell, state line, media info line, time label, seek slider, transport
 * buttons (seek back, Play / Pause, seek forward), Stop + Loop toggle, and a volume slider.
 * Ported from InteractionKitExamples' ExampleVideoPlayer; playback is delegated to a
 * SpecsVideoPlayer (SpecsNDK on device, VideoTexture fallback in the editor).
 * Public API: getPlayer(), play(), pause(), stop(), seekRelative(dt), setVolume(v), setLoop(b).
 */
import { Button } from "UIKit.lspkg/Scripts/Components/Button/Button"
import { RoundedRectangle } from "UIKit.lspkg/Scripts/Visuals/RoundedRectangle/RoundedRectangle"
import { ElementContent } from "UIKit.lspkg/Scripts/Components/Content/ElementContent"
import { Frame } from "UIKit.lspkg/Scripts/Components/Frame/Frame"
import { FlexItem } from "UIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexItem"
import { FlexLayout } from "UIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexLayout"
import { FlexAlign, FlexDirection, FlexJustify } from "UIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexTypes"
import { Slider } from "UIKit.lspkg/Scripts/Components/Slider/Slider"

import { bindStartEvent, bindUpdateEvent } from "SnapDecorators.lspkg/decorators"

import { SpecsVideoPlayer, VideoPlayerState, VIDEO_PLAYER_STATE_NAMES } from "./SpecsVideoPlayer"

const FONT_LIGHT: Font   = requireAsset("../Fonts/SpecsSans-Light.otf")   as Font
const FONT_REGULAR: Font = requireAsset("../Fonts/SpecsSans-Regular.otf") as Font
const FONT_MEDIUM: Font  = requireAsset("../Fonts/SpecsSans-Medium.otf")  as Font
const FONT_BOLD: Font    = requireAsset("../Fonts/SpecsSans-Bold.otf")    as Font

type FontWeight = "light" | "regular" | "medium" | "bold"

// Z rules: ElementContent labels sit CONTENT_Z_OFFSET in front of their button; Text placed
// manually must sit at TEXT_Z >= 0.65 so it is never hidden inside a 1 cm button face.
const CONTENT_Z_OFFSET     = 0.08
const TEXT_Z               = 0.65
const LAYOUT_Z_LIFT        = 0.02
const LABEL_EDGE_INSET     = 0.75
const PANEL_CONTENT_Z_LIFT = 0.05
const CONTENT_RO           = 8
const BTN_CONTENT_RO       = 3

const ASPECT_RATIOS: Record<string, number> = {
  "16:9": 9 / 16,
  "4:3":  3 / 4,
  "1:1":  1.0,
}

// Corner-grab resize limits (frame inner size, cm)
const FRAME_MIN_SIZE = new vec2(24, 24)
const FRAME_MAX_SIZE = new vec2(80, 80)

const TRANSPORT_BTN_HEIGHT = 4.0   // base heights in cm, multiplied by uiScale
const SECONDARY_BTN_HEIGHT = 3.2
const TRANSPORT_BTN_GAP    = 1.2
const STATE_LINE_H         = 1.8
const INFO_LINE_H          = 1.6
const TIME_LINE_H          = 2.2
const SEEK_BAR_H           = 2.6
const VOLUME_BLOCK_H       = 4.2
const SEEK_THROTTLE_S      = 0.15  // live-scrub / button seek rate limit
const SEEK_HOLD_S          = 1.0   // keep showing the requested time while the decoder catches up
const SCRUB_COMMIT_S       = 0.2   // no slider input for this long = the drag / tap is over

const STATE_COLORS: Record<number, vec4> = {
  [VideoPlayerState.Idle]:      new vec4(1, 1, 1, 0.5),
  [VideoPlayerState.Opening]:   new vec4(0.38, 0.65, 0.98, 1),
  [VideoPlayerState.Buffering]: new vec4(0.98, 0.80, 0.30, 1),
  [VideoPlayerState.Playing]:   new vec4(0.29, 0.87, 0.50, 1),
  [VideoPlayerState.Paused]:    new vec4(1, 1, 1, 0.8),
  [VideoPlayerState.Stopped]:   new vec4(1, 1, 1, 0.6),
  [VideoPlayerState.Ended]:     new vec4(1, 1, 1, 0.6),
  [VideoPlayerState.Error]:     new vec4(0.97, 0.44, 0.44, 1),
}

@component
export class VideoPlayerPanel extends BaseScriptComponent {

  @ui.label('<span style="color: #60A5FA;">VideoPlayerPanel – UIKit UI for SpecsVideoPlayer</span><br/><span style="color: #94A3B8; font-size: 11px;">No prefabs. Assign a SpecsVideoPlayer (or put one on this SceneObject). The panel builds frame, video, seek, transport, loop and volume at runtime.</span>')
  @ui.separator

  // ── Player ─────────────────────────────────────────────────────────────
  @ui.group_start("Player")
  @input
  @allowUndefined
  @hint("SpecsVideoPlayer to drive. Empty = the SpecsVideoPlayer on this SceneObject.")
  player: SpecsVideoPlayer

  @input("number", "1.0")
  @hint("Seconds to seek per +/- button press (presses stack, so 5 quick taps = 5 s)")
  seekStep: number = 1.0

  @input
  @hint("Show the volume slider below the transport controls")
  showVolumeSlider: boolean = true

  @input
  @hint("Show the media info line (resolution, fps, codecs, source host)")
  showMediaInfo: boolean = true
  @ui.group_end

  // ── Layout ─────────────────────────────────────────────────────────────
  @ui.separator
  @ui.group_start("Layout")
  @input
  @hint(
    "Corner-grab resize behavior. <br><br><b>ON — flex layout:</b> grabbing a corner changes the frame's inner area; the video cell absorbs the height change and the controls track the width. <br><br><b>OFF — scaling:</b> grabbing a corner uniformly scales the frame and everything inside it."
  )
  flexLayoutResize: boolean = false

  @input("number", "32.0")
  @hint("Panel content area width in cm")
  panelWidth: number = 32.0

  @input("string")
  @hint("Video cell aspect ratio. Auto fits the video's own aspect inside a 16:9 cell (letterbox).")
  @widget(new ComboBoxWidget([
    new ComboBoxItem("Auto", "auto"),
    new ComboBoxItem("16:9", "16:9"),
    new ComboBoxItem("4:3",  "4:3"),
    new ComboBoxItem("1:1",  "1:1"),
  ]))
  aspectRatio: string = "auto"

  @input("number", "0")
  @hint("Local X position")
  positionX: number = 0

  @input("number", "0")
  @hint("Local Y position")
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
  @input("number", "1.4")
  @hint("Scales the row and button heights of the panel (1 = the original compact size)")
  uiScale: number = 1.4

  @input("number", "3.2")
  @hint("Scales every text size below. UIKit text units are small: 3.2 gives about 1.4 cm tall button labels on Specs.")
  textScale: number = 3.2

  @input("number", "24")
  @hint("Font size for the current time / duration label (before UI Scale)")
  timeLabelFontSize: number = 24

  @input("number", "20")
  @hint("Font size for the transport buttons")
  buttonFontSize: number = 20

  @input("number", "22")
  @hint("Font size for the Volume label")
  volumeLabelFontSize: number = 22

  @input("number", "20")
  @hint("Font size for the state line")
  stateFontSize: number = 20

  @input("number", "16")
  @hint("Font size for the media info line")
  infoFontSize: number = 16
  @ui.group_end

  // ── Private state ──────────────────────────────────────────────────────
  private seekSlider:   Slider | null = null
  private volumeSlider: Slider | null = null
  private timeText:     Text   | null = null
  private stateText:    Text   | null = null
  private infoText:     Text   | null = null

  private playBtnObj:    SceneObject | null = null
  private pauseBtnObj:   SceneObject | null = null
  private loopOnBtnObj:  SceneObject | null = null
  private loopOffBtnObj: SceneObject | null = null

  // Flex-resize reflow refs
  private frame:              Frame | null = null
  private colLayout:          FlexLayout | null = null
  private videoRR:            RoundedRectangle | null = null
  private videoItem:          FlexItem | null = null
  private widthItems:         FlexItem[] = []
  private rowLayouts:         FlexLayout[] = []
  private transportSlotItems: FlexItem[] = []
  private transportButtons:   Button[] = []
  private secondarySlotItems: FlexItem[] = []
  private secondaryButtons:   Button[] = []
  private buildPanelH:        number = 0
  private buildVideoH:        number = 0
  private cellAspect:         number = 9 / 16
  private videoAspect:        number = 0

  // Row heights in cm after uiScale (set in buildUI, reused by the flex reflow)
  private hTransport: number = TRANSPORT_BTN_HEIGHT
  private hSecondary: number = SECONDARY_BTN_HEIGHT

  // Seeking / scrubbing: the panel remembers the time it asked for, because the decoder's
  // position lags behind a seek (rapid +5 s presses must stack from the target, not from it)
  private heldTarget:     number | null = null
  private holdTimer:      number = 0
  private scrubbing:      boolean = false
  private scrubPaused:    boolean = false
  private lastScrubInput: number = 0
  private clock:          number = 0

  // Loading spinner in front of the video: shown while opening / buffering / waiting for a seek
  private spinner:        SceneObject | null = null
  private spinnerDots:    RoundedRectangle[] = []
  private spinnerAngle:   number = 0
  private busyFor:        number = 0

  private skipSeekSync:   boolean = false
  private skipVolumeSync: boolean = false
  private pendingSeek:    number | null = null
  private seekCooldown:   number = 0
  private infoClock:      number = 0
  private lastInfoLine:   string = ""
  private initialized:    boolean = false
  private unsubs:         (() => void)[] = []

  onAwake(): void {
    this.createEvent("OnDestroyEvent").bind(() => {
      for (const u of this.unsubs) u()
      this.unsubs = []
    })
  }

  @bindStartEvent
  onStart(): void {
    if (!this.player) {
      this.player = this.sceneObject.getComponent(SpecsVideoPlayer.getTypeName()) as SpecsVideoPlayer
    }
    this.buildUI()
    if (this.player) {
      this.unsubs.push(this.player.onTextureChanged.add((tex) => this.applyTexture(tex)))
      this.unsubs.push(this.player.onStateChanged.add(() => this.syncStateLine()))
      const tex = this.player.getTexture()
      if (tex) this.applyTexture(tex)
      this.setVolumeSliderUI(this.player.getVolume())
    } else {
      print("[VideoPlayerPanel] no SpecsVideoPlayer assigned or found on this SceneObject")
    }
    this.syncLoopButtons()
    this.syncStateLine()
    this.initialized = true
  }

  @bindUpdateEvent
  onUpdate(): void {
    if (!this.initialized || !this.player) return
    this.clock += getDeltaTime()
    this.holdTimer = Math.max(0, this.holdTimer - getDeltaTime())
    this.updateScrub()
    this.updateSpinner()
    this.applyPendingSeek()
    this.syncSeekSlider()
    this.syncTimeLabel()
    this.syncPlayPauseButtons()
    this.infoClock += getDeltaTime()
    if (this.infoClock >= 0.5) {
      this.infoClock = 0
      this.syncInfoLine()
      this.syncStateLine()
    }
  }

  // ── Public API ────────────────────────────────────────────────────────────
  public getPlayer(): SpecsVideoPlayer | null { return this.player ?? null }
  public play(): void { this.player?.play() }
  public pause(): void { this.player?.pause() }
  public stop(): void { this.player?.stop() }
  /** Seek by `delta` seconds from where the viewer last asked to be (stacks on rapid presses). */
  public seekRelative(delta: number): void { this.seekTo(this.displayTime() + delta) }

  /** Seek to an absolute time; the UI shows it immediately while the decoder catches up. */
  public seekTo(seconds: number): void {
    if (!this.player) return
    const d = this.player.getDuration()
    const t = Math.max(0, d > 0 ? Math.min(seconds, d) : seconds)
    this.pendingSeek = t
    this.heldTarget = t
    this.holdTimer = SEEK_HOLD_S
  }

  /** The time the UI should show: the requested target while a seek is in flight, else the real position. */
  private displayTime(): number {
    if (this.pendingSeek !== null) return this.pendingSeek
    if (this.heldTarget !== null) {
      const actual = this.player.getCurrentTime()
      if (this.holdTimer > 0 && Math.abs(actual - this.heldTarget) > 0.75) return this.heldTarget
      this.heldTarget = null
    }
    return this.player.getCurrentTime()
  }

  public setVolume(volume: number): void {
    this.player?.setVolume(volume)
    this.setVolumeSliderUI(volume)
  }

  public setLoop(loop: boolean): void {
    this.player?.setLoop(loop)
    this.syncLoopButtons()
  }

  // ── Sync ──────────────────────────────────────────────────────────────────
  private applyPendingSeek(): void {
    this.seekCooldown = Math.max(0, this.seekCooldown - getDeltaTime())
    if (this.pendingSeek === null || this.seekCooldown > 0) return
    this.player.seek(this.pendingSeek)
    this.pendingSeek = null
    this.seekCooldown = SEEK_THROTTLE_S
  }

  /** Slider drag / tap bookkeeping: pause while dragging, final seek + resume when the viewer lets go. */
  private updateScrub(): void {
    if (!this.scrubbing || !this.seekSlider) return
    const dragging = !!(this.seekSlider as any).isDragging
    if (dragging) this.lastScrubInput = this.clock
    if (!dragging && this.clock - this.lastScrubInput > SCRUB_COMMIT_S) {
      this.scrubbing = false
      this.seekCooldown = 0 // the final position goes out at once
      if (this.scrubPaused) {
        this.scrubPaused = false
        this.player.play()
      }
      this.syncTimeColor()
    }
  }

  /** Is the player making the viewer wait (opening, buffering, or a seek the decoder has not finished)? */
  private isBusy(): boolean {
    const st = this.player.getState()
    if (st === VideoPlayerState.Opening || st === VideoPlayerState.Buffering) return true
    if (this.scrubbing) return false
    if (this.pendingSeek !== null) return true
    return this.heldTarget !== null && this.holdTimer > 0 && Math.abs(this.player.getCurrentTime() - this.heldTarget) > 0.75
  }

  /** Spinning dots in front of the video; appears only after a short wait so quick seeks do not flash it. */
  private updateSpinner(): void {
    if (!this.spinner) return
    const dt = getDeltaTime()
    this.busyFor = this.isBusy() ? this.busyFor + dt : 0
    const show = this.busyFor > 0.25
    if (this.spinner.enabled !== show) this.spinner.enabled = show
    if (!show) return
    this.spinnerAngle += dt * 9 // radians per second of the chasing-tail highlight
    const n = this.spinnerDots.length
    for (let i = 0; i < n; i++) {
      const phase = ((i / n) - (this.spinnerAngle / (Math.PI * 2)) % 1 + 2) % 1
      this.spinnerDots[i].opacity = 0.15 + 0.85 * (1 - phase)
    }
  }

  private syncTimeColor(): void {
    if (this.timeText) this.timeText.textFill.color = this.scrubbing ? new vec4(0.38, 0.65, 0.98, 1) : new vec4(1, 1, 1, 0.8)
  }

  private syncSeekSlider(): void {
    const d = this.player.getDuration()
    if (!this.seekSlider || d <= 0 || this.scrubbing) return
    this.skipSeekSync = true
    this.seekSlider.currentValue = Math.max(0, Math.min(1, this.displayTime() / d))
    this.skipSeekSync = false
  }

  private syncTimeLabel(): void {
    if (!this.timeText) return
    const d = this.player.getDuration()
    const t = this.displayTime()
    this.timeText.text = this.fmt(t) + " / " + (d > 0 ? this.fmt(d) : "--:--")
  }

  private syncPlayPauseButtons(): void {
    const playing = this.player.isPlaying()
    if (this.playBtnObj && this.playBtnObj.enabled === playing)  this.playBtnObj.enabled  = !playing
    if (this.pauseBtnObj && this.pauseBtnObj.enabled !== playing) this.pauseBtnObj.enabled = playing
  }

  private syncLoopButtons(): void {
    const loop = this.player ? this.player.getLoop() : false
    if (this.loopOnBtnObj)  this.loopOnBtnObj.enabled  = loop
    if (this.loopOffBtnObj) this.loopOffBtnObj.enabled = !loop
  }

  private syncStateLine(): void {
    if (!this.stateText || !this.player) return
    const s = this.player.getState()
    let line = VIDEO_PLAYER_STATE_NAMES[s] ?? "Unknown"
    if (s === VideoPlayerState.Error) {
      const e = this.player.getLastError()
      if (e) line += ": " + (e.length > 36 ? e.substring(0, 33) + "..." : e)
    }
    const backend = this.player.getBackend()
    if (backend === "texture") line += "  ·  VideoTexture"
    else if (backend === "native") line += "  ·  SpecsPlayer"
    this.stateText.text = line
    this.stateText.textFill.color = STATE_COLORS[s] ?? new vec4(1, 1, 1, 0.8)
  }

  private syncInfoLine(): void {
    if (!this.infoText) return
    const info = this.player.getMediaInfo()
    const parts: string[] = []
    if (info.width > 0 && info.height > 0) parts.push(info.width + "×" + info.height)
    if (info.framerate > 0) parts.push(info.framerate.toFixed(info.framerate % 1 === 0 ? 0 : 2) + " fps")
    const codecs = [info.videoCodec, info.audioCodec].filter((c) => !!c).join(" / ")
    if (codecs) parts.push(codecs)
    const host = this.sourceHost(this.player.getCurrentUrl())
    if (host) parts.push(host)
    const line = parts.length > 0 ? parts.join("  ·  ") : " "
    if (line !== this.lastInfoLine) {
      this.lastInfoLine = line
      this.infoText.text = line
    }
    if (info.width > 0 && info.height > 0) {
      const a = info.height / info.width
      if (Math.abs(a - this.videoAspect) > 0.001) {
        this.videoAspect = a
        this.fitVideoSurface()
      }
    }
  }

  private sourceHost(url: string): string {
    if (!url) return this.player && this.player.getBackend() === "texture" ? "bundled" : ""
    const m = url.match(/^([a-zA-Z][a-zA-Z0-9+.-]*):\/\/([^/?#]*)/)
    if (!m) return ""
    if (m[1].toLowerCase() === "file") return "local file"
    return m[2]
  }

  private setVolumeSliderUI(v: number): void {
    if (!this.volumeSlider) return
    this.skipVolumeSync = true
    this.volumeSlider.currentValue = Math.max(0, Math.min(1, v))
    this.skipVolumeSync = false
  }

  private applyTexture(tex: Texture): void {
    if (!this.videoRR) return
    this.videoRR.useTexture = true
    this.videoRR.texture = tex
    this.videoRR.textureMode = "Stretch"
    const w = tex.getWidth()
    const h = tex.getHeight()
    if (w > 0 && h > 0) {
      this.videoAspect = h / w
      this.fitVideoSurface()
    }
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
    root.getTransform().setLocalPosition(new vec3(this.positionX, this.positionY, this.positionZ))

    const pw     = this.panelWidth
    const aspect = ASPECT_RATIOS[this.aspectRatio] ?? (9 / 16)
    const videoH = pw * aspect
    const gap    = 0.8
    const k      = Math.max(0.5, this.uiScale)
    const hState = STATE_LINE_H * k, hInfo = INFO_LINE_H * k, hTime = TIME_LINE_H * k
    const hSeek  = SEEK_BAR_H * k, hVol = VOLUME_BLOCK_H * k
    this.hTransport = TRANSPORT_BTN_HEIGHT * k
    this.hSecondary = SECONDARY_BTN_HEIGHT * k
    const fs = (n: number) => n * Math.max(0.5, this.textScale)
    // Rows: video, state, [info], time, seek, transport, secondary, [volume]
    let ph = videoH + hState + hTime + hSeek + this.hTransport + this.hSecondary + 1.0
    let rows = 6
    if (this.showMediaInfo) { ph += hInfo; rows++ }
    if (this.showVolumeSlider) { ph += hVol; rows++ }
    ph += gap * (rows - 1)

    this.buildPanelH = ph
    this.buildVideoH = videoH
    this.cellAspect  = aspect

    const content = this.scenePanel(root, "VideoPlayerPanel", pw, ph)
    const col = this.flexColumn(content, pw, ph, { gap, padX: 0.5, padY: 0.5 })
    this.colLayout = col.getComponent(FlexLayout.getTypeName()) as FlexLayout

    // 1. Video display ──────────────────────────────────────────────────
    this.flexChild(col, { w: pw, h: videoH }, (cell) => {
      this.videoItem = cell.getComponent(FlexItem.getTypeName()) as FlexItem
      this.buildVideoCell(cell, pw, videoH)
    })

    // 2. State line ─────────────────────────────────────────────────────
    this.flexChild(col, { w: pw, h: hState }, (cell) => {
      this.widthItems.push(cell.getComponent(FlexItem.getTypeName()) as FlexItem)
      this.stateText = this.dynamicText(
        cell, "State", "Idle", fs(this.stateFontSize), new vec3(0, 0, TEXT_Z),
        new vec4(1, 1, 1, 0.8), FONT_MEDIUM, HorizontalAlignment.Center
      )
    })

    // 3. Media info line ────────────────────────────────────────────────
    if (this.showMediaInfo) {
      this.flexChild(col, { w: pw, h: hInfo }, (cell) => {
        this.widthItems.push(cell.getComponent(FlexItem.getTypeName()) as FlexItem)
        this.infoText = this.dynamicText(
          cell, "MediaInfo", " ", fs(this.infoFontSize), new vec3(0, 0, TEXT_Z),
          new vec4(1, 1, 1, 0.55), FONT_LIGHT, HorizontalAlignment.Center
        )
      })
    }

    // 4. Time label ─────────────────────────────────────────────────────
    this.flexChild(col, { w: pw, h: hTime }, (cell) => {
      this.widthItems.push(cell.getComponent(FlexItem.getTypeName()) as FlexItem)
      this.timeText = this.dynamicText(
        cell, "Time", "0:00 / --:--", fs(this.timeLabelFontSize), new vec3(0, 0, TEXT_Z),
        new vec4(1, 1, 1, 0.7), FONT_REGULAR, HorizontalAlignment.Center
      )
    })

    // 5. Seek timeline: drag the knob or tap anywhere on the bar (YouTube style) ──────────
    this.flexChild(col, { w: pw, h: hSeek }, (cell) => {
      this.widthItems.push(cell.getComponent(FlexItem.getTypeName()) as FlexItem)
      const s = cell.createComponent(Slider.getTypeName()) as Slider
      const sa = s as any
      sa.snapToTriggerPosition = true            // a tap on the bar jumps there
      sa.customKnobSize = true
      sa._knobSize = new vec2(hSeek * 1.15, hSeek * 1.15) // a knob that is easy to pinch
      s.size = new vec3(pw, hSeek, 1)
      s.initialize()
      s.currentValue = 0
      this.seekSlider = s
      s.onValueChange.add((v: number) => {
        if (this.skipSeekSync || !this.player) return
        const d = this.player.getDuration()
        if (d <= 0) return
        if (!this.scrubbing) {
          this.scrubbing = true
          // while the knob is dragged: stop the audio / picture running away, resume on release
          this.scrubPaused = !!sa.isDragging && this.player.isPlaying()
          if (this.scrubPaused) this.player.pause()
          this.syncTimeColor()
        }
        this.lastScrubInput = this.clock
        this.seekTo(v * d) // live scrub, rate-limited in applyPendingSeek()
      })
    })

    // 6. Transport controls ─────────────────────────────────────────────
    const btnH = this.hTransport
    const btnW = (pw - TRANSPORT_BTN_GAP * 2) / 3
    this.flexChild(col, { w: pw, h: btnH }, (cell) => {
      this.widthItems.push(cell.getComponent(FlexItem.getTypeName()) as FlexItem)
      const row = this.flexRow(cell, pw, btnH, {
        gap: TRANSPORT_BTN_GAP, justify: FlexJustify.Center, align: FlexAlign.Center,
      })
      this.rowLayouts.push(row.getComponent(FlexLayout.getTypeName()) as FlexLayout)
      // Seek back
      this.flexChild(row, { w: btnW, h: btnH }, (bo) => {
        this.transportSlotItems.push(bo.getComponent(FlexItem.getTypeName()) as FlexItem)
        const btn = this.btn(bo, "Secondary", "Capsule", btnW, btnH)
        this.transportButtons.push(btn)
        this.content(bo, { text: "-" + this.seekStep + "s", textSize: fs(this.buttonFontSize), fontWeight: "medium", renderOrderOffset: BTN_CONTENT_RO })
        btn.onTriggerUp.add(() => this.seekRelative(-this.seekStep))
      })
      // Play / Pause toggle (two objects stacked in the same slot)
      this.flexChild(row, { w: btnW, h: btnH }, (slot) => {
        this.transportSlotItems.push(slot.getComponent(FlexItem.getTypeName()) as FlexItem)
        this.playBtnObj = this.obj(slot, "PlayBtn")
        const playBtn = this.btn(this.playBtnObj, "Prism", "Capsule", btnW, btnH)
        this.transportButtons.push(playBtn)
        this.content(this.playBtnObj, { text: "Play", textSize: fs(this.buttonFontSize), fontWeight: "bold", renderOrderOffset: BTN_CONTENT_RO })
        playBtn.onTriggerUp.add(() => this.play())

        this.pauseBtnObj = this.obj(slot, "PauseBtn")
        this.pauseBtnObj.enabled = false
        const pauseBtn = this.btn(this.pauseBtnObj, "Prism", "Capsule", btnW, btnH)
        this.transportButtons.push(pauseBtn)
        this.content(this.pauseBtnObj, { text: "Pause", textSize: fs(this.buttonFontSize), fontWeight: "bold", renderOrderOffset: BTN_CONTENT_RO })
        pauseBtn.onTriggerUp.add(() => this.pause())
      })
      // Seek forward
      this.flexChild(row, { w: btnW, h: btnH }, (bo) => {
        this.transportSlotItems.push(bo.getComponent(FlexItem.getTypeName()) as FlexItem)
        const btn = this.btn(bo, "Secondary", "Capsule", btnW, btnH)
        this.transportButtons.push(btn)
        this.content(bo, { text: "+" + this.seekStep + "s", textSize: fs(this.buttonFontSize), fontWeight: "medium", renderOrderOffset: BTN_CONTENT_RO })
        btn.onTriggerUp.add(() => this.seekRelative(this.seekStep))
      })
    })

    // 7. Stop + Loop toggle ─────────────────────────────────────────────
    const secH = this.hSecondary
    const secW = (pw - TRANSPORT_BTN_GAP) / 2
    this.flexChild(col, { w: pw, h: secH }, (cell) => {
      this.widthItems.push(cell.getComponent(FlexItem.getTypeName()) as FlexItem)
      const row = this.flexRow(cell, pw, secH, {
        gap: TRANSPORT_BTN_GAP, justify: FlexJustify.Center, align: FlexAlign.Center,
      })
      this.rowLayouts.push(row.getComponent(FlexLayout.getTypeName()) as FlexLayout)
      // Stop
      this.flexChild(row, { w: secW, h: secH }, (bo) => {
        this.secondarySlotItems.push(bo.getComponent(FlexItem.getTypeName()) as FlexItem)
        const btn = this.btn(bo, "Secondary", "Capsule", secW, secH)
        this.secondaryButtons.push(btn)
        this.content(bo, { text: "Stop", textSize: fs(this.buttonFontSize), fontWeight: "medium", renderOrderOffset: BTN_CONTENT_RO })
        btn.onTriggerUp.add(() => this.stop())
      })
      // Loop toggle (two objects stacked in the same slot)
      this.flexChild(row, { w: secW, h: secH }, (slot) => {
        this.secondarySlotItems.push(slot.getComponent(FlexItem.getTypeName()) as FlexItem)
        this.loopOffBtnObj = this.obj(slot, "LoopOffBtn")
        const offBtn = this.btn(this.loopOffBtnObj, "Secondary", "Capsule", secW, secH)
        this.secondaryButtons.push(offBtn)
        this.content(this.loopOffBtnObj, { text: "Loop: Off", textSize: fs(this.buttonFontSize), fontWeight: "medium", renderOrderOffset: BTN_CONTENT_RO })
        offBtn.onTriggerUp.add(() => this.setLoop(true))

        this.loopOnBtnObj = this.obj(slot, "LoopOnBtn")
        this.loopOnBtnObj.enabled = false
        const onBtn = this.btn(this.loopOnBtnObj, "Prism", "Capsule", secW, secH)
        this.secondaryButtons.push(onBtn)
        this.content(this.loopOnBtnObj, { text: "Loop: On", textSize: fs(this.buttonFontSize), fontWeight: "bold", renderOrderOffset: BTN_CONTENT_RO })
        onBtn.onTriggerUp.add(() => this.setLoop(false))
      })
    })

    // 8. Volume slider (optional) ───────────────────────────────────────
    if (this.showVolumeSlider) {
      this.flexChild(col, { w: pw, h: hVol }, (cell) => {
        this.widthItems.push(cell.getComponent(FlexItem.getTypeName()) as FlexItem)
        const volCol = this.flexColumn(cell, pw, hVol, { gap: 0.4 })
        this.rowLayouts.push(volCol.getComponent(FlexLayout.getTypeName()) as FlexLayout)
        this.flexChild(volCol, { w: pw, h: 1.8 * k }, (hdr) => {
          this.widthItems.push(hdr.getComponent(FlexItem.getTypeName()) as FlexItem)
          this.label(hdr, "Volume", pw, 1.8 * k, { textSize: fs(this.volumeLabelFontSize), align: "center", fontWeight: "medium" })
        })
        this.flexChild(volCol, { w: pw, h: 2.2 * k }, (sCell) => {
          this.widthItems.push(sCell.getComponent(FlexItem.getTypeName()) as FlexItem)
          const vs = sCell.createComponent(Slider.getTypeName()) as Slider
          vs.size = new vec3(pw, 2.2 * k, 1)
          vs.initialize()
          vs.currentValue = 1
          this.volumeSlider = vs
          vs.onValueChange.add((v: number) => {
            if (this.skipVolumeSync) return
            this.player?.setVolume(v)
          })
        })
      })
    }

    if (this.flexLayoutResize) {
      this.frame?.onSizeChanged.add(() => this.reflowToFrameSize())
    }
  }

  /** Flex resize mode: video cell absorbs the height delta, controls track the width. */
  private reflowToFrameSize(): void {
    if (!this.frame) return
    const contentW = this.frame.innerSize.x
    const contentH = this.frame.innerSize.y
    const dy = contentH - this.buildPanelH

    if (this.colLayout) {
      this.colLayout.width = contentW
      this.colLayout.height = contentH
    }
    const cellH = Math.max(2, this.buildVideoH + dy)
    if (this.videoItem) {
      this.videoItem.overrideWidth = contentW
      this.videoItem.overrideHeight = cellH
    }
    this.fitVideoSurface(contentW, cellH)

    for (const item of this.widthItems) item.overrideWidth = contentW
    for (const fl of this.rowLayouts) fl.width = contentW
    if (this.seekSlider) this.seekSlider.size = new vec3(contentW, this.seekSlider.size.y, this.seekSlider.size.z)
    if (this.volumeSlider) this.volumeSlider.size = new vec3(contentW, this.volumeSlider.size.y, this.volumeSlider.size.z)

    const btnW = (contentW - TRANSPORT_BTN_GAP * 2) / 3
    for (const item of this.transportSlotItems) item.overrideWidth = btnW
    for (const btn of this.transportButtons) btn.size = new vec3(btnW, this.hTransport, 1)
    const secW = (contentW - TRANSPORT_BTN_GAP) / 2
    for (const item of this.secondarySlotItems) item.overrideWidth = secW
    for (const btn of this.secondaryButtons) btn.size = new vec3(secW, this.hSecondary, 1)
  }

  /** Fit (contain) the video surface in its cell; Auto aspect uses the video's own aspect. */
  private fitVideoSurface(cellW?: number, cellH?: number): void {
    if (!this.videoRR) return
    const w = cellW ?? (this.videoItem?.overrideWidth ?? this.panelWidth)
    const h = cellH ?? (this.videoItem?.overrideHeight ?? this.buildVideoH)
    const aspect = this.aspectRatio === "auto" && this.videoAspect > 0 ? this.videoAspect : this.cellAspect
    let vidW = w
    let vidH = w * aspect
    if (vidH > h) {
      vidH = h
      vidW = h / aspect
    }
    this.videoRR.size = new vec2(vidW, vidH)
  }

  private buildVideoCell(parent: SceneObject, w: number, h: number): void {
    const rrObj = this.obj(parent, "VideoDisplay")
    const rr = rrObj.createComponent(RoundedRectangle.getTypeName()) as RoundedRectangle
    rr.cornerRadius = this.videoCornerRadius
    rr.initialize()
    rr.size = new vec2(w, h)
    this.videoRR = rr
    this.buildSpinner(parent)
  }

  /** A dim disc with a ring of 12 dots whose brightness chases around it, centred on the video cell. */
  private buildSpinner(parent: SceneObject): void {
    const root = this.obj(parent, "LoadingSpinner", new vec3(0, 0, TEXT_Z))
    const discObj = this.obj(root, "Disc")
    const disc = discObj.createComponent(RoundedRectangle.getTypeName()) as RoundedRectangle
    disc.cornerRadius = 4
    disc.initialize()
    disc.size = new vec2(8, 8)
    disc.backgroundColor = new vec4(0.04, 0.05, 0.08, 1)
    disc.opacity = 0.55
    const dots = 12
    const radius = 2.6
    for (let i = 0; i < dots; i++) {
      const a = (i / dots) * Math.PI * 2
      const o = this.obj(root, "Dot" + i, new vec3(Math.cos(a) * radius, Math.sin(a) * radius, 0.15))
      const d = o.createComponent(RoundedRectangle.getTypeName()) as RoundedRectangle
      d.cornerRadius = 0.5
      d.initialize()
      d.size = new vec2(1.0, 1.0)
      d.backgroundColor = new vec4(1, 1, 1, 1)
      d.opacity = 0.2
      this.spinnerDots.push(d)
    }
    root.enabled = false
    this.spinner = root
  }

  // ── Composition helpers (same pattern as ExampleVideoPlayer) ─────────────

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

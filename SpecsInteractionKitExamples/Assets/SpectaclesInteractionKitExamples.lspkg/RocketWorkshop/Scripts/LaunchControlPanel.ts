import "SpectaclesUIKit.lspkg/Scripts/Themes/ThemeService"
import {ToggleGroup} from "SpectaclesUIKit.lspkg/Scripts/Components/Toggle/ToggleGroup"
import {Button} from "SpectaclesUIKit.lspkg/Scripts/Components/Button/Button"
import {Slider} from "SpectaclesUIKit.lspkg/Scripts/Components/Slider/Slider"
import {FlexAlign, FlexJustify} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexTypes"
import {ElementContent} from "SpectaclesUIKit.lspkg/Scripts/Components/Content/ElementContent"
import NativeLogger from "SpectaclesInteractionKit.lspkg/Utils/NativeLogger"
import {validate} from "SpectaclesInteractionKit.lspkg/Utils/validate"
import {RocketConfigurator} from "./RocketConfigurator"
import {RocketUI} from "./RocketUI"

const TAG = "LaunchControlPanel"
const log = new NativeLogger(TAG)

const FLIGHT_END_EVENT_NAME = "flightEnded"

// Flight-path option → animation clip. A/B/C are the player-facing labels; the clips keep
// their authored names.
const FLIGHT_PATHS = [
  {label: "A", clip: "Base Layer Rocket 1"},
  {label: "B", clip: "Base Layer Rocket 2"},
  {label: "C", clip: "Base Layer Rocket 3"}
]

const MIN_PLAYBACK_SPEED = 1.0
const MAX_PLAYBACK_SPEED = 5.0
const DEFAULT_SPEED_VALUE = 0.0 // slider 0..1 → playback speed MIN..MAX

const PANEL_WIDTH = 38
const PANEL_HEIGHT = 72

/**
 * LaunchControlPanel — builds the rocket "launch controls" panel entirely in code and owns
 * the launch → takeoff → landing sequence.
 *
 * It is a plain class (not a @component): the RocketWorkshop entry point constructs it and
 * hands in the pieces it needs — the owning script (for DelayedCallbackEvent timers), the
 * authored AnimationPlayer, and the platform/sparks SceneObjects from the diorama. All UI
 * (Frame, launch Button, flight-path ToggleGroup, speed Slider, platform Switch) is created
 * here via the RocketUI helpers; nothing is wired through @input.
 */
export class LaunchControlPanel {
  private launchButton!: Button
  private launchButtonContent!: ElementContent
  private speedSlider!: Slider
  private flightPathStatusText!: Text

  private currentClip: AnimationClip | undefined
  private currentLaunchAnimationName: string = FLIGHT_PATHS[0].clip
  private flightInProgress = false

  private readonly audio: AudioComponent
  private readonly launchSFX = requireAsset("../SFX/ui-rocket-ignition_c-1db_stereo4824.wav") as AudioTrackAsset
  private readonly landSFX = requireAsset("../SFX/ui-rocket-land-cutoff-c_-1dB_stereo4824.wav") as AudioTrackAsset

  // Timed phases of the launch sequence.
  private engineStartedEvent!: DelayedCallbackEvent
  private engineReadyEvent!: DelayedCallbackEvent
  private rocketTakeOffEvent!: DelayedCallbackEvent
  private takeOffCompleteEvent!: DelayedCallbackEvent
  private landingStartedEvent!: DelayedCallbackEvent
  private launchSparksDisableEvent!: DelayedCallbackEvent

  constructor(
    private readonly script: BaseScriptComponent,
    parent: SceneObject,
    private readonly config: RocketConfigurator,
    private readonly rocketAnimationPlayer: AnimationPlayer,
    private readonly launchPlatform: SceneObject,
    private readonly launchSparks: SceneObject
  ) {
    // Audio source created in code — SFX assets loaded via requireAsset.
    const audioObj = RocketUI.obj(parent, "RocketLaunchAudio")
    this.audio = audioObj.createComponent("Component.AudioComponent") as AudioComponent

    this.createSequenceEvents()
    this.buildUI(parent)

    this.launchSparks.enabled = false
    this.subscribeToCurrentLaunchAnimationEndEvent()
  }

  // ─── UI construction ─────────────────────────────────────────────────────

  private buildUI(parent: SceneObject): void {
    const W = PANEL_WIDTH - 4
    const panel = RocketUI.frame(parent, "RocketLaunchControls", PANEL_WIDTH, PANEL_HEIGHT)
    const outer = RocketUI.flexColumn(panel, PANEL_WIDTH - 2, PANEL_HEIGHT - 2, {gap: 1.8, padX: 1.5, padY: 1})

    // Title
    RocketUI.flexChild(outer, {w: W, h: 8}, (t) => {
      RocketUI.label(t, "Launch Control", W, 8, {textSize: RocketUI.TITLE_SIZE, align: "center", fontWeight: "bold"})
    })

    // Big launch button
    RocketUI.flexChild(outer, {w: W, h: 10}, (b) => {
      this.launchButton = RocketUI.button(b, "Primary", "Capsule", W, 10)
      this.launchButtonContent = RocketUI.content(b, {text: "Launch!", textSize: RocketUI.LABEL_SIZE, fontWeight: "bold"})
      this.launchButton.onTriggerUp.add(() => this.onLaunchButton())
    })

    // Flight path — label + A/B/C toggle group + status readout
    RocketUI.flexChild(outer, {w: W, h: 6}, (l) => {
      RocketUI.label(l, "Flight Path", W, 6, {textSize: RocketUI.LABEL_SIZE, align: "left", fontWeight: "medium"})
    })

    const pathGroupContainer = RocketUI.obj(panel, "FlightPathToggleGroup")
    const pathGroup = pathGroupContainer.createComponent(ToggleGroup.getTypeName()) as ToggleGroup
    ;(pathGroup as any)._allowAllTogglesOff = false

    RocketUI.flexChild(outer, {w: W, h: 8}, (rowObj) => {
      const row = RocketUI.flexRow(rowObj, W, 8, {gap: 1.2, justify: FlexJustify.SpaceBetween})
      const btnWidth = (W - 2.4) / 3
      FLIGHT_PATHS.forEach((path, index) => {
        RocketUI.flexChild(row, {w: btnWidth, h: 8}, (cell) => {
          const btn = RocketUI.toggleBtn(cell, "PrimaryNeutral", "Rectangle", btnWidth, 8)
          RocketUI.content(cell, {text: path.label, textSize: RocketUI.BODY_SIZE, fontWeight: "bold"})
          if (index === 0) btn.isOn = true
          pathGroup.registerToggleable(btn, path.label)
        })
      })
    })

    RocketUI.flexChild(outer, {w: W, h: 4.5}, (s) => {
      this.flightPathStatusText = RocketUI.dynamicText(
        s, "FlightPathStatus", "Flight Path : A", RocketUI.BODY_SIZE,
        new vec4(1, 1, 1, 0.6), RocketUI.FONT_LIGHT, HorizontalAlignment.Left
      )
    })

    pathGroup.onToggleSelected.add((args) => this.onFlightPathSelected(args.value as string))

    // Flight speed — label + value readout + slider
    let speedValueText: Text
    RocketUI.flexChild(outer, {w: W, h: 6}, (headerObj) => {
      const header = RocketUI.flexRow(headerObj, W, 6, {
        justify: FlexJustify.SpaceBetween,
        align: FlexAlign.Center
      })
      RocketUI.flexChild(header, {w: W - 9, h: 6, grow: 1}, (lObj) => {
        RocketUI.label(lObj, "Flight Speed", W - 9, 6, {textSize: RocketUI.LABEL_SIZE, align: "left", fontWeight: "medium"})
      })
      RocketUI.flexChild(header, {w: 8, h: 6}, (vObj) => {
        speedValueText = RocketUI.dynamicText(
          vObj, "SpeedValue", this.speedLabel(DEFAULT_SPEED_VALUE), RocketUI.BODY_SIZE,
          new vec4(1, 1, 1, 0.75), RocketUI.FONT_REGULAR, HorizontalAlignment.Right
        )
      })
    })
    RocketUI.flexChild(outer, {w: W, h: 5.2}, (sObj) => {
      this.speedSlider = RocketUI.slider(sObj, W, DEFAULT_SPEED_VALUE)
      this.speedSlider.onValueChange.add((v: number) => {
        if (speedValueText) speedValueText.text = this.speedLabel(v)
      })
    })

    // Show platform — label + switch
    RocketUI.flexChild(outer, {w: W, h: 6}, (rowObj) => {
      const row = RocketUI.flexRow(rowObj, W, 6, {
        justify: FlexJustify.SpaceBetween,
        align: FlexAlign.Center
      })
      RocketUI.flexChild(row, {w: W - 8, h: 6, grow: 1}, (lObj) => {
        RocketUI.label(lObj, "Show Platform", W - 8, 6, {textSize: RocketUI.LABEL_SIZE, align: "left", fontWeight: "medium"})
      })
      RocketUI.flexChild(row, {w: 9, h: 5}, (switchObj) => {
        const platformSwitch = RocketUI.switchControl(switchObj, this.launchPlatform.enabled)
        platformSwitch.onFinished.add(() => {
          this.launchPlatform.enabled = platformSwitch.isOn
        })
      })
    })
  }

  private speedLabel(sliderValue: number): string {
    const speed = MathUtils.remap(sliderValue, 0, 1, MIN_PLAYBACK_SPEED, MAX_PLAYBACK_SPEED)
    return `${speed.toFixed(1)}x`
  }

  // ─── Flight path selection ─────────────────────────────────────────────────

  private onFlightPathSelected(label: string): void {
    const path = FLIGHT_PATHS.find((p) => p.label === label)
    if (!path) return
    this.currentLaunchAnimationName = path.clip
    this.subscribeToCurrentLaunchAnimationEndEvent()
  }

  // ─── Launch sequence ─────────────────────────────────────────────────────

  private createSequenceEvents(): void {
    this.engineStartedEvent = this.script.createEvent("DelayedCallbackEvent")
    this.engineStartedEvent.bind(() => this.engineStarted())
    this.engineReadyEvent = this.script.createEvent("DelayedCallbackEvent")
    this.engineReadyEvent.bind(() => this.engineReady())
    this.rocketTakeOffEvent = this.script.createEvent("DelayedCallbackEvent")
    this.rocketTakeOffEvent.bind(() => this.rocketTakeOff())
    this.takeOffCompleteEvent = this.script.createEvent("DelayedCallbackEvent")
    this.takeOffCompleteEvent.bind(() => this.takeOffCompleted())
    this.landingStartedEvent = this.script.createEvent("DelayedCallbackEvent")
    this.landingStartedEvent.bind(() => this.landingStarted())
    this.launchSparksDisableEvent = this.script.createEvent("DelayedCallbackEvent")
    this.launchSparksDisableEvent.bind(() => {
      this.launchSparks.enabled = false
    })
  }

  private onLaunchButton(): void {
    if (this.flightInProgress) return
    this.flightInProgress = true
    this.launchButton.enabled = false
    this.launchButtonContent.text = "Flight in Progress"
    this.launchButtonContent.textSize = RocketUI.BODY_SIZE
    this.engineStartedEvent.reset(0)
  }

  private engineStarted(): void {
    this.config.getExhaustControl()
    validate(this.config.exhaustControl)
    this.config.exhaustControl.setEngineSmokesValue(1.1)
    this.config.exhaustControl.turnOnExhausts()
    this.config.exhaustControl.turnOnSmokes()
    this.audio.audioTrack = this.launchSFX
    this.audio.play(1)
    this.engineReadyEvent.reset(0.5)
  }

  private engineReady(): void {
    validate(this.config.exhaustControl)
    this.config.exhaustControl.engineReady()
    this.config.exhaustControl.setEngineSmokesValue(0.8)
    this.rocketTakeOffEvent.reset(0.5)
  }

  private rocketTakeOff(): void {
    validate(this.config.exhaustControl)
    this.config.exhaustControl.setEngineSmokesValue(0.0)

    this.rocketAnimationPlayer.playClipAt(this.currentLaunchAnimationName, 0.0)
    this.rocketAnimationPlayer.getClip(this.currentLaunchAnimationName).playbackSpeed = MathUtils.remap(
      this.speedSlider.currentValue ?? 0, 0.0, 1.0, MIN_PLAYBACK_SPEED, MAX_PLAYBACK_SPEED
    )

    this.launchSparks.enabled = true
    this.launchSparksDisableEvent.reset(0.5)

    this.currentClip = this.rocketAnimationPlayer.getClip(this.currentLaunchAnimationName)
    validate(this.currentClip)
    this.landingStartedEvent.reset((this.currentClip.duration / this.currentClip.playbackSpeed) * 0.9)
    this.takeOffCompleteEvent.reset((this.currentClip.duration / this.currentClip.playbackSpeed) * 0.2)
  }

  private takeOffCompleted(): void {
    // The SIKLogLevelConfiguration Log Level Filter must be set to Info or higher to see this.
    log.i("Take Off Completed!")
  }

  private landingStarted(): void {
    log.i("Landing Started!")
    validate(this.config.exhaustControl)
    this.config.exhaustControl.turnOffExhausts()
    this.audio.audioTrack = this.landSFX
    this.audio.play(1)
  }

  private subscribeToCurrentLaunchAnimationEndEvent(): void {
    const currentAnimationClip = this.rocketAnimationPlayer.getClip(this.currentLaunchAnimationName)
    currentAnimationClip.animation.createEvent(FLIGHT_END_EVENT_NAME, currentAnimationClip.duration)
    this.rocketAnimationPlayer.onEvent.add(this.onAnimationEnd.bind(this))

    const path = FLIGHT_PATHS.find((p) => p.clip === this.currentLaunchAnimationName)
    if (path && this.flightPathStatusText) {
      this.flightPathStatusText.text = `Flight Path : ${path.label}`
    }
  }

  private onAnimationEnd(eventData: AnimationPlayerOnEventArgs): void {
    if (eventData.eventName !== FLIGHT_END_EVENT_NAME) return
    validate(this.config.exhaustControl)
    this.config.exhaustControl.turnOffSmokes()
    this.flightInProgress = false
    this.launchButton.enabled = true
    this.launchButtonContent.text = "Launch!"
    this.launchButtonContent.textSize = RocketUI.LABEL_SIZE
  }
}

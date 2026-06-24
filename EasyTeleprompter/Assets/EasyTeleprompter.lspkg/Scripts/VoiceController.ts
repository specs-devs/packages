import { Logger } from "Utilities.lspkg/Scripts/Utils/Logger";
import NativeLogger from "SpectaclesInteractionKit.lspkg/Utils/NativeLogger"
import {GoogleSlideBridge} from "./GoogleSlideBridge"
import {PresentationSwitcher} from "./PresentationSwitcher"

const log = new NativeLogger("SpeechToText")

@component
export class SpeechToText extends BaseScriptComponent {
  @input
  @hint("Text component to display transcriptions")
  text: Text

  @input
  @hint("Reference to the PresentationSwitcher component")
  presentationSwitcher: PresentationSwitcher

  @input
  @hint("Reference to the GoogleSlideBridge component")
  googleSlideBridge: GoogleSlideBridge

  @input
  @hint("Delay time (in seconds) to wait before confirming a command")
  commandDelay: number = 2.0

  @input
  @hint("The button image component to swap icons")
  buttonImage: Image

  @input
  @hint("Texture for the normal mic icon (listening off)")
  normalMicImage: Texture

  @input
  @hint("Texture for the listening mic icon (listening on)")
  listeningMicImage: Texture

  @input
  @hint("Enable this boolean if you are planning to Use Google Slide API and the Google Slide Bridge")
  useGoogleSlide: boolean = false

  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Logging Configuration</span>')

  @input
  @hint("Enable general logging")
  enableLogging: boolean = false

  @input
  @hint("Enable lifecycle logging (onAwake, onStart, etc.)")
  enableLoggingLifecycle: boolean = false

  private logger: Logger

  private asr: AsrModule = require("LensStudio:AsrModule")
  private options = null
  private isListening: boolean = false
  private lastTranscription: string = ""
  private commandPending: boolean = false
  private commandTimer: number = 0

  onAwake() {
    this.logger = new Logger("SpeechToText", this.enableLogging || this.enableLoggingLifecycle, true);

    if (this.enableLoggingLifecycle) {
      this.logger.debug("LIFECYCLE: onAwake() - Component initializing");
    }

    this.logger.debug("SpeechToText onAwake called")
    this.logger.debug(`Device: ${global.deviceInfoSystem.isSpectacles() ? "Spectacles" : "Editor"}`)

    // Create ASR options once (following working Depth Cache pattern)
    this.options = AsrModule.AsrTranscriptionOptions.create()
    this.options.silenceUntilTerminationMs = 1000
    this.options.mode = AsrModule.AsrMode.HighAccuracy

    // Register transcription update callback
    this.options.onTranscriptionUpdateEvent.add((args) => {
      this.logger.debug(`Transcription: ${args.text}, isFinal: ${args.isFinal}`)

      if (args.text.trim() === "") {
        this.logger.debug("Empty transcription, skipping")
        return
      }

      // Update text display
      this.text.text = args.text

      // Process final transcriptions
      if (args.isFinal) {
        this.logger.debug(`Final: ${args.text}`)
        if (this.isListening) {
          this.handleTranscription(args.text)
        } else {
          this.logger.debug("Listening disabled, ignoring")
        }
      }
    })

    // Register error callback
    this.options.onTranscriptionErrorEvent.add((errorCode) => {
      this.logger.error(`ASR Error: ${errorCode}`)
    })

    // Bind update event for command delay
    this.createEvent("UpdateEvent").bind(() => {
      this.update()
    })

    // Set initial button icon
    if (this.buttonImage && this.normalMicImage) {
      this.buttonImage.mainMaterial.mainPass.baseTex = this.normalMicImage
      this.logger.debug("Button icon set to normal")
    } else {
      this.logger.warn("Button image or normal mic image not assigned")
    }

    this.logger.debug("SpeechToText initialized successfully")
  }

  // Public method to toggle listening
  public toggleListening() {
    this.logger.debug("toggleListening() called")
    this.isListening = !this.isListening

    if (this.isListening) {
      this.logger.debug("Starting ASR transcription...")
      this.asr.startTranscribing(this.options)
      this.logger.debug("ASR started")

      if (this.buttonImage && this.listeningMicImage) {
        this.buttonImage.mainMaterial.mainPass.baseTex = this.listeningMicImage
        this.logger.debug("Button icon changed to listening")
      }
    } else {
      this.logger.debug("Stopping ASR transcription...")
      this.asr.stopTranscribing()
      this.logger.debug("ASR stopped")

      if (this.buttonImage && this.normalMicImage) {
        this.buttonImage.mainMaterial.mainPass.baseTex = this.normalMicImage
        this.logger.debug("Button icon changed to normal")
      }

      this.text.text = ""
      this.commandPending = false
      this.lastTranscription = ""
    }
  }

  private handleTranscription(transcription: string) {
    const normalizedText = transcription.trim().toLowerCase()

    if (normalizedText === "next" || normalizedText === "next.") {
      this.logger.debug("Detected 'next' command - starting delay")
      this.lastTranscription = normalizedText
      this.commandPending = true
      this.commandTimer = 0
    } else if (
      normalizedText === "previous" ||
      normalizedText === "previous." ||
      normalizedText === "go back" ||
      normalizedText === "go back."
    ) {
      this.logger.debug("Detected 'previous' command - starting delay")
      this.lastTranscription = normalizedText
      this.commandPending = true
      this.commandTimer = 0
    } else {
      this.logger.debug(`No command match for: "${transcription}"`)
      this.commandPending = false
    }
  }

  private update() {
    if (!this.commandPending) return

    this.commandTimer += getDeltaTime()
    this.logger.debug(`Command timer: ${this.commandTimer.toFixed(2)}s`)

    if (this.commandTimer >= this.commandDelay) {
      const currentText = this.text.text.trim().toLowerCase()
      if (currentText === this.lastTranscription) {
        this.logger.debug(`Command "${this.lastTranscription}" confirmed after delay`)
        if (this.isListening) {
          if (this.lastTranscription === "next" || this.lastTranscription === "next.") {
            this.navigateToNext()
          } else if (
            this.lastTranscription === "previous" ||
            this.lastTranscription === "go back" ||
            this.lastTranscription === "previous." ||
            this.lastTranscription === "go back."
          ) {
            this.navigateToPrevious()
          }
        }
      } else {
        this.logger.debug(`Command changed from "${this.lastTranscription}" to "${currentText}" - ignoring`)
      }
      this.commandPending = false
      this.lastTranscription = ""
    }
  }

  private navigateToNext() {
    if (this.presentationSwitcher && !this.useGoogleSlide) {
      this.presentationSwitcher.next()
    }
    if (this.googleSlideBridge && this.useGoogleSlide) {
      this.googleSlideBridge.next()
    }
    this.logger.debug("Going to next slide")
  }

  private navigateToPrevious() {
    if (this.presentationSwitcher && !this.useGoogleSlide) {
      this.presentationSwitcher.previous()
    }
    if (this.googleSlideBridge && this.useGoogleSlide) {
      this.googleSlideBridge.previous()
    }
    this.logger.debug("Going to previous slide")
  }
}

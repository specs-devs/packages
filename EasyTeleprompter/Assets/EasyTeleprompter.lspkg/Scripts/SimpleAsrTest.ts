import { Logger } from "Utilities.lspkg/Scripts/Utils/Logger";

@component
export class SimpleAsrTest extends BaseScriptComponent {
  @input
  @hint("Text component to display transcriptions")
  outputText: Text

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

  onAwake() {
    this.logger = new Logger("SimpleAsrTest", this.enableLogging || this.enableLoggingLifecycle, true);

    if (this.enableLoggingLifecycle) {
      this.logger.debug("LIFECYCLE: onAwake() - Component initializing");
    }

    print("=== SimpleAsrTest onAwake ===")
    print(`Device: ${global.deviceInfoSystem.isSpectacles() ? "Spectacles" : "Editor"}`)

    // Create options once
    this.options = AsrModule.AsrTranscriptionOptions.create()
    this.options.silenceUntilTerminationMs = 1000
    this.options.mode = AsrModule.AsrMode.HighAccuracy

    // Register callbacks
    this.options.onTranscriptionUpdateEvent.add((args) => {
      print(`ASR: "${args.text}" (final: ${args.isFinal})`)
      if (this.outputText) {
        this.outputText.text = args.text
      }
    })

    this.options.onTranscriptionErrorEvent.add((errorCode) => {
      print(`ASR ERROR: ${errorCode}`)
      if (this.outputText) {
        this.outputText.text = `Error: ${errorCode}`
      }
    })

    // Start immediately
    print("Starting ASR...")
    this.asr.startTranscribing(this.options)
    print("ASR started!")

    if (this.outputText) {
      this.outputText.text = "Listening..."
    }
  }

  onDestroy() {
    this.asr.stopTranscribing()
    print("ASR stopped")
  }
}

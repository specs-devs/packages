import { Logger } from "Utilities.lspkg/Scripts/Utils/Logger";
import {SIK} from "SpectaclesInteractionKit.lspkg/SIK"
import NativeLogger from "SpectaclesInteractionKit.lspkg/Utils/NativeLogger"
import {GoogleSlideBridge} from "./GoogleSlideBridge"
import {PresentationSwitcher} from "./PresentationSwitcher"

const log = new NativeLogger("MobileController")

@component
export class MobileController extends BaseScriptComponent {
  @input
  presentationSwitcher: PresentationSwitcher

  @input
  googleSlideBridge: GoogleSlideBridge

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

  onAwake() {
    this.logger = new Logger("MobileController", this.enableLogging || this.enableLoggingLifecycle, true);

    if (this.enableLoggingLifecycle) {
      this.logger.debug("LIFECYCLE: onAwake() - Component initializing");
    }

    this.createEvent("OnStartEvent").bind(() => {
      this.onStart()
    })
  }

  onStart() {
    // Retrieve MobileInputData from SIK's definitions.
    const mobileInputData = SIK.MobileInputData
    // Fetch the MotionController for the phone.
    const motionController = mobileInputData.motionController
    // Add touch event handler that uses the normalized position to decide next/previous.
    motionController.onTouchEvent.add((normalizedPosition, touchId, timestampMs, phase) => {
      // Wait until the touch is finished (Ended phase)
      if (phase !== MotionController.TouchPhase.Ended) return

      // Check if the touch occurred on the left half of the screen.
      if (normalizedPosition.x < 0.5) {
        this.logger.debug("Previous slide")
        this.navigateToPrevious()
      } else {
        this.logger.debug("Next slide")
        this.navigateToNext()
      }
    })
  }

  // Navigate to the next slide and synchronize across all platforms
  private navigateToNext() {
    // Update local presentation
    if (this.presentationSwitcher && !this.useGoogleSlide) {
      this.presentationSwitcher.next()
    }

    // Update Google Slides via direct API
    if (this.googleSlideBridge && this.useGoogleSlide) {
      this.googleSlideBridge.next()
    }
  }

  // Navigate to the previous slide and synchronize across all platforms
  private navigateToPrevious() {
    // Update local presentation
    if (this.presentationSwitcher && !this.useGoogleSlide) {
      this.presentationSwitcher.previous()
    }

    // Update Google Slides via direct API
    if (this.googleSlideBridge && this.useGoogleSlide) {
      this.googleSlideBridge.previous()
    }
  }
}

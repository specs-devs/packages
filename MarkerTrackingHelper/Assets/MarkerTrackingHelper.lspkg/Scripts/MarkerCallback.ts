/**
 * Specs Inc. 2026
 * Marker tracking callback handler that responds to marker found/lost events. Demonstrates
 * animation control based on marker tracking state for augmented reality experiences.
 */
import { Logger } from "Utilities.lspkg/Scripts/Utils/Logger";
import { bindStartEvent, bindUpdateEvent, bindLateUpdateEvent, bindDestroyEvent } from "SnapDecorators.lspkg/decorators";

@component
export class MarkerCallbacks extends BaseScriptComponent {
  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Animation Image</span>')
  @ui.label('<span style="color: #94A3B8; font-size: 11px;">Image component with animated texture to play when marker is found</span>')

  @input
  animationImage: Image;

  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Logging Configuration</span>')
  @ui.label('<span style="color: #94A3B8; font-size: 11px;">Control logging output for this script instance</span>')

  @input
  @hint("Enable general logging (animation cycles, events, etc.)")
  enableLogging: boolean = false;

  @input
  @hint("Enable lifecycle logging (onAwake, onStart, onUpdate, onDestroy, etc.)")
  enableLoggingLifecycle: boolean = false;

  // Logger instance
  private logger: Logger;

  private loop = 1;
  private offset = 0.0;

  /**
   * Called when component is initialized
   */
  onAwake(): void {
    // Initialize logger
    this.logger = new Logger("MarkerCallbacks", this.enableLogging || this.enableLoggingLifecycle, true);

    if (this.enableLoggingLifecycle) {
      this.logger.debug("LIFECYCLE: onAwake() - Component initializing");
    }
  }

  onMarkerFound() {
    this.logger.debug("Marker found");

    /* Play the animation when the marker is found */
    const textureProvider = this.animationImage.getMaterial(0).getPass(0)
      .baseTex.control as AnimatedTextureFileProvider;
    textureProvider.play(this.loop, this.offset);
  }

  onMarkerLost() {
    this.logger.debug("Marker Lost");

    /* Add custom logic here for when the marker is lost */
  }
}

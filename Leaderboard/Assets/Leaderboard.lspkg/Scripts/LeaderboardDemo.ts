/**
 * Specs Inc. 2026
 * Demo controller for the Leaderboard functionality.
 * This script connects UI buttons to the LeaderboardExample functionality
 * using Spectacles Interaction Kit.
 */
import { LeaderboardExample } from "./LeaderboardExample";
import { RectangleButton } from "SpectaclesUIKit.lspkg/Scripts/Components/Button/RectangleButton";
import { Logger } from "Utilities.lspkg/Scripts/Utils/Logger";
import { bindStartEvent, bindUpdateEvent, bindLateUpdateEvent, bindDestroyEvent } from "SnapDecorators.lspkg/decorators";

// Simple print-based logger
const log = {
  d: (msg: string) => print(msg),
  e: (msg: string) => print(`ERROR: ${msg}`)
};
@component
export class LeaderboardDemo extends BaseScriptComponent {
  /**
   * Reference to the LeaderboardExample component
   */
  @input
  @hint("Reference to the LeaderboardExample component")
  leaderboardExample: LeaderboardExample;

  /**
   * Button to create a new leaderboard
   */
  @input
  @hint("Button to create a new leaderboard")
  createLeaderboardButton: RectangleButton;

  /**
   * Button to load a previous leaderboard
   */
  @input
  @hint("Button to load a previous leaderboard")
  loadLeaderboardButton: RectangleButton;

  /**
   * Reference to the Submit Score button (must have RectangleButton component)
   */
  @input
  @allowUndefined
  @hint("Reference to the Submit Score button with RectangleButton component")
  submitScoreButton: RectangleButton;

  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Optional Status Display</span>')
  @ui.label('<span style="color: #94A3B8; font-size: 11px;">Optional text field to show status messages like "Score submitted!" or "Loading..."</span>')

  /**
   * Optional: Text component for debug/status messages
   */
  @input
  @allowUndefined
  @hint("(Optional) Text component for debug/status messages")
  statusText: Text;

  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Debug Settings</span>')

  /**
   * Flag to enable debug logging
   */
  @input
  @hint("Enable debug logging to console")
  debug: boolean = true;

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


  onAwake(): void {
    // Initialize logger
    this.logger = new Logger("LeaderboardDemo", this.enableLogging || this.enableLoggingLifecycle, true);

    if (this.enableLoggingLifecycle) {
      this.logger.debug("LIFECYCLE: onAwake() - Component initializing");
    }

    this.logger.debug("[LeaderboardDemo] Initializing");
    this.logger.debug("[LeaderboardDemo] Initializing");
  }

  /**
   * Called on start event
   */
  @bindStartEvent
  onStart(): void {
    this.logger.debug("[LeaderboardDemo] Start event triggered");
    this.logger.debug("[LeaderboardDemo] Start event triggered");
    this.validateReferences();
    this.setupButtonEvents();

    // Initialize with a default leaderboard name if needed
    if (!this.leaderboardExample.leaderboardName) {
      this.leaderboardExample.leaderboardName = "default_leaderboard";
    }
  }

  /**
   * Validates all required references
   */
  private validateReferences(): void {
    if (!this.leaderboardExample) {
      this.logger.debug("[LeaderboardDemo] ERROR: LeaderboardExample reference is missing");
      return;
    }

    this.debug &&
      this.logger.debug("[LeaderboardDemo] LeaderboardExample reference is valid");

    // All fields are now optional or managed by LeaderboardExample
    this.logger.debug("[LeaderboardDemo] Validation complete");

    // Check button references
    if (!this.createLeaderboardButton) {
      this.logger.debug("[LeaderboardDemo] WARNING: Create Leaderboard button reference is missing");
    }

    if (!this.submitScoreButton) {
      this.logger.debug("[LeaderboardDemo] WARNING: Submit Score button reference is missing");
    }
  }

  /**
   * Sets up button click events using Spectacles Interaction Kit
   */
  private setupButtonEvents(): void {
    // Create Leaderboard button
    if (this.createLeaderboardButton) {
      // Create an event callback function for the create leaderboard button
      const createLeaderboardCallback = () => {
        this.updateStatusText("Creating leaderboard...");

        // Create leaderboard (reads from user input in LeaderboardExample)
        this.leaderboardExample.createLeaderboard(true, () => {
          this.updateStatusText(`Created: ${this.leaderboardExample.leaderboardName}`);
          this.leaderboardExample.clearAllItems();
        });
      };

      // Add the event listener to the button onTriggerUp
      this.createLeaderboardButton.onTriggerUp.add(createLeaderboardCallback);
    } else {
      this.logger.debug("[LeaderboardDemo] WARNING: Create Leaderboard button not set");
    }

    // Submit Score button
    if (this.submitScoreButton) {
      // Create an event callback function for the submit score button
      const submitScoreCallback = () => {
        this.updateStatusText("Submitting score...");

        // Submit score (auto-generates score of 10 with user's name)
        this.leaderboardExample.submitScore();

        this.updateStatusText("Score submitted!");
      };

      // Add the event listener to the button onTriggerUp
      this.submitScoreButton.onTriggerUp.add(submitScoreCallback);
    } else {
      this.logger.debug("[LeaderboardDemo] WARNING: Submit Score button not set");
    }

    // Load Leaderboard button
    if (this.loadLeaderboardButton) {
      // Create an event callback function for the load leaderboard button
      const loadLeaderboardCallback = () => {
        this.updateStatusText("Loading previous leaderboard...");

        const leaderboards = this.leaderboardExample.getCreatedLeaderboards();

        if (leaderboards.length === 0) {
          this.updateStatusText("No previous leaderboards");
          return;
        }

        // Get the most recent different leaderboard
        let leaderboardToLoad = leaderboards[leaderboards.length - 1];
        if (leaderboards.length > 1) {
          for (let i = leaderboards.length - 1; i >= 0; i--) {
            if (leaderboards[i] !== this.leaderboardExample.leaderboardName) {
              leaderboardToLoad = leaderboards[i];
              break;
            }
          }
        }

        this.leaderboardExample.loadLeaderboard(leaderboardToLoad, () => {
          this.updateStatusText(`Loaded: ${leaderboardToLoad}`);
        });
      };

      // Add the event listener to the button onTriggerUp
      this.loadLeaderboardButton.onTriggerUp.add(loadLeaderboardCallback);
    } else {
      this.logger.debug("[LeaderboardDemo] WARNING: Load Leaderboard button not set");
    }
  }

  /**
   * Helper method to update status text
   */
  private updateStatusText(message: string): void {
    if (this.statusText) {
      this.statusText.text = message;
    }
    this.logger.debug(`[LeaderboardDemo] ${message}`);
  }
}

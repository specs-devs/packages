import { LeaderboardExample } from "./LeaderboardExample";
import { InteractorEvent } from "SpectaclesInteractionKit.lspkg/Core/Interactor/InteractorEvent";
import { Interactable } from "SpectaclesInteractionKit.lspkg/Components/Interaction/Interactable/Interactable";
import NativeLogger from "SpectaclesInteractionKit.lspkg/Utils/NativeLogger";

// Create a logger for debugging purposes
const log = new NativeLogger("LeaderboardLogger");

/**
 * Demo controller for the Leaderboard functionality.
 * This script connects UI buttons to the LeaderboardExample functionality
 * using Spectacles Interaction Kit.
 */
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
  createLeaderboardButton: Interactable;

  /**
   * Button to load a previous leaderboard
   */
  @input
  @hint("Button to load a previous leaderboard")
  loadLeaderboardButton: Interactable;

  /**
   * Reference to the Submit Score button (must have Interactable component)
   */
  @input
  @allowUndefined
  @hint("Reference to the Submit Score button with Interactable component")
  submitScoreButton: Interactable;

  /**
   * Reference to the Get Leaderboard button (must have Interactable component)
   */
  @input
  @allowUndefined
  @hint("Reference to the Get Leaderboard button with Interactable component")
  getLeaderboardButton: Interactable;

  /**
   * Reference to the leaderboard name input field scene object
   */
  @input
  @hint("Reference to the leaderboard name input text object")
  leaderboardNameInputObj: SceneObject;

  /**
   * Reference to the score input field scene object
   */
  @input
  @hint("Reference to the score input text object")
  scoreInputObj: SceneObject;

  /**
   * Flag to enable debug logging
   */

  /**
   * Flag to enable debug logging
   */
  @input
  @hint("Enable debug logging")
  debug: boolean = true;

  onAwake(): void {
    this.debug && print("[LeaderboardDemo] Initializing");
    log.d("[LeaderboardDemo] Initializing");

    // Create an event for onStart that we'll trigger after initialization
    this.createEvent("OnStartEvent").bind(() => {
      this.onStart();
      this.debug && print("[LeaderboardDemo] Start event triggered");
      log.d("[LeaderboardDemo] Start event triggered");
    });
  }

  /**
   * Called on start event
   */
  onStart(): void {
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
      print("[LeaderboardDemo] ERROR: LeaderboardExample reference is missing");
      log.e("[LeaderboardDemo] LeaderboardExample reference is missing");
      return;
    }

    this.debug &&
      print("[LeaderboardDemo] LeaderboardExample reference is valid");

    // Check input fields
    if (!this.leaderboardNameInputObj) {
      this.debug && print("[LeaderboardDemo] WARNING: Leaderboard name input object is not set");
    }

    if (!this.scoreInputObj) {
      this.debug && print("[LeaderboardDemo] WARNING: Score input object is not set");
    }

    // Check button references
    if (!this.createLeaderboardButton) {
      this.debug &&
        print(
          "[LeaderboardDemo] WARNING: Create Leaderboard button reference is missing"
        );
    }

    if (!this.submitScoreButton) {
      this.debug &&
        print(
          "[LeaderboardDemo] WARNING: Submit Score button reference is missing"
        );
    }

    if (!this.getLeaderboardButton) {
      this.debug &&
        print(
          "[LeaderboardDemo] WARNING: Get Leaderboard button reference is missing"
        );
    }
  }

  /**
   * Sets up button click events using Spectacles Interaction Kit
   */
  private setupButtonEvents(): void {
    // Create Leaderboard button
    if (this.createLeaderboardButton) {
      // Create an event callback function for the create leaderboard button
      const createLeaderboardCallback = (event: InteractorEvent) => {
        this.debug &&
          print("[LeaderboardDemo] Create Leaderboard button pressed");
        log.d("[LeaderboardDemo] Create Leaderboard button pressed");

        // Always clear the input fields to ensure we create a new leaderboard
        this.clearLeaderboardNameInputField();
        this.clearScoreInputField();

        // Generate a completely random name
        this.debug && print('[LeaderboardDemo] ALWAYS generating a new random leaderboard name');

        // Use the callback to ensure UI is updated after leaderboard is created
        this.leaderboardExample.createLeaderboard(true, () => {
          // Update the text input field with the current leaderboard name
          this.updateTextInputWithGeneratedName();
          this.debug && print(`[LeaderboardDemo] Created new leaderboard: "${this.leaderboardExample.leaderboardName}"`);

          // Clear the grid content to show empty leaderboard
          if (this.leaderboardExample.gridContentCreator) {
            this.leaderboardExample.gridContentCreator.clearAllItems();
            this.debug && print("[LeaderboardDemo] Cleared grid content for new leaderboard");
          }
        });
      };

      // Add the event listener to the button onInteractorTriggerStart
      this.createLeaderboardButton.onInteractorTriggerStart(
        createLeaderboardCallback
      );
    } else {
      print("[LeaderboardDemo] WARNING: Create Leaderboard button not set");
    }

    // Submit Score button
    if (this.submitScoreButton) {
      // Create an event callback function for the submit score button
      const submitScoreCallback = (event: InteractorEvent) => {
        this.debug && print("[LeaderboardDemo] Submit Score button pressed");
        log.d("[LeaderboardDemo] Submit Score button pressed");

        this.updateScoreValue();
        this.leaderboardExample.submitScore();

        // Update the score input field with the actual submitted score
        this.updateScoreInputWithSubmittedScore();
      };

      // Add the event listener to the button onInteractorTriggerStart
      this.submitScoreButton.onInteractorTriggerStart(submitScoreCallback);
    } else {
      print("[LeaderboardDemo] WARNING: Submit Score button not set");
    }

    // Get Leaderboard button
    if (this.getLeaderboardButton) {
      // Create an event callback function for the get leaderboard button
      const getLeaderboardCallback = (event: InteractorEvent) => {
        this.debug && print("[LeaderboardDemo] Get Leaderboard button pressed");
        log.d("[LeaderboardDemo] Get Leaderboard button pressed");

        this.leaderboardExample.getLeaderboard();
      };

      // Add the event listener to the button onInteractorTriggerStart
      this.getLeaderboardButton.onInteractorTriggerStart(
        getLeaderboardCallback
      );
    } else {
      print("[LeaderboardDemo] WARNING: Get Leaderboard button not set");
    }

    // Load Leaderboard button
    if (this.loadLeaderboardButton) {
      // Create an event callback function for the load leaderboard button
      const loadLeaderboardCallback = (event: InteractorEvent) => {
        this.debug &&
          print("[LeaderboardDemo] Load Leaderboard button pressed");
        log.d("[LeaderboardDemo] Load Leaderboard button pressed");

        // Get the list of created leaderboards
        const leaderboards = this.leaderboardExample.getCreatedLeaderboards();

        if (leaderboards.length === 0) {
          print("[LeaderboardDemo] No previous leaderboards to load");
          return;
        }

        // Get the most recent leaderboard (excluding the current one)
        let leaderboardToLoad = "";
        if (leaderboards.length === 1) {
          leaderboardToLoad = leaderboards[0];
        } else {
          // Find a different leaderboard than the current one
          for (let i = leaderboards.length - 1; i >= 0; i--) {
            if (leaderboards[i] !== this.leaderboardExample.leaderboardName) {
              leaderboardToLoad = leaderboards[i];
              break;
            }
          }

          // If we didn't find a different one, use the most recent
          if (!leaderboardToLoad) {
            leaderboardToLoad = leaderboards[leaderboards.length - 1];
          }
        }

        print(`[LeaderboardDemo] Loading previous leaderboard: "${leaderboardToLoad}"`);

        // Load the selected leaderboard
        this.leaderboardExample.loadLeaderboard(leaderboardToLoad, () => {
          // Update the text input field with the loaded leaderboard name
          this.updateTextInputWithGeneratedName();
          print(`[LeaderboardDemo] Loaded previous leaderboard: "${leaderboardToLoad}"`);
        });
      };

      // Add the event listener to the button onInteractorTriggerStart
      this.loadLeaderboardButton.onInteractorTriggerStart(
        loadLeaderboardCallback
      );
    } else {
      print("[LeaderboardDemo] WARNING: Load Leaderboard button not set");
    }
  }

  /* VARIANT IF YOU WANT TO RETRIEVE LEADERBOARD WITH NAME 

      // Load Leaderboard button
      if (this.loadLeaderboardButton) {
        // Create an event callback function for the load leaderboard button
        const loadLeaderboardCallback = (event: InteractorEvent) => {
          // Load the selected leaderboard
          this.leaderboardExample.loadLeaderboard("super_wolves_696", () => {
            // Update the text input field with the loaded leaderboard name
            this.updateTextInputWithGeneratedName();
            print(`[LeaderboardDemo] Loaded previous leaderboard: "super_wolves_696"`);
          });
        };
    }
   */

  /**
   * Updates the leaderboard name from the input field
   * Note: This method is kept for compatibility but is no longer used directly
   * in the Create Leaderboard button callback
   */
  private updateLeaderboardName(): void {
    if (!this.leaderboardExample) {
      this.debug &&
        print(
          "[LeaderboardDemo] ERROR: Cannot update leaderboard name, LeaderboardExample reference is missing"
        );
      log.e("[LeaderboardDemo] LeaderboardExample reference is missing");
      return;
    }

    if (!this.leaderboardNameInputObj) {
      this.debug &&
        print(
          "[LeaderboardDemo] WARNING: No leaderboard name input set, cannot update leaderboard name"
        );
      return;
    }

    // Get the input text from the object
    try {
      const textComponent = this.leaderboardNameInputObj.getComponent("Component.Text");
      if (textComponent && textComponent.text) {
        const name = textComponent.text.trim();
        if (name) {
          this.leaderboardExample.leaderboardName = name;
          this.debug &&
            print(`[LeaderboardDemo] Updated leaderboard name to "${name}"`);
          log.d(`[LeaderboardDemo] Updated leaderboard name to "${name}"`);
          return;
        }
      }

      // If we couldn't read the name, we'll let the LeaderboardExample generate one
      this.debug && print("[LeaderboardDemo] Could not read leaderboard name from input field, will use generated name");
    } catch (error) {
      print(
        `[LeaderboardDemo] ERROR: Failed to get leaderboard name from input: ${error}`
      );
      // Will use generated name instead
    }
  }

  /**
   * Gets the name from the input field if available
   */
  private getNameFromInputField(): string {
    if (!this.leaderboardNameInputObj) {
      return '';
    }

    try {
      const textComponent = this.leaderboardNameInputObj.getComponent("Component.Text");
      if (textComponent && textComponent.text) {
        return textComponent.text.trim();
      }
    } catch (error) {
      print(`[LeaderboardDemo] ERROR: Failed to get name from input field: ${error}`);
    }

    return '';
  }

  /**
   * Updates the text input field with the current name from LeaderboardExample
   */
  private updateTextInputWithGeneratedName(): void {
    if (!this.leaderboardExample) {
      this.debug &&
        print(
          "[LeaderboardDemo] ERROR: Cannot update text input, LeaderboardExample reference is missing"
        );
      log.e("[LeaderboardDemo] LeaderboardExample reference is missing");
      return;
    }

    if (!this.leaderboardNameInputObj) {
      this.debug &&
        print(
          "[LeaderboardDemo] WARNING: No leaderboard name input set, cannot update UI"
        );
      return;
    }

    // Get the current leaderboard name
    const currentName = this.leaderboardExample.leaderboardName;
    if (!currentName) {
      print("[LeaderboardDemo] ERROR: Leaderboard name is empty or undefined");
      return;
    }

    // Force update the text component with the current leaderboard name
    try {
      // Try to get the text component
      const textComponent = this.leaderboardNameInputObj.getComponent("Component.Text");
      if (textComponent) {
        // Always set the text to ensure it updates
        textComponent.text = currentName;

        // Log the update
        print(`[LeaderboardDemo] FORCED UI UPDATE: Text input set to: "${currentName}"`);
        log.d(`[LeaderboardDemo] FORCED UI UPDATE: Text input set to: "${currentName}"`);

        // Try to force a UI refresh by toggling visibility
        const visibilityComponent = this.leaderboardNameInputObj.getComponent("Component.ScreenTransform");
        if (visibilityComponent) {
          // Toggle visibility to force refresh
          const wasEnabled = this.leaderboardNameInputObj.enabled;
          this.leaderboardNameInputObj.enabled = false;
          // Re-enable immediately
          this.leaderboardNameInputObj.enabled = true;
          this.debug && print("[LeaderboardDemo] Toggled visibility to force UI refresh");
        }
      } else {
        print("[LeaderboardDemo] ERROR: Text component not found on leaderboardNameInputObj");
      }
    } catch (error) {
      print(
        `[LeaderboardDemo] ERROR: Failed to update text input with name: ${error}`
      );
    }
  }

  /**
   * Clears the score input field
   */
  private clearScoreInputField(): void {
    if (!this.scoreInputObj) {
      this.debug &&
        print(
          "[LeaderboardDemo] WARNING: No score input set, cannot clear input field"
        );
      return;
    }

    // Clear the text component
    try {
      const textComponent = this.scoreInputObj.getComponent("Component.Text");
      if (textComponent) {
        textComponent.text = '';
        this.debug && print("[LeaderboardDemo] Cleared score input field");
      } else {
        this.debug && print("[LeaderboardDemo] ERROR: Text component not found on scoreInputObj");
      }
    } catch (error) {
      print(
        `[LeaderboardDemo] ERROR: Failed to clear score input field: ${error}`
      );
    }
  }

  /**
   * Clears the leaderboard name input field
   */
  private clearLeaderboardNameInputField(): void {
    if (!this.leaderboardNameInputObj) {
      this.debug &&
        print(
          "[LeaderboardDemo] WARNING: No leaderboard name input set, cannot clear input field"
        );
      return;
    }

    // Clear the text component
    try {
      const textComponent = this.leaderboardNameInputObj.getComponent("Component.Text");
      if (textComponent) {
        textComponent.text = '';
        this.debug && print("[LeaderboardDemo] Cleared leaderboard name input field");
      } else {
        this.debug && print("[LeaderboardDemo] ERROR: Text component not found on leaderboardNameInputObj");
      }
    } catch (error) {
      print(
        `[LeaderboardDemo] ERROR: Failed to clear leaderboard name input field: ${error}`
      );
    }
  }

  private updateScoreInputWithSubmittedScore(): void {
    if (!this.leaderboardExample) {
      this.debug &&
        print(
          "[LeaderboardDemo] ERROR: Cannot update score input, LeaderboardExample reference is missing"
        );
      return;
    }

    if (!this.scoreInputObj) {
      this.debug &&
        print(
          "[LeaderboardDemo] WARNING: No score input object set, cannot update UI"
        );
      return;
    }

    // Update the text component with the submitted score
    try {
      const textComponent = this.scoreInputObj.getComponent("Component.Text");
      if (textComponent) {
        // Access the lastSubmittedScore from LeaderboardExample
        const submittedScore = this.leaderboardExample['lastSubmittedScore'];
        if (submittedScore !== undefined) {
          // Format the score to remove decimal places if it's a whole number
          const formattedScore = Number.isInteger(submittedScore) ?
            submittedScore.toString() :
            Math.round(submittedScore).toString();

          textComponent.text = formattedScore;
          this.debug &&
            print(`[LeaderboardDemo] Updated score input with submitted score: ${formattedScore}`);
          log.d(`[LeaderboardDemo] Updated score input with submitted score: ${formattedScore}`);
        }
      } else {
        this.debug && print("[LeaderboardDemo] ERROR: Text component not found on scoreInputObj");
      }
    } catch (error) {
      print(
        `[LeaderboardDemo] ERROR: Failed to update score input with submitted score: ${error}`
      );
    }
  }

  /**
   * Updates the score value from the input field
   */
  private updateScoreValue(): void {
    if (!this.leaderboardExample) {
      this.debug &&
        print(
          "[LeaderboardDemo] ERROR: Cannot update score, LeaderboardExample reference is missing"
        );
      return;
    }

    if (!this.scoreInputObj) {
      this.debug &&
        print(
          "[LeaderboardDemo] WARNING: No score input set, using default score of 10"
        );
      this.leaderboardExample.scoreToSubmit = 10; // Use default score of 10
      return;
    }

    // Get the score input text from the object
    try {
      const textComponent = this.scoreInputObj.getComponent("Component.Text");
      if (textComponent && textComponent.text) {
        const scoreText = textComponent.text.trim();
        const score = parseInt(scoreText);
        if (!isNaN(score) && score >= 0) {
          this.leaderboardExample.scoreToSubmit = score;
          this.debug &&
            print(`[LeaderboardDemo] Updated score to ${score}`);
          log.d(`[LeaderboardDemo] Updated score to ${score}`);
          return;
        }
      }

      // Use default score of 10 if input parsing failed
      this.debug && print("[LeaderboardDemo] Could not read valid score from input, using default score of 10");
      this.leaderboardExample.scoreToSubmit = 10; // Use default score of 10
    } catch (error) {
      print(
        `[LeaderboardDemo] ERROR: Failed to get score value from input: ${error}`
      );
      this.leaderboardExample.scoreToSubmit = 10; // Use default score of 10
    }
  }
}

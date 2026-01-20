import { GridContentCreator } from "./GridContentCreatorLeaderboard";

/**
 * Leaderboard Manager for Snapchat Spectacles
 * This component provides methods to:
 * - Create a new leaderboard with a specified name
 * - Submit a random score to the leaderboard
 * - Get and display leaderboard entries visually
 */
@component
export class LeaderboardExample extends BaseScriptComponent {
  private leaderboardModule = require('LensStudio:LeaderboardModule');
  private currentLeaderboardInstance: Leaderboard;

  // Current leaderboard name
  leaderboardName: string = '';
  
  // Keep track of created leaderboards
  private createdLeaderboards: string[] = [];

  // Arrays for generating random leaderboard names
  private adjectives: string[] = [
    "swift", "brave", "mighty", "golden", "silver", "crystal", "royal", "epic",
    "cosmic", "mystic", "super", "mega", "ultra", "hyper", "turbo", "power",
    "grand", "elite", "prime", "master"
  ];

  private nouns: string[] = [
    "champions", "legends", "heroes", "titans", "warriors", "stars", "victors",
    "masters", "kings", "queens", "dragons", "eagles", "lions", "tigers", "wolves",
    "panthers", "falcons", "rockets", "thunder", "lightning"
  ];

  @input
  @hint("Score to submit (if left at -1, a random score will be generated)")
  scoreToSubmit: number = 10;

  @input
  @hint("Reference to GridContentCreator to update the UI")
  gridContentCreator: GridContentCreator;

  /**
   * Array of leaderboard entries that can be used to populate the UI
   */
  private leaderboardEntries: Array<{ name: string, score: number, rank: number, isTestData: boolean }> = [];

  onAwake() {
    print("[LeaderboardExample] Initialized");
  }

  /**
   * Gets the list of created leaderboards
   */
  getCreatedLeaderboards(): string[] {
    return this.createdLeaderboards;
  }
  
  /**
   * Loads a specific leaderboard by name
   * @param leaderboardName The name of the leaderboard to load
   * @param callback Optional callback function to be called after the leaderboard is loaded
   */
  loadLeaderboard(leaderboardName: string, callback?: () => void): void {
    if (!leaderboardName) {
      print("[LeaderboardExample] ERROR: Cannot load leaderboard with empty name");
      return;
    }
    
    this.leaderboardName = leaderboardName;
    print(`[LeaderboardExample] Loading existing leaderboard: "${this.leaderboardName}"`);
    
    const leaderboardCreateOptions = Leaderboard.CreateOptions.create();
    leaderboardCreateOptions.name = this.leaderboardName;
    leaderboardCreateOptions.ttlSeconds = 800000;  // Time-to-live in seconds (about 9 days)
    leaderboardCreateOptions.orderingType = 1;     // 1 = Descending order (higher scores ranked higher)
    
    this.leaderboardModule.getLeaderboard(
      leaderboardCreateOptions,
      (leaderboardInstance) => {
        print(`[LeaderboardExample] Successfully loaded leaderboard: "${this.leaderboardName}"`);
        this.currentLeaderboardInstance = leaderboardInstance;
        
        // Get the leaderboard entries immediately
        this.getLeaderboard();
        
        // Call the callback if provided
        if (callback) {
          callback();
        }
      },
      (status) => {
        print(`[LeaderboardExample] Failed to load leaderboard, status: ${status}`);
      }
    );
  }
  
  /**
   * Creates a new leaderboard or loads an existing one.
   * If generateNewName is true, a new name will be generated.
   * Otherwise, the current leaderboardName property will be used.
   * @param generateNewName Whether to generate a new name
   * @param callback Optional callback function to be called after the leaderboard is created
   */
  createLeaderboard(generateNewName: boolean = true, callback?: () => void): void {
    // Reset score tracking when creating a new leaderboard
    if (generateNewName) {
      // Reset the last submitted score
      this.lastSubmittedScore = 0;
      print("[LeaderboardExample] Reset score tracking for new leaderboard");
      
      // Clear existing leaderboard entries
      this.leaderboardEntries = [];
      
      // Generate a completely random leaderboard name
      const randomAdj = this.adjectives[Math.floor(Math.random() * this.adjectives.length)];
      const randomNoun = this.nouns[Math.floor(Math.random() * this.nouns.length)];
      const randomNum = Math.floor(Math.random() * 1000);
      const generatedName = `${randomAdj}_${randomNoun}_${randomNum}`;

      // Update the leaderboardName property with the generated name
      this.leaderboardName = generatedName;
      
      // Add to the list of created leaderboards
      if (!this.createdLeaderboards.includes(this.leaderboardName)) {
        this.createdLeaderboards.push(this.leaderboardName);
      }
      
      print(`[LeaderboardExample] Generating new random leaderboard name: "${this.leaderboardName}"`);
      print(`[LeaderboardExample] Total leaderboards created: ${this.createdLeaderboards.length}`);
    } else {
      print(`[LeaderboardExample] Using existing leaderboard name: "${this.leaderboardName}"`);
    }

    const leaderboardCreateOptions = Leaderboard.CreateOptions.create();
    leaderboardCreateOptions.name = this.leaderboardName;
    leaderboardCreateOptions.ttlSeconds = 800000;  // Time-to-live in seconds (about 9 days)
    leaderboardCreateOptions.orderingType = 1;     // 1 = Descending order (higher scores ranked higher)

    this.leaderboardModule.getLeaderboard(
      leaderboardCreateOptions,
      (leaderboardInstance) => {
        print(`[LeaderboardExample] Successfully created/loaded leaderboard: "${this.leaderboardName}"`);
        this.currentLeaderboardInstance = leaderboardInstance;
        
        // Call the callback if provided
        if (callback) {
          callback();
        }
      },
      (status) => {
        print(`[LeaderboardExample] Failed to create/load leaderboard, status: ${status}`);
      }
    );
  }

  /**
   * Last submitted score value (for UI updates)
   */
  private lastSubmittedScore: number = 0;

  /**
   * Submits a score to the current leaderboard
   * Always uses the scoreToSubmit value (default: 10)
   */
  submitScore(): void {
    if (!this.currentLeaderboardInstance) {
      print("[LeaderboardExample] ERROR: No leaderboard loaded. Call createLeaderboard first.");
      return;
    }
    
    // Always use the fixed score value (default: 10)
    // If this is not the first submission, increment it by 10
    let scoreValue: number;
    
    if (this.lastSubmittedScore === 0) {
      // First submission for this leaderboard
      scoreValue = this.scoreToSubmit;
      print(`[LeaderboardExample] First submission, using score: ${scoreValue}`);
    } else {
      // Subsequent submission, increment by 10
      scoreValue = this.lastSubmittedScore + 10;
      print(`[LeaderboardExample] Incrementing score from ${this.lastSubmittedScore} to ${scoreValue}`);
    }

    // Store the actual score being submitted
    this.lastSubmittedScore = scoreValue;
    print(`[LeaderboardExample] Submitting score: ${scoreValue}`);

    this.currentLeaderboardInstance.submitScore(
      scoreValue,
      this.submitScoreSuccessCallback.bind(this),
      (status) => {
        print(`[Leaderboard] Submit failed, status: ${status}`);
      }
    );
  }

  /**
   * Gets the current leaderboard entries and updates the UI
   */
  getLeaderboard(): void {
    if (!this.currentLeaderboardInstance) {
      print("[LeaderboardExample] ERROR: No leaderboard loaded. Call createLeaderboard first.");
      return;
    }

    print("[LeaderboardExample] Retrieving leaderboard entries...");

    const retrievalOptions = Leaderboard.RetrievalOptions.create();
    retrievalOptions.usersLimit = 50; // Get up to 10 entries
    retrievalOptions.usersType = Leaderboard.UsersType.Global; // Global leaderboard

    this.currentLeaderboardInstance.getLeaderboardInfo(
      retrievalOptions,
      (otherRecords, currentUserRecord) => {
        this.processLeaderboardData(otherRecords, currentUserRecord);
        this.updateGridContent();
      },
      (status) => {
        print(`[LeaderboardExample] Failed to get leaderboard entries: ${status}`);
      }
    );
  }

  submitScoreSuccessCallback(currentUserInfo): void {
    print('[LeaderboardExample] Score successfully submitted!');
    if (!isNull(currentUserInfo)) {
      const userName = currentUserInfo.snapchatUser?.displayName || 'Unknown User';

      // Use our last submitted score instead of the one from currentUserInfo
      // This ensures we're displaying what we actually submitted
      print(`[LeaderboardExample] User: ${userName}, Score: ${this.lastSubmittedScore}`);

      // Automatically refresh the leaderboard after submitting a score
      this.getLeaderboard();
    }
  }

  /**
   * Processes leaderboard data into a format that can be used for UI
   */
  private processLeaderboardData(otherRecords: any[], currentUserRecord: any): void {
    // Clear previous entries
    this.leaderboardEntries = [];

    // Add current user if available
    if (currentUserRecord && currentUserRecord.snapchatUser) {
      const isTestData = this.isTestDataName(currentUserRecord.snapchatUser.displayName);

      // Use our lastSubmittedScore instead of the one from the server
      // This ensures we're displaying what we actually submitted
      const userScore = this.lastSubmittedScore > 0 ? this.lastSubmittedScore : (currentUserRecord.score || 0);

      this.leaderboardEntries.push({
        name: currentUserRecord.snapchatUser.displayName || "Current User",
        score: userScore,
        rank: 0, // Will determine rank after sorting
        isTestData: isTestData
      });

      print(`[LeaderboardExample] Using score ${userScore} for current user (server reported: ${currentUserRecord.score})`);
    }

    // Add other entries
    otherRecords.forEach(record => {
      if (record && record.snapchatUser) {
        const isTestData = this.isTestDataName(record.snapchatUser.displayName);
        this.leaderboardEntries.push({
          name: record.snapchatUser.displayName || "Unknown User",
          score: record.score || 0,
          rank: 0, // Will determine rank after sorting
          isTestData: isTestData
        });
      }
    });

    // Sort by score (higher scores first)
    this.leaderboardEntries.sort((a, b) => b.score - a.score);

    // Assign ranks
    this.leaderboardEntries.forEach((entry, index) => {
      entry.rank = index + 1;
    });

    // Print entries to console
    print(`[LeaderboardExample] Found ${this.leaderboardEntries.length} entries:`);
    this.leaderboardEntries.forEach((entry) => {
      const testLabel = entry.isTestData ? " [TEST DATA]" : "";
      print(`[LeaderboardExample] #${entry.rank}: ${entry.name} - ${entry.score}${testLabel}`);
    });
  }

  /**
   * Helper method to identify names that are likely test data
   */
  private isTestDataName(name: string): boolean {
    if (!name) return false;

    // Common test data names
    const testNames = [
      "John Doe", "Jane Smith", "Mark Johnson", "Emily Brown",
      "Alex Wilson", "Sophia Miller", "Daniel Davis", "Olivia Taylor",
      "William Anderson", "Ella Martinez"
    ];

    // Check if the name matches any known test names
    for (const testName of testNames) {
      if (name.startsWith(testName)) {
        return true;
      }
    }

    // Check for common patterns in test data names
    return name.includes("Test") || name.includes("Mock") ||
      name.includes("Demo") || name.includes("Example");
  }

  /**
   * Updates the grid content UI with leaderboard entries
   */
  private updateGridContent(): void {
    if (!this.gridContentCreator) {
      print("[LeaderboardExample] ERROR: No gridContentCreator reference. Set it in the Inspector.");
      return;
    }

    if (this.gridContentCreator && typeof this.gridContentCreator.updateLeaderboardEntries === "function") {
      this.gridContentCreator.updateLeaderboardEntries(this.leaderboardEntries);
    } else {
      print("[LeaderboardExample] ERROR: GridContentCreator doesn't have updateLeaderboardEntries method.");
    }
  }
}
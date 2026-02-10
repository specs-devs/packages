/**
 * Specs Inc. 2026
 * Leaderboard manager for Snapchat Spectacles. Handles leaderboard creation, score submission,
 * and dynamic UI generation with GridLayout integration for displaying competitive rankings.
 */
import { GridLayout } from "SpectaclesUIKit.lspkg/Scripts/Components/GridLayout/GridLayout";
import { RectangleButton } from "SpectaclesUIKit.lspkg/Scripts/Components/Button/RectangleButton";
import { ScrollWindow } from "SpectaclesUIKit.lspkg/Scripts/Components/ScrollWindow/ScrollWindow";
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

  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Grid Configuration</span>')
  @ui.label('<span style="color: #94A3B8; font-size: 11px;">IMPORTANT ScrollWindow setup:</span>')
  @ui.label('<span style="color: #94A3B8; font-size: 11px;">1. GridLayout should be child of ScrollWindow content area</span>')
  @ui.label('<span style="color: #94A3B8; font-size: 11px;">2. GridLayout position should be at TOP of content (not centered)</span>')
  @ui.label('<span style="color: #94A3B8; font-size: 11px;">3. Disable Scroll Snapping OR set Snap Region = cell height + gap</span>')

  @input
  @allowUndefined
  @hint("(Optional) ScrollWindow component - will auto-update scroll dimensions as entries grow")
  scrollWindow: ScrollWindow;

  @input
  @hint("Reference to GridLayout component that will display leaderboard entries")
  gridLayout: GridLayout;

  @input
  @hint("Prefab template for leaderboard items (should have RectangleButton with Rank/Name/Score Text children)")
  itemPrefab: ObjectPrefab;

  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Display Settings</span>')

  @input
  @hint("Number of placeholder buttons to show initially")
  initialPlaceholderCount: number = 3;

  @input
  @hint("Color for test data entries")
  testDataColor: vec4 = new vec4(1, 0.7, 0.7, 1);

  @input
  @hint("Color for regular entries")
  regularColor: vec4 = new vec4(1, 1, 1, 1);

  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Debug Settings</span>')

  @input
  @hint("Enable debug logging")
  debug: boolean = false;

  /**
   * Array of leaderboard entries that can be used to populate the UI
   */
  private leaderboardEntries: Array<{ name: string, score: number, rank: number, isTestData: boolean }> = [];

  /**
   * Instantiated button scene objects
   */
  private leaderboardButtons: SceneObject[] = [];

  /**
   * Maps of alternative names for text components
   */
  private fieldNameMaps = {
    "Rank": ["Rank", "Position", "Placement", "RankText"],
    "Name": ["Name", "PlayerName", "NameText", "UserName"],
    "Score": ["Score", "ScoreText", "Points", "PointsText"]
  };

  onAwake() {
    print("[LeaderboardExample] Initialized");

    // Delay initialization to ensure GridLayout is ready
    const delayedEvent = this.createEvent("DelayedCallbackEvent");
    delayedEvent.bind(() => {
      this.initializeGrid();
    });
    delayedEvent.reset(0.1);
  }

  /**
   * Initializes the grid with empty placeholder buttons
   */
  private initializeGrid(): void {
    if (!this.gridLayout) {
      print("[LeaderboardExample] ERROR: GridLayout reference is missing!");
      return;
    }

    if (!this.itemPrefab) {
      print("[LeaderboardExample] ERROR: Item prefab reference is missing!");
      return;
    }

    this.debug && print("[LeaderboardExample] Initializing grid with placeholder buttons");

    // Create initial placeholder buttons
    this.createLeaderboardButtons(this.initialPlaceholderCount);
  }

  /**
   * Creates leaderboard button instances from prefab
   * @param count Number of buttons to create
   */
  private createLeaderboardButtons(count: number): void {
    const gridParent = this.gridLayout.getSceneObject();

    // Clear existing buttons
    this.leaderboardButtons.forEach(button => {
      if (button) {
        button.destroy();
      }
    });
    this.leaderboardButtons = [];

    // Update GridLayout configuration
    this.gridLayout.rows = count;
    this.gridLayout.columns = 1;

    this.debug && print(`[LeaderboardExample] Creating ${count} leaderboard buttons`);

    // Create buttons from prefab
    for (let i = 0; i < count; i++) {
      const buttonObj = this.itemPrefab.instantiate(gridParent);

      // Initialize RectangleButton if it exists
      const button = buttonObj.getComponent(RectangleButton.getTypeName()) as RectangleButton;
      if (button && typeof button.initialize === "function") {
        try {
          button.initialize();
          this.debug && print(`[LeaderboardExample] Initialized button ${i+1}`);
        } catch (e) {
          this.debug && print(`[LeaderboardExample] Button ${i+1} already initialized`);
        }
      }

      // Set default placeholder values
      this.updateButtonContent(buttonObj, {
        name: "placeholder",
        score: 0,
        rank: i + 1,
        isTestData: false
      });

      this.leaderboardButtons.push(buttonObj);
      buttonObj.enabled = true;
    }

    // Re-layout the grid
    if (this.gridLayout.initialize) {
      this.gridLayout.initialize();
    }
    if (this.gridLayout.layout) {
      this.gridLayout.layout();
    }

    // Update ScrollWindow dimensions dynamically based on grid content
    if (this.scrollWindow) {
      this.updateScrollWindowDimensions(count);
    }

    this.debug && print(`[LeaderboardExample] Created ${this.leaderboardButtons.length} buttons`);
  }

  /**
   * Updates ScrollWindow scroll dimensions based on number of entries
   * Pattern: gap, item, gap, item, gap, item...
   * Example: 3 items with height=7, gap=1: 1+7+1+7+1+7 = 24
   * Formula: entryCount × (itemHeight + gap)
   *
   * @param entryCount Number of entries in the grid
   */
  private updateScrollWindowDimensions(entryCount: number): void {
    if (!this.scrollWindow || !this.gridLayout) {
      print("[LeaderboardExample] ERROR: ScrollWindow or GridLayout is null!");
      return;
    }

    // Calculate total height: entryCount × (itemHeight + gap)
    // This accounts for one gap before each item
    const itemHeight = this.gridLayout.cellSize.y;
    const gap = this.gridLayout.cellPadding.y; // Top padding = gap between items
    const totalHeight = entryCount * (itemHeight + gap);

    // Get current values
    const windowSize = this.scrollWindow.windowSize;
    const currentDimensions = this.scrollWindow.scrollDimensions;
    const currentScrollPos = this.scrollWindow.scrollPosition;

    // Get all scene objects and their transforms
    const scrollWindowObj = this.scrollWindow.getSceneObject();
    const gridObj = this.gridLayout.getSceneObject();
    const scrollWindowParent = scrollWindowObj.getParent();

    print(`[LeaderboardExample] ======================================`);
    print(`[LeaderboardExample] === COMPLETE POSITION DEBUG ===`);
    print(`[LeaderboardExample] ======================================`);
    print(`[LeaderboardExample] Entry count: ${entryCount}`);
    print(`[LeaderboardExample] Calculated: itemHeight=${itemHeight}, gap=${gap}, totalHeight=${totalHeight}`);
    print(`[LeaderboardExample] `);

    // ScrollWindow hierarchy and positions
    print(`[LeaderboardExample] --- SCROLLWINDOW ---`);
    print(`[LeaderboardExample] ScrollWindow SceneObject: ${scrollWindowObj.name}`);
    const swLocalPos = scrollWindowObj.getTransform().getLocalPosition();
    const swWorldPos = scrollWindowObj.getTransform().getWorldPosition();
    print(`[LeaderboardExample] ScrollWindow Local Position: (${swLocalPos.x}, ${swLocalPos.y}, ${swLocalPos.z})`);
    print(`[LeaderboardExample] ScrollWindow World Position: (${swWorldPos.x}, ${swWorldPos.y}, ${swWorldPos.z})`);
    if (scrollWindowParent) {
      print(`[LeaderboardExample] ScrollWindow Parent: ${scrollWindowParent.name}`);
      const parentWorldPos = scrollWindowParent.getTransform().getWorldPosition();
      print(`[LeaderboardExample] ScrollWindow Parent World Position: (${parentWorldPos.x}, ${parentWorldPos.y}, ${parentWorldPos.z})`);
    }
    print(`[LeaderboardExample] ScrollWindow windowSize: (${windowSize.x}, ${windowSize.y})`);
    print(`[LeaderboardExample] ScrollWindow OLD scrollDimensions: (${currentDimensions.x}, ${currentDimensions.y})`);
    print(`[LeaderboardExample] ScrollWindow OLD scrollPosition: (${currentScrollPos.x}, ${currentScrollPos.y})`);
    print(`[LeaderboardExample] `);

    // GridLayout hierarchy and positions
    print(`[LeaderboardExample] --- GRIDLAYOUT ---`);
    print(`[LeaderboardExample] GridLayout SceneObject: ${gridObj.name}`);
    const gridLocalPos = gridObj.getTransform().getLocalPosition();
    const gridWorldPos = gridObj.getTransform().getWorldPosition();
    print(`[LeaderboardExample] GridLayout OLD Local Position: (${gridLocalPos.x}, ${gridLocalPos.y}, ${gridLocalPos.z})`);
    print(`[LeaderboardExample] GridLayout OLD World Position: (${gridWorldPos.x}, ${gridWorldPos.y}, ${gridWorldPos.z})`);
    const gridParent = gridObj.getParent();
    if (gridParent) {
      print(`[LeaderboardExample] GridLayout Parent: ${gridParent.name}`);
      const gridParentWorldPos = gridParent.getTransform().getWorldPosition();
      print(`[LeaderboardExample] GridLayout Parent World Position: (${gridParentWorldPos.x}, ${gridParentWorldPos.y}, ${gridParentWorldPos.z})`);
    }
    print(`[LeaderboardExample] GridLayout cellSize: (${this.gridLayout.cellSize.x}, ${this.gridLayout.cellSize.y})`);
    print(`[LeaderboardExample] GridLayout cellPadding: (${this.gridLayout.cellPadding.x}, ${this.gridLayout.cellPadding.y}, ${this.gridLayout.cellPadding.z}, ${this.gridLayout.cellPadding.w})`);
    print(`[LeaderboardExample] GridLayout totalCellSize: (${this.gridLayout.totalCellSize.x}, ${this.gridLayout.totalCellSize.y})`);
    print(`[LeaderboardExample] `);

    // Log first 5 and last 5 button positions (or all if less than 10)
    print(`[LeaderboardExample] --- BUTTON POSITIONS ---`);
    const numButtonsToLog = Math.min(5, this.leaderboardButtons.length);
    for (let i = 0; i < numButtonsToLog; i++) {
      const button = this.leaderboardButtons[i];
      if (button) {
        const btnLocalPos = button.getTransform().getLocalPosition();
        const btnWorldPos = button.getTransform().getWorldPosition();
        print(`[LeaderboardExample] Button #${i+1} (${button.name}):`);
        print(`[LeaderboardExample]   Local: (${btnLocalPos.x}, ${btnLocalPos.y}, ${btnLocalPos.z})`);
        print(`[LeaderboardExample]   World: (${btnWorldPos.x}, ${btnWorldPos.y}, ${btnWorldPos.z})`);
      }
    }

    if (this.leaderboardButtons.length > 10) {
      print(`[LeaderboardExample] ... (${this.leaderboardButtons.length - 10} buttons omitted) ...`);

      for (let i = this.leaderboardButtons.length - 5; i < this.leaderboardButtons.length; i++) {
        const button = this.leaderboardButtons[i];
        if (button) {
          const btnLocalPos = button.getTransform().getLocalPosition();
          const btnWorldPos = button.getTransform().getWorldPosition();
          print(`[LeaderboardExample] Button #${i+1} (${button.name}):`);
          print(`[LeaderboardExample]   Local: (${btnLocalPos.x}, ${btnLocalPos.y}, ${btnLocalPos.z})`);
          print(`[LeaderboardExample]   World: (${btnWorldPos.x}, ${btnWorldPos.y}, ${btnWorldPos.z})`);
        }
      }
    } else if (this.leaderboardButtons.length > 5) {
      for (let i = numButtonsToLog; i < this.leaderboardButtons.length; i++) {
        const button = this.leaderboardButtons[i];
        if (button) {
          const btnLocalPos = button.getTransform().getLocalPosition();
          const btnWorldPos = button.getTransform().getWorldPosition();
          print(`[LeaderboardExample] Button #${i+1} (${button.name}):`);
          print(`[LeaderboardExample]   Local: (${btnLocalPos.x}, ${btnLocalPos.y}, ${btnLocalPos.z})`);
          print(`[LeaderboardExample]   World: (${btnWorldPos.x}, ${btnWorldPos.y}, ${btnWorldPos.z})`);
        }
      }
    }
    print(`[LeaderboardExample] `);

    // Keep width same as window size, adjust height to fit content
    const newDimensions = new vec2(currentDimensions.x, totalHeight);

    // Update scroll dimensions
    this.scrollWindow.scrollDimensions = newDimensions;

    // CRITICAL: Position GridLayout to work with ScrollWindow
    //
    // Analysis from logs:
    // - ScrollWindow world Y = -5, window shows Y = -21 to Y = 11 (32 units tall)
    // - When scrollPosition = 0: Scroller at Y = -5 (baseline)
    // - When scrollPosition increases: Scroller moves UP, content moves UP (out of view)
    // - GridLayout centers items around its position
    // - For totalHeight=266, buttons span from gridY+129.5 to gridY-129.5
    //
    // Goal: When scrollPosition = 0, show TOP entries (Button #1)
    // - Want Button #1 (local Y = +129.5 from GridLayout) at window top (world Y ≈ 11)
    // - Button #1 world Y = Scroller Y + GridLayout local Y + Button local Y
    // - 11 = -5 + GridLayout local Y + 129.5
    // - GridLayout local Y = 11 + 5 - 129.5 = -113.5
    //
    // More generally: GridLayout local Y = (windowSize.y / 2) - (totalHeight / 2)
    //
    const gridYPosition = (windowSize.y / 2) - (totalHeight / 2);
    const newGridPosition = new vec3(gridLocalPos.x, gridYPosition, gridLocalPos.z);
    gridObj.getTransform().setLocalPosition(newGridPosition);

    // Reset scroll to show top entries
    this.scrollWindow.scrollPosition = vec2.zero();

    // Log updated positions
    const newGridLocalPos = gridObj.getTransform().getLocalPosition();
    const newGridWorldPos = gridObj.getTransform().getWorldPosition();
    const newScrollPos = this.scrollWindow.scrollPosition;

    print(`[LeaderboardExample] --- AFTER UPDATE ---`);
    print(`[LeaderboardExample] GridLayout NEW Local Position: (${newGridLocalPos.x}, ${newGridLocalPos.y}, ${newGridLocalPos.z})`);
    print(`[LeaderboardExample] GridLayout NEW World Position: (${newGridWorldPos.x}, ${newGridWorldPos.y}, ${newGridWorldPos.z})`);
    print(`[LeaderboardExample] ScrollWindow NEW scrollDimensions: (${newDimensions.x}, ${newDimensions.y})`);
    print(`[LeaderboardExample] Calculated gridYPosition: ${gridYPosition} = (windowSize/2=${windowSize.y/2}) - (totalHeight/2=${totalHeight/2})`);
    print(`[LeaderboardExample] ScrollWindow NEW scrollPosition: (${newScrollPos.x}, ${newScrollPos.y})`);
    print(`[LeaderboardExample] ======================================`);
  }

  /**
   * Updates a button's text content with entry data
   * @param buttonObj The button scene object
   * @param entry The leaderboard entry data
   */
  private updateButtonContent(buttonObj: SceneObject, entry: { name: string, score: number, rank: number, isTestData: boolean }): void {
    const color = entry.isTestData ? this.testDataColor : this.regularColor;

    // Update Rank
    this.updateButtonText(buttonObj, "Rank", `#${entry.rank}`, color);

    // Update Name
    this.updateButtonText(buttonObj, "Name", entry.name, color);

    // Update Score
    const scoreText = entry.score > 0 ? entry.score.toString() : "---";
    this.updateButtonText(buttonObj, "Score", scoreText, color);
  }

  /**
   * Updates a specific text field in a button
   * @param parent Parent button object
   * @param fieldName Field name to update (Rank, Name, or Score)
   * @param textValue New text value
   * @param color Text color
   */
  private updateButtonText(parent: SceneObject, fieldName: string, textValue: string, color: vec4): void {
    const alternativeNames = this.fieldNameMaps[fieldName] || [fieldName];
    let updated = false;

    for (const altName of alternativeNames) {
      for (let i = 0; i < parent.getChildrenCount(); i++) {
        const child = parent.getChild(i);
        if (child.name === altName) {
          const textComponent = child.getComponent("Component.Text") as Text;
          if (textComponent) {
            textComponent.text = textValue;
            textComponent.textFill.color = color;
            this.debug && print(`[LeaderboardExample] Updated ${fieldName}: ${textValue}`);
            updated = true;
            break;
          }
        }
      }
      if (updated) break;
    }

    if (!updated) {
      this.debug && print(`[LeaderboardExample] WARNING: Could not find ${fieldName} text field`);
    }
  }

  /**
   * Updates the grid UI with current leaderboard entries
   * Dynamically adjusts grid size based on number of entries
   */
  private updateGridUI(): void {
    if (!this.gridLayout) {
      print("[LeaderboardExample] ERROR: GridLayout reference is missing!");
      return;
    }

    const entryCount = this.leaderboardEntries.length;
    // Show at least initialPlaceholderCount, or grow to fit entries
    const displayCount = Math.max(entryCount, this.initialPlaceholderCount);

    this.debug && print(`[LeaderboardExample] Updating UI with ${entryCount} entries (displaying ${displayCount} slots)`);

    // Recreate buttons if count changed
    if (this.leaderboardButtons.length !== displayCount) {
      this.createLeaderboardButtons(displayCount);
    }

    // Update button content
    for (let i = 0; i < this.leaderboardButtons.length; i++) {
      const buttonObj = this.leaderboardButtons[i];

      if (i < this.leaderboardEntries.length) {
        // Update with real entry data
        this.updateButtonContent(buttonObj, this.leaderboardEntries[i]);
      } else {
        // Show empty placeholder
        this.updateButtonContent(buttonObj, {
          name: "placeholder",
          score: 0,
          rank: i + 1,
          isTestData: false
        });
      }
    }

    // Re-layout the grid
    if (this.gridLayout.layout) {
      this.gridLayout.layout();
    }

    // Ensure ScrollWindow dimensions match current button count
    if (this.scrollWindow) {
      this.updateScrollWindowDimensions(this.leaderboardButtons.length);
    }
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
    leaderboardCreateOptions.ttlSeconds = 800000;
    leaderboardCreateOptions.orderingType = 1;

    this.leaderboardModule.getLeaderboard(
      leaderboardCreateOptions,
      (leaderboardInstance) => {
        print(`[LeaderboardExample] Successfully loaded leaderboard: "${this.leaderboardName}"`);
        this.currentLeaderboardInstance = leaderboardInstance;

        this.getLeaderboard();

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
   * Generates a random leaderboard name
   */
  private generateRandomLeaderboardName(): string {
    const randomAdj = this.adjectives[Math.floor(Math.random() * this.adjectives.length)];
    const randomNoun = this.nouns[Math.floor(Math.random() * this.nouns.length)];
    const randomNum = Math.floor(Math.random() * 1000);
    return `${randomAdj}_${randomNoun}_${randomNum}`;
  }

  /**
   * Returns the auto-generated score value
   */
  private getAutoScore(): number {
    return 10;
  }

  /**
   * Creates a new leaderboard or loads an existing one
   * @param generateNewName Whether to generate a new name
   * @param callback Optional callback function
   */
  createLeaderboard(generateNewName: boolean = true, callback?: () => void): void {
    if (generateNewName) {
      this.lastSubmittedScore = 0;
      this.leaderboardEntries = [];

      // Auto-generate random leaderboard name
      this.leaderboardName = this.generateRandomLeaderboardName();

      if (!this.createdLeaderboards.includes(this.leaderboardName)) {
        this.createdLeaderboards.push(this.leaderboardName);
      }

      print(`[LeaderboardExample] Using leaderboard: "${this.leaderboardName}"`);
    }

    const leaderboardCreateOptions = Leaderboard.CreateOptions.create();
    leaderboardCreateOptions.name = this.leaderboardName;
    leaderboardCreateOptions.ttlSeconds = 800000;
    leaderboardCreateOptions.orderingType = 1;

    this.leaderboardModule.getLeaderboard(
      leaderboardCreateOptions,
      (leaderboardInstance) => {
        print(`[LeaderboardExample] Successfully created leaderboard: "${this.leaderboardName}"`);
        this.currentLeaderboardInstance = leaderboardInstance;

        // Clear the UI when creating new leaderboard
        this.updateGridUI();

        if (callback) {
          callback();
        }
      },
      (status) => {
        print(`[LeaderboardExample] Failed to create leaderboard, status: ${status}`);
      }
    );
  }

  /**
   * Last submitted score value
   */
  public lastSubmittedScore: number = 0;

  /**
   * Submits a score to the current leaderboard
   */
  submitScore(): void {
    if (!this.currentLeaderboardInstance) {
      print("[LeaderboardExample] ERROR: No leaderboard loaded. Call createLeaderboard first.");
      return;
    }

    // Auto-generate score of 10
    const scoreValue = this.getAutoScore();

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
    retrievalOptions.usersLimit = 50;
    // Global returns all users (friends + non-friends)
    // We'll recalculate ranks to show 1, 2, 3... based on sorted scores
    retrievalOptions.usersType = Leaderboard.UsersType.Global;

    this.currentLeaderboardInstance.getLeaderboardInfo(
      retrievalOptions,
      (otherRecords, currentUserRecord) => {
        this.processLeaderboardData(otherRecords, currentUserRecord);
        this.updateGridUI();
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
      print(`[LeaderboardExample] User: ${userName}, Score: ${this.lastSubmittedScore}`);
      this.getLeaderboard();
    }
  }

  /**
   * Processes leaderboard data into UI format
   */
  private processLeaderboardData(otherRecords: any[], currentUserRecord: any): void {
    this.leaderboardEntries = [];

    // Collect all records first
    const allRecords: any[] = [];

    if (currentUserRecord && currentUserRecord.snapchatUser) {
      allRecords.push(currentUserRecord);
    }

    if (otherRecords && otherRecords.length > 0) {
      allRecords.push(...otherRecords);
    }

    // Sort by score (descending) first
    allRecords.sort((a, b) => (b.score || 0) - (a.score || 0));

    // Create entries with display rank (1, 2, 3, etc.) based on sorted order
    // Filter out test/mock data
    let rankCounter = 1;
    allRecords.forEach((record) => {
      if (record && record.snapchatUser) {
        const displayName = record.snapchatUser.displayName || "Unknown User";
        const isTestData = this.isTestDataName(displayName);

        // Skip test data entries
        if (isTestData) {
          this.debug && print(`[LeaderboardExample] Filtering out test data: ${displayName}`);
          return;
        }

        const score = (record === currentUserRecord && this.lastSubmittedScore > 0)
          ? this.lastSubmittedScore
          : (record.score || 0);

        this.leaderboardEntries.push({
          name: displayName,
          score: score,
          rank: rankCounter++, // Display rank, not global API rank
          isTestData: false
        });
      }
    });

    print(`[LeaderboardExample] Found ${this.leaderboardEntries.length} entries`);
    this.leaderboardEntries.forEach((entry) => {
      const testLabel = entry.isTestData ? " [TEST DATA]" : "";
      print(`#${entry.rank}: ${entry.name} - ${entry.score}${testLabel}`);
    });
  }

  /**
   * Helper method to identify test data names
   */
  private isTestDataName(name: string): boolean {
    if (!name) return false;

    const testNames = [
      "John Doe", "Jane Smith", "Mark Johnson", "Emily Brown",
      "Alex Wilson", "Sophia Miller", "Daniel Davis", "Olivia Taylor",
      "William Anderson", "Ella Martinez"
    ];

    for (const testName of testNames) {
      if (name.startsWith(testName)) {
        return true;
      }
    }

    return name.includes("Test") || name.includes("Mock") ||
      name.includes("Demo") || name.includes("Example");
  }

  /**
   * Clears all leaderboard items (for external use if needed)
   */
  public clearAllItems(): void {
    this.leaderboardEntries = [];
    this.updateGridUI();
  }
}

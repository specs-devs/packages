/**
 * Specs Inc. 2026
 * Grid content creator for leaderboard entries. Dynamically creates and manages leaderboard items
 * using GridLayout and prefab templates with support for rank, name, and score display.
 */
import { RectangleButton } from "SpectaclesUIKit.lspkg/Scripts/Components/Button/RectangleButton";
import { GridLayout } from "SpectaclesUIKit.lspkg/Scripts/Components/GridLayout/GridLayout";
@component
export class GridContentCreator extends BaseScriptComponent {
  /**
   * Reference to the GridLayout component that will contain the items
   */
  @input
  @hint("GridLayout component that will contain the leaderboard items")
  gridLayout: GridLayout;

  /**
   * The prefab template for leaderboard items
   * Should have RectangleButton on root and Rank/Name/Score Text children
   */
  @input
  @hint("Prefab with RectangleButton and Rank/Name/Score Text children")
  itemPrefab: ObjectPrefab;

  /**
   * Number of grid items to create and display
   */
  @input
  @hint("Number of leaderboard entries to display")
  itemsCount: number = 10;

  /**
   * Color for test data entries
   */
  @input
  @hint("Color for test data entries")
  testDataColor: vec4 = new vec4(1, 0.7, 0.7, 1);

  /**
   * Color for regular entries
   */
  @input
  @hint("Color for regular entries")
  regularColor: vec4 = new vec4(1, 1, 1, 1);

  /**
   * Enable debug logging
   */
  @input
  @hint("Enable debug logging")
  debug: boolean = false;

  /**
   * Internal references
   */
  private leaderboardItems: SceneObject[] = [];

  /**
   * Maps of alternative names for text components
   */
  private fieldNameMaps = {
    "Rank": ["Rank", "Position", "Placement", "RankText"],
    "Name": ["Name", "PlayerName", "NameText", "UserName"],
    "Score": ["Score", "ScoreText", "Points", "PointsText"]
  };

  onAwake(): void {
    this.debug && print("[GridContentCreator] Initializing grid content for leaderboard display");

    // Delay initialization to next frame to ensure GridLayout is ready
    const delayedEvent = this.createEvent("DelayedCallbackEvent");
    delayedEvent.bind(() => {
      this.createGridItems();
    });
    delayedEvent.reset(0.1);
  }

  /**
   * Creates the grid items from prefab
   */
  private createGridItems(): void {
    this.debug && print("[GridContentCreator] Creating grid items");

    if (!this.gridLayout) {
      print("[GridContentCreator] ERROR: GridLayout reference is missing!");
      return;
    }

    if (!this.itemPrefab) {
      print("[GridContentCreator] ERROR: Item prefab reference is missing!");
      return;
    }

    // Get the GridLayout's parent object
    const gridParent = this.gridLayout.getSceneObject();

    // Clear any existing items
    this.leaderboardItems.forEach(item => {
      if (item) {
        item.destroy();
      }
    });
    this.leaderboardItems = [];

    // Create new items from prefab
    for (let i = 0; i < this.itemsCount; i++) {
      // Instantiate prefab as child of GridLayout
      const item = this.itemPrefab.instantiate(gridParent);

      // Initialize the RectangleButton if it exists
      const button = item.getComponent(RectangleButton.getTypeName()) as RectangleButton;
      if (button) {
        // Initialize button if not already initialized
        if (typeof button.initialize === "function") {
          try {
            button.initialize();
          } catch (e) {
            // Button may already be initialized, that's okay
            this.debug && print(`[GridContentCreator] Button ${i+1} already initialized or initialization not needed`);
          }
        }
      }

      // Set default values
      this.updateItemWithEntry(item, {
        name: "---",
        score: 0,
        rank: i + 1,
        isTestData: false
      });

      // Store reference
      this.leaderboardItems.push(item);
      item.enabled = true;
    }

    // Initialize/re-layout the grid
    if (this.gridLayout.initialize) {
      this.gridLayout.initialize();
    }
    if (this.gridLayout.layout) {
      this.gridLayout.layout();
    }

    this.debug && print(`[GridContentCreator] Created ${this.leaderboardItems.length} leaderboard item slots`);
  }

  /**
   * Clears all leaderboard items, resetting them to default state
   */
  clearAllItems(): void {
    this.debug && print(`[GridContentCreator] Clearing all ${this.leaderboardItems.length} leaderboard items`);

    // Reset all items to default state
    for (let i = 0; i < this.leaderboardItems.length; i++) {
      const item = this.leaderboardItems[i];
      this.updateItemWithEntry(item, {
        name: "---",
        score: 0,
        rank: i + 1,
        isTestData: false
      });
    }

    this.debug && print(`[GridContentCreator] All leaderboard items cleared`);
  }

  /**
   * Updates the leaderboard UI with the provided entries
   * @param entries Array of leaderboard entries with name, score, and rank
   */
  updateLeaderboardEntries(entries: Array<{ name: string, score: number, rank: number, isTestData: boolean }>): void {
    this.debug && print(`[GridContentCreator] Updating UI with ${entries.length} leaderboard entries`);

    // Reset all items to default state first
    for (let i = 0; i < this.leaderboardItems.length; i++) {
      const item = this.leaderboardItems[i];
      this.updateItemWithEntry(item, {
        name: "---",
        score: 0,
        rank: i + 1,
        isTestData: false
      });
    }

    // Update items with entry data
    for (let i = 0; i < Math.min(entries.length, this.leaderboardItems.length); i++) {
      const entry = entries[i];
      const item = this.leaderboardItems[i];

      this.debug && print(`[GridContentCreator] Updating item ${i+1} with entry: rank=${entry.rank}, name=${entry.name}, score=${entry.score}`);
      this.updateItemWithEntry(item, entry);
    }
  }

  /**
   * Updates a single leaderboard item with entry data
   * @param item The item scene object to update
   * @param entry The leaderboard entry data
   */
  private updateItemWithEntry(item: SceneObject, entry: { name: string, score: number, rank: number, isTestData: boolean }): void {
    // Update Rank text
    this.updateItemText(item, "Rank", `#${entry.rank}`, entry.isTestData ? this.testDataColor : this.regularColor);

    // Update Name text
    this.updateItemText(item, "Name", entry.name, entry.isTestData ? this.testDataColor : this.regularColor);

    // Update Score text
    const scoreText = entry.score > 0 ? entry.score.toString() : "---";
    this.updateItemText(item, "Score", scoreText, entry.isTestData ? this.testDataColor : this.regularColor);
  }

  /**
   * Updates the text component in a child object with the specified name
   * @param parent Parent object containing the text component
   * @param baseChildName Base name of the child object with the text component
   * @param textValue New text value to set
   * @param color Color to set
   */
  private updateItemText(parent: SceneObject, baseChildName: string, textValue: string, color: vec4): void {
    // Get alternative names that might be used
    const alternativeNames = this.fieldNameMaps[baseChildName] || [baseChildName];
    let updated = false;

    // Try each alternative name
    for (const altName of alternativeNames) {
      // Find the child by name
      for (let i = 0; i < parent.getChildrenCount(); i++) {
        const child = parent.getChild(i);

        if (child.name === altName) {
          // Get the text component and update it
          const textComponent = child.getComponent("Component.Text") as Text;
          if (textComponent) {
            textComponent.text = textValue;
            textComponent.textFill.color = color;
            this.debug && print(`[GridContentCreator] Updated ${baseChildName} text (using name '${altName}'): ${textValue}`);
            updated = true;
            break;
          }
        }
      }

      if (updated) break;
    }

    // If we reach here and nothing was updated, no matching child was found
    if (!updated) {
      this.debug && print(`[GridContentCreator] WARNING: Could not find any child for ${baseChildName} (tried ${alternativeNames.join(", ")})`);
    }
  }
}

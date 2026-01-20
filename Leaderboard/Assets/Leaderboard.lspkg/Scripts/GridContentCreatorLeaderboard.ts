import { LeaderboardItemExample } from "./LeaderboardItemExample";

/**
 * This class is responsible for creating and positioning grid content items based on a specified prefab and item count.
 * It instantiates items and arranges them vertically for the leaderboard display.
 * Each item should have a LeaderboardItemExample component or three Text children: Position/Placement/Rank, Name, and Score.
 */
@component
export class GridContentCreator extends BaseScriptComponent {
  /**
   * The prefab object that will be instantiated for each grid item.
   * Should contain a LeaderboardItemExample component or three Text children: Position, Name, and Score.
   */
  @input
  @hint("The prefab object that will be instantiated for each grid item.")
  itemPrefab!: ObjectPrefab
  
  /**
   * Number of grid items to instantiate and display.
   */
  @input
  @hint("Number of grid items to instantiate and display.")
  itemsCount: number = 10
  
  /**
   * Vertical offset between items
   */
  @input
  @hint("Vertical offset between leaderboard items")
  verticalOffset: number = -5.4
  
  /**
   * Starting Y position for the first item
   */
  @input
  @hint("Starting Y position for the first item")
  startYPosition: number = 0
  
  /**
   * Color for test data entries
   */
  @input
  @hint("Color for test data entries")
  testDataColor: vec4 = new vec4(1, 0.7, 0.7, 1)
  
  /**
   * Color for regular entries
   */
  @input
  @hint("Color for regular entries")
  regularColor: vec4 = new vec4(1, 1, 1, 1)
  
  /**
   * Enable debug logging
   */
  @input
  @hint("Enable debug logging")
  debug: boolean = false
  
  /**
   * Store references to instantiated items for updating
   */
  private leaderboardItems: SceneObject[] = [];

  /**
   * Maps of alternative names that might be used for text components
   */
  private fieldNameMaps = {
    "Position": ["Position", "Placement", "Rank", "RankText"],
    "Name": ["Name", "PlayerName", "NameText", "UserName"],
    "Score": ["Score", "ScoreText", "Points", "PointsText"]
  };

  onAwake(): void {
    this.debug && print("[GridContentCreator] Initializing grid content for leaderboard display");
    this.createGridItems();
  }
  
  /**
   * Creates the initial grid items that will be updated with leaderboard data
   */
  private createGridItems(): void {
    this.debug && print("[GridContentCreator] Creating grid items for leaderboard display");
    
    // Clear any existing items
    this.leaderboardItems.forEach(item => {
      if (item) {
        item.destroy();
      }
    });
    this.leaderboardItems = [];
    
    // Create new items
    for (let i = 0; i < this.itemsCount; i++) {
      this.debug && print(`[GridContentCreator] Creating item ${i+1} of ${this.itemsCount}`);
      
      const item = this.itemPrefab.instantiate(this.getSceneObject());
      const screenTransform = item.getComponent("Component.ScreenTransform");
      screenTransform.offsets.setCenter(new vec2(0, this.startYPosition + this.verticalOffset * i));
      
      // Get all available script components
      const allComponents = item.getComponents("Component.ScriptComponent");
      let leaderboardItemComponent = null;
      
      // Find LeaderboardItemExample component
      for (let j = 0; j < allComponents.length; j++) {
        const comp = allComponents[j];
        if (comp.api && typeof comp.api.updateWithEntry === "function") {
          leaderboardItemComponent = comp;
          this.debug && print(`[GridContentCreator] Found LeaderboardItemExample component in item ${i+1}`);
          break;
        }
      }
      
      if (leaderboardItemComponent) {
        this.debug && print(`[GridContentCreator] Item ${i+1} has LeaderboardItemExample component, using it`);
        // Use the component's method to update the item with default values
        leaderboardItemComponent.api.updateWithEntry({
          name: "---",
          score: 0,
          rank: i + 1,
          isTestData: false
        });
      } else {
        this.debug && print(`[GridContentCreator] Item ${i+1} using direct child text update`);
        // Set default values directly on child text components
        this.updateItemText(item, "Position", `#${i + 1}`);
        this.updateItemText(item, "Name", "---");
        this.updateItemText(item, "Score", "---");
      }
      
      // Do a direct check for all required text components
      this.verifyItemTextComponents(item, i);
      
      // Store reference and enable the item
      this.leaderboardItems.push(item);
      item.enabled = true;
    }
    
    this.debug && print(`[GridContentCreator] Created ${this.leaderboardItems.length} leaderboard item slots`);
  }
  
  /**
   * Verifies that an item has all the required text components
   * @param item The item to check
   * @param index The item's index for logging
   */
  private verifyItemTextComponents(item: SceneObject, index: number): void {
    const baseFields = ["Position", "Name", "Score"];
    const foundFields = new Set<string>();
    
    // Check direct children
    for (let i = 0; i < item.getChildrenCount(); i++) {
      const child = item.getChild(i);
      
      // Check all possible field names
      for (const baseField of baseFields) {
        if (this.fieldNameMaps[baseField].includes(child.name)) {
          const textComponent = child.getComponent("Component.Text");
          if (textComponent) {
            foundFields.add(baseField);
            this.debug && print(`[GridContentCreator] Item ${index+1}: Found ${baseField} text component with name '${child.name}'`);
          } else {
            print(`[GridContentCreator] WARNING: Item ${index+1}: ${child.name} found but has no Text component`);
          }
        }
      }
    }
    
    // Check for missing fields
    const missingFields = baseFields.filter(field => !foundFields.has(field));
    if (missingFields.length > 0) {
      print(`[GridContentCreator] WARNING: Item ${index+1} is missing required text fields: ${missingFields.join(", ")}`);
    } else {
      this.debug && print(`[GridContentCreator] Item ${index+1} has all required text fields`);
    }
  }
  
  /**
   * Clears all leaderboard items, resetting them to default state
   */
  clearAllItems(): void {
    this.debug && print(`[GridContentCreator] Clearing all ${this.leaderboardItems.length} leaderboard items`);
    
    // Reset all items to default state
    for (let i = 0; i < this.leaderboardItems.length; i++) {
      const item = this.leaderboardItems[i];
      
      // Try to find LeaderboardItemExample component
      const allComponents = item.getComponents("Component.ScriptComponent");
      let leaderboardItemComponent = null;
      
      // Find LeaderboardItemExample component
      for (let j = 0; j < allComponents.length; j++) {
        const comp = allComponents[j];
        if (comp.api && typeof comp.api.updateWithEntry === "function") {
          leaderboardItemComponent = comp;
          break;
        }
      }
      
      if (leaderboardItemComponent) {
        // Use the component's method to reset the item
        leaderboardItemComponent.api.updateWithEntry({
          name: "---",
          score: 0,
          rank: i + 1,
          isTestData: false
        });
      } else {
        // Fallback to direct child update method
        this.updateItemText(item, "Position", `#${i + 1}`);
        this.updateItemText(item, "Name", "---");
        this.updateItemText(item, "Score", "---");
        this.setItemColor(item, this.regularColor);
      }
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
      
      // Try to find LeaderboardItemExample component
      const allComponents = item.getComponents("Component.ScriptComponent");
      let leaderboardItemComponent = null;
      
      // Find LeaderboardItemExample component
      for (let j = 0; j < allComponents.length; j++) {
        const comp = allComponents[j];
        if (comp.api && typeof comp.api.updateWithEntry === "function") {
          leaderboardItemComponent = comp;
          break;
        }
      }
      
      if (leaderboardItemComponent) {
        // Use the component's method to update the item
        leaderboardItemComponent.api.updateWithEntry({
          name: "---",
          score: 0,
          rank: i + 1,
          isTestData: false
        });
      } else {
        // Fallback to direct child update method
        this.updateItemText(item, "Position", `#${i + 1}`);
        this.updateItemText(item, "Name", "---");
        this.updateItemText(item, "Score", "---");
        this.setItemColor(item, this.regularColor);
      }
    }
    
    // Update items with entry data
    for (let i = 0; i < Math.min(entries.length, this.leaderboardItems.length); i++) {
      const entry = entries[i];
      const item = this.leaderboardItems[i];
      
      // Try to find LeaderboardItemExample component
      const allComponents = item.getComponents("Component.ScriptComponent");
      let leaderboardItemComponent = null;
      
      // Find LeaderboardItemExample component
      for (let j = 0; j < allComponents.length; j++) {
        const comp = allComponents[j];
        if (comp.api && typeof comp.api.updateWithEntry === "function") {
          leaderboardItemComponent = comp;
          break;
        }
      }
      
      if (leaderboardItemComponent) {
        // Use the component's method to update the item
        this.debug && print(`[GridContentCreator] Updating item ${i+1} using LeaderboardItemExample component`);
        leaderboardItemComponent.api.updateWithEntry(entry);
      } else {
        // Fallback to direct child update method
        this.debug && print(`[GridContentCreator] Updating item ${i+1} using direct text updates`);
        this.updateItemText(item, "Position", `#${entry.rank}`);
        this.updateItemText(item, "Name", entry.name);
        this.updateItemText(item, "Score", entry.score.toString());
        
        // Apply special color for test data
        if (entry.isTestData) {
          this.setItemColor(item, this.testDataColor);
        } else {
          this.setItemColor(item, this.regularColor);
        }
      }
    }
  }
  
  /**
   * Updates the text component in a child object with the specified name
   * @param parent Parent object containing the text component
   * @param baseChildName Base name of the child object with the text component
   * @param textValue New text value to set
   */
  private updateItemText(parent: SceneObject, baseChildName: string, textValue: string): void {
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
          const textComponent = child.getComponent("Component.Text");
          if (textComponent) {
            textComponent.text = textValue;
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
      print(`[GridContentCreator] WARNING: Could not find any child for ${baseChildName} (tried ${alternativeNames.join(", ")})`);
    }
  }
  
  /**
   * Sets the color for all text components in an item
   * @param parent Parent object containing the text components
   * @param color Color to set
   */
  private setItemColor(parent: SceneObject, color: vec4): void {
    for (let i = 0; i < parent.getChildrenCount(); i++) {
      const child = parent.getChild(i);
      const textComponent = child.getComponent("Component.Text");
      if (textComponent) {
        textComponent.textFill.color = color;
      }
    }
  }
}

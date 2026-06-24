/**
 * Specs Inc. 2026
 * Leaderboard item component for individual entries. Manages the display of rank, player name, and score
 * for a single leaderboard entry. Must be attached to prefab root with Position, Name, and Score text children.
 */
import { Logger } from "Utilities.lspkg/Scripts/Utils/Logger";
import { bindStartEvent, bindUpdateEvent, bindLateUpdateEvent, bindDestroyEvent } from "SnapDecorators.lspkg/decorators";

@component
export class LeaderboardItemExample extends BaseScriptComponent {
  /**
   * Reference to the Position text object
   * MUST be set in the Inspector or found by name
   * Will also search for alternative names: Position, Placement, Rank
   */
  @input
  @hint("Reference to the Position/Placement/Rank text object")
  positionText: SceneObject;
  
  /**
   * Reference to the Name text object
   * MUST be set in the Inspector or found by name
   */
  @input
  @hint("Reference to the Name text object")
  nameText: SceneObject;
  
  /**
   * Reference to the Score text object
   * MUST be set in the Inspector or found by name
   */
  @input
  @hint("Reference to the Score text object")
  scoreText: SceneObject;
  
  /**
   * Enable highlighting for test data
   */
  @input
  @hint("Enable highlighting for test data")
  highlightTestData: boolean = true;
  
  /**
   * Color to use for test data entries
   */
  @input
  @hint("Test data highlight color")
  testDataColor: vec4 = new vec4(1, 0.7, 0.7, 1);
  
  /**
   * Color to use for regular entries
   */
  @input
  @hint("Regular data color")
  regularColor: vec4 = new vec4(1, 1, 1, 1);
  
  /**
   * Debug mode for extra logging
   */
  @input
  @hint("Enable debug logging")
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

  
  // Maps of alternative names that might be used
  private fieldNameMaps = {
    "Position": ["Position", "Placement", "Rank", "RankText", "Place"],
    "Name": ["Name", "PlayerName", "NameText", "UserName", "User"],
    "Score": ["Score", "ScoreText", "Points", "PointsText", "Value"]
  };
  
  /**
   * Initializes the component and verifies the setup
   */
  onAwake(): void {
    // Initialize logger
    this.logger = new Logger("LeaderboardItemExample", this.enableLogging || this.enableLoggingLifecycle, true);
    
    if (this.enableLoggingLifecycle) {
      this.logger.debug("LIFECYCLE: onAwake() - Component initializing");
    }

    this.logger.debug("[LeaderboardItemExample] Initializing and verifying setup");
    this.verifySetup();
  }
  
  /**
   * Verifies that the component is properly set up
   */
  private verifySetup(): void {
    let allFound = true;
    
    // Check Position text
    if (!this.positionText) {
      this.logger.debug("[LeaderboardItemExample] Position text reference not set, will try to find by name");
      this.positionText = this.findTextComponentByNameAlternatives("Position");
      if (!this.positionText) {
        this.logger.debug("[LeaderboardItemExample] WARNING: Position/Placement/Rank text object not found");
        allFound = false;
      }
    }
    
    // Check Name text
    if (!this.nameText) {
      this.logger.debug("[LeaderboardItemExample] Name text reference not set, will try to find by name");
      this.nameText = this.findTextComponentByNameAlternatives("Name");
      if (!this.nameText) {
        this.logger.debug("[LeaderboardItemExample] WARNING: Name text object not found");
        allFound = false;
      }
    }
    
    // Check Score text
    if (!this.scoreText) {
      this.logger.debug("[LeaderboardItemExample] Score text reference not set, will try to find by name");
      this.scoreText = this.findTextComponentByNameAlternatives("Score");
      if (!this.scoreText) {
        this.logger.debug("[LeaderboardItemExample] WARNING: Score text object not found");
        allFound = false;
      }
    }
    
    if (allFound) {
      this.logger.debug("[LeaderboardItemExample] All required text objects found");
    } else {
      this.logger.debug("[LeaderboardItemExample] WARNING: Missing required text objects. Leaderboard item may not display correctly");
      
      // Print all available children for debugging purposes
      this.logger.debug("[LeaderboardItemExample] Available child objects:");
      for (let i = 0; i < this.getSceneObject().getChildrenCount(); i++) {
        const child = this.getSceneObject().getChild(i);
        const hasTextComp = child.getComponent("Component.Text") ? "with Text component" : "without Text component";
        this.logger.debug(`[LeaderboardItemExample] - Child ${i}: ${child.name} (${hasTextComp})`);
      }
    }
  }
  
  /**
   * Finds a text component by name with support for alternative names
   * @param baseName Base name to look for ("Position", "Name", or "Score")
   * @returns The found scene object or null
   */
  private findTextComponentByNameAlternatives(baseName: string): SceneObject {
    const alternatives = this.fieldNameMaps[baseName] || [baseName];
    
    // First try direct children
    for (const name of alternatives) {
      const obj = this.findChildByName(name);
      if (obj) {
        const textComp = obj.getComponent("Component.Text");
        if (textComp) {
          this.logger.debug(`[LeaderboardItemExample] Found '${baseName}' field with name '${name}'`);
          return obj;
        } else {
          this.logger.debug(`[LeaderboardItemExample] Found child named '${name}' but it has no Text component`);
          
          // Check if this child has a Text component in its children
          for (let i = 0; i < obj.getChildrenCount(); i++) {
            const grandChild = obj.getChild(i);
            const grandChildTextComp = grandChild.getComponent("Component.Text");
            if (grandChildTextComp) {
              this.logger.debug(`[LeaderboardItemExample] Found '${baseName}' field in grandchild of '${name}'`);
              return obj;  // Still return parent as reference
            }
          }
        }
      }
    }
    
    // Check for PinchButton structure specifically for Score
    if (baseName === "Score") {
      const pinchBtn = this.findChildByName("PinchButton");
      if (pinchBtn) {
        this.logger.debug(`[LeaderboardItemExample] Found PinchButton, checking for ${baseName} child`);
        // Check PinchButton's children for Score
        for (let i = 0; i < pinchBtn.getChildrenCount(); i++) {
          const pinchChild = pinchBtn.getChild(i);
          // Check if child name is in alternatives
          if (alternatives.includes(pinchChild.name)) {
            const textComp = pinchChild.getComponent("Component.Text");
            if (textComp) {
              this.logger.debug(`[LeaderboardItemExample] Found ${baseName} in PinchButton/`+
                                 `${pinchChild.name}`);
              return pinchChild;
            }
          }
        }
      }
    }
    
    // Try deeper search
    for (let i = 0; i < this.getSceneObject().getChildrenCount(); i++) {
      const child = this.getSceneObject().getChild(i);
      
      // Search within each child
      for (let j = 0; j < child.getChildrenCount(); j++) {
        const grandChild = child.getChild(j);
        if (alternatives.includes(grandChild.name)) {
          const textComp = grandChild.getComponent("Component.Text");
          if (textComp) {
            this.logger.debug(`[LeaderboardItemExample] Found nested '${baseName}' in `+
                               `${child.name}/${grandChild.name}`);
            return grandChild;
          }
        }
      }
    }
    
    return null;
  }
  
  /**
   * Finds a child by name
   * @param name Name of the child to find
   * @returns The found child or null
   */
  private findChildByName(name: string): SceneObject {
    for (let i = 0; i < this.getSceneObject().getChildrenCount(); i++) {
      const child = this.getSceneObject().getChild(i);
      if (child.name === name) {
        return child;
      }
    }
    return null;
  }
  
  /**
   * Updates this item with leaderboard entry data
   * @param entry Leaderboard entry data
   */
  updateWithEntry(entry: { name: string, score: number, rank: number, isTestData: boolean }): void {
    this.logger.debug(`[LeaderboardItemExample] Updating item with rank ${entry.rank}, name: ${entry.name}, score: ${entry.score}`);
    
    // Update position text
    if (this.positionText) {
      const positionTextComp = this.positionText.getComponent("Component.Text");
      if (positionTextComp) {
        positionTextComp.text = `#${entry.rank}`;
        this.logger.debug(`[LeaderboardItemExample] Updated position text: ${positionTextComp.text}`);
      } else {
        this.logger.debug(`[LeaderboardItemExample] ERROR: Position object has no Text component`);
      }
    } else {
      // Try to find position text by name in children
      if (!this.tryFindAndUpdateTextWithAlternatives("Position", `#${entry.rank}`)) {
        this.logger.debug(`[LeaderboardItemExample] ERROR: Failed to update position text, object not found`);
      }
    }
    
    // Update name text
    if (this.nameText) {
      const nameTextComp = this.nameText.getComponent("Component.Text");
      if (nameTextComp) {
        nameTextComp.text = entry.name;
        this.logger.debug(`[LeaderboardItemExample] Updated name text: ${nameTextComp.text}`);
      } else {
        this.logger.debug(`[LeaderboardItemExample] ERROR: Name object has no Text component`);
      }
    } else {
      // Try to find name text by name in children
      if (!this.tryFindAndUpdateTextWithAlternatives("Name", entry.name)) {
        this.logger.debug(`[LeaderboardItemExample] ERROR: Failed to update name text, object not found`);
      }
    }
    
    // Update score text
    const scoreValue = entry.score.toString();
    const scoreUpdateSuccess = this.updateScoreText(scoreValue);
    
    if (!scoreUpdateSuccess) {
      this.logger.debug(`[LeaderboardItemExample] CRITICAL: All attempts to update score text failed`);
    }
    
    // Apply highlighting for test data if enabled
    if (this.highlightTestData) {
      const color = entry.isTestData ? this.testDataColor : this.regularColor;
      this.setAllTextColors(color);
      
      if (entry.isTestData) {
        this.logger.debug(`[LeaderboardItemExample] Applied test data highlight color`);
      }
    }
  }
  
  /**
   * Last resort to update any Text component that we haven't already updated
   * @param fieldType Type of field we're trying to update (for logging)
   * @param value Value to update with
   */
  private updateAnyRemainingTextComponent(fieldType: string, value: string): boolean {
    const alreadyHandled = [this.positionText, this.nameText, this.scoreText];
    
    for (let i = 0; i < this.getSceneObject().getChildrenCount(); i++) {
      const child = this.getSceneObject().getChild(i);
      
      // Skip if we've already processed this object
      if (alreadyHandled.includes(child)) {
        continue;
      }
      
      const textComp = child.getComponent("Component.Text");
      if (textComp) {
        textComp.text = value;
        this.logger.debug(`[LeaderboardItemExample] EMERGENCY: Updated fallback text component in '${child.name}' with ${fieldType}: ${value}`);
        return true;
      }
    }
    
    return false;
  }
  
  /**
   * Tries to find a child by name (or alternative names) and update its text component
   * @param baseChildName Base name of the child to find ("Position", "Name", or "Score")
   * @param textValue Text value to set
   */
  private tryFindAndUpdateTextWithAlternatives(baseChildName: string, textValue: string): boolean {
    const alternatives = this.fieldNameMaps[baseChildName] || [baseChildName];
    
    for (const name of alternatives) {
      if (this.tryFindAndUpdateText(name, textValue)) {
        return true;
      }
    }
    
    return false;
  }
  
  /**
   * Tries to find a child by name and update its text component
   * @param childName Name of the child to find
   * @param textValue Text value to set
   */
  private tryFindAndUpdateText(childName: string, textValue: string): boolean {
    for (let i = 0; i < this.getSceneObject().getChildrenCount(); i++) {
      const child = this.getSceneObject().getChild(i);
      if (child.name === childName) {
        const textComp = child.getComponent("Component.Text");
        if (textComp) {
          textComp.text = textValue;
          this.logger.debug(`[LeaderboardItemExample] Updated ${childName} text by finding child: ${textValue}`);
          return true;
        } else {
          this.logger.debug(`[LeaderboardItemExample] Found child with name ${childName}, but it has no Text component`);
        }
      }
    }
    
    this.logger.debug(`[LeaderboardItemExample] Could not find ${childName} child with Text component`);
    return false;
  }
  
  /**
   * Special dedicated method for updating score text, with multiple fallback strategies
   * @param scoreValue The score value to set
   * @returns True if successful, false if all update attempts failed
   */
  private updateScoreText(scoreValue: string): boolean {
    this.logger.debug(`[LeaderboardItemExample] Trying to update score text to: ${scoreValue}`);
    
    // Strategy 1: Use direct reference if available
    if (this.scoreText) {
      const scoreTextComp = this.scoreText.getComponent("Component.Text");
      if (scoreTextComp) {
        scoreTextComp.text = scoreValue;
        this.logger.debug(`[LeaderboardItemExample] Updated score text via direct reference: ${scoreTextComp.text}`);
        return true;
      } else {
        this.logger.debug(`[LeaderboardItemExample] ERROR: Score object has no Text component, but will try its children`);
        
        // Check if the Score object has children with Text components
        for (let i = 0; i < this.scoreText.getChildrenCount(); i++) {
          const childObj = this.scoreText.getChild(i);
          const childTextComp = childObj.getComponent("Component.Text");
          if (childTextComp) {
            childTextComp.text = scoreValue;
            this.logger.debug(`[LeaderboardItemExample] Updated score text via child of scoreText: ${childObj.name}`);
            return true;
          }
          
          // Check one level deeper (for "PinchButton/Score" structure)
          for (let j = 0; j < childObj.getChildrenCount(); j++) {
            const grandChild = childObj.getChild(j);
            const grandChildTextComp = grandChild.getComponent("Component.Text");
            if (grandChildTextComp) {
              grandChildTextComp.text = scoreValue;
              this.logger.debug(`[LeaderboardItemExample] Updated score text via grandchild: ${childObj.name}/${grandChild.name}`);
              return true;
            }
          }
        }
      }
    } else {
      this.logger.debug(`[LeaderboardItemExample] No direct reference to score text component`);
    }
    
    // Strategy 2: Look for specific PinchButton/Score structure
    this.logger.debug(`[LeaderboardItemExample] Checking for PinchButton/Score structure...`);
    for (let i = 0; i < this.getSceneObject().getChildrenCount(); i++) {
      const child = this.getSceneObject().getChild(i);
      if (child.name === "PinchButton") {
        this.logger.debug(`[LeaderboardItemExample] Found PinchButton, checking for Score child...`);
        
        // Check for Score in PinchButton's children
        for (let j = 0; j < child.getChildrenCount(); j++) {
          const scoreChild = child.getChild(j);
          if (this.isScoreRelatedName(scoreChild.name)) {
            const textComp = scoreChild.getComponent("Component.Text");
            if (textComp) {
              textComp.text = scoreValue;
              this.logger.debug(`[LeaderboardItemExample] Updated score text via PinchButton/${scoreChild.name}`);
              return true;
            }
          }
        }
      }
    }
    
    // Strategy 3: Try to find by name alternatives
    this.logger.debug(`[LeaderboardItemExample] Trying to find score text by name alternatives`);
    if (this.tryFindAndUpdateTextWithAlternatives("Score", scoreValue)) {
      this.logger.debug(`[LeaderboardItemExample] Successfully updated score text via name alternatives`);
      return true;
    }
    
    // Strategy 4: Try to find text component in any child with "score" in the name (case insensitive)
    this.logger.debug(`[LeaderboardItemExample] Trying to find any child with 'score' in the name`);
    for (let i = 0; i < this.getSceneObject().getChildrenCount(); i++) {
      const child = this.getSceneObject().getChild(i);
      if (this.isScoreRelatedName(child.name)) {
        const textComp = child.getComponent("Component.Text");
        if (textComp) {
          textComp.text = scoreValue;
          this.logger.debug(`[LeaderboardItemExample] Updated score text via partial name match: ${child.name}`);
          return true;
        }
      }
      
      // Also check one level deeper in each child
      for (let j = 0; j < child.getChildrenCount(); j++) {
        const grandChild = child.getChild(j);
        if (this.isScoreRelatedName(grandChild.name)) {
          const textComp = grandChild.getComponent("Component.Text");
          if (textComp) {
            textComp.text = scoreValue;
            this.logger.debug(`[LeaderboardItemExample] Updated score text via nested child: ${child.name}/${grandChild.name}`);
            return true;
          }
        }
      }
    }
    
    // Strategy 5: Try to update any unused text component
    this.logger.debug(`[LeaderboardItemExample] Last resort: trying to update ANY remaining text component`);
    if (this.updateAnyRemainingTextComponent("Score", scoreValue)) {
      this.logger.debug(`[LeaderboardItemExample] Updated score using emergency fallback method`);
      return true;
    }
    
    // If we got here, all update strategies failed
    this.logger.debug(`[LeaderboardItemExample] ERROR: Failed to update score text, no suitable text component found`);
    return false;
  }
  
  /**
   * Helper method to check if a name is related to score
   * @param name The name to check
   * @returns True if name is related to score
   */
  private isScoreRelatedName(name: string): boolean {
    const lowerName = name.toLowerCase();
    return lowerName.includes("score") || 
           lowerName.includes("points") || 
           lowerName.includes("value") ||
           lowerName.includes("number") ||
           lowerName.includes("count") ||
           lowerName === "text"; // Sometimes generic "Text" is used for score
  }
  
  /**
   * Sets the color for all text components
   * @param color Color to apply
   */
  private setAllTextColors(color: vec4): void {
    // Try to use referenced text objects first
    const textObjects = [this.positionText, this.nameText, this.scoreText];
    
    // Apply color to referenced objects
    textObjects.forEach(textObj => {
      if (textObj) {
        const textComp = textObj.getComponent("Component.Text");
        if (textComp) {
          textComp.textFill.color = color;
        } else {
          // Check if object has children with Text components
          for (let i = 0; i < textObj.getChildrenCount(); i++) {
            const childTextComp = textObj.getChild(i).getComponent("Component.Text");
            if (childTextComp) {
              childTextComp.textFill.color = color;
            }
          }
        }
      }
    });
    
    // Check for PinchButton/Score structure specifically
    const pinchBtn = this.findChildByName("PinchButton");
    if (pinchBtn) {
      for (let i = 0; i < pinchBtn.getChildrenCount(); i++) {
        const pinchChild = pinchBtn.getChild(i);
        const childTextComp = pinchChild.getComponent("Component.Text");
        if (childTextComp && this.isScoreRelatedName(pinchChild.name)) {
          childTextComp.textFill.color = color;
          this.logger.debug(`[LeaderboardItemExample] Set color for PinchButton/${pinchChild.name}`);
        }
      }
    }
    
    // Always do a full scan to ensure all Text components get colored properly
    this.applyColorToAllTextComponentsRecursively(this.getSceneObject(), color);
  }
  
  /**
   * Recursively applies color to all text components in an object and its children
   * @param obj The object to scan
   * @param color The color to apply
   */
  private applyColorToAllTextComponentsRecursively(obj: SceneObject, color: vec4): void {
    // Apply to this object if it has a Text component
    const textComp = obj.getComponent("Component.Text");
    if (textComp) {
      textComp.textFill.color = color;
    }
    
    // Apply to all children recursively
    for (let i = 0; i < obj.getChildrenCount(); i++) {
      this.applyColorToAllTextComponentsRecursively(obj.getChild(i), color);
    }
  }
}

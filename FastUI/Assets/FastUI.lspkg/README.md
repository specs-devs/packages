![FastUI](../AssetImage/FastUI.png)

# FastUI

FastUI is a runtime UI generation framework for Spectacles that creates complex UI layouts programmatically without requiring prefabs. It provides powerful tools for generating grids, lists, and custom UI patterns using SpectaclesUIKit components, enabling dynamic content creation, drag-and-drop interactions, and responsive layouts that adapt to different screen configurations.

## Features

- **Runtime Grid Generation**: Create button grids with customizable rows, columns, and cell sizing
- **Programmatic UI Patterns**: Generate common UI patterns (modals, menus, galleries) from code
- **Drag-and-Drop Support**: Optional button rearrangement with interactive manipulation
- **Dynamic Content Updates**: Update button text, images, and callbacks at runtime
- **Auto-Sizing Frames**: Automatic Frame component sizing based on grid dimensions
- **Pattern Library**: Pre-built patterns including modals, action sheets, and settings menus
- **Content Layout System**: Automatic button content arrangement (image, title, subtitle)
- **Responsive Scaling**: Content automatically scales based on button size

## Quick Start

Create a 2x4 button grid at runtime:

```typescript
import { FastGrid } from "FastUI.lspkg/Scripts/FastGrid";

@component
export class MyUIManager extends BaseScriptComponent {
  @input gridComponent: FastGrid;

  onAwake() {
    // Grid generates automatically
    // Configure via Lens Studio inspector:
    // - rows: 2
    // - columns: 4
    // - buttonWidth: 10cm
    // - buttonHeight: 10cm
  }

  onStart() {
    // Customize buttons after generation
    this.gridComponent.updateButtonText(1, "Home", "Main menu");
    this.gridComponent.updateButtonText(2, "Settings", "Configure app");

    // Set button callbacks
    this.gridComponent.setButtonCallback(1, () => {
      print("Home button pressed!");
      this.showHomeScreen();
    });
  }

  private showHomeScreen() {
    // Your logic here
  }
}
```

## Script Highlights

- **FastGrid.ts**: Primary UI grid generator that creates runtime button grids with automatic layout. Handles Frame creation and configuration, GridLayout component management with row/column specifications, button instantiation with RectangleButton components, content layout (image + title + subtitle), and drag-and-drop functionality via InteractableManipulation. Provides public API for updating button text, images, and callbacks at runtime.

- **UIKitPatternGenerator.ts**: Pattern library for generating common UI layouts programmatically. Includes pre-built patterns like modal dialogs, action sheets, settings menus, content sections, and grid galleries. Supports multiple button types (Rectangle, Capsule, Round), Frame integration with auto-show-hide, and configurable layout parameters. All patterns are generated entirely from code without requiring prefabs.

- **ButtonContentLayout.ts**: Content arrangement system for buttons with image + text layout. Handles vertical stacking of image, title, and subtitle with configurable spacing, text alignment within layout rects, aspect-ratio-aware scaling for different button sizes, and automatic content positioning. Provides helpers for creating and updating button content dynamically.

- **GridRearrangement.ts**: Drag-and-drop grid interaction manager using InteractableManipulation. Detects drag start/end events, calculates drop position within grid cells, animates button repositions, and maintains grid layout integrity during rearrangement. Includes visual feedback for dragged buttons and snap-to-grid positioning.

## Core API Methods

### Grid Generation

```typescript
// Generate grid (called automatically on awake)
generateGrid(): void

// Clear existing grid
clearGrid(): void

// Update grid size after parameter changes
updateGridSize(): void

// Get calculated grid dimensions
getGridSize(): vec2
```

### Button Access

```typescript
// Get specific button (1-based index)
getButton(index: number): RectangleButton

// Get all buttons
getButtons(): RectangleButton[]
```

### Button Customization

```typescript
// Update button text
updateButtonText(
  index: number,
  title?: string,
  subtitle?: string
): void

// Update button image
updateButtonImage(
  index: number,
  texture?: Texture,
  material?: Material
): void

// Set button callback
setButtonCallback(
  index: number,
  callback: () => void
): void
```

## Advanced Usage

### Dynamic Content Grid

Create a grid that populates from data:

```typescript
@component
export class ContentGrid extends BaseScriptComponent {
  @input gridComponent: FastGrid;
  @input itemTextures: Texture[];
  @input itemNames: string[];

  async onStart() {
    // Wait for grid generation
    await this.delay(300);

    // Populate grid with data
    const buttons = this.gridComponent.getButtons();
    for (let i = 0; i < Math.min(buttons.length, this.itemTextures.length); i++) {
      const index = i + 1; // 1-based index

      // Set content
      this.gridComponent.updateButtonText(
        index,
        this.itemNames[i],
        `Item ${index}`
      );

      this.gridComponent.updateButtonImage(
        index,
        this.itemTextures[i]
      );

      // Set callback
      this.gridComponent.setButtonCallback(index, () => {
        this.onItemSelected(index, this.itemNames[i]);
      });
    }
  }

  private onItemSelected(index: number, name: string) {
    print(`Selected: ${name} (index ${index})`);
  }

  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => {
      const event = this.createEvent("DelayedCallbackEvent");
      event.bind(() => resolve());
      event.reset(ms / 1000);
    });
  }
}
```

### Interactive Menu System

Build a hierarchical menu:

```typescript
@component
export class MenuSystem extends BaseScriptComponent {
  @input mainGrid: FastGrid;
  @input subMenuGrid: FastGrid;

  private currentMenu: string = "main";

  onAwake() {
    this.setupMainMenu();
    this.subMenuGrid.getFrame().hideVisual();
  }

  private setupMainMenu() {
    const menuItems = [
      {title: "Play", subtitle: "Start game", action: () => this.showGameModes()},
      {title: "Settings", subtitle: "Configure", action: () => this.showSettings()},
      {title: "Store", subtitle: "Buy items", action: () => this.showStore()},
      {title: "Profile", subtitle: "Your stats", action: () => this.showProfile()}
    ];

    menuItems.forEach((item, index) => {
      this.mainGrid.updateButtonText(index + 1, item.title, item.subtitle);
      this.mainGrid.setButtonCallback(index + 1, item.action);
    });
  }

  private showGameModes() {
    this.currentMenu = "gameModes";
    this.mainGrid.getFrame().hideVisual();
    this.subMenuGrid.getFrame().showVisual();

    // Setup sub-menu
    const modes = ["Solo", "Co-op", "versus", "Tournament"];
    modes.forEach((mode, index) => {
      this.subMenuGrid.updateButtonText(index + 1, mode, "");
      this.subMenuGrid.setButtonCallback(index + 1, () => {
        print(`Starting ${mode} mode`);
        this.startGame(mode);
      });
    });

    // Add back button
    const lastIndex = modes.length + 1;
    this.subMenuGrid.updateButtonText(lastIndex, "Back", "Return");
    this.subMenuGrid.setButtonCallback(lastIndex, () => this.showMainMenu());
  }

  private showMainMenu() {
    this.currentMenu = "main";
    this.subMenuGrid.getFrame().hideVisual();
    this.mainGrid.getFrame().showVisual();
  }

  private showSettings() {
    print("Showing settings");
  }

  private showStore() {
    print("Showing store");
  }

  private showProfile() {
    print("Showing profile");
  }

  private startGame(mode: string) {
    print(`Starting game in ${mode} mode`);
  }
}
```

### Drag-and-Drop Grid

Enable interactive grid rearrangement:

```typescript
@component
export class RearrangeableGrid extends BaseScriptComponent {
  @input gridComponent: FastGrid;

  onAwake() {
    // Enable draggable in Lens Studio inspector:
    // draggable: true

    // Buttons can now be dragged and rearranged
    // Grid automatically handles:
    // - Drag detection
    // - Position calculation
    // - Smooth reordering animation
    // - Grid layout updates
  }

  onStart() {
    // Listen for button interactions
    const buttons = this.gridComponent.getButtons();
    buttons.forEach((button, index) => {
      button.onTriggerUp.add(() => {
        print(`Button ${index + 1} at position: ${this.getButtonPosition(button)}`);
      });
    });
  }

  private getButtonPosition(button: RectangleButton): string {
    const pos = button.getSceneObject().getTransform().getLocalPosition();
    return `(${pos.x.toFixed(1)}, ${pos.y.toFixed(1)})`;
  }
}
```

### Custom Button Content

Create buttons with custom layouts:

```typescript
@component
export class CustomButtonGrid extends BaseScriptComponent {
  @input gridComponent: FastGrid;
  @input iconTextures: Texture[];
  @input iconMaterial: Material;

  async onStart() {
    await this.delay(300);

    const buttons = this.gridComponent.getButtons();

    // Create custom content for each button
    for (let i = 0; i < buttons.length; i++) {
      const index = i + 1;

      // Set unique icon
      if (i < this.iconTextures.length) {
        this.gridComponent.updateButtonImage(
          index,
          this.iconTextures[i],
          this.iconMaterial
        );
      }

      // Set dynamic text based on app state
      const itemCount = this.getItemCount(index);
      this.gridComponent.updateButtonText(
        index,
        `Category ${index}`,
        `${itemCount} items`
      );

      // Dynamic callback based on content
      this.gridComponent.setButtonCallback(index, () => {
        this.showCategory(index, itemCount);
      });
    }
  }

  private getItemCount(categoryId: number): number {
    // Fetch from your data source
    return Math.floor(Math.random() * 50) + 1;
  }

  private showCategory(categoryId: number, itemCount: number) {
    print(`Category ${categoryId} has ${itemCount} items`);
  }

  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => {
      const event = this.createEvent("DelayedCallbackEvent");
      event.bind(() => resolve());
      event.reset(ms / 1000);
    });
  }
}
```

### Runtime Pattern Generation

Use UIKitPatternGenerator for pre-built patterns:

```typescript
import { UIKitPatternGenerator } from "FastUI.lspkg/Scripts/UIKitPatternGenerator";

@component
export class PatternDemo extends BaseScriptComponent {
  @input patternGenerator: UIKitPatternGenerator;

  onAwake() {
    // Configure in inspector:
    // patternType: "modal_dialog"
    // frameAppearance: "Large"
    // frameAutoShowHide: true

    // Pattern generates automatically
  }

  changePattern(newPattern: string) {
    // Dynamically change pattern
    (this.patternGenerator as any).patternType = newPattern;
    this.patternGenerator.generatePattern();
  }

  showModalDialog() {
    this.changePattern("modal_dialog");
  }

  showSettingsMenu() {
    this.changePattern("settings_menu");
  }

  showGridGallery() {
    this.changePattern("grid_gallery");
  }
}
```

### Responsive Grid Sizing

Adapt grid to different content amounts:

```typescript
@component
export class ResponsiveGrid extends BaseScriptComponent {
  @input gridComponent: FastGrid;

  private contentCount: number = 12;

  onAwake() {
    this.adjustGridSize();
  }

  private adjustGridSize() {
    // Calculate optimal grid dimensions
    const cols = Math.ceil(Math.sqrt(this.contentCount));
    const rows = Math.ceil(this.contentCount / cols);

    // Update grid parameters
    (this.gridComponent as any).rows = rows;
    (this.gridComponent as any).columns = cols;

    // Regenerate grid
    this.gridComponent.generateGrid();

    // Update content
    this.populateGrid();
  }

  private populateGrid() {
    for (let i = 1; i <= this.contentCount; i++) {
      this.gridComponent.updateButtonText(i, `Item ${i}`, `#${i}`);
      this.gridComponent.setButtonCallback(i, () => {
        this.selectItem(i);
      });
    }
  }

  private selectItem(index: number) {
    print(`Item ${index} selected`);
  }

  // Call this to change content count
  updateContentCount(newCount: number) {
    this.contentCount = newCount;
    this.gridComponent.clearGrid();
    this.adjustGridSize();
  }
}
```

## UI Pattern Types

UIKitPatternGenerator includes these pre-built patterns:

### Custom UI Examples
- **Simple Grid 2x2/3x3/4x4**: Basic square grids
- **Card Grid with Icons**: Grid with image+text buttons
- **Vertical Menu List**: Stacked menu options

### Horizon OS Patterns
- **Modal Dialog**: Title bar with action buttons
- **Content Section with Buttons**: Title + horizontal button row
- **Image Content Section**: Title + image grid + close button
- **Settings Menu**: Vertical list of settings options
- **Action Sheet**: Title + stacked action buttons
- **Grid Gallery**: 4x4 image gallery grid

## Configuration Options

### FastGrid Parameters

```typescript
// Grid dimensions
rows: number = 2;
columns: number = 4;

// Button sizing (cm)
buttonWidth: number = 10;
buttonHeight: number = 10;

// Content
buttonImageTexture: Texture | null;
buttonImageMaterial: Material | null;

// Interaction
draggable: boolean = false;
```

### Frame Configuration

```typescript
frameAppearance: "Small" | "Large"
frameAutoShowHide: boolean
showCloseButton: boolean
frameFollowing: boolean
```

### Button Styles

- PrimaryNeutral (default)
- Primary
- Secondary
- Special
- Ghost

## Performance Considerations

- **Generation Time**: Grid generation takes ~200ms (automatic delay included)
- **Button Limit**: Recommended max 50 buttons for performance
- **Update Cost**: Button text/image updates are instant
- **Drag Performance**: Drag-and-drop adds interaction overhead
- **Memory**: Each button ~500 bytes + content assets

## Best Practices

1. **Generate Once**: Clear and regenerate grid only when necessary
2. **Delay Updates**: Wait 200-300ms after generation before updating content
3. **Batch Updates**: Group button updates together for efficiency
4. **Asset Management**: Reuse textures and materials across buttons
5. **Grid Size**: Keep grids under 6x8 for optimal performance

## Limitations

- **No Nested Grids**: Cannot nest FastGrid components
- **Fixed Layouts**: GridLayout only, no custom positioning within cells
- **Button Types**: FastGrid only supports RectangleButton
- **Runtime Properties**: Some button properties (style, audio) cannot change at runtime
- **Frame Following**: Following behavior controlled by Frame component

---

Built with 👻 by the Spectacles team


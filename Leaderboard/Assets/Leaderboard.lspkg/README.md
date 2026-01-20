# Leaderboard System for Snapchat Spectacles

This folder contains a comprehensive leaderboard implementation for Snapchat Spectacles applications. The system allows you to create, display, and manage leaderboards with support for both real user data and test data.


## Overview

The Leaderboard system provides a complete solution for:
- Creating and retrieving leaderboards by name
- Submitting scores from users
- Displaying leaderboard entries with customizable UI
- Supporting both global and friends leaderboards
- Visual distinction between test data and real user data

## Files and Components

- **LeaderboardExample.ts**: Main manager for leaderboard operations
- **LeaderboardItemExample.ts**: Component for individual leaderboard entry prefabs
- **GridContentCreatorLeaderboard.ts**: Handles creating and positioning grid items
- **LeaderboardDemo.ts**: Demo controller connecting UI buttons to leaderboard functionality

## Quick Setup

1. Add the `LeaderboardModule` to your project
2. Create a prefab for leaderboard items with the following structure:
   ```
   LeaderboardItem (root object with ScreenTransform and LeaderboardItemExample component)
   ├── Position/Placement/Rank (child with Text component)
   ├── Name (child with Text component)
   └── Score (child with Text component)
   ```
   * Note: The Score text can also be nested in another object (e.g., PinchButton/Score)
3. Add reference to the LeaderboardExample component in your UI scene
4. Connect UI buttons to the LeaderboardExample functions

## Usage Guide

### Creating a Leaderboard

```typescript
// Create a leaderboard with name "MY_LEADERBOARD"
leaderboardExample.leaderboardName = "MY_LEADERBOARD";
leaderboardExample.createLeaderboard();
```

The leaderboard is uniquely identified by the combination of your Lens ID and the leaderboard name. If a leaderboard with this name already exists, it will be retrieved instead of creating a new one.

### Submitting Scores

```typescript
// Submit a score of 500
leaderboardExample.scoreToSubmit = 500;
leaderboardExample.submitScore();

// Submit a random score
leaderboardExample.scoreToSubmit = -1; // Uses random score
leaderboardExample.submitScore();
```

### Retrieving and Displaying Leaderboard Data

```typescript
// Get and display the leaderboard
leaderboardExample.getLeaderboard();
```

## Customization Options

### LeaderboardExample Component

| Property | Description |
|----------|-------------|
| `leaderboardName` | Name of the leaderboard to create/retrieve |
| `scoreToSubmit` | Score to submit (-1 for random score) |
| `gridContentCreator` | Reference to the grid content creator |

### LeaderboardItemExample Component

| Property | Description |
|----------|-------------|
| `positionText` | Reference to the Position/Rank text object |
| `nameText` | Reference to the Name text object |
| `scoreText` | Reference to the Score text object |
| `highlightTestData` | Whether to highlight test data entries |
| `testDataColor` | Color to use for test data entries |
| `regularColor` | Color to use for regular entries |
| `debug` | Enable debug logging |

### GridContentCreator Component

| Property | Description |
|----------|-------------|
| `itemPrefab` | The prefab used for leaderboard items |
| `itemsCount` | Number of items to display |
| `verticalOffset` | Vertical spacing between items |
| `startYPosition` | Starting Y position for the first item |

## Advanced Features

### Support for Multiple Text Field Names

The system supports multiple alternative names for text fields:

```typescript
// Position field names
"Position", "Placement", "Rank", "RankText", "Place"

// Name field names
"Name", "PlayerName", "NameText", "UserName", "User"

// Score field names
"Score", "ScoreText", "Points", "PointsText", "Value"
```

### Nested Text Components

The system can find and update text components that are nested within other objects. For example, if your "Score" text is inside another object like "PinchButton":

```
LeaderboardItem
├── Position
├── Name
└── PinchButton
    └── Score
```

### Test Data Detection

The system automatically detects test data based on common test names or patterns:

- Names like "John Doe", "Jane Smith", etc.
- Names containing words like "Test", "Mock", "Demo", "Example"

Test data will be visually distinct (if `highlightTestData` is enabled) to help differentiate between real and test data during development.

## Important Notes

### Testing and Development

- In the Lens Studio preview, the leaderboard will display test data with mock users to help visualize the UI.
- Your submitted score will be associated with "Snap User" in the development environment.
- **Real user data will only appear when the lens is published and used on actual Spectacles devices.**

### Privacy

- Leaderboards protect user privacy and require each user to opt in to share scores.
- Users must explicitly consent to sharing their data on the leaderboard.

### Limitations

- You can only submit scores for the current user (the person wearing the Spectacles).
- You cannot manually add or remove participants from the leaderboard.
- Leaderboards are uniquely identified by name within a lens, so use distinct names for separate leaderboards.
- Leaderboard data will reset after the time specified by `ttlSeconds` (default is ~9 days).

## Troubleshooting

### Score Not Displaying

If the score isn't displaying properly:

1. Check that the Score text object exists and has a Text component
2. Verify the name of your Score text object matches one of the supported alternatives
3. If using a nested structure, ensure the Score text is correctly referenced
4. Enable `debug` mode on the LeaderboardItemExample component for detailed logs

### Leaderboard Not Updating

1. Make sure to call `createLeaderboard()` before `submitScore()` or `getLeaderboard()`
2. Check the console for error messages
3. Verify that the GridContentCreator component is properly connected

## API Reference

For complete API documentation, refer to the [Snapchat Spectacles Leaderboard API Guide](https://docs.snap.com/spectacles-api/docs/leaderboard).
 
